// src/inngest/functions/process-registration.ts
//
// The "Resilient Worker" -- the core of the high-concurrency seat-claim flow.
//
// Execution model:
//   Step 1  claimSeat          -- atomic Prisma transaction; decides CONFIRMED vs WAITLISTED
//   Step 2  confirmRegistration -- persists the final Registration record
//   Step 3  sendConfirmation   -- calls downstream notification service; retried automatically
//
// Inngest guarantees at-least-once delivery and durably checkpoints each
// step.run() boundary, so a cold-start or transient DB blip between steps
// will NOT result in a double-charge or a lost registration.

import { NonRetriableError } from "inngest";
import { Prisma, RegistrationStatus } from "@prisma/client";
import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { trackRequestEvent } from "@/lib/metrics";
import { sendConfirmedEmail, sendWaitlistedEmail } from "@/lib/email";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SeatClaimResult =
  | {
      outcome: "CONFIRMED";
      eventTitle: string;
      eventDate: string | null;
      location:  string | null;
      meetingUrl: string | null;
      isVirtual:  boolean;
    }
  | { outcome: "WAITLISTED"; eventTitle: string };

type UserInfo = { email: string; name: string | null; };

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const processRegistration = inngest.createFunction(
  {
    id: "process-registration",
    name: "Process Event Registration",

    // Concurrency: at most 5 workers per eventId run simultaneously.
    // (Inngest free plan limit; upgrade to increase.)
    concurrency: {
      limit: 5,
      key: "event.data.eventId",
    },

    // Inngest retry policy: 4 attempts with exponential back-off.
    // Individual steps that throw will only re-run from THAT step forward,
    // preserving previously completed step results.
    retries: 4,
  },
  { event: "event/registration.requested" },

  async ({ event, step, logger }) => {
    const { userId, eventId, requestedAt } = event.data;

    logger.info("Processing registration", { userId, eventId, requestedAt });

    // -----------------------------------------------------------------------
    // Step 1 -- Atomic seat claim
    //
    // Uses a Prisma interactive transaction to:
    //   a) Decrement availableSeats WHERE availableSeats > 0   (optimistic lock)
    //   b) Decide CONFIRMED or WAITLISTED based on update count
    //
    // Wrapping in step.run() means Inngest checkpoints the result so a
    // subsequent cold start never re-runs this step.
    // -----------------------------------------------------------------------

    // Fetch user info (email + name) for notification — cached in this step.
    const userInfo = await step.run(
      "fetch-user-info",
      async (): Promise<UserInfo> => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (!user?.email) {
          throw new NonRetriableError(`User ${userId} not found or has no email.`);
        }
        return { email: user.email, name: user.name ?? "there" };
      }
    );

    const claimResult = await step.run(
      "claim-seat",
      async (): Promise<SeatClaimResult> => {
        return prisma.$transaction(async (tx) => {
          // Attempt atomic decrement -- only succeeds when a seat is free.
          const updated = await tx.event.updateMany({
            where: {
              id: eventId,
              availableSeats: { gt: 0 },
              isPublished: true,
            },
            data: { availableSeats: { decrement: 1 } },
          });

          if (updated.count === 0) {
            const event = await tx.event.findUnique({
              where: { id: eventId },
              select: { title: true, isPublished: true },
            });
            if (!event) {
              throw new NonRetriableError(`Event ${eventId} not found or unpublished.`);
            }
            return { outcome: "WAITLISTED", eventTitle: event.title };
          }

          const updatedEvent = await tx.event.findUniqueOrThrow({
            where: { id: eventId },
            select: {
              title: true, startsAt: true, location: true,
              meetingUrl: true, isVirtual: true,
            },
          });

          return {
            outcome:    "CONFIRMED",
            eventTitle: updatedEvent.title,
            eventDate:  updatedEvent.startsAt.toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            }),
            location:   updatedEvent.location,
            meetingUrl: updatedEvent.meetingUrl,
            isVirtual:  updatedEvent.isVirtual,
          };
        });
      }
    );

    // -----------------------------------------------------------------------
    // Step 2 -- Persist the Registration record
    // -----------------------------------------------------------------------

    const registration = await step.run(
      "persist-registration",
      async () => {
        const status: RegistrationStatus =
          claimResult.outcome === "CONFIRMED"
            ? RegistrationStatus.CONFIRMED
            : RegistrationStatus.WAITLISTED;

        try {
          // upsert handles the edge case where a previous partial run already
          // created a PENDING record via a separate pathway.
          return await prisma.registration.upsert({
            where: { userId_eventId: { userId, eventId } },
            create: { userId, eventId, status },
            update: { status },
          });
        } catch (err) {
          // P2002: unique constraint violation -- another concurrent worker
          // already confirmed this user.  Restore the seat we decremented
          // and stop processing (non-retriable).
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002" &&
            claimResult.outcome === "CONFIRMED"
          ) {
            logger.warn(
              "Duplicate registration detected after seat claim -- restoring seat.",
              { userId, eventId }
            );

            await prisma.event.update({
              where: { id: eventId },
              data: { availableSeats: { increment: 1 } },
            });

            throw new NonRetriableError(
              `Duplicate registration for user=${userId} event=${eventId}. Seat restored.`
            );
          }

          // Any other DB error is retriable -- re-throw so Inngest backs off.
          void trackRequestEvent("FAILED");
          throw err;
        }
      }
    );

    // If the user was waitlisted, send waitlist email and exit early.
    if (claimResult.outcome === "WAITLISTED") {
      await step.run("send-waitlist-email", async () => {
        await sendWaitlistedEmail({
          to:         userInfo.email,
          name:       userInfo.name ?? "there",
          eventTitle: claimResult.eventTitle,
        });
      });

      await inngest.send({
        name: "event/registration.waitlisted",
        data: { userId, eventId },
      });

      logger.info("User waitlisted — waitlist email dispatched.", { userId, eventId });
      return { status: "WAITLISTED", registrationId: registration.id };
    }

    // -----------------------------------------------------------------------
    // Step 3 -- Send confirmation email via Resend
    //
    // Isolated in its own step so that a Resend outage does NOT
    // cause a seat to be re-decremented on retry — only this step re-runs.
    // -----------------------------------------------------------------------

    await step.run("send-confirmation-email", async () => {
      const confirmed = claimResult as Extract<SeatClaimResult, { outcome: "CONFIRMED" }>;
      await sendConfirmedEmail({
        to:             userInfo.email,
        name:           userInfo.name ?? "there",
        eventTitle:     confirmed.eventTitle,
        eventDate:      confirmed.eventDate ?? undefined,
        location:       confirmed.location  ?? undefined,
        meetingUrl:     confirmed.meetingUrl ?? undefined,
        isVirtual:      confirmed.isVirtual,
        registrationId: registration.id,
      });
    });

    // Emit a typed downstream event for analytics, webhooks, etc.
    await step.run("emit-confirmed-event", async () => {
      await inngest.send({
        name: "event/registration.confirmed",
        data: {
          registrationId: registration.id,
          userId,
          eventId,
        },
      });
    });

    logger.info("Registration completed successfully.", {
      userId,
      eventId,
      registrationId: registration.id,
    });

    return { status: "CONFIRMED", registrationId: registration.id };
  }
);

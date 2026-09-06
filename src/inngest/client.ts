// src/inngest/client.ts
//
// Singleton Inngest client.  Import this everywhere you need to send
// events or reference function definitions -- never instantiate Inngest
// more than once per process.

import { EventSchemas, Inngest } from "inngest";

// ---------------------------------------------------------------------------
// Typed event catalogue
// Extending this union keeps every send() and trigger() call type-safe.
// ---------------------------------------------------------------------------

type RegistrationRequestedEvent = {
  name: "event/registration.requested";
  data: {
    userId: string;
    eventId: string;
    /** ISO-8601 timestamp set by the API route for observability / SLA checks */
    requestedAt: string;
  };
};

type RegistrationConfirmedEvent = {
  name: "event/registration.confirmed";
  data: {
    registrationId: string;
    userId: string;
    eventId: string;
  };
};

type RegistrationWaitlistedEvent = {
  name: "event/registration.waitlisted";
  data: {
    userId: string;
    eventId: string;
  };
};

/**
 * Built-in Inngest system event fired automatically when a function
 * exhausts all its retries. Used by the alerting worker.
 */
type InngestFunctionFailedEvent = {
  name: "inngest/function.failed";
  data: {
    function_id: string;
    run_id: string;
    error: {
      name: string;
      message: string;
      stack: string;
    };
    event: {
      name: string;
      data: Record<string, unknown>;
    };
  };
};

/**
 * Union of all domain events.
 * Add new event shapes here as the platform grows.
 */
export type Events =
  | RegistrationRequestedEvent
  | RegistrationConfirmedEvent
  | RegistrationWaitlistedEvent
  | InngestFunctionFailedEvent;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export const inngest = new Inngest({
  id: "event-registration-platform",
  schemas: new EventSchemas().fromUnion<Events>(),
});

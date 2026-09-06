// src/app/api/users/find-or-create/route.ts
//
// Stateless user identity endpoint.
//
// The registration UI calls this before hitting /api/registrations so that
// it can obtain a stable CUID for the user based on their email address.
// This avoids requiring full OAuth sign-in for the demo flow while still
// producing valid CUIDs that satisfy the Prisma schema.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  name:  z.string().min(1, "Name is required.").max(120),
  email: z.string().email("A valid email is required.").max(255),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { name, email } = parsed.data;

  try {
    // upsert: find existing user by email (unique) or create a new record.
    // We deliberately don't overwrite emailVerified or sessions.
    const user = await prisma.user.upsert({
      where:  { email },
      update: { name },
      create: { name, email },
      select: { id: true },
    });

    return NextResponse.json({ userId: user.id });
  } catch (err) {
    console.error("[users/find-or-create] DB error:", err);
    return NextResponse.json(
      { error: "Failed to set up your account. Please try again." },
      { status: 500 }
    );
  }
}
// src/app/api/auth/signup/route.ts
//
// Creates a new user account with a bcrypt-hashed password.
// Email/password accounts default to ATTENDEE role; set role:"ORGANIZER"
// in the request body to create an organizer account.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SignupSchema = z.object({
  name:     z.string().min(1, "Name is required.").max(120),
  email:    z.string().email("A valid email is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role:     z.enum(["ATTENDEE", "ORGANIZER"]).default("ATTENDEE"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, password: hashed, role },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}

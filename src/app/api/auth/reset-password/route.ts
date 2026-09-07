// src/app/api/auth/reset-password/route.ts
//
// Validates the reset token and updates the user's password.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  email:    z.string().email(),
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors?.password?.[0] ?? "Invalid request." },
      { status: 422 }
    );
  }

  const { email, token, password } = parsed.data;

  // Look up the token
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: `pwd-reset:${email}`, token } },
  });

  if (!record) {
    return NextResponse.json(
      { error: "Invalid or expired reset link. Please request a new one." },
      { status: 400 }
    );
  }

  // Check expiry
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: `pwd-reset:${email}`, token } },
    });
    return NextResponse.json(
      { error: "This reset link has expired. Please request a new one." },
      { status: 400 }
    );
  }

  // Update password
  const hashed = await bcrypt.hash(password, 12);
  const updated = await prisma.user.updateMany({
    where: { email },
    data:  { password: hashed },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Delete the used token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: `pwd-reset:${email}`, token } },
  });

  return NextResponse.json({ message: "Password updated successfully. You can now sign in." });
}

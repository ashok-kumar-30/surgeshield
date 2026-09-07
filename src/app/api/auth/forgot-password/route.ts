// src/app/api/auth/forgot-password/route.ts
//
// Generates a secure password-reset token, stores it in VerificationToken,
// and emails a reset link to the user via Resend.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const Schema = z.object({
  email: z.string().email("A valid email is required."),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 422 });
  }

  const { email } = parsed.data;

  // Always return 200 to prevent email enumeration attacks.
  // We silently skip if the user doesn't exist or has no password (OAuth-only).
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, password: true } });

  if (user?.password) {
    // Delete any existing token for this email first
    await prisma.verificationToken.deleteMany({ where: { identifier: `pwd-reset:${email}` } });

    // Generate a cryptographically secure token
    const token   = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.verificationToken.create({
      data: { identifier: `pwd-reset:${email}`, token, expires },
    });

    // Send reset email
    if (process.env.RESEND_API_KEY) {
      const resend   = new Resend(process.env.RESEND_API_KEY);
      const FROM     = process.env.FROM_EMAIL ?? "SurgeShield <onboarding@resend.dev>";
      const BASE_URL = process.env.NEXTAUTH_URL ?? "https://surgeshield-xi.vercel.app";
      const resetUrl = `${BASE_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      await resend.emails.send({
        from:    FROM,
        to:      email,
        subject: "Reset your SurgeShield password",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#020207;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 32px;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">🔑</div>
      <h1 style="margin:0;font-size:22px;font-weight:800;color:white;">Reset Your Password</h1>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">SurgeShield Account Security</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;">Hi <strong style="color:white;">${user.name ?? email}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
        We received a request to reset your password. Click the button below to choose a new one.
        This link expires in <strong style="color:white;">1 hour</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
          Reset Password →
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
        If you didn't request this, you can safely ignore this email. Your password will not change.
      </p>
    </div>
    <div style="padding:16px 32px;text-align:center;font-size:11px;color:rgba(255,255,255,0.2);">
      SurgeShield · Resilient Event Registration
    </div>
  </div>
</body>
</html>`,
      }).catch(err => console.error("[forgot-password] Resend error:", err));
    } else {
      console.info(`[forgot-password] Reset link: ${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`);
    }
  }

  // Always return success regardless (prevents email enumeration)
  return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
}

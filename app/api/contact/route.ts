// app/api/contact/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { z } from 'zod';
export const runtime = 'nodejs';

/* ───────── validation must match the client side ───────── */
const contactSchema = z.object({
  name:    z.string().min(2),
  email:   z.string().email(),
  subject: z.string().min(5),
  message: z.string().min(10),
});
type ContactFormData = z.infer<typeof contactSchema>;

/* ───────── nodemailer transport (re-use across calls) ───────── */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,                                    // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ███  POST /api/contact  ███ */
export async function POST(req: Request) {
  try {
    const data = contactSchema.parse(await req.json()) as ContactFormData;

    /* ——— build e-mail ——— */
    await transporter.sendMail({
      from: `"Woodeng Contact" <${process.env.SMTP_USER}>`,
      to:     process.env.CONTACT_TO,               // where you receive
      replyTo: data.email,                          // so you can reply
      subject: data.subject,
      text: `
Name: ${data.name}
Email: ${data.email}

${data.message}
      `.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact]', err);
    /* zod throws ZodError on invalid input */
    const status = err instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { ok: false, message: 'Unable to send message' },
      { status },
    );
  }
}

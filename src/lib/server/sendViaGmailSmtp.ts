import nodemailer from 'nodemailer';

/**
 * Send mail through Gmail SMTP using the same App Password as IMAP ingest.
 * Server-only.
 */
export async function sendViaGmailSmtp(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  appPassword: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: opts.from, pass: opts.appPassword },
  });
  await transporter.sendMail({
    from: opts.from,
    to: opts.to,
    replyTo: opts.from,
    subject: opts.subject,
    text: opts.text,
  });
}

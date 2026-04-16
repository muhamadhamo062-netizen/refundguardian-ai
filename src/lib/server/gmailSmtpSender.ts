import nodemailer from 'nodemailer';

type SendMailInput = {
  gmailAddress: string;
  appPassword: string;
  to: string;
  subject: string;
  text: string;
  fromName?: string | null;
};

export async function sendViaGmailSmtp(input: SendMailInput): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: input.gmailAddress,
      pass: input.appPassword,
    },
  });

  const from = input.fromName?.trim()
    ? `"${input.fromName.trim().replaceAll('"', "'")}" <${input.gmailAddress}>`
    : input.gmailAddress;

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}


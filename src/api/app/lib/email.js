import nodemailer from 'nodemailer';

function hasSmtpConfig() {
  return !!process.env.SMTP_HOST;
}

function makeTransport() {
  if (!hasSmtpConfig()) return null;

  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = process.env.SMTP_USER || null;
  const pass = process.env.SMTP_PASS || null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
}

export async function sendRegistrationEmail({ to, registrationLink, tenantId }) {
  const from = process.env.SMTP_FROM || 'no-reply@service-catalogue.local';
  const subject = `Complete your registration for ${tenantId}`;
  const text = `You have been invited to manage tenant "${tenantId}".\n\nComplete registration:\n${registrationLink}\n`;

  const transport = makeTransport();
  if (!transport) {
    // No SMTP configured; treat as no-op.
    return { sent: false, reason: 'SMTP not configured' };
  }

  await transport.sendMail({ from, to, subject, text });
  return { sent: true };
}


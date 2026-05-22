/**
 * Send contact form notifications via SMTP (Gmail recommended).
 * Set SMTP_USER + SMTP_PASS (Gmail app password) in .env for live email delivery.
 */
const DEFAULT_TO = '';

function contactToAddress() {
  return (process.env.CONTACT_TO_EMAIL || DEFAULT_TO).trim();
}

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      String(process.env.SMTP_USER).trim() &&
      String(process.env.SMTP_PASS).trim()
  );
}

async function sendContactEmail(entry) {
  if (!smtpConfigured()) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return { sent: false, reason: 'nodemailer_missing' };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS.trim()
    }
  });

  const to = contactToAddress();
  const from =
    process.env.SMTP_FROM ||
    `Researchium Contact <${process.env.SMTP_USER.trim()}>`;

  const text = [
    'New contact form submission (CSIR / Researchium)',
    '',
    `Name: ${entry.name}`,
    `Email: ${entry.email}`,
    `Mobile: ${entry.phone || '—'}`,
    `Topic: ${entry.subject || 'General'}`,
    '',
    'Message:',
    entry.message,
    '',
    `Submitted: ${entry.createdAt}`
  ].join('\n');

  const html = `
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(entry.name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(entry.email)}">${escapeHtml(entry.email)}</a></p>
    <p><strong>Mobile:</strong> ${escapeHtml(entry.phone || '—')}</p>
    <p><strong>Topic:</strong> ${escapeHtml(entry.subject || 'General')}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(entry.message)}</pre>
    <p style="color:#666;font-size:12px">Submitted: ${escapeHtml(entry.createdAt)}</p>
  `;

  await transporter.sendMail({
    from,
    to,
    replyTo: entry.email,
    subject: `[Researchium] Contact: ${entry.subject || 'General'} — ${entry.name}`,
    text,
    html
  });

  return { sent: true, to };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  contactToAddress,
  smtpConfigured,
  sendContactEmail
};

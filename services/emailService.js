'use strict';

const nodemailer = require('nodemailer');

let transporter;

function getMailer() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';

  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return transporter;
}

async function sendMail(options) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error('SMTP_FROM (or SMTP_USER) is required');
  }

  const mailer = getMailer();
  return mailer.sendMail({ from, ...options });
}

module.exports = { sendMail };


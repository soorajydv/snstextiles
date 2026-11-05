import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = env.smtpUser && env.smtpPass
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    })
  : null;

export async function sendEmail(options: { to: string; subject: string; text: string; html: string }) {
  if (!transporter || !env.mailFrom) throw new Error('SMTP email is not configured');
  await transporter.sendMail({ from: env.mailFrom, ...options });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const resetUrl = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: 'Reset your SNS Textiles password',
    text: `Hello ${name},\n\nUse this link to reset your SNS Textiles password:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18241f;max-width:560px"><h2>SNS Textiles password reset</h2><p>Hello ${escapeHtml(name)},</p><p>Use the button below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetUrl}" style="display:inline-block;background:#173d35;color:#fff;padding:11px 16px;border-radius:7px;text-decoration:none">Reset password</a></p><p style="font-size:12px;color:#66756b">If you did not request this, you can ignore this email.</p></div>`,
  });
}

export async function sendUserWelcomeEmail(details: {
  name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  customer: string;
  password: string;
  customerDetails?: {
    contactPerson: string;
    phone: string;
    email: string;
    panNumber: string;
    address: string;
    notes: string;
  };
}) {
  const rows = [
    ['Name', details.name],
    ['Username', details.username],
    ['Email', details.email],
    ['Phone', details.phone || 'Not provided'],
    ['Role', details.role],
    ['Customer', details.customer || 'Not linked'],
    ['Temporary password', details.password],
  ];
  if (details.customerDetails) {
    rows.splice(6, 0,
      ['Customer contact person', details.customerDetails.contactPerson || 'Not provided'],
      ['Customer phone', details.customerDetails.phone || 'Not provided'],
      ['Customer email', details.customerDetails.email || 'Not provided'],
      ['PAN / VAT number', details.customerDetails.panNumber || 'Not provided'],
      ['Customer address', details.customerDetails.address || 'Not provided'],
      ['Customer notes', details.customerDetails.notes || 'Not provided'],
    );
  }
  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n');
  const htmlRows = rows
    .map(([label, value]) => `<tr><td style="padding:7px 12px 7px 0;color:#66756b"><strong>${escapeHtml(label)}</strong></td><td style="padding:7px 0">${escapeHtml(value)}</td></tr>`)
    .join('');

  await sendEmail({
    to: details.email,
    subject: 'Your SNS Textiles account has been created',
    text: `Hello ${details.name},\n\nAn SNS Textiles account has been created for you.\n\n${textRows}\n\nYou can sign in at ${env.appUrl}. Please change your temporary password after signing in.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18241f;max-width:560px"><h2>SNS Textiles account created</h2><p>Hello ${escapeHtml(details.name)},</p><p>An account has been created for you with the following details:</p><table style="border-collapse:collapse">${htmlRows}</table><p><a href="${escapeHtml(env.appUrl)}" style="display:inline-block;background:#173d35;color:#fff;padding:11px 16px;border-radius:7px;text-decoration:none">Open SNS Textiles</a></p><p style="font-size:12px;color:#66756b">Please change your temporary password after signing in.</p></div>`,
  });
}

export async function sendCustomerRegistrationEmail(details: {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  panNumber: string;
  address: string;
  notes: string;
  username: string;
  loginEmail: string;
  password: string;
}) {
  const rows = [
    ['Customer / club name', details.name],
    ['Contact person', details.contactPerson || 'Not provided'],
    ['Phone', details.phone || 'Not provided'],
    ['Email', details.email],
    ['PAN / VAT number', details.panNumber || 'Not provided'],
    ['Address', details.address || 'Not provided'],
    ['Notes', details.notes || 'Not provided'],
    ['Username', details.username],
    ['Login email', details.loginEmail],
    ['Temporary password', details.password],
  ];
  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n');
  const htmlRows = rows
    .map(([label, value]) => `<tr><td style="padding:7px 12px 7px 0;color:#66756b"><strong>${escapeHtml(label)}</strong></td><td style="padding:7px 0">${escapeHtml(value)}</td></tr>`)
    .join('');

  await sendEmail({
    to: details.email,
    subject: 'Your SNS Textiles customer registration is complete',
    text: `Hello ${details.contactPerson || details.name},\n\nYour customer registration with SNS Textiles is complete.\n\n${textRows}\n\nSign in at ${env.appUrl}. Please change your temporary password after signing in.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18241f;max-width:560px"><h2>SNS Textiles customer registration</h2><p>Hello ${escapeHtml(details.contactPerson || details.name)},</p><p>Your customer registration is complete. Your account and customer details are below:</p><table style="border-collapse:collapse">${htmlRows}</table><p><a href="${escapeHtml(env.appUrl)}" style="display:inline-block;background:#173d35;color:#fff;padding:11px 16px;border-radius:7px;text-decoration:none">Open SNS Textiles</a></p><p style="font-size:12px;color:#66756b">Please change your temporary password after signing in.</p></div>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

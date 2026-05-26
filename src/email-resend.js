const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export async function sendResendMail(config = {}, message = {}) {
  const email = normalizeResendConfig(config);
  if (!email.recipients.length) throw new Error('Email recipient is missing.');
  if (!email.resendApiKey) throw new Error('Resend API key is missing.');
  if (!email.from) throw new Error('Resend sender address is missing.');

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${email.resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: email.from,
      to: email.recipients,
      subject: message.subject || 'TradePulse Monitor',
      text: message.text || '',
    }),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const details = payload?.message || payload?.error || text.slice(0, 300);
    throw new Error(formatResendError(response.status, details));
  }

  return payload || {};
}

export function normalizeResendConfig(input = {}) {
  return {
    resendApiKey: String(input.resendApiKey || process.env.RESEND_API_KEY || '').trim(),
    from: String(input.from || process.env.RESEND_FROM || 'TradePulse Monitor <onboarding@resend.dev>').trim(),
    recipients: splitRecipients(input.recipient || input.to),
  };
}

export function splitRecipients(value) {
  return String(value || '')
    .split(/[;,，；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatResendError(status, details) {
  const message = String(details || '').trim();
  if (
    status === 403
    && (/resend\.dev/i.test(message) || /domain/i.test(message) || /verified/i.test(message))
  ) {
    return 'Resend default sender can only send to the email address registered on this Resend account.';
  }
  return `Resend failed: HTTP ${status}${message ? ` ${message}` : ''}`;
}

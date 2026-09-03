const PROVIDERS = ['arkesel', 'termii'];

function getConfig() {
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase();
  const enabled = process.env.SMS_ENABLED === 'true' && provider.length > 0;
  return {
    enabled,
    provider,
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || '',
    termiiRegion: process.env.TERMII_REGION || '',
    termiiBase: process.env.TERMII_BASE_URL || '',
    arkeselBase: process.env.ARKESEL_BASE_URL || 'https://sms.arkesel.com/api/v2/sms/send',
    welcomeEnabled: process.env.SMS_WELCOME_ENABLED === 'true',
    welcomeTemplate: process.env.SMS_WELCOME_TEMPLATE || 'Hi {name}, welcome to {campus}! Your registration is complete. Access code: {code}'
  };
}

function isSmsEnabled() {
  return getConfig().enabled;
}

function health() {
  const cfg = getConfig();
  return {
    enabled: cfg.enabled,
    provider: cfg.provider || null,
    senderId: cfg.senderId || null,
    welcomeEnabled: cfg.enabled && cfg.welcomeEnabled,
    configured: cfg.enabled && Boolean(cfg.apiKey)
  };
}

function normalizePhone(phone) {
  let p = String(phone || '').replace(/[^0-9+]/g, '');
  if (!p) return p;
  if (p.startsWith('0')) {
    p = '233' + p.slice(1);
  }
  if (p.startsWith('+')) {
    p = p.slice(1);
  }
  return p;
}

function buildTermiiBase(cfg) {
  if (cfg.termiiBase) return cfg.termiiBase.replace(/\/$/, '');
  const region = cfg.termiiRegion || 'ng';
  return `https://api.${region}.termii.com/api`;
}

async function sendTermii(cfg, to, message, from) {
  const url = `${buildTermiiBase(cfg)}/sms/send`;
  const payload = {
    api_key: cfg.apiKey,
    to: normalizePhone(to),
    from: from || cfg.senderId,
    sms: message,
    type: 'plain',
    channel: 'generic'
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!response.ok) {
    throw new Error(`Termii error ${response.status}: ${text}`);
  }
  return data;
}

async function sendArkesel(cfg, to, message, from) {
  const url = cfg.arkeselBase;
  const payload = {
    sender: from || cfg.senderId,
    message,
    recipients: [normalizePhone(to)]
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!response.ok) {
    throw new Error(`Arkesel error ${response.status}: ${text}`);
  }
  return data;
}

async function sendSingle({ to, message, from }) {
  const cfg = getConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    return { sent: false, skipped: true, reason: 'SMS not configured' };
  }
  if (!to || !message) {
    return { sent: false, skipped: true, reason: 'Missing recipient or message' };
  }
  try {
    let result;
    if (cfg.provider === 'termii') {
      result = await sendTermii(cfg, to, message, from);
    } else if (cfg.provider === 'arkesel') {
      result = await sendArkesel(cfg, to, message, from);
    } else {
      return { sent: false, skipped: true, reason: `Unsupported provider: ${cfg.provider}` };
    }
    return { sent: true, provider: cfg.provider, to: normalizePhone(to) };
  } catch (error) {
    return { sent: false, error: error.message, to: normalizePhone(to) };
  }
}

async function sendBulk({ recipients, message, from }) {
  const cfg = getConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    return { enabled: false, sent: 0, failed: 0, skipped: true, reason: 'SMS not configured' };
  }
  const results = [];
  for (const recipient of recipients) {
    const to = recipient && recipient.phone ? recipient.phone : recipient;
    const result = await sendSingle({ to, message, from });
    results.push(result);
  }
  const sent = results.filter((r) => r.sent).length;
  const failed = results.filter((r) => !r.sent && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  return { enabled: true, provider: cfg.provider, sent, failed, skipped, results };
}

function fillTemplate(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (m, key) => (key in values ? values[key] : m));
}

export { sendSingle, sendBulk, sendTermii, sendArkesel, health, isSmsEnabled, getConfig, fillTemplate, normalizePhone, PROVIDERS };

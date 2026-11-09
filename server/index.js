import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { promises as fs, existsSync, statSync } from 'fs';
import QRCode from 'qrcode';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import {
  init,
  checkClassScheduleSchema,
  seedInitialTimetables,
  getSettingSync,
  setSetting,
  createSession,
  resolveSession,
  deleteSession,
  findStudentByPhoneAndCampus,
  findStudentById,
  insertStudent,
  registerStudentWithClassBookings,
  markClassBookingCalendarAdded,
  listStudents,
  countNewStudents,
  updateStudentFlag,
  updateStudent,
  deleteStudent,
  listTokensForStudent,
  exportAllData,
  restoreAllData,
  getSystemInfo,
  findTokenForStudentToday,
  tokenExistsForDate,
  insertToken,
  findTokenByCode,
  markTokenVerified,
  listTokensWithStudents,
  listTokensVerifiedOn,
  listTokensForDate,
  getRetention,
  checkSupabaseHealth,
  countVerifiedVisitsForStudent,
  insertFeedback,
  listFeedback,
  getCampusStats,
  insertSmsLogs,
  listSmsLogs,
  listRetentionSmsHistory,
  updateSmsDeliveryStatus,
  insertRetentionSchedule,
  listRetentionSchedules,
  claimDueRetentionSchedules,
  updateRetentionSchedule,
  cancelRetentionSchedule,
  listAcademicTerms,
  getAcademicTerm,
  saveAcademicTerm,
  setOtherTermsInactive,
  listClassSchedules,
  getClassSchedule,
  saveClassSchedule,
  createClassBooking,
  countActiveClassBookings,
  getClassAttendanceAnalytics,
  listClassBookings,
  updateFutureClassBookings,
  cancelClassBooking,
  saveClassAttendance,
  insertClassNotification,
  countClassBookingsForStudent
} from './db.js';
import { sendSingle, sendBulk, health as smsHealth, getConfig as getSmsConfig, fillTemplate, normalizePhone } from './sms.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
let classScheduleSchemaReady = true;
const CLASS_SCHEDULE_SETUP_ERROR =
  'Class registration is not configured in the database yet. Ask an administrator to run supabase/class-schedule-migration.sql, then restart the server.';
const CAMPUS_INSTITUTE_NAME = process.env.CAMPUS_INSTITUTE_NAME || 'ACCRA INSTITUTE FACULTY STUDENT PORTAL';
const DEFAULT_CAMPUS = process.env.DEFAULT_CAMPUS || 'TESANO CAMPUS';
const SUB_CAMPUSES = [
  'TESANO CAMPUS',
  'CANTOMENT CAMPUS',
  'ASHIAMAN CAMPUS',
  'LEGON CAMPUS',
  'TEMA CAMPUS'
];
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const SECURITY_TOKEN = process.env.SECURITY_TOKEN || '';
const SUPER_ADMIN_TOKEN = process.env.SUPER_ADMIN_TOKEN || process.env.SUPER_ADMIN || '';
const CAMPUS_ADMIN_TOKENS = parseTokenMap(process.env.CAMPUS_ADMIN_TOKENS || '');
const CAMPUS_SECURITY_TOKENS = parseTokenMap(process.env.CAMPUS_SECURITY_TOKENS || '');
const CAMPUS_TOKEN_STORAGE_KEYS = {
  admin: 'campus_admin_tokens',
  security: 'campus_security_tokens',
  'super-admin': 'campus_super_admin_tokens'
};
const ALLOW_UNAUTHENTICATED = process.env.NODE_ENV !== 'production' && process.env.ALLOW_UNAUTHENTICATED === 'true';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE = 'aifsp_session';
const scrypt = promisify(scryptCallback);
const SERVER_STARTED_AT = Date.now();
const ACCESS_TOKEN_PATTERN = /^\d{4}$/;
const DEFAULT_RETENTION_SMS_SETTINGS = {
  firstTimeFollowUp: 'Hi {name}, we hope you enjoyed your visit to {campus}! Our facility is open and we would love to see you again soon.',
  atRiskWinback: "Hello {name}, we noticed it's been a few weeks since your last visit to {campus}. We miss having you! Drop by anytime.",
  cooldownDays: 7
};
const MAX_SMS_MESSAGE_LENGTH = 500;
const CLASS_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTokenMap(rawValue) {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed).map(([campus, token]) => [normalizeCampusName(campus), String(token)])
      );
    }
  } catch {
    // fall through to legacy comma-delimited parsing
  }

  const map = {};
  rawValue.split(',').forEach(entry => {
    const [campus, token] = String(entry).split(':');
    if (campus && token) {
      map[normalizeCampusName(campus)] = token.trim();
    }
  });
  return map;
}

function normalizeCampusName(value) {
  if (!value) return 'TESANO CAMPUS';
  const campus = String(value).trim();
  return SUB_CAMPUSES.find(item => item.toLowerCase() === campus.toLowerCase()) || campus;
}

function resolveCampusName(value) {
  return normalizeCampusName(value || 'TESANO CAMPUS');
}

function getSessionIdFromRequest(req) {
  const sessionCookie = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return sessionCookie ? sessionCookie.slice(SESSION_COOKIE.length + 1) : '';
}

function setSessionCookie(res, sessionId) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
    maxAge: SESSION_TTL_MS
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api'
  });
}

async function isMatchingToken(candidateToken, tokenValue) {
  if (!candidateToken || !tokenValue) return false;
  const storedValue = String(tokenValue);
  if (storedValue.startsWith('scrypt$')) {
    const [, salt, hash] = storedValue.split('$');
    if (!salt || !hash) return false;
    const saltBytes = Buffer.from(salt, 'base64');
    const expectedHash = Buffer.from(hash, 'base64');
    if (!saltBytes.length || !expectedHash.length) return false;
    const candidateHash = Buffer.from(await scrypt(String(candidateToken), saltBytes, expectedHash.length));
    return expectedHash.length === candidateHash.length && timingSafeEqual(expectedHash, candidateHash);
  }
  const bufA = Buffer.from(String(candidateToken));
  const bufB = Buffer.from(String(tokenValue));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function readStoredCampusTokenMap(role) {
  const key = CAMPUS_TOKEN_STORAGE_KEYS[role];
  if (!key) return {};

  const value = getSettingSync(key);
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed).map(([campus, token]) => [normalizeCampusName(campus), String(token)])
      );
    }
  } catch {
    // ignore invalid JSON and fall back to empty map
  }

  return {};
}

function getCampusRoleToken(campusName, role) {
  const normalizedCampus = resolveCampusName(campusName);
  const storedMap = readStoredCampusTokenMap(role);
  if (storedMap[normalizedCampus]) {
    return storedMap[normalizedCampus];
  }
  if (role === 'admin') {
    return CAMPUS_ADMIN_TOKENS[normalizedCampus] || ADMIN_TOKEN || '';
  }
  if (role === 'security') {
    return CAMPUS_SECURITY_TOKENS[normalizedCampus] || SECURITY_TOKEN || '';
  }
  if (role === 'super-admin') {
    return SUPER_ADMIN_TOKEN || '';
  }
  return '';
}

async function setCampusRoleToken(campusName, role, password) {
  const key = CAMPUS_TOKEN_STORAGE_KEYS[role];
  const normalizedCampus = resolveCampusName(campusName);
  const existing = readStoredCampusTokenMap(role);

  for (const [campus, savedPassword] of Object.entries(existing)) {
    if (savedPassword.startsWith('scrypt$')) continue;
    const legacySalt = randomBytes(16);
    const legacyHash = await scrypt(savedPassword, legacySalt, 64);
    existing[campus] = `scrypt$${legacySalt.toString('base64')}$${Buffer.from(legacyHash).toString('base64')}`;
  }

  if (!password || !String(password).trim()) {
    delete existing[normalizedCampus];
  } else {
    const salt = randomBytes(16);
    const hash = await scrypt(String(password).trim(), salt, 64);
    existing[normalizedCampus] = `scrypt$${salt.toString('base64')}$${Buffer.from(hash).toString('base64')}`;
  }

  await setSetting(key, JSON.stringify(existing));
  return existing;
}

async function upgradeLegacyCampusPassword(campusName, role, password) {
  const savedPassword = readStoredCampusTokenMap(role)[resolveCampusName(campusName)];
  if (savedPassword && !savedPassword.startsWith('scrypt$')) {
    await setCampusRoleToken(campusName, role, password);
  }
}

app.use(helmet());

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawAllowedOrigins
  ? rawAllowedOrigins.split(',').map(s => s.trim()).filter(Boolean)
  : [];

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn('[security] ALLOWED_ORIGINS is unset; cross-origin browser requests will be denied.');
}
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_UNAUTHENTICATED === 'true') {
  console.warn('[security] ALLOW_UNAUTHENTICATED is ignored in production.');
}
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, false);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production' && (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin))) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

const tokenIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many access-code requests, please try again later.' }
});

const tokenPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const phone = normalizePhone(req.body?.phone).replace(/\D/g, '').slice(-15);
    return phone ? `phone:${phone}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many access-code requests for this phone, please try again later.' }
});

const classBookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => {
    const phone = normalizePhone(req.body?.phone || req.query?.phone).replace(/\D/g, '').slice(-15);
    return phone ? `phone:${phone}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many class booking requests. Please try again later.' }
});

app.use('/api', apiLimiter);
app.use('/api/register', authLimiter);
app.use('/api/verify-token', authLimiter);
app.use('/api/validate-login', loginLimiter);
app.use('/api/generate-token', tokenIpLimiter, tokenPhoneLimiter);
app.use('/api/scan-entry', tokenIpLimiter, tokenPhoneLimiter);
app.use('/api/classes/bookings', classBookingLimiter);
app.use('/api', (req, res, next) => {
  if (!getSessionIdFromRequest(req) || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const origin = req.get('origin');
  const sameOrigin = origin === `${req.protocol}://${req.get('host')}`;
  const allowedOrigin = origin && (allowedOrigins.includes(origin) ||
    (process.env.NODE_ENV !== 'production' && (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin))));
  if (!sameOrigin && !allowedOrigin) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  return next();
});

function currentDateString() {
  return new Date().toISOString().split('T')[0];
}

function currentAccraDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

function getPeriodRange(range) {
  const now = new Date();
  const today = formatDate(now);
  if (range === 'all') {
    return { start: '1970-01-01', end: today };
  }

  if (range === 'week') {
    const firstDay = new Date(now);
    firstDay.setDate(now.getDate() - now.getDay());
    return { start: formatDate(firstDay), end: today };
  }

  if (range === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatDate(firstDay), end: today };
  }

  return { start: today, end: today };
}

async function ensureCampusQr(campusName = DEFAULT_CAMPUS) {
  const normalizedCampus = resolveCampusName(campusName);
  const settingKey = `campus_qr_${normalizedCampus.replace(/\s+/g, '_').toUpperCase()}`;
  let campusCode = getSettingSync(settingKey);

  if (!campusCode) {
    campusCode = uuidv4();
    await setSetting(settingKey, campusCode);
    console.log(`Campus entrance QR code generated for ${normalizedCampus}:`, campusCode);
  }

  return { campusCode, campusName: normalizedCampus, settingKey };
}

async function resolveCampusFromCode(campusCode) {
  if (!campusCode) {
    return null;
  }

  for (const campusName of SUB_CAMPUSES) {
    const { campusCode: expectedCode } = await ensureCampusQr(campusName);
    if (expectedCode === campusCode) {
      return campusName;
    }
  }

  const legacyCode = getSettingSync('campus_qr');
  if (legacyCode && legacyCode === campusCode) {
    return DEFAULT_CAMPUS;
  }

  return null;
}

function getLanIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

function buildBaseUrl(req) {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (publicBaseUrl) {
    return publicBaseUrl.replace(/\/+$/, '');
  }

  const protocol = req.protocol;
  const host = req.get('host');

  // In production, use the public request host (Render/Vercel/etc.)
  if (process.env.NODE_ENV === 'production' && host) {
    return `${protocol}://${host}`;
  }

  const lanAddress = getLanIPv4();
  if (lanAddress) {
    const frontendPort = process.env.NODE_ENV === 'production' ? PORT : 3000;
    return `${protocol}://${lanAddress}:${frontendPort}`;
  }

  if (host?.includes(':3001') && process.env.NODE_ENV !== 'production') {
    return `${protocol}://${host.replace(':3001', ':3000')}`;
  }
  return host ? `${protocol}://${host}` : '';
}

function generateAccessToken() {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

async function createTokenForStudent(studentId, campusName = DEFAULT_CAMPUS) {
  const today = currentDateString();
  let tokenData = await findTokenForStudentToday(studentId, campusName, today);
  if (tokenData) {
    return tokenData;
  }

  let token = generateAccessToken();
  let collisionCount = 0;
  while (await tokenExistsForDate(token, today) && collisionCount < 10) {
    token = generateAccessToken();
    collisionCount += 1;
  }

  const createdAt = new Date().toISOString();
  tokenData = {
    id: uuidv4(),
    student_id: studentId,
    campus: campusName,
    token,
    valid_date: today,
    created_at: createdAt,
    used_at: createdAt,
    verified_at: null
  };

  await insertToken(tokenData);

  return tokenData;
}

function getMilestoneInfo(count) {
  if (count <= 0) return { label: 'First Visit', badge: 'First Visit • Welcome! 🎉', tier: 'new', visitNumber: 1 };
  if (count <= 3) return { label: 'Returning Member', badge: `Visit #${count + 1} • Returning Member 🌟`, tier: 'bronze', visitNumber: count + 1 };
  if (count <= 9) return { label: 'Frequent Regular', badge: `Visit #${count + 1} • Frequent Regular 🎖️`, tier: 'silver', visitNumber: count + 1 };
  return { label: 'VIP Patron', badge: `Visit #${count + 1} • VIP Patron 👑`, tier: 'gold', visitNumber: count + 1 };
}

async function buildTokenResponse(tokenData, student) {
  const tokenQR = await QRCode.toDataURL(tokenData.token);
  const recentVisits = await listTokensForStudent(student.id);
  const verifiedVisits = await countVerifiedVisitsForStudent(student.id);
  const milestone = getMilestoneInfo(verifiedVisits);

  return {
    success: true,
    student: { id: student.id, name: student.name, phone: student.phone, campus: student.campus },
    token: tokenData.token,
    tokenQR,
    validDate: tokenData.valid_date,
    campus: student.campus,
    recentVisits: recentVisits.slice(0, 10),
    totalVisits: verifiedVisits,
    milestone
  };
}

function validatePhone(phone) {
  return typeof phone === 'string' && /^[+\d][\d\s()-]{5,20}$/.test(phone.trim());
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `***${digits.slice(-4)}` : 'unknown';
}

function createSmsLog(result, recipient, campus, source, provider, createdAt) {
  return {
    id: uuidv4(),
    campus: recipient?.campus || campus,
    recipient_name: recipient?.name || null,
    recipient_phone_masked: maskPhone(recipient?.phone || result.to),
    recipient_id: recipient?.id || result.recipientId || null,
    provider: result.provider || provider || null,
    provider_message_id: result.providerMessageId || null,
    status: result.sent ? 'accepted' : result.skipped ? 'skipped' : 'failed',
    delivery_status: result.sent && result.providerMessageId ? 'pending' : null,
    source,
    error: result.error || result.reason || null,
    created_at: createdAt
  };
}

function retentionSettingsKey(campus) {
  const key = String(campus || 'ALL CAMPUSES').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return `retention_sms_settings_${key}`;
}

function getRetentionSmsSettings(campus) {
  const stored = getSettingSync(retentionSettingsKey(campus))
    || (campus ? getSettingSync(retentionSettingsKey(null)) : null);
  let parsed = {};
  if (stored) {
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      console.error('Invalid retention SMS settings; defaults will be used:', error);
    }
  }
  const cooldownDays = Number(parsed.cooldownDays);
  return {
    firstTimeFollowUp: typeof parsed.firstTimeFollowUp === 'string'
      ? parsed.firstTimeFollowUp
      : DEFAULT_RETENTION_SMS_SETTINGS.firstTimeFollowUp,
    atRiskWinback: typeof parsed.atRiskWinback === 'string'
      ? parsed.atRiskWinback
      : DEFAULT_RETENTION_SMS_SETTINGS.atRiskWinback,
    cooldownDays: Number.isInteger(cooldownDays) && cooldownDays >= 1 && cooldownDays <= 90
      ? cooldownDays
      : DEFAULT_RETENTION_SMS_SETTINGS.cooldownDays
  };
}

function validateRetentionSmsSettings(value) {
  const { firstTimeFollowUp, atRiskWinback, cooldownDays } = value || {};
  for (const [label, message] of [['firstTimeFollowUp', firstTimeFollowUp], ['atRiskWinback', atRiskWinback]]) {
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_SMS_MESSAGE_LENGTH) {
      return { error: `${label} must be a non-empty message no longer than ${MAX_SMS_MESSAGE_LENGTH} characters.` };
    }
  }
  if (!Number.isInteger(cooldownDays) || cooldownDays < 1 || cooldownDays > 90) {
    return { error: 'Cooldown must be a whole number between 1 and 90 days.' };
  }
  return { settings: { firstTimeFollowUp: firstTimeFollowUp.trim(), atRiskWinback: atRiskWinback.trim(), cooldownDays } };
}

async function getAutoCampaignCandidates(campus, settings, now = Date.now()) {
  const retention = await getRetention(campus);
  const cutoff = new Date(now - settings.cooldownDays * 24 * 60 * 60 * 1000).toISOString();
  const recentAttempts = await listRetentionSmsHistory(campus, cutoff);
  const recentlyContacted = new Map();
  for (const attempt of recentAttempts) {
    if (attempt.status !== 'accepted' || !attempt.recipient_id) continue;
    const sentAt = Date.parse(attempt.created_at);
    if (!Number.isNaN(sentAt) && sentAt >= now - settings.cooldownDays * 24 * 60 * 60 * 1000) {
      recentlyContacted.set(attempt.recipient_id, attempt.created_at);
    }
  }

  const records = retention.records || [];
  const firstTimeFollowUps = records.filter((record) =>
    record.visit_count === 1 &&
    record.days_since_last >= 3 &&
    record.days_since_last <= 7 &&
    record.phone
  );
  const atRiskReengagements = records.filter((record) =>
    record.visit_count >= 2 &&
    record.days_since_last >= 25 &&
    record.days_since_last <= 35 &&
    record.phone
  );
  const candidates = [
    ...firstTimeFollowUps.map((record) => ({ record, source: 'first-time-followup', template: settings.firstTimeFollowUp })),
    ...atRiskReengagements.map((record) => ({ record, source: 'at-risk-winback', template: settings.atRiskWinback }))
  ];
  const eligible = candidates.filter(({ record }) => !record.sms_opt_out && !recentlyContacted.has(record.id));
  const scheduled = eligible.map(({ record, source, template }) => ({
    id: record.id,
    name: record.name,
    phone: record.phone,
    campus: record.campus || campus || 'our campus',
    status: record.status,
    visit_count: record.visit_count,
    last_visit: record.last_visit,
    days_since_last: record.days_since_last,
    source,
    message: fillTemplate(template, { name: record.name, campus: record.campus || campus || 'our campus' })
  }));
  return {
    eligible: scheduled,
    counts: {
      firstTimeFollowUpsCount: scheduled.filter((row) => row.source === 'first-time-followup').length,
      atRiskReengagementsCount: scheduled.filter((row) => row.source === 'at-risk-winback').length,
      totalEligible: scheduled.length,
      excludedOptOut: candidates.filter(({ record }) => record.sms_opt_out).length,
      excludedCooldown: candidates.filter(({ record }) => !record.sms_opt_out && recentlyContacted.has(record.id)).length
    }
  };
}

async function persistSmsLogs(logs) {
  try {
    await insertSmsLogs(logs);
    return null;
  } catch (error) {
    console.error('SMS history persistence failed:', error);
    return 'SMS attempts completed, but the history could not be saved.';
  }
}

async function notifyClassBookingChanges(bookings, event, updatedClass) {
  const summary = { accepted: 0, failed: 0, skipped: 0, historyErrors: 0 };
  for (const booking of bookings) {
    let status = 'skipped';
    let provider = null;
    let providerMessageId = null;
    let error = null;
    try {
      if (booking.student_sms_opt_out) {
        error = 'Student opted out of SMS.';
      } else {
        const message = event === 'class-cancelled'
          ? `Hi ${booking.student_name}, ${booking.class_title_snapshot} on ${booking.class_date} at ${booking.start_time_snapshot} in ${booking.classroom_snapshot} has been cancelled. Please check the student timetable for updates.`
          : `Hi ${booking.student_name}, ${booking.class_title_snapshot} has a new schedule: ${CLASS_DAYS[updatedClass.day_of_week]} ${updatedClass.start_time}-${updatedClass.end_time}, ${updatedClass.classroom}. Your ${booking.class_date} booking needs to be rebooked.`;
        const result = await sendSingle({ to: booking.student_phone, message });
        if (result.sent) {
          status = 'accepted';
          provider = result.provider;
          providerMessageId = result.providerMessageId;
          summary.accepted += 1;
        } else if (result.error) {
          status = 'failed';
          error = result.error;
          summary.failed += 1;
        } else {
          error = result.reason || 'SMS was skipped.';
          summary.skipped += 1;
        }
      }
      if (booking.student_sms_opt_out) summary.skipped += 1;
      await insertClassNotification({
        id: uuidv4(),
        booking_id: booking.id,
        student_id: booking.student_id,
        event,
        status,
        provider,
        provider_message_id: providerMessageId,
        error,
        created_at: new Date().toISOString()
      });
    } catch (notificationError) {
      summary.historyErrors += 1;
      console.error(`Class notification processing failed for booking ${booking.id}:`, notificationError);
    }
  }
  return summary;
}

async function requireAdminAuth(req, res, next) {
  try {
    const rawCampus = req.get('x-campus') || req.body?.campus || req.query?.campus || DEFAULT_CAMPUS;
    const isAllCampuses = typeof rawCampus === 'string' && (rawCampus.trim().toLowerCase() === 'all' || rawCampus.trim().toLowerCase() === 'all campuses');
    const campus = isAllCampuses ? null : resolveCampusName(rawCampus);
    const session = await resolveSession(getSessionIdFromRequest(req));

    if (session) {
      if (session.role === 'admin' || session.role === 'super-admin' || session.is_super_admin) {
        req.authenticatedRole = session.role || (session.is_super_admin ? 'super-admin' : 'admin');
        req.isSuperAdmin = session.role === 'super-admin' || Boolean(session.is_super_admin);
        req.userCampus = req.isSuperAdmin ? (isAllCampuses ? null : campus) : session.campus;
        return next();
      }
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const token = req.get('x-admin-token') || req.get('x-super-admin-token') || '';
    const campusForToken = campus || DEFAULT_CAMPUS;
    const campusAdminToken = getCampusRoleToken(campusForToken, 'admin');
    const campusSuperAdminToken = getCampusRoleToken(campusForToken, 'super-admin');
    const superAdminMatches = campusSuperAdminToken && await isMatchingToken(token, campusSuperAdminToken);
    const campusAdminMatches = campusAdminToken && await isMatchingToken(token, campusAdminToken);

    if (superAdminMatches || campusAdminMatches) {
      req.authenticatedRole = superAdminMatches ? 'super-admin' : 'admin';
      req.isSuperAdmin = superAdminMatches;
      req.userCampus = (superAdminMatches && isAllCampuses) ? null : campusForToken;
      return next();
    }

    if (ALLOW_UNAUTHENTICATED) {
      req.authenticatedRole = 'development-bypass';
      req.userCampus = isAllCampuses ? null : campusForToken;
      req.isSuperAdmin = false;
      return next();
    }

    if (!hasConfiguredAdminAuth(campusForToken)) {
      return res.status(503).json({ error: 'Admin authentication is not configured.' });
    }

    return res.status(401).json({ error: 'Admin authentication required' });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ error: 'Admin authentication failed' });
  }
}

function getAdminTargetCampus(req, overrideCampus) {
  if (!req.isSuperAdmin) {
    return req.userCampus;
  }
  const candidate = overrideCampus !== undefined ? overrideCampus : (req.query?.campus || req.body?.campus || req.get('x-campus'));
  if (candidate !== undefined && candidate !== null) {
    const trimmed = String(candidate).trim();
    if (trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'all campuses') {
      return null;
    }
    if (trimmed) {
      return resolveCampusName(trimmed);
    }
  }
  return req.userCampus;
}

async function requireSecurityAuth(req, res, next) {
  try {
    const campus = resolveCampusName(req.get('x-campus') || req.body?.campus || req.query?.campus || DEFAULT_CAMPUS);
    const session = await resolveSession(getSessionIdFromRequest(req));

    if (session) {
      if (session.role === 'security' || session.role === 'super-admin' || session.is_super_admin) {
        req.userCampus = session.is_super_admin ? campus : session.campus;
        req.isSuperAdmin = session.role === 'super-admin' || Boolean(session.is_super_admin);
        return next();
      }
      return res.status(401).json({ error: 'Security authentication required' });
    }

    const token = req.get('x-security-token') || req.get('x-super-admin-token') || '';
    const campusSecurityToken = getCampusRoleToken(campus, 'security');
    const campusSuperAdminToken = getCampusRoleToken(campus, 'super-admin');
    const superAdminMatches = campusSuperAdminToken && await isMatchingToken(token, campusSuperAdminToken);
    const campusSecurityMatches = campusSecurityToken && await isMatchingToken(token, campusSecurityToken);

    if (superAdminMatches || campusSecurityMatches) {
      req.userCampus = campus;
      req.isSuperAdmin = superAdminMatches;
      return next();
    }

    if (ALLOW_UNAUTHENTICATED) {
      req.userCampus = campus;
      req.isSuperAdmin = false;
      return next();
    }

    if (!hasConfiguredSecurityAuth(campus)) {
      return res.status(503).json({ error: 'Security authentication is not configured.' });
    }

    return res.status(401).json({ error: 'Security authentication required' });
  } catch (error) {
    console.error('Security auth error:', error);
    return res.status(500).json({ error: 'Security authentication failed' });
  }
}

function hasConfiguredAdminAuth(campus) {
  return Boolean(
    SUPER_ADMIN_TOKEN ||
    ADMIN_TOKEN ||
    getCampusRoleToken(campus, 'admin') ||
    getCampusRoleToken(campus, 'super-admin')
  );
}

function hasConfiguredSecurityAuth(campus) {
  return Boolean(
    SUPER_ADMIN_TOKEN ||
    SECURITY_TOKEN ||
    getCampusRoleToken(campus, 'security') ||
    getCampusRoleToken(campus, 'super-admin')
  );
}

async function sendWelcomeSms(student) {
  const cfg = getSmsConfig();
  if (!cfg.enabled || !cfg.welcomeEnabled || !cfg.apiKey) return;
  const campusName = String(student.campus || DEFAULT_CAMPUS);
  const message = fillTemplate(cfg.welcomeTemplate, {
    name: student.name || '',
    campus: campusName,
    phone: student.phone || ''
  });
  const result = await sendSingle({ to: student.phone, message });
  await insertSmsLogs([createSmsLog(
    result,
    student,
    student.campus || DEFAULT_CAMPUS,
    'registration-welcome',
    cfg.provider,
    new Date().toISOString()
  )]);
}

app.get('/api', (req, res) => {
  res.json({
    message: `${CAMPUS_INSTITUTE_NAME} API is available`,
    campusInstitute: CAMPUS_INSTITUTE_NAME,
    campuses: SUB_CAMPUSES,
    endpoints: [
      '/api/campus-qr',
      '/api/register',
      '/api/generate-token',
      '/api/scan-entry',
      '/api/verify-token',
      '/api/classes',
      '/api/classes/availability',
      '/api/classes/bookings',
      '/api/admin/classes',
      '/api/admin/classes/attendance',
      '/api/admin/classes/analytics',
      '/api/admin/today',
      '/api/admin/students',
      '/api/admin/stats',
      '/api/admin/visits',
      '/api/admin/retention',
      '/api/sms/status'
    ]
  });
});

app.post('/api/register', async (req, res) => {
  try {
    if (!classScheduleSchemaReady) {
      return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    }
    const { name, phone, date_of_birth: dateOfBirth, purpose, campus, classBookings } = req.body || {};
    const campusName = resolveCampusName(campus || DEFAULT_CAMPUS);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (!isValidDateString(dateOfBirth) || dateOfBirth > currentAccraDateString()) {
      return res.status(400).json({ error: 'A valid date of birth that is not in the future is required.' });
    }
    if (!Array.isArray(classBookings) || classBookings.length < 1 || classBookings.length > 10 ||
        classBookings.some((booking) => !booking || typeof booking.classId !== 'string' ||
          !booking.classId.trim() || !isValidDateString(booking.classDate))) {
      return res.status(400).json({ error: 'Select at least one valid class session to complete registration.' });
    }
    const bookingKeys = classBookings.map((booking) => `${booking.classId}:${booking.classDate}`);
    if (new Set(bookingKeys).size !== bookingKeys.length) {
      return res.status(400).json({ error: 'A class session can only be selected once.' });
    }

    const existing = await findStudentByPhoneAndCampus(phone.trim(), campusName);
    if (existing) {
      return res.status(400).json({ error: 'This phone is already registered for this campus.' });
    }

    const student = {
      id: uuidv4(),
      name: name.trim(),
      phone: phone.trim(),
      date_of_birth: dateOfBirth,
      purpose: (purpose || '').trim(),
      campus: campusName,
      created_at: new Date().toISOString()
    };

    const classDate = currentAccraDateString();
    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Accra',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date());
    const selectedBookings = classBookings.map((booking) => ({
      id: uuidv4(),
      class_id: booking.classId.trim(),
      class_date: booking.classDate,
      created_at: student.created_at,
      updated_at: student.created_at
    }));
    const registration = await registerStudentWithClassBookings(student, selectedBookings, classDate, currentTime);

    sendWelcomeSms(student).catch((error) => {
      console.error('Welcome SMS processing failed:', error);
    });

    res.json({
      success: true,
      message: 'Registration successful',
      studentId: student.id,
      campus: student.campus,
      bookings: registration.bookings
    });
  } catch (error) {
    const message = String(error.message || '');
    if (/class is full/i.test(message)) return res.status(409).json({ error: 'A selected class session is full.' });
    if (/already ended|outside the schedule|not open|academic term is not active/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    if (/duplicate|unique/i.test(message)) return res.status(409).json({ error: 'Registration already exists or a selected class session was booked.' });
    if (/PGRST20[25]|42P01|register_student_with_class_bookings/i.test(message)) {
      classScheduleSchemaReady = false;
      return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/health', async (_req, res) => {
  const status = await checkSupabaseHealth();
  res.json({
    ok: true,
    ...status,
    classScheduleReady: classScheduleSchemaReady,
    uptime: Math.round(process.uptime())
  });
});

app.get('/api/campus-qr', async (req, res) => {
  try {
    const campusName = resolveCampusName(req.query.campus || DEFAULT_CAMPUS);
    const { campusCode } = await ensureCampusQr(campusName);
    const registrationUrl = `${buildBaseUrl(req)}/register?code=${campusCode}&campus=${encodeURIComponent(campusName)}`;
    const customImagePath = path.join(process.cwd(), 'public', 'custom-campus-qr.png');
    try {
      await fs.access(customImagePath);
      const imageUrl = `${buildBaseUrl(req)}/custom-campus-qr.png`;
      return res.json({ qrCodeUrl: imageUrl, code: campusCode, campus: campusName, registrationUrl });
    } catch {
      const qrDataURL = await QRCode.toDataURL(registrationUrl);
      return res.json({ qrCodeUrl: qrDataURL, code: campusCode, campus: campusName, registrationUrl });
    }
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.post('/api/generate-token', async (req, res) => {
  try {
    const { phone, campusCode, code, campus } = req.body;
    const providedCode = campusCode || code;
    const campusName = resolveCampusName(campus || await resolveCampusFromCode(providedCode) || DEFAULT_CAMPUS);
    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (providedCode) {
      const { campusCode: expectedCode } = await ensureCampusQr(campusName);
      const legacyCode = getSettingSync('campus_qr');
      if (providedCode !== expectedCode && providedCode !== legacyCode) {
        return res.status(400).json({ error: 'Invalid campus code' });
      }
    }

    const student = await findStudentByPhoneAndCampus(phone.trim(), campusName);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const tokenData = await createTokenForStudent(student.id, campusName);
    res.json(await buildTokenResponse(tokenData, student));
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate access token' });
  }
});

app.post('/api/scan-entry', async (req, res) => {
  try {
    const { qrCode, phone, campus } = req.body;
    const campusName = resolveCampusName(campus || await resolveCampusFromCode(qrCode) || DEFAULT_CAMPUS);
    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (qrCode) {
      const { campusCode: expectedCode } = await ensureCampusQr(campusName);
      const legacyCode = getSettingSync('campus_qr');
      if (qrCode !== expectedCode && qrCode !== legacyCode) {
        return res.status(400).json({ error: 'Invalid QR code' });
      }
    }

    const student = await findStudentByPhoneAndCampus(phone.trim(), campusName);
    if (!student) {
      return res.status(404).json({ error: 'Student not registered. Please register first.' });
    }

    const tokenData = await createTokenForStudent(student.id, campusName);
    res.json(await buildTokenResponse(tokenData, student));
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Failed to generate access token' });
  }
});

app.post('/api/verify-token', requireSecurityAuth, async (req, res) => {
  try {
    const { token, campus } = req.body;
    const campusName = resolveCampusName(campus || req.userCampus || DEFAULT_CAMPUS);
    const normalizedToken = String(token || '').trim().toUpperCase();
    if (!ACCESS_TOKEN_PATTERN.test(normalizedToken)) {
      return res.status(400).json({ valid: false, error: 'Token must be a 4-digit code' });
    }

    const today = currentDateString();
    const tokenData = await findTokenByCode(campusName, normalizedToken, today);
    if (!tokenData) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired token for this campus' });
    }

    const verifiedAt = new Date().toISOString();
    await markTokenVerified(tokenData.id, verifiedAt);

    const student = await findStudentById(tokenData.student_id);
    res.json({
      valid: true,
      student: {
        name: student.name,
        phone: student.phone,
        purpose: student.purpose,
        campus: student.campus,
        flagged: Boolean(student.flagged),
        flagNote: student.flag_note || ''
      },
      validDate: tokenData.valid_date,
      campus: tokenData.campus,
      verifiedAt
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/classes', async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = resolveCampusName(req.query.campus || DEFAULT_CAMPUS);
    const terms = await listAcademicTerms(campus);
    const activeTerm = terms.find((term) => term.status === 'active');
    if (!activeTerm) return res.json({ term: null, classes: [] });
    const schedules = await listClassSchedules(campus, activeTerm.id);
    const classes = schedules.filter((classSchedule) => classSchedule.status === 'published');
    return res.json({ term: activeTerm, classes });
  } catch (error) {
    console.error('Public class timetable lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load the class timetable.' });
  }
});

app.get('/api/classes/availability', async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = resolveCampusName(req.query.campus || DEFAULT_CAMPUS);
    const classId = String(req.query.class_id || '');
    const classDate = req.query.date;
    if (!classId || !isValidDateString(classDate)) {
      return res.status(400).json({ error: 'Choose a class and valid class date.' });
    }
    const classSchedule = await getClassSchedule(classId, campus);
    if (!classSchedule || classSchedule.status !== 'published') {
      return res.json({ available: false, reason: 'Registration is closed for this class.' });
    }
    const term = await getAcademicTerm(classSchedule.term_id, campus);
    if (!term || term.status !== 'active' || classDate < term.start_date || classDate > term.end_date ||
        new Date(`${classDate}T00:00:00.000Z`).getUTCDay() !== classSchedule.day_of_week) {
      return res.json({ available: false, reason: 'This class does not meet on the selected date.' });
    }
    const today = currentAccraDateString();
    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Accra',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date());
    if (classDate < today || (classDate === today && currentTime >= classSchedule.end_time)) {
      return res.json({ available: false, reason: 'This class session has ended.' });
    }
    const bookedCount = await countActiveClassBookings(classId, classDate);
    const remainingCapacity = Math.max(0, classSchedule.capacity - bookedCount);
    return res.json({
      available: remainingCapacity > 0,
      capacity: classSchedule.capacity,
      bookedCount,
      remainingCapacity,
      reason: remainingCapacity > 0 ? '' : 'This class session is full.'
    });
  } catch (error) {
    console.error('Class availability query failed:', error);
    return res.status(500).json({ error: 'Unable to check class availability.' });
  }
});

app.get('/api/classes/bookings', async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = resolveCampusName(req.query.campus || DEFAULT_CAMPUS);
    const phone = String(req.query.phone || '').trim();
    const name = String(req.query.name || '').trim();
    if (!phone || !validatePhone(phone) || !name) {
      return res.status(400).json({ error: 'Enter your registered name and phone number.' });
    }
    const student = await findStudentByPhoneAndCampus(phone, campus);
    if (!student || student.name.trim().toLowerCase() !== name.toLowerCase()) {
      return res.status(404).json({ error: 'No student registration matches that name, phone number, and campus.' });
    }
    const bookings = await listClassBookings({ campus, studentId: student.id });
    return res.json({ bookings });
  } catch (error) {
    console.error('Student class booking lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load class bookings.' });
  }
});

app.post('/api/classes/bookings', async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const { classId, classDate, phone, name, campus: requestedCampus } = req.body || {};
    const campus = resolveCampusName(requestedCampus || DEFAULT_CAMPUS);
    const normalizedPhone = String(phone || '').trim();
    if (!normalizedPhone || !validatePhone(normalizedPhone) || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Enter your registered name and phone number.' });
    }
    if (typeof classId !== 'string' || !classId.trim() || !isValidDateString(classDate)) {
      return res.status(400).json({ error: 'Choose a class and a valid class date.' });
    }
    const student = await findStudentByPhoneAndCampus(normalizedPhone, campus);
    if (!student) return res.status(404).json({ error: 'Register for campus access before booking a class.' });
    if (student.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
      return res.status(404).json({ error: 'Student name does not match the campus registration.' });
    }
    const classSchedule = await getClassSchedule(classId, campus);
    if (!classSchedule) return res.status(404).json({ error: 'Class not found for this campus.' });
    if (classDate === currentAccraDateString()) {
      const currentTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Accra',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(new Date());
      if (currentTime >= classSchedule.end_time) {
        return res.status(400).json({ error: 'This class session has already ended and cannot be booked.' });
      }
    }
    const now = new Date().toISOString();
    const booking = await createClassBooking({
      id: uuidv4(),
      class_id: classId,
      student_id: student.id,
      campus,
      class_date: classDate,
      status: 'booked',
      created_at: now,
      updated_at: now
    }, currentAccraDateString());
    return res.status(201).json({ success: true, booking });
  } catch (error) {
    const message = String(error.message || '');
    if (/full/i.test(message)) return res.status(409).json({ error: 'This class session is full.' });
    if (/duplicate|unique/i.test(message)) return res.status(409).json({ error: 'You already booked this class session.' });
    if (/not open|outside the schedule|active/i.test(message)) return res.status(400).json({ error: message });
    console.error('Class booking failed:', error);
    return res.status(500).json({ error: 'Unable to create the class booking.' });
  }
});

app.post('/api/classes/bookings/:id/cancel', async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = resolveCampusName(req.body?.campus || DEFAULT_CAMPUS);
    const phone = String(req.body?.phone || '').trim();
    const name = String(req.body?.name || '').trim();
    if (!phone || !validatePhone(phone) || !name) return res.status(400).json({ error: 'Enter your registered name and phone number.' });
    const student = await findStudentByPhoneAndCampus(phone, campus);
    if (!student) return res.status(404).json({ error: 'Student registration not found.' });
    if (student.name.trim().toLowerCase() !== name.toLowerCase()) return res.status(404).json({ error: 'Student name does not match the campus registration.' });
    const booking = (await listClassBookings({ bookingId: req.params.id, campus, studentId: student.id }))[0];
    if (!booking || booking.status !== 'booked') return res.status(404).json({ error: 'Active class booking not found.' });
    const today = currentAccraDateString();
    if (booking.class_date < today) return res.status(400).json({ error: 'Past class bookings cannot be cancelled.' });
    if (booking.class_date === today) {
      const currentTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Accra',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(new Date());
      if (currentTime >= booking.start_time_snapshot) {
        return res.status(400).json({ error: 'A class booking cannot be cancelled after the class starts.' });
      }
    }
    const cancelled = await cancelClassBooking(booking.id, student.id, new Date().toISOString());
    if (!cancelled) return res.status(409).json({ error: 'This class booking was already changed.' });
    return res.json({ success: true, message: 'Class booking cancelled.' });
  } catch (error) {
    console.error('Class booking cancellation failed:', error);
    return res.status(500).json({ error: 'Unable to cancel the class booking.' });
  }
});

app.post('/api/classes/bookings/:id/calendar', async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = resolveCampusName(req.body?.campus || DEFAULT_CAMPUS);
    const phone = String(req.body?.phone || '').trim();
    const name = String(req.body?.name || '').trim();
    if (!phone || !validatePhone(phone) || !name) {
      return res.status(400).json({ error: 'Enter your registered name and phone number.' });
    }
    const student = await findStudentByPhoneAndCampus(phone, campus);
    if (!student || student.name.trim().toLowerCase() !== name.toLowerCase()) {
      return res.status(404).json({ error: 'Student registration not found.' });
    }
    const booking = (await listClassBookings({
      bookingId: req.params.id,
      campus,
      studentId: student.id
    }))[0];
    if (!booking || booking.status !== 'booked') {
      return res.status(404).json({ error: 'Active class booking not found.' });
    }
    if (!booking.calendar_added_at) {
      const clickedAt = new Date().toISOString();
      const marked = await markClassBookingCalendarAdded(booking.id, student.id, campus, clickedAt);
      if (!marked) {
        const latestBooking = (await listClassBookings({
          bookingId: booking.id,
          campus,
          studentId: student.id
        }))[0];
        if (!latestBooking?.calendar_added_at) {
          return res.status(409).json({ error: 'Unable to record the calendar selection. Please try again.' });
        }
        return res.json({ success: true, calendarAddedAt: latestBooking.calendar_added_at });
      }
      return res.json({ success: true, calendarAddedAt: clickedAt });
    }
    return res.json({ success: true, calendarAddedAt: booking.calendar_added_at });
  } catch (error) {
    console.error('Calendar selection tracking failed:', error);
    return res.status(500).json({ error: 'Unable to record the calendar selection.' });
  }
});

app.get('/api/admin/academic-terms', requireAdminAuth, async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = getAdminTargetCampus(req);
    if (!campus) return res.status(400).json({ error: 'Select one campus to manage its timetable.' });
    return res.json({ terms: await listAcademicTerms(campus), campus });
  } catch (error) {
    console.error('Academic term query failed:', error);
    return res.status(500).json({ error: 'Unable to load academic terms.' });
  }
});

app.post('/api/admin/academic-terms', requireAdminAuth, async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = getAdminTargetCampus(req);
    if (!campus) return res.status(400).json({ error: 'Select one campus to manage its timetable.' });
    const { id, name, start_date: startDate, end_date: endDate, status = 'inactive' } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || !isValidDateString(startDate) ||
        !isValidDateString(endDate) || endDate < startDate || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Provide a term name, valid date range, and active or inactive status.' });
    }
    const now = new Date().toISOString();
    const term = {
      id: typeof id === 'string' && id ? id : uuidv4(),
      campus,
      name: name.trim().slice(0, 100),
      start_date: startDate,
      end_date: endDate,
      status,
      created_at: now,
      updated_at: now
    };
    if (id) {
      const existing = await getAcademicTerm(id, campus);
      if (!existing) return res.status(404).json({ error: 'Academic term not found for this campus.' });
      term.created_at = existing.created_at;
    }
    if (status === 'active') await setOtherTermsInactive(campus, term.id, now);
    await saveAcademicTerm(term);
    return res.json({ success: true, term });
  } catch (error) {
    console.error('Academic term save failed:', error);
    return res.status(500).json({ error: 'Unable to save the academic term.' });
  }
});

app.get('/api/admin/classes', requireAdminAuth, async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = getAdminTargetCampus(req);
    if (!campus) return res.status(400).json({ error: 'Select one campus to manage its timetable.' });
    const [terms, classes] = await Promise.all([
      listAcademicTerms(campus),
      listClassSchedules(campus, req.query.term_id)
    ]);
    return res.json({ terms, classes, campus });
  } catch (error) {
    console.error('Admin class timetable query failed:', error);
    return res.status(500).json({ error: 'Unable to load the class timetable.' });
  }
});

app.post('/api/admin/classes', requireAdminAuth, async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = getAdminTargetCampus(req);
    if (!campus) return res.status(400).json({ error: 'Select one campus to manage its timetable.' });
    const payload = req.body || {};
    const term = typeof payload.term_id === 'string' ? await getAcademicTerm(payload.term_id, campus) : null;
    const dayOfWeek = Number(payload.day_of_week);
    const capacity = Number(payload.capacity);
    const status = payload.status || 'draft';
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const classroom = typeof payload.classroom === 'string' ? payload.classroom.trim() : '';
    if (!term || !title || title.length > 120 || !classroom || classroom.length > 100 ||
        !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 ||
        !isValidTime(payload.start_time) || !isValidTime(payload.end_time) || payload.start_time >= payload.end_time ||
        !Number.isInteger(capacity) || capacity < 1 || capacity > 5000 ||
        !['draft', 'published', 'disabled', 'cancelled'].includes(status) ||
        (payload.description && String(payload.description).length > 2000) ||
        (payload.instructor && String(payload.instructor).length > 120)) {
      return res.status(400).json({ error: 'Provide valid class details, schedule, room, capacity, term, and status.' });
    }

    const now = new Date().toISOString();
    const id = typeof payload.id === 'string' && payload.id ? payload.id : uuidv4();
    const existing = payload.id ? await getClassSchedule(payload.id, campus) : null;
    if (payload.id && !existing) return res.status(404).json({ error: 'Class not found for this campus.' });
    const schedule = {
      id,
      term_id: term.id,
      campus,
      title,
      description: String(payload.description || '').trim(),
      day_of_week: dayOfWeek,
      start_time: payload.start_time,
      end_time: payload.end_time,
      classroom,
      capacity,
      instructor: String(payload.instructor || '').trim(),
      status,
      created_at: existing?.created_at || now,
      updated_at: now
    };

    const terms = await listAcademicTerms(campus);
    const termById = new Map(terms.map((item) => [item.id, item]));
    const schedules = await listClassSchedules(campus);
    const overlaps = schedules.some((other) => {
      if (other.id === id || other.status === 'cancelled' || other.day_of_week !== dayOfWeek ||
          other.classroom.trim().toLowerCase() !== classroom.toLowerCase() ||
          other.start_time >= schedule.end_time || schedule.start_time >= other.end_time) return false;
      const otherTerm = termById.get(other.term_id);
      if (!otherTerm) return false;
      return term.start_date <= otherTerm.end_date && otherTerm.start_date <= term.end_date;
    });
    if (overlaps) return res.status(409).json({ error: 'That classroom is already scheduled for an overlapping class at this time.' });

    const activeBookings = existing ? await listClassBookings({ classId: id, status: 'booked' }) : [];
    const bookingsPerDate = new Map();
    activeBookings.forEach((booking) => bookingsPerDate.set(
      booking.class_date,
      (bookingsPerDate.get(booking.class_date) || 0) + 1
    ));
    if ([...bookingsPerDate.values()].some((count) => count > capacity)) {
      return res.status(409).json({ error: 'Capacity cannot be lower than existing bookings for a class session.' });
    }

    const scheduleChanged = Boolean(existing && (
      existing.term_id !== schedule.term_id ||
      existing.title !== schedule.title ||
      existing.day_of_week !== schedule.day_of_week ||
      existing.start_time !== schedule.start_time ||
      existing.end_time !== schedule.end_time ||
      existing.classroom !== schedule.classroom
    ));
    await saveClassSchedule(schedule);
    let notifications = { accepted: 0, failed: 0, skipped: 0, historyErrors: 0 };
    if (existing && status === 'cancelled' && existing.status !== 'cancelled') {
      const affected = await updateFutureClassBookings(id, 'class_cancelled', currentAccraDateString(), now);
      notifications = await notifyClassBookingChanges(affected, 'class-cancelled', schedule);
    } else if (scheduleChanged && status !== 'cancelled') {
      const affected = await updateFutureClassBookings(id, 'schedule_changed', currentAccraDateString(), now);
      notifications = await notifyClassBookingChanges(affected, 'schedule-changed', schedule);
    }
    return res.json({ success: true, class: schedule, notifications });
  } catch (error) {
    console.error('Class schedule save failed:', error);
    return res.status(500).json({ error: 'Unable to save the class schedule.' });
  }
});

app.get('/api/admin/classes/attendance', requireAdminAuth, async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = getAdminTargetCampus(req);
    const classDate = req.query.date;
    const classId = typeof req.query.class_id === 'string' ? req.query.class_id : '';
    if (!campus) return res.status(400).json({ error: 'Select one campus to view class attendance.' });
    if (!isValidDateString(classDate)) return res.status(400).json({ error: 'Use a valid class date in YYYY-MM-DD format.' });
    if (classId && !(await getClassSchedule(classId, campus))) {
      return res.status(404).json({ error: 'Class not found for this campus.' });
    }
    const [bookings, campusEntries] = await Promise.all([
      listClassBookings({ campus, classDate, classId }),
      listTokensVerifiedOn(campus, classDate)
    ]);
    const campusEntryByStudent = new Map();
    campusEntries.forEach((entry) => {
      const current = campusEntryByStudent.get(entry.student_id);
      if (!current || entry.verified_at < current.verified_at) campusEntryByStudent.set(entry.student_id, entry);
    });
    const checkedInStudents = new Set(campusEntryByStudent.keys());
    const activeBookings = bookings.filter((booking) => booking.status === 'booked');
    const bookedStudents = new Set(activeBookings.map((booking) => booking.student_id));
    const roster = bookings.map((booking) => ({
      ...booking,
      campus_attended: checkedInStudents.has(booking.student_id),
      campus_entry_at: campusEntryByStudent.get(booking.student_id)?.verified_at || null,
      class_attendance: booking.status !== 'booked' ? booking.status : booking.attendance?.status || 'pending'
    }));
    const campusOnly = [...campusEntryByStudent.values()].filter((entry) => !bookedStudents.has(entry.student_id));
    const summary = {
      campusEntries: checkedInStudents.size,
      classBookings: activeBookings.length,
      present: activeBookings.filter((booking) => booking.attendance?.status === 'present').length,
      absent: activeBookings.filter((booking) => booking.attendance?.status === 'absent').length,
      pending: activeBookings.filter((booking) => !booking.attendance).length,
      enteredWithoutClassBooking: campusOnly.length,
      bookedWithoutCampusEntry: activeBookings.filter((booking) => !checkedInStudents.has(booking.student_id)).length
    };
    return res.json({ date: classDate, summary, roster, campusOnly });
  } catch (error) {
    console.error('Class attendance report failed:', error);
    return res.status(500).json({ error: 'Unable to load class attendance.' });
  }
});

app.get('/api/admin/classes/analytics', requireAdminAuth, async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = getAdminTargetCampus(req);
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    if (!campus) return res.status(400).json({ error: 'Select one campus to view class analytics.' });
    if (!isValidDateString(startDate) || !isValidDateString(endDate) || startDate > endDate) {
      return res.status(400).json({ error: 'Choose a valid date range in YYYY-MM-DD format.' });
    }
    const rangeDays = (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86400000;
    if (rangeDays > 1825) return res.status(400).json({ error: 'Class analytics date ranges cannot exceed five years.' });
    const analytics = await getClassAttendanceAnalytics(campus, startDate, endDate);
    return res.json({ campus, startDate, endDate, ...analytics });
  } catch (error) {
    console.error('Class analytics query failed:', error);
    return res.status(500).json({ error: 'Unable to load class analytics.' });
  }
});

app.put('/api/admin/classes/bookings/:id/attendance', requireAdminAuth, async (req, res) => {
  try {
    if (!classScheduleSchemaReady) return res.status(503).json({ error: CLASS_SCHEDULE_SETUP_ERROR });
    const campus = getAdminTargetCampus(req);
    const status = req.body?.status;
    if (!campus) return res.status(400).json({ error: 'Select one campus to record class attendance.' });
    if (!['present', 'absent'].includes(status)) return res.status(400).json({ error: 'Attendance must be present or absent.' });
    const booking = (await listClassBookings({ campus, bookingId: req.params.id }))[0];
    if (!booking || booking.status !== 'booked') return res.status(404).json({ error: 'Active class booking not found.' });
    const today = currentAccraDateString();
    if (booking.class_date > today) return res.status(400).json({ error: 'Attendance cannot be recorded for a future class.' });
    if (booking.class_date === today) {
      const currentTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Accra',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(new Date());
      if (status === 'absent' && currentTime < booking.end_time_snapshot) {
        return res.status(400).json({ error: 'An absence can only be recorded after the scheduled class ends.' });
      }
      if (status === 'present' && currentTime < booking.start_time_snapshot) {
        return res.status(400).json({ error: 'Attendance cannot be recorded before the scheduled class starts.' });
      }
    }
    const attendance = {
      id: booking.attendance?.id || uuidv4(),
      booking_id: booking.id,
      class_id: booking.class_id,
      student_id: booking.student_id,
      class_date: booking.class_date,
      status,
      verified_by: req.authenticatedRole || 'admin',
      verified_at: new Date().toISOString()
    };
    await saveClassAttendance(attendance);
    return res.json({ success: true, attendance });
  } catch (error) {
    console.error('Class attendance update failed:', error);
    return res.status(500).json({ error: 'Unable to update class attendance.' });
  }
});

app.get('/api/classes/notices', async (req, res) => {
  try {
    const campus = resolveCampusName(req.query.campus || DEFAULT_CAMPUS);
    const phone = String(req.query.phone || '').trim();
    const name = String(req.query.name || '').trim();
    if (!phone || !validatePhone(phone) || !name) return res.status(400).json({ error: 'Enter your registered name and phone number.' });
    const student = await findStudentByPhoneAndCampus(phone, campus);
    if (!student || student.name.trim().toLowerCase() !== name.toLowerCase()) return res.status(404).json({ error: 'Student registration not found.' });
    const bookings = await listClassBookings({ campus, studentId: student.id });
    return res.json({
      notices: bookings.flatMap((booking) => (booking.notifications || []).map((notice) => ({
        event: notice.event,
        status: notice.status,
        error: notice.error,
        created_at: notice.created_at,
        booking_id: booking.id
      })))
    });
  } catch (error) {
    console.error('Class notification history lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load class change notices.' });
  }
});

app.post('/api/validate-login', async (req, res) => {
  try {
    const { role, campus, password } = req.body || {};
    const selectedRole = String(role || '').toLowerCase();
    const selectedCampus = resolveCampusName(campus || DEFAULT_CAMPUS);
    const passwordValue = String(password || '').trim();

    if (!selectedRole || !['admin', 'security', 'super-admin'].includes(selectedRole)) {
      return res.status(400).json({ valid: false, error: 'Valid role is required.' });
    }

    if (!passwordValue) {
      return res.status(400).json({ valid: false, error: 'Password is required.' });
    }

    if (selectedRole === 'super-admin') {
      const expected = getCampusRoleToken(selectedCampus, 'super-admin');
      const isValid = Boolean(expected) && await isMatchingToken(passwordValue, expected);
      if (!isValid) {
        return res.json({ valid: false, role: 'super-admin', campus: selectedCampus });
      }

      await upgradeLegacyCampusPassword(selectedCampus, selectedRole, passwordValue);
      const session = await createSession({ id: uuidv4(), role: 'super-admin', campus: selectedCampus, is_super_admin: true, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
      setSessionCookie(res, session.id);
      return res.json({
        valid: true,
        role: 'super-admin',
        campus: selectedCampus,
        expiresAt: session.expires_at
      });
    }

    const expected = selectedRole === 'admin'
      ? getCampusRoleToken(selectedCampus, 'admin') || ADMIN_TOKEN
      : getCampusRoleToken(selectedCampus, 'security') || SECURITY_TOKEN;

    const isValid = Boolean(expected) && await isMatchingToken(passwordValue, expected);
    if (!isValid) {
      return res.json({ valid: false, role: selectedRole, campus: selectedCampus });
    }

    await upgradeLegacyCampusPassword(selectedCampus, selectedRole, passwordValue);
    const session = await createSession({ id: uuidv4(), role: selectedRole, campus: selectedCampus, is_super_admin: false, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
    setSessionCookie(res, session.id);
    return res.json({
      valid: true,
      role: selectedRole,
      campus: selectedCampus,
      expiresAt: session.expires_at
    });
  } catch (error) {
    console.error('Password validation error:', error);
    return res.status(500).json({ valid: false, error: 'Validation failed.' });
  }
});

app.get('/api/session', async (req, res) => {
  try {
    const session = await resolveSession(getSessionIdFromRequest(req));
    if (!session) {
      return res.status(401).json({ valid: false, error: 'Session expired or invalid.' });
    }

    return res.json({
      valid: true,
      role: session.role,
      campus: session.campus,
      isSuperAdmin: Boolean(session.is_super_admin),
      expiresAt: session.expires_at
    });
  } catch (error) {
    console.error('Session lookup failed:', error.message || error);
    return res.status(500).json({ valid: false, error: 'Session lookup failed.' });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    await deleteSession(getSessionIdFromRequest(req));
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout failed:', error.message || error);
    res.status(500).json({ success: false, error: 'Logout failed.' });
  }
});

app.get('/api/super-admin/passwords', requireAdminAuth, (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required.' });
    }

    const adminMap = readStoredCampusTokenMap('admin');
    const securityMap = readStoredCampusTokenMap('security');
    const superAdminMap = readStoredCampusTokenMap('super-admin');
    res.json({
      admin: Object.fromEntries(Object.keys(adminMap).map((campus) => [campus, true])),
      security: Object.fromEntries(Object.keys(securityMap).map((campus) => [campus, true])),
      superAdmin: Object.fromEntries(Object.keys(superAdminMap).map((campus) => [campus, true])),
      campuses: SUB_CAMPUSES
    });
  } catch (error) {
    console.error('Password map fetch error:', error);
    return res.status(500).json({ error: 'Failed to load campus password settings.' });
  }
});

app.post('/api/super-admin/passwords', requireAdminAuth, async (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required.' });
    }

    const { campus, role, password } = req.body || {};
    const selectedRole = String(role || '').toLowerCase();
    const selectedCampus = resolveCampusName(campus || DEFAULT_CAMPUS);

    if (!selectedRole || !['admin', 'security', 'super-admin'].includes(selectedRole)) {
      return res.status(400).json({ error: 'Role must be admin, security, or super-admin.' });
    }
    if (typeof password !== 'string' || password.trim().length < 12) {
      return res.status(400).json({ error: 'Passwords must be at least 12 characters long.' });
    }

    await setCampusRoleToken(selectedCampus, selectedRole, password);

    return res.json({
      success: true,
      campus: selectedCampus,
      role: selectedRole,
      updated: true
    });
  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ error: 'Failed to update campus password.' });
  }
});

app.get('/api/admin/today', requireAdminAuth, async (req, res) => {
  try {
    const targetCampus = getAdminTargetCampus(req);
    const today = currentDateString();
    const rows = await listTokensVerifiedOn(targetCampus, today);
    const students = rows.map(token => ({
      name: token.name,
      phone: token.phone,
      purpose: token.purpose,
      campus: token.campus,
      used_at: token.used_at
    }));
    res.json({ date: today, count: students.length, students, campus: targetCampus || 'ALL CAMPUSES' });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/admin/students', requireAdminAuth, async (req, res) => {
  try {
    const targetCampus = getAdminTargetCampus(req);
    const rows = await listStudents(targetCampus);
    res.json({ count: rows.length, students: rows, campus: targetCampus || 'ALL CAMPUSES' });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const campus = getAdminTargetCampus(req);
    const today = currentDateString();
    const thisWeek = getPeriodRange('week');
    const thisMonth = getPeriodRange('month');

    const stats = await getCampusStats(campus, today, thisWeek.start, thisWeek.end, thisMonth.start, thisMonth.end);

    res.json({ campus: campus || 'ALL CAMPUSES', ...stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

app.get('/api/admin/visits', requireAdminAuth, async (req, res) => {
  try {
    const { range = 'day', start, end, campus, purpose } = req.query;
    let periodStart = start;
    let periodEnd = end;
    const targetCampus = getAdminTargetCampus(req, campus);

    if (!periodStart || !periodEnd) {
      const rangeDates = getPeriodRange(range);
      periodStart = rangeDates.start;
      periodEnd = rangeDates.end;
    }

    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(periodStart) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(periodEnd)) {
      return res.status(400).json({ error: 'Invalid date range format. Use YYYY-MM-DD.' });
    }

    const rows = await listTokensWithStudents(targetCampus, periodStart, periodEnd);

    const purposeCounts = {};
    rows.forEach(v => {
      const key = (v.purpose || 'Not specified').trim();
      purposeCounts[key] = (purposeCounts[key] || 0) + 1;
    });
    const purposes = Object.entries(purposeCounts)
      .map(([key, count]) => ({ purpose: key, count }))
      .sort((a, b) => b.count - a.count);

    const filterTerm = String(purpose || '').trim().toLowerCase();
    const filteredRows = filterTerm
      ? rows.filter(v => (v.purpose || 'Not specified').trim().toLowerCase() === filterTerm)
      : rows;

    const students = filteredRows.map(v => ({
      name: v.name,
      phone: v.phone,
      purpose: v.purpose,
      campus: v.campus,
      used_at: v.used_at,
      valid_date: v.valid_date
    }));

    res.json({ range, start: periodStart, end: periodEnd, count: students.length, students, purposes, campus: targetCampus || 'ALL CAMPUSES' });
  } catch (error) {
    console.error('Visits query error:', error);
    res.status(500).json({ error: 'Failed to fetch visit data' });
  }
});

app.get('/api/admin/retention', requireAdminAuth, async (req, res) => {
  try {
    const campus = getAdminTargetCampus(req);
    const result = await getRetention(campus);
    res.json({ ...result, campus: campus || 'ALL CAMPUSES' });
  } catch (error) {
    console.error('Retention query error:', error);
    res.status(500).json({ error: 'Failed to fetch retention data' });
  }
});

app.get('/api/admin/retention/settings', requireAdminAuth, (req, res) => {
  const campus = getAdminTargetCampus(req);
  res.json({ settings: getRetentionSmsSettings(campus), campus: campus || 'ALL CAMPUSES' });
});

app.put('/api/admin/retention/settings', requireAdminAuth, async (req, res) => {
  const campus = getAdminTargetCampus(req);
  const validated = validateRetentionSmsSettings(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  try {
    await setSetting(retentionSettingsKey(campus), JSON.stringify(validated.settings));
    res.json({ success: true, settings: validated.settings, campus: campus || 'ALL CAMPUSES' });
  } catch (error) {
    console.error('Retention settings save error:', error);
    res.status(500).json({ error: 'Failed to save retention SMS settings' });
  }
});

app.get('/api/admin/retention/auto-campaign/preview', requireAdminAuth, async (req, res) => {
  try {
    const campus = getAdminTargetCampus(req);
    const settings = getRetentionSmsSettings(campus);
    const preview = await getAutoCampaignCandidates(campus, settings);
    res.json({
      success: true,
      campus: campus || 'ALL CAMPUSES',
      cooldownDays: settings.cooldownDays,
      cohorts: preview.counts,
      settings,
      recipients: preview.eligible.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        phone: maskPhone(recipient.phone),
        status: recipient.status,
        visit_count: recipient.visit_count,
        last_visit: recipient.last_visit,
        days_since_last: recipient.days_since_last,
        source: recipient.source,
        message: recipient.message
      }))
    });
  } catch (error) {
    console.error('Retention campaign preview error:', error);
    res.status(500).json({ error: 'Failed to preview retention campaign' });
  }
});

let retentionDispatchInProgress = false;
async function dispatchRetentionCampaign(campus, settings, campaignId = null, recipientIds = null) {
  if (retentionDispatchInProgress) {
    const error = new Error('Another retention campaign is currently being sent. Try again shortly.');
    error.statusCode = 409;
    throw error;
  }
  retentionDispatchInProgress = true;
  try {
    const preview = await getAutoCampaignCandidates(campus, settings);
    const selectedIds = recipientIds == null ? null : new Set(recipientIds);
    const eligible = selectedIds
      ? preview.eligible.filter((recipient) => selectedIds.has(recipient.id))
      : preview.eligible;
    const counts = {
      ...preview.counts,
      firstTimeFollowUpsCount: eligible.filter((row) => row.source === 'first-time-followup').length,
      atRiskReengagementsCount: eligible.filter((row) => row.source === 'at-risk-winback').length,
      totalEligible: eligible.length,
      excludedSincePreview: selectedIds ? Math.max(0, selectedIds.size - eligible.length) : 0
    };
    const cfg = getSmsConfig();
    const isReady = cfg.enabled && cfg.apiKey;
    const createdAt = new Date().toISOString();
    let sendResult = { sent: 0, failed: 0, skipped: eligible.length, reason: 'SMS not enabled' };

    if (isReady && eligible.length > 0) {
      const results = [];
      for (const recipient of eligible) {
        const result = await sendSingle({ to: recipient.phone, message: recipient.message });
        results.push({
          ...result,
          name: recipient.name,
          recipientId: recipient.id,
          campus: recipient.campus,
          type: recipient.source
        });
      }
      sendResult = {
        sent: results.filter((result) => result.sent).length,
        failed: results.filter((result) => !result.sent).length,
        skipped: 0,
        provider: cfg.provider
      };
      const historyWarning = await persistSmsLogs(results.map((result) => createSmsLog(
        result,
        { id: result.recipientId, name: result.name, phone: result.to, campus: result.campus },
        result.campus || campus || DEFAULT_CAMPUS,
        result.type,
        cfg.provider,
        createdAt
      )));
      if (historyWarning) sendResult.historyWarning = historyWarning;
    } else if (eligible.length > 0) {
      const historyWarning = await persistSmsLogs(eligible.map((recipient) => createSmsLog(
        { sent: false, skipped: true, reason: 'SMS not configured', to: recipient.phone, recipientId: recipient.id },
        { id: recipient.id, name: recipient.name, phone: recipient.phone, campus: recipient.campus },
        recipient.campus || campus || DEFAULT_CAMPUS,
        recipient.source,
        cfg.provider,
        createdAt
      )));
      if (historyWarning) sendResult.historyWarning = historyWarning;
    }

    return {
      success: true,
      campaignId,
      cohorts: counts,
      sms: sendResult
    };
  } finally {
    retentionDispatchInProgress = false;
  }
}

app.post('/api/admin/retention/auto-campaign', requireAdminAuth, async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Preview recipients and explicitly confirm before sending.' });
  }
  if (!Array.isArray(req.body?.recipient_ids) || req.body.recipient_ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'A previewed recipient_ids array is required.' });
  }
  const validatedSettings = validateRetentionSmsSettings(req.body?.settings);
  if (validatedSettings.error) return res.status(400).json({ error: validatedSettings.error });
  try {
    const campus = getAdminTargetCampus(req, req.body?.campus);
    const result = await dispatchRetentionCampaign(campus, validatedSettings.settings, null, req.body.recipient_ids);
    res.json(result);
  } catch (error) {
    console.error('Auto-campaign error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to run retention campaign' });
  }
});

app.get('/api/admin/retention/schedules', requireAdminAuth, async (req, res) => {
  try {
    const campus = getAdminTargetCampus(req);
    const schedules = await listRetentionSchedules(campus, 50);
    res.json({ schedules, campus: campus || 'ALL CAMPUSES' });
  } catch (error) {
    console.error('Retention schedules fetch error:', error);
    res.status(500).json({ error: 'Failed to load scheduled campaigns' });
  }
});

app.post('/api/admin/retention/schedules', requireAdminAuth, async (req, res) => {
  const parsedRunAt = typeof req.body?.run_at === 'string' ? Date.parse(req.body.run_at) : NaN;
  if (!Number.isFinite(parsedRunAt) || parsedRunAt <= Date.now()) {
    return res.status(400).json({ error: 'Choose a future schedule time.' });
  }
  if (!Array.isArray(req.body?.recipient_ids) || !req.body.recipient_ids.length ||
    req.body.recipient_ids.length > 5000 || req.body.recipient_ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'Select at least one previewed member to schedule.' });
  }
  const validatedSettings = validateRetentionSmsSettings(req.body?.settings);
  if (validatedSettings.error) return res.status(400).json({ error: validatedSettings.error });
  try {
    const targetCampus = getAdminTargetCampus(req);
    const campus = targetCampus || 'ALL CAMPUSES';
    const settings = validatedSettings.settings;
    const preview = await getAutoCampaignCandidates(targetCampus, settings);
    const eligibleIds = new Set(preview.eligible.map((recipient) => recipient.id));
    const recipientIds = [...new Set(req.body.recipient_ids)];
    if (recipientIds.some((id) => !eligibleIds.has(id))) {
      return res.status(409).json({ error: 'Campaign eligibility changed. Refresh the preview before scheduling.' });
    }
    const schedule = {
      id: uuidv4(),
      campus,
      run_at: new Date(parsedRunAt).toISOString(),
      status: 'scheduled',
      templates: {
        firstTimeFollowUp: settings.firstTimeFollowUp,
        atRiskWinback: settings.atRiskWinback
      },
      recipient_ids: recipientIds,
      cooldown_days: settings.cooldownDays,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await insertRetentionSchedule(schedule);
    res.status(201).json({ success: true, schedule });
  } catch (error) {
    console.error('Retention schedule create error:', error);
    res.status(500).json({ error: 'Failed to schedule retention campaign' });
  }
});

app.delete('/api/admin/retention/schedules/:id', requireAdminAuth, async (req, res) => {
  try {
    const campus = getAdminTargetCampus(req);
    const cancelled = await cancelRetentionSchedule(req.params.id, campus);
    if (!cancelled) return res.status(404).json({ error: 'Scheduled campaign not found or already started.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Retention schedule cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel scheduled campaign' });
  }
});

async function processDueRetentionSchedules() {
  if (retentionDispatchInProgress) return;
  const now = new Date().toISOString();
  const schedules = await claimDueRetentionSchedules(now, 10);
  for (const schedule of schedules) {
    try {
      const campus = schedule.campus === 'ALL CAMPUSES' ? null : schedule.campus;
      const result = await dispatchRetentionCampaign(campus, {
        ...DEFAULT_RETENTION_SMS_SETTINGS,
        ...schedule.templates,
        cooldownDays: schedule.cooldown_days
      }, schedule.id, schedule.recipient_ids);
      await updateRetentionSchedule(schedule.id, 'completed', result);
    } catch (error) {
      console.error(`Scheduled retention campaign ${schedule.id} failed:`, error);
      if (error.statusCode === 409) {
        await updateRetentionSchedule(schedule.id, 'scheduled');
      } else {
        await updateRetentionSchedule(schedule.id, 'failed', { error: 'Campaign execution failed' });
      }
    }
  }
}

let scheduledCampaignPoller;
let schedulePollInProgress = false;
async function pollScheduledRetentionCampaigns() {
  if (schedulePollInProgress) return;
  schedulePollInProgress = true;
  try {
    await processDueRetentionSchedules();
  } catch (error) {
    console.error('Scheduled retention campaign polling failed:', error);
  } finally {
    schedulePollInProgress = false;
  }
}

function startRetentionSchedulePoller() {
  if (scheduledCampaignPoller) return;
  scheduledCampaignPoller = setInterval(pollScheduledRetentionCampaigns, 30_000);
  scheduledCampaignPoller.unref();
  pollScheduledRetentionCampaigns();
}

app.post('/api/feedback', async (req, res) => {
  try {
    const { phone, campus, rating, category, comment, studentId } = req.body || {};
    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }
    const campusName = resolveCampusName(campus || DEFAULT_CAMPUS);
    const feedbackItem = {
      id: uuidv4(),
      student_id: studentId || null,
      phone: phone ? String(phone).trim() : null,
      campus: campusName,
      rating: Math.round(numericRating),
      category: category ? String(category).trim() : 'General',
      comment: comment ? String(comment).trim() : null,
      created_at: new Date().toISOString()
    };
    await insertFeedback(feedbackItem);
    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

app.get('/api/admin/feedback', requireAdminAuth, async (req, res) => {
  try {
    const campus = getAdminTargetCampus(req);
    const items = await listFeedback(campus, 100);
    const total = items.length;
    const avgRating = total > 0
      ? Number((items.reduce((acc, f) => acc + f.rating, 0) / total).toFixed(1))
      : 0;
    const ratingsBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const categoryBreakdown = {};
    items.forEach((f) => {
      ratingsBreakdown[f.rating] = (ratingsBreakdown[f.rating] || 0) + 1;
      const cat = f.category || 'General';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    res.json({
      success: true,
      campus: campus || 'ALL CAMPUSES',
      total,
      avgRating,
      ratingsBreakdown,
      categoryBreakdown,
      recent: items.slice(0, 25)
    });
  } catch (error) {
    console.error('Admin feedback fetch error:', error);
    res.status(500).json({ error: 'Failed to load feedback' });
  }
});

app.get('/api/sms/status', requireAdminAuth, async (_req, res) => {
  res.json({ ok: true, sms: smsHealth() });
});

app.post('/api/sms/send', requireAdminAuth, async (req, res) => {
  if (retentionDispatchInProgress) {
    return res.status(409).json({ error: 'Another SMS campaign is currently being sent. Try again shortly.' });
  }
  retentionDispatchInProgress = true;
  try {
    const cfg = getSmsConfig();
    if (!cfg.enabled || !cfg.apiKey) {
      return res.status(503).json({ error: 'SMS is not configured. Add SMS_PROVIDER/SMS_API_KEY to use this feature.' });
    }
    const { recipients, message, from } = req.body;
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients must be a non-empty array' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (message.length > MAX_SMS_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `message must not exceed ${MAX_SMS_MESSAGE_LENGTH} characters.` });
    }
    const targetCampus = getAdminTargetCampus(req);
    const records = (await getRetention(targetCampus)).records || [];
    const byId = new Map(records.map((record) => [record.id, record]));
    const byPhone = new Map(records.map((record) => [normalizePhone(record.phone), record]));
    let optOutSkipped = 0;
    const resolvedRecipients = recipients.flatMap((recipient) => {
      const record = recipient?.id
        ? byId.get(recipient.id)
        : byPhone.get(normalizePhone(typeof recipient === 'string' ? recipient : recipient?.phone));
      if (!record) return [];
      if (record.sms_opt_out) {
        optOutSkipped += 1;
        return [];
      }
      return [{ id: record.id, phone: record.phone, name: record.name, campus: record.campus }];
    });
    if (resolvedRecipients.length === 0) {
      return res.status(400).json({
        error: optOutSkipped ? 'All selected members have opted out of SMS.' : 'No selected members were found in this campus.'
      });
    }
    const result = await sendBulk({
      recipients: resolvedRecipients,
      message,
      from: from || cfg.senderId,
      templateValues: { campus: targetCampus || DEFAULT_CAMPUS }
    });
    const createdAt = new Date().toISOString();
    const historyWarning = await persistSmsLogs(result.results.map((smsResult) => createSmsLog(
      smsResult,
      { id: smsResult.recipientId, name: smsResult.name, phone: smsResult.to, campus: smsResult.campus },
      smsResult.campus || targetCampus || DEFAULT_CAMPUS,
      'manual-broadcast',
      result.provider,
      createdAt
    )));
    res.json({
      ok: true,
      sms: { ...result, skipped: result.skipped + optOutSkipped, optOutSkipped },
      historyWarning
    });
  } catch (error) {
    console.error('SMS send error:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  } finally {
    retentionDispatchInProgress = false;
  }
});

app.post('/api/sms/delivery', async (req, res) => {
  const expectedToken = process.env.SMS_DELIVERY_WEBHOOK_TOKEN || '';
  const suppliedToken = req.get('x-sms-webhook-token')
    || req.get('authorization')?.replace(/^Bearer\s+/i, '')
    || '';
  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return res.status(401).json({ error: 'Invalid SMS delivery webhook credentials' });
  }
  const providerMessageId = req.body?.provider_message_id || req.body?.message_id || req.body?.messageId;
  const rawStatus = String(req.body?.delivery_status || req.body?.status || '').toLowerCase();
  const statusMap = {
    delivered: 'delivered',
    success: 'delivered',
    failed: 'failed',
    undelivered: 'undelivered',
    expired: 'expired',
    rejected: 'rejected'
  };
  const deliveryStatus = statusMap[rawStatus];
  if (typeof providerMessageId !== 'string' || !providerMessageId.trim() || !deliveryStatus) {
    return res.status(400).json({ error: 'A provider message ID and supported delivery status are required.' });
  }
  try {
    const updated = await updateSmsDeliveryStatus(providerMessageId.trim(), deliveryStatus);
    if (!updated) return res.status(404).json({ error: 'SMS message ID was not found.' });
    res.json({ success: true, updated });
  } catch (error) {
    console.error('SMS delivery callback update failed:', error);
    res.status(500).json({ error: 'Failed to update SMS delivery status' });
  }
});

app.get('/api/admin/sms/logs', requireAdminAuth, async (req, res) => {
  try {
    const campus = getAdminTargetCampus(req);
    const logs = await listSmsLogs(campus, 100);
    res.json({ logs, campus: campus || 'ALL CAMPUSES' });
  } catch (error) {
    console.error('SMS history error:', error);
    res.status(500).json({ error: 'Failed to load SMS history' });
  }
});

app.get('/api/admin/retention/analytics', requireAdminAuth, async (req, res) => {
  try {
    const campus = getAdminTargetCampus(req);
    const [logs, retention] = await Promise.all([
      listSmsLogs(campus, 1000),
      getRetention(campus)
    ]);
    const campaignLogs = logs.filter((log) => ['first-time-followup', 'at-risk-winback'].includes(log.source));
    const recordById = new Map((retention.records || []).map((record) => [record.id, record]));
    const recentLogs = campaignLogs.filter((log) => Date.parse(log.created_at) >= Date.now() - 90 * 24 * 60 * 60 * 1000);
    const grouped = {};
    for (const log of recentLogs) {
      const cohort = grouped[log.source] || (grouped[log.source] = {
        source: log.source,
        accepted: 0,
        failed: 0,
        delivered: 0,
        deliveryFailed: 0,
        returnedAfterSend: 0
      });
      if (log.status === 'accepted') cohort.accepted += 1;
      if (log.status === 'failed') cohort.failed += 1;
      if (log.delivery_status === 'delivered') cohort.delivered += 1;
      if (['failed', 'undelivered', 'expired', 'rejected'].includes(log.delivery_status)) cohort.deliveryFailed += 1;
      const record = log.status === 'accepted' && log.recipient_id && recordById.get(log.recipient_id);
      if (record?.last_visit && Date.parse(record.last_visit) > Date.parse(log.created_at)) cohort.returnedAfterSend += 1;
    }
    const totals = Object.values(grouped).reduce((sum, cohort) => ({
      accepted: sum.accepted + cohort.accepted,
      failed: sum.failed + cohort.failed,
      delivered: sum.delivered + cohort.delivered,
      deliveryFailed: sum.deliveryFailed + cohort.deliveryFailed,
      returnedAfterSend: sum.returnedAfterSend + cohort.returnedAfterSend
    }), { accepted: 0, failed: 0, delivered: 0, deliveryFailed: 0, returnedAfterSend: 0 });
    res.json({ days: 90, totals, cohorts: Object.values(grouped) });
  } catch (error) {
    console.error('Retention campaign analytics error:', error);
    res.status(500).json({ error: 'Failed to load retention campaign analytics' });
  }
});
app.get('/api/admin/analytics', requireAdminAuth, async (req, res) => {
  try {
    const { range = 'day', campus } = req.query;
    const targetCampus = getAdminTargetCampus(req, campus);
    const period = getPeriodRange(range);

    const visitors = await listTokensWithStudents(targetCampus, period.start, period.end);

    const peakHours = Array(24).fill(0);
    const purposeCounts = {};
    const visitorCounts = {};
    visitors.forEach(v => {
      const hour = new Date(v.verified_at).getHours();
      peakHours[hour] += 1;

      const purpose = v.purpose || 'Not specified';
      purposeCounts[purpose] = (purposeCounts[purpose] || 0) + 1;

      visitorCounts[v.student_id] = (visitorCounts[v.student_id] || 0) + 1;
    });

    const uniqueVisitors = Object.keys(visitorCounts).length;
    const returningVisitors = Object.values(visitorCounts).filter(count => count > 1).length;

    const newStudents = await countNewStudents(targetCampus, period.start, period.end);

    const purposes = Object.entries(purposeCounts)
      .map(([purpose, count]) => ({ purpose, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      range,
      start: period.start,
      end: period.end,
      campus: targetCampus || 'ALL CAMPUSES',
      totalVisits: visitors.length,
      uniqueVisitors,
      returningVisitors,
      newStudents,
      peakHours,
      purposes
    });
  } catch (error) {
    console.error('Analytics query error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

app.post('/api/admin/students', requireAdminAuth, async (req, res) => {
  try {
    const { name, phone, purpose, campus } = req.body || {};
    const campusName = resolveCampusName(campus || req.userCampus || DEFAULT_CAMPUS);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    const existing = await findStudentByPhoneAndCampus(phone.trim(), campusName);
    if (existing) {
      return res.status(400).json({ error: 'Phone already registered for this campus' });
    }

    const student = {
      id: uuidv4(),
      name: name.trim(),
      phone: phone.trim(),
      purpose: (purpose || '').trim(),
      campus: campusName,
      created_at: new Date().toISOString(),
      flagged: 0,
      flag_note: ''
    };

    await insertStudent(student);

    res.json({ success: true, message: 'Visitor added successfully', student });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ error: 'Failed to add visitor' });
  }
});

app.post('/api/admin/students/:id/flag', requireAdminAuth, async (req, res) => {
  try {
    const { flagged, note } = req.body || {};
    const student = await findStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await updateStudentFlag(student.id, flagged, note);

    res.json({ success: true, message: flagged ? 'Student flagged' : 'Flag removed', studentId: student.id });
  } catch (error) {
    console.error('Flag student error:', error);
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

app.post('/api/admin/students/:id/sms-preference', requireAdminAuth, async (req, res) => {
  const { opted_out } = req.body || {};
  if (typeof opted_out !== 'boolean') {
    return res.status(400).json({ error: 'opted_out must be a boolean.' });
  }
  try {
    const student = await findStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    const targetCampus = getAdminTargetCampus(req);
    if (targetCampus && student.campus !== targetCampus) {
      return res.status(404).json({ error: 'Student not found in this campus.' });
    }
    await updateStudent(student.id, {
      name: student.name,
      phone: student.phone,
      purpose: student.purpose,
      sms_opt_out: opted_out
    });
    res.json({ success: true, studentId: student.id, sms_opt_out: opted_out });
  } catch (error) {
    console.error('SMS preference update error:', error);
    res.status(500).json({ error: 'Failed to update SMS preference' });
  }
});

app.put('/api/admin/students/:id', requireAdminAuth, async (req, res) => {
  try {
    const { name, phone, purpose } = req.body || {};
    const student = await findStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    const newPhone = (phone || student.phone).trim();
    if (newPhone !== student.phone) {
      const existing = await findStudentByPhoneAndCampus(newPhone, student.campus);
      if (existing && existing.id !== student.id) {
        return res.status(400).json({ error: 'Phone already registered for this campus' });
      }
    }

    await updateStudent(student.id, {
      name: name || student.name,
      phone: newPhone,
      purpose: purpose !== undefined ? purpose : student.purpose
    });

    res.json({ success: true, message: 'Visitor updated successfully', studentId: student.id });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update visitor' });
  }
});

app.delete('/api/admin/students/:id', requireAdminAuth, async (req, res) => {
  try {
    const student = await findStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (await countClassBookingsForStudent(student.id)) {
      return res.status(409).json({ error: 'This student has class booking or attendance history and cannot be deleted without removing academic records.' });
    }

    await deleteStudent(student.id);

    res.json({ success: true, message: 'Visitor removed successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to remove visitor' });
  }
});

app.get('/api/admin/students/:id/visits', requireAdminAuth, async (req, res) => {
  try {
    const student = await findStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const visits = await listTokensForStudent(student.id);
    res.json({ studentId: student.id, count: visits.length, visits });
  } catch (error) {
    console.error('Student visits error:', error);
    res.status(500).json({ error: 'Failed to fetch visit history' });
  }
});

app.get('/api/admin/export', requireAdminAuth, async (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required.' });
    }
    const data = await exportAllData();
    res.setHeader('Content-Disposition', `attachment; filename="aifsp-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.post('/api/admin/restore', requireAdminAuth, async (req, res) => {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required.' });
  }
  try {
    const data = req.body || {};
    if (!Array.isArray(data.students) || !Array.isArray(data.tokens) || !Array.isArray(data.settings)) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }
    const counts = await restoreAllData(data);
    res.json({
      success: true,
      message: `Restore complete: ${counts.students} students, ${counts.tokens} tokens, ${counts.settings} settings`
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore data' });
  }
});

app.get('/api/admin/system-info', requireAdminAuth, async (req, res) => {
  try {
    const info = getSystemInfo();
    res.json({
      ...info,
      institute: CAMPUS_INSTITUTE_NAME,
      campuses: SUB_CAMPUSES,
      startedAt: SERVER_STARTED_AT,
      uptimeSeconds: Math.round((Date.now() - SERVER_STARTED_AT) / 1000)
    });
  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({ error: 'Failed to fetch system information' });
  }
});

app.get('/api/admin/tokens/qr', requireAdminAuth, async (req, res) => {
  try {
    const targetCampus = getAdminTargetCampus(req);
    const date = req.query.date || currentDateString();
    const tokens = await listTokensForDate(targetCampus, date);
    const withQR = [];
    for (const t of tokens) {
      withQR.push({ ...t, tokenQR: await QRCode.toDataURL(t.token, { width: 400, margin: 1 }) });
    }
    res.json({ date, count: withQR.length, tokens: withQR, campus: targetCampus || 'ALL CAMPUSES' });
  } catch (error) {
    console.error('Tokens QR error:', error);
    res.status(500).json({ error: 'Failed to load QR codes' });
  }
});

function startServer(port, host = '0.0.0.0', attemptsLeft = 10) {
  const server = app.listen(port, host, () => {
    const actualPort = server.address().port;
    console.log(`Server running on http://localhost:${actualPort}`);
    console.log(`\n🌐 Network Access:`);
    console.log(`   Use your computer's IP address to access from other devices`);
    console.log(`   Example: http://192.168.1.XXX:${actualPort}`);
    console.log(`\n📱 To find your IP address:`);
    console.log(`   Windows: Run "ipconfig" in command prompt`);
    console.log(`   Look for "IPv4 Address" under your active network`);
  });

  server.on('error', err => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      setTimeout(() => startServer(port + 1, host, attemptsLeft - 1), 200);
      return;
    }
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

async function main() {
  await init();
  classScheduleSchemaReady = await checkClassScheduleSchema();
  if (classScheduleSchemaReady) {
    await seedInitialTimetables(SUB_CAMPUSES);
  }
  startRetentionSchedulePoller();
  startServer(PORT);
}

export { app };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error('Startup failed:', error);
    process.exit(1);
  });
}

const distDir = path.join(process.cwd(), 'dist');
if (existsSync(distDir)) {
  try {
    if (statSync(distDir).isDirectory()) {
      app.use(express.static(distDir));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
      console.log('Serving production frontend from', distDir);
    }
  } catch (err) {
    console.warn('Could not inspect dist directory:', err.message || err);
  }
}

// Centralized Express error handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('Unhandled request error:', err);
  const status = Number(err.status || err.statusCode || 500);
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error'
      : (err.message || 'An unexpected error occurred')
  });
});

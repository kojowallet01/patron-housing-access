import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { promises as fs } from 'fs';
import QRCode from 'qrcode';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import {
  init,
  getSettingSync,
  setSetting,
  createSession,
  resolveSession,
  deleteSession,
  findStudentByPhoneAndCampus,
  findStudentById,
  insertStudent,
  listStudents,
  countStudents,
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
  countVerifiedVisits,
  countVerifiedVisitsBetween,
  countAllVerifiedVisits
} from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
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
const ALLOW_UNAUTHENTICATED = process.env.ALLOW_UNAUTHENTICATED === 'true';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SERVER_STARTED_AT = Date.now();
const ACCESS_TOKEN_PATTERN = /^\d{4}$/;

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

function isMatchingToken(candidateToken, tokenValue) {
  return Boolean(candidateToken) && Boolean(tokenValue) && String(candidateToken) === String(tokenValue);
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

  if (!password || !String(password).trim()) {
    delete existing[normalizedCampus];
  } else {
    existing[normalizedCampus] = String(password).trim();
  }

  await setSetting(key, JSON.stringify(existing));
  return existing;
}

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/admin') || req.path.startsWith('/super-admin')) {
    return next();
  }
  return apiLimiter(req, res, next);
});
app.use('/api/register', authLimiter);
app.use('/api/verify-token', authLimiter);

function currentDateString() {
  return new Date().toISOString().split('T')[0];
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

async function buildTokenResponse(tokenData, student) {
  const tokenQR = await QRCode.toDataURL(tokenData.token);
  const recentVisits = await listTokensForStudent(student.id);
  return {
    success: true,
    student: { name: student.name, phone: student.phone, campus: student.campus },
    token: tokenData.token,
    tokenQR,
    validDate: tokenData.valid_date,
    campus: student.campus,
    recentVisits: recentVisits.slice(0, 10)
  };
}

function validatePhone(phone) {
  return typeof phone === 'string' && /^[+\d][\d\s()-]{5,20}$/.test(phone.trim());
}

async function requireAdminAuth(req, res, next) {
  try {
    const campus = resolveCampusName(req.get('x-campus') || req.body?.campus || req.query?.campus || DEFAULT_CAMPUS);
    const session = await resolveSession(req.get('x-session-token'));

    if (session) {
      if (session.role === 'admin' || session.role === 'super-admin' || session.is_super_admin) {
        req.userCampus = session.is_super_admin ? campus : session.campus;
        req.isSuperAdmin = session.role === 'super-admin' || Boolean(session.is_super_admin);
        return next();
      }
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const token = req.get('x-admin-token') || req.get('x-super-admin-token') || '';
    const campusAdminToken = getCampusRoleToken(campus, 'admin');
    const campusSuperAdminToken = getCampusRoleToken(campus, 'super-admin');
    const superAdminMatches = campusSuperAdminToken && isMatchingToken(token, campusSuperAdminToken);
    const campusAdminMatches = campusAdminToken && isMatchingToken(token, campusAdminToken);

    if (superAdminMatches || campusAdminMatches) {
      req.userCampus = campus;
      req.isSuperAdmin = superAdminMatches;
      return next();
    }

    if (ALLOW_UNAUTHENTICATED) {
      req.userCampus = campus;
      req.isSuperAdmin = false;
      return next();
    }

    if (!hasConfiguredAdminAuth(campus)) {
      return res.status(503).json({ error: 'Admin authentication is not configured.' });
    }

    return res.status(401).json({ error: 'Admin authentication required' });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ error: 'Admin authentication failed' });
  }
}

async function requireSecurityAuth(req, res, next) {
  try {
    const campus = resolveCampusName(req.get('x-campus') || req.body?.campus || req.query?.campus || DEFAULT_CAMPUS);
    const session = await resolveSession(req.get('x-session-token'));

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
    const superAdminMatches = campusSuperAdminToken && isMatchingToken(token, campusSuperAdminToken);
    const campusSecurityMatches = campusSecurityToken && isMatchingToken(token, campusSecurityToken);

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
      '/api/admin/today',
      '/api/admin/students',
      '/api/admin/stats',
      '/api/admin/visits'
    ]
  });
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, purpose, campus } = req.body;
    const campusName = resolveCampusName(campus || DEFAULT_CAMPUS);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    const existing = await findStudentByPhoneAndCampus(phone.trim(), campusName);
    if (existing) {
      return res.status(400).json({ error: 'This phone is already registered for this campus.' });
    }

    const student = {
      id: uuidv4(),
      name: name.trim(),
      phone: phone.trim(),
      purpose: (purpose || '').trim(),
      campus: campusName,
      created_at: new Date().toISOString()
    };

    await insertStudent(student);

    res.json({ success: true, message: 'Registration successful', studentId: student.id, campus: student.campus });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
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
      const isValid = Boolean(expected) && isMatchingToken(passwordValue, expected);
      if (!isValid) {
        return res.json({ valid: false, role: 'super-admin', campus: selectedCampus });
      }

      const session = await createSession({ id: uuidv4(), role: 'super-admin', campus: selectedCampus, is_super_admin: true, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
      return res.json({
        valid: true,
        role: 'super-admin',
        campus: selectedCampus,
        sessionToken: session.id,
        expiresAt: session.expires_at
      });
    }

    const expected = selectedRole === 'admin'
      ? getCampusRoleToken(selectedCampus, 'admin') || ADMIN_TOKEN
      : getCampusRoleToken(selectedCampus, 'security') || SECURITY_TOKEN;

    const isValid = Boolean(expected) && isMatchingToken(passwordValue, expected);
    if (!isValid) {
      return res.json({ valid: false, role: selectedRole, campus: selectedCampus });
    }

    const session = await createSession({ id: uuidv4(), role: selectedRole, campus: selectedCampus, is_super_admin: false, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
    return res.json({
      valid: true,
      role: selectedRole,
      campus: selectedCampus,
      sessionToken: session.id,
      expiresAt: session.expires_at
    });
  } catch (error) {
    console.error('Password validation error:', error);
    return res.status(500).json({ valid: false, error: 'Validation failed.' });
  }
});

app.get('/api/session', async (req, res) => {
  try {
    const session = await resolveSession(req.get('x-session-token'));
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
    await deleteSession(req.get('x-session-token'));
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
      admin: adminMap,
      security: securityMap,
      superAdmin: superAdminMap,
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
    const today = currentDateString();
    const rows = await listTokensVerifiedOn(req.isSuperAdmin ? null : req.userCampus, today);
    const students = rows.map(token => ({
      name: token.name,
      phone: token.phone,
      purpose: token.purpose,
      campus: token.campus,
      used_at: token.used_at
    }));
    res.json({ date: today, count: students.length, students });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/admin/students', requireAdminAuth, async (req, res) => {
  try {
    const rows = await listStudents(req.isSuperAdmin ? null : req.userCampus);
    res.json({ count: rows.length, students: rows });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const campus = req.isSuperAdmin ? null : req.userCampus;
    const today = currentDateString();
    const thisWeek = getPeriodRange('week');
    const thisMonth = getPeriodRange('month');

    const [totalStudents, todayVisits, thisWeekVisits, thisMonthVisits, totalVisits] = await Promise.all([
      countStudents(campus),
      countVerifiedVisits(campus, today),
      countVerifiedVisitsBetween(campus, thisWeek.start, thisWeek.end),
      countVerifiedVisitsBetween(campus, thisMonth.start, thisMonth.end),
      countAllVerifiedVisits(campus)
    ]);

    res.json({ totalStudents, todayVisits, thisWeekVisits, thisMonthVisits, totalVisits });
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
    const campusName = resolveCampusName(campus || req.userCampus || DEFAULT_CAMPUS);

    if (!periodStart || !periodEnd) {
      const rangeDates = getPeriodRange(range);
      periodStart = rangeDates.start;
      periodEnd = rangeDates.end;
    }

    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(periodStart) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(periodEnd)) {
      return res.status(400).json({ error: 'Invalid date range format. Use YYYY-MM-DD.' });
    }

    const rows = await listTokensWithStudents(req.isSuperAdmin ? null : campusName, periodStart, periodEnd);

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

    res.json({ range, start: periodStart, end: periodEnd, count: students.length, students, purposes });
  } catch (error) {
    console.error('Visits query error:', error);
    res.status(500).json({ error: 'Failed to fetch visit data' });
  }
});

app.get('/api/admin/analytics', requireAdminAuth, async (req, res) => {
  try {
    const { range = 'day' } = req.query;
    const period = getPeriodRange(range);

    const visitors = await listTokensWithStudents(req.isSuperAdmin ? null : req.userCampus, period.start, period.end);

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

    const newStudents = await countNewStudents(req.isSuperAdmin ? null : req.userCampus, period.start, period.end);

    const purposes = Object.entries(purposeCounts)
      .map(([purpose, count]) => ({ purpose, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      range,
      start: period.start,
      end: period.end,
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
    const date = req.query.date || currentDateString();
    const tokens = await listTokensForDate(req.userCampus, date);
    const withQR = [];
    for (const t of tokens) {
      withQR.push({ ...t, tokenQR: await QRCode.toDataURL(t.token, { width: 400, margin: 1 }) });
    }
    res.json({ date, count: withQR.length, tokens: withQR });
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
fs.stat(distDir).then(stat => {
  if (stat && stat.isDirectory()) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
    console.log('Serving production frontend from', distDir);
  }
}).catch(() => {
  // ignore if dist doesn't exist yet
});

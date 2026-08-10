import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import QRCode from 'qrcode';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DB_FILE = path.join(process.cwd(), 'patron-housing.db');
const CAMPUS_INSTITUTE_NAME = process.env.CAMPUS_INSTITUTE_NAME || 'CAMPUS INSTITUTE';
const DEFAULT_CAMPUS = process.env.DEFAULT_CAMPUS || 'TESANO CAMPUS';
const SUB_CAMPUSES = [
  'TESANO CAMPUS',
  'CHRISTIANSBORG CAMPUS',
  'ASHIAMAN CAMPUS',
  'LEGON CAMPUS'
];
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const SECURITY_TOKEN = process.env.SECURITY_TOKEN || '';
const SUPER_ADMIN_TOKEN = process.env.SUPER_ADMIN_TOKEN || process.env.SUPER_ADMIN || '';
const CAMPUS_ADMIN_TOKENS = parseTokenMap(process.env.CAMPUS_ADMIN_TOKENS || '');
const CAMPUS_SECURITY_TOKENS = parseTokenMap(process.env.CAMPUS_SECURITY_TOKENS || '');
const CAMPUS_TOKEN_STORAGE_KEYS = {
  admin: 'campus_admin_tokens',
  security: 'campus_security_tokens'
};

function parseTokenMap(rawValue) {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed).map(([campus, token]) => [normalizeCampusName(campus), String(token)])
      );
    }
  } catch (error) {
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

  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row?.value) return {};

  try {
    const parsed = JSON.parse(row.value);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed).map(([campus, token]) => [normalizeCampusName(campus), String(token)])
      );
    }
  } catch (error) {
    // ignore invalid JSON and fall back to empty map
  }

  return {};
}

function getCampusRoleToken(campusName, role) {
  const normalizedCampus = resolveCampusName(campusName);
  const storedMap = readStoredCampusTokenMap(role);
  const envMap = role === 'admin' ? CAMPUS_ADMIN_TOKENS : CAMPUS_SECURITY_TOKENS;
  return storedMap[normalizedCampus] || envMap[normalizedCampus] || (role === 'admin' ? ADMIN_TOKEN : SECURITY_TOKEN) || '';
}

function setCampusRoleToken(campusName, role, password) {
  const key = CAMPUS_TOKEN_STORAGE_KEYS[role];
  const normalizedCampus = resolveCampusName(campusName);
  const existing = readStoredCampusTokenMap(role);

  if (!password || !String(password).trim()) {
    delete existing[normalizedCampus];
  } else {
    existing[normalizedCampus] = String(password).trim();
  }

  setSetting(key, JSON.stringify(existing));
  return existing;
}

app.use(helmet());
app.use(cors({ origin: true }));
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
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

app.use('/api', apiLimiter);
app.use('/api/register', authLimiter);
app.use('/api/verify-token', authLimiter);

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.prepare(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  campus TEXT NOT NULL DEFAULT 'TESANO CAMPUS',
  created_at TEXT NOT NULL
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS access_tokens (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  campus TEXT NOT NULL DEFAULT 'TESANO CAMPUS',
  token TEXT NOT NULL,
  valid_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT NOT NULL,
  FOREIGN KEY(student_id) REFERENCES students(id)
)`).run();

try {
  db.prepare('ALTER TABLE students ADD COLUMN campus TEXT NOT NULL DEFAULT "TESANO CAMPUS"').run();
} catch (error) {
  // column already exists
}

try {
  db.prepare('ALTER TABLE access_tokens ADD COLUMN campus TEXT NOT NULL DEFAULT "TESANO CAMPUS"').run();
} catch (error) {
  // column already exists
}

try {
  db.prepare('CREATE INDEX IF NOT EXISTS idx_students_campus ON students (campus)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_access_tokens_campus ON access_tokens (campus)').run();
} catch (error) {
  // ignore if index creation fails on older DBs
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

function generateShortToken() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function validatePhone(phone) {
  return typeof phone === 'string' && /^[+\d][\d\s()-]{5,20}$/.test(phone.trim());
}

function requireAdminAuth(req, res, next) {
  const token = req.get('x-admin-token') || req.get('x-super-admin-token') || '';
  const campus = resolveCampusName(req.get('x-campus') || req.body?.campus || req.query?.campus || DEFAULT_CAMPUS);

  const campusAdminToken = getCampusRoleToken(campus, 'admin');
  const superAdminMatches = SUPER_ADMIN_TOKEN && isMatchingToken(token, SUPER_ADMIN_TOKEN);
  const campusAdminMatches = campusAdminToken && isMatchingToken(token, campusAdminToken);

  if (!SUPER_ADMIN_TOKEN && !campusAdminToken && !ADMIN_TOKEN) {
    return next();
  }

  if (superAdminMatches || campusAdminMatches) {
    req.userCampus = campus;
    req.isSuperAdmin = superAdminMatches;
    return next();
  }

  return res.status(401).json({ error: 'Admin authentication required' });
}

function requireSecurityAuth(req, res, next) {
  const token = req.get('x-security-token') || req.get('x-super-admin-token') || '';
  const campus = resolveCampusName(req.get('x-campus') || req.body?.campus || req.query?.campus || DEFAULT_CAMPUS);

  const campusSecurityToken = getCampusRoleToken(campus, 'security');
  const superAdminMatches = SUPER_ADMIN_TOKEN && isMatchingToken(token, SUPER_ADMIN_TOKEN);
  const campusSecurityMatches = campusSecurityToken && isMatchingToken(token, campusSecurityToken);

  if (!SUPER_ADMIN_TOKEN && !campusSecurityToken && !SECURITY_TOKEN) {
    return next();
  }

  if (superAdminMatches || campusSecurityMatches) {
    req.userCampus = campus;
    req.isSuperAdmin = superAdminMatches;
    return next();
  }

  return res.status(401).json({ error: 'Security authentication required' });
}

function currentDateString() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

function getPeriodRange(range) {
  const now = new Date();
  const today = formatDate(now);
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

function ensureCampusQr() {
  let campusQr = getSetting('campus_qr');
  if (!campusQr) {
    campusQr = uuidv4();
    setSetting('campus_qr', campusQr);
    console.log('Campus entrance QR code generated:', campusQr);
  }
  return campusQr;
}

const campusQr = ensureCampusQr();

// Supabase client (optional) - use if SUPABASE_URL and SUPABASE_SERVICE_KEY are provided
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('Supabase client initialized');
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err.message || err);
    supabase = null;
  }
}

function buildBaseUrl(req) {
  const host = req.get('host');
  const protocol = req.protocol;
  if (host?.includes(':3001') && process.env.NODE_ENV !== 'production') {
    return `${protocol}://${host.replace(':3001', ':3000')}`;
  }
  return `${protocol}://${host}`;
}

function createTokenForStudent(studentId, campusName = DEFAULT_CAMPUS) {
  const today = currentDateString();
  let tokenData = db.prepare('SELECT * FROM access_tokens WHERE student_id = ? AND campus = ? AND valid_date = ?').get(studentId, campusName, today);
  if (tokenData) {
    return tokenData;
  }

  let token = generateShortToken();
  let collisionCount = 0;
  while (db.prepare('SELECT 1 FROM access_tokens WHERE token = ? AND valid_date = ?').get(token, today) && collisionCount < 10) {
    token = generateShortToken();
    collisionCount += 1;
  }

  tokenData = {
    id: uuidv4(),
    student_id: studentId,
    campus: campusName,
    token,
    valid_date: today,
    created_at: new Date().toISOString(),
    used_at: new Date().toISOString()
  };

  db.prepare(`INSERT INTO access_tokens (id, student_id, campus, token, valid_date, created_at, used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(tokenData.id, tokenData.student_id, tokenData.campus, tokenData.token, tokenData.valid_date, tokenData.created_at, tokenData.used_at);

  return tokenData;
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

app.post('/api/register', (req, res) => {
  try {
    const { name, phone, purpose, campus } = req.body;
    const campusName = resolveCampusName(campus || DEFAULT_CAMPUS);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (!purpose || typeof purpose !== 'string' || !purpose.trim()) {
      return res.status(400).json({ error: 'Purpose is required' });
    }

    const existing = db.prepare('SELECT * FROM students WHERE phone = ?').get(phone.trim());
    if (existing) {
      return res.status(400).json({ error: 'Phone already registered' });
    }

    const student = {
      id: uuidv4(),
      name: name.trim(),
      phone: phone.trim(),
      purpose: purpose.trim(),
      campus: campusName,
      created_at: new Date().toISOString()
    };

    db.prepare(`INSERT INTO students (id, name, phone, purpose, campus, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(student.id, student.name, student.phone, student.purpose, student.campus, student.created_at);

    res.json({ success: true, message: 'Registration successful', studentId: student.id, campus: student.campus });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/campus-qr', async (req, res) => {
  try {
    const registrationUrl = `${buildBaseUrl(req)}/register?campus=${campusQr}`;
    const customImagePath = path.join(process.cwd(), 'public', 'custom-campus-qr.png');
    try {
      await fs.access(customImagePath);
      const imageUrl = `${buildBaseUrl(req)}/custom-campus-qr.png`;
      return res.json({ qrCodeUrl: imageUrl, code: campusQr, registrationUrl });
    } catch {
      const qrDataURL = await QRCode.toDataURL(registrationUrl);
      return res.json({ qrCodeUrl: qrDataURL, code: campusQr, registrationUrl });
    }
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.post('/api/generate-token', (req, res) => {
  try {
    const { phone, campusCode, campus } = req.body;
    const campusName = resolveCampusName(campus || DEFAULT_CAMPUS);
    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (campusCode && campusCode !== campusQr) {
      return res.status(400).json({ error: 'Invalid campus code' });
    }

    const student = db.prepare('SELECT * FROM students WHERE phone = ? AND campus = ?').get(phone.trim(), campusName);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const tokenData = createTokenForStudent(student.id, campusName);
    const tokenQR = QRCode.toDataURL(tokenData.token);

    res.json({
      success: true,
      student: { name: student.name, phone: student.phone, campus: student.campus },
      token: tokenData.token,
      tokenQR,
      validDate: tokenData.valid_date,
      campus: student.campus
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate access token' });
  }
});

app.post('/api/scan-entry', (req, res) => {
  try {
    const { qrCode, phone, campus } = req.body;
    const campusName = resolveCampusName(campus || DEFAULT_CAMPUS);
    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (qrCode !== campusQr) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }

    const student = db.prepare('SELECT * FROM students WHERE phone = ? AND campus = ?').get(phone.trim(), campusName);
    if (!student) {
      return res.status(404).json({ error: 'Student not registered. Please register first.' });
    }

    const tokenData = createTokenForStudent(student.id, campusName);
    const tokenQR = QRCode.toDataURL(tokenData.token);

    res.json({
      success: true,
      student: { name: student.name, phone: student.phone, campus: student.campus },
      token: tokenData.token,
      tokenQR,
      validDate: tokenData.valid_date,
      campus: student.campus
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Failed to generate access token' });
  }
});

app.post('/api/verify-token', requireSecurityAuth, (req, res) => {
  try {
    const { token, campus } = req.body;
    const campusName = resolveCampusName(campus || req.userCampus || DEFAULT_CAMPUS);
    if (!token || typeof token !== 'string' || !/^\d{4}$/.test(token.trim())) {
      return res.status(400).json({ valid: false, error: 'Token must be a 4-digit number' });
    }

    const today = currentDateString();
    const tokenData = db.prepare('SELECT * FROM access_tokens WHERE token = ? AND campus = ? AND valid_date = ?').get(token.trim(), campusName, today);
    if (!tokenData) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired token for this campus' });
    }

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(tokenData.student_id);
    res.json({
      valid: true,
      student: {
        name: student.name,
        phone: student.phone,
        purpose: student.purpose,
        campus: student.campus
      },
      validDate: tokenData.valid_date,
      campus: tokenData.campus
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/validate-login', (req, res) => {
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
      const isValid = Boolean(SUPER_ADMIN_TOKEN) && isMatchingToken(passwordValue, SUPER_ADMIN_TOKEN);
      return res.json({ valid: isValid, role: 'super-admin', campus: selectedCampus });
    }

    const expected = selectedRole === 'admin'
      ? getCampusRoleToken(selectedCampus, 'admin') || ADMIN_TOKEN
      : getCampusRoleToken(selectedCampus, 'security') || SECURITY_TOKEN;

    const isValid = Boolean(expected) && isMatchingToken(passwordValue, expected);
    return res.json({ valid: isValid, role: selectedRole, campus: selectedCampus });
  } catch (error) {
    console.error('Password validation error:', error);
    return res.status(500).json({ valid: false, error: 'Validation failed.' });
  }
});

app.get('/api/super-admin/passwords', requireAdminAuth, (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required.' });
    }

    const adminMap = readStoredCampusTokenMap('admin');
    const securityMap = readStoredCampusTokenMap('security');
    res.json({
      admin: adminMap,
      security: securityMap,
      campuses: SUB_CAMPUSES
    });
  } catch (error) {
    console.error('Password map fetch error:', error);
    return res.status(500).json({ error: 'Failed to load campus password settings.' });
  }
});

app.post('/api/super-admin/passwords', requireAdminAuth, (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required.' });
    }

    const { campus, role, password } = req.body || {};
    const selectedRole = String(role || '').toLowerCase();
    const selectedCampus = resolveCampusName(campus || DEFAULT_CAMPUS);

    if (!selectedRole || !['admin', 'security'].includes(selectedRole)) {
      return res.status(400).json({ error: 'Role must be admin or security.' });
    }

    setCampusRoleToken(selectedCampus, selectedRole, password);

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

app.get('/api/admin/today', requireAdminAuth, (req, res) => {
  try {
    const today = currentDateString();
    const campusFilter = req.isSuperAdmin ? '' : 'AND t.campus = ?';
    const params = req.isSuperAdmin ? [today] : [today, req.userCampus];
    const todayTokens = db.prepare(`SELECT t.* FROM access_tokens t WHERE t.valid_date = ? ${campusFilter}`).all(...params);
    const students = todayTokens.map(token => {
      const student = db.prepare('SELECT * FROM students WHERE id = ?').get(token.student_id);
      return {
        name: student.name,
        phone: student.phone,
        purpose: student.purpose,
        campus: token.campus,
        used_at: token.used_at
      };
    });
    res.json({ date: today, count: students.length, students });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/admin/students', requireAdminAuth, (req, res) => {
  try {
    const campusFilter = req.isSuperAdmin ? '' : 'WHERE campus = ?';
    const params = req.isSuperAdmin ? [] : [req.userCampus];
    const students = db.prepare(`SELECT * FROM students ${campusFilter} ORDER BY created_at DESC`).all(...params);
    res.json({ count: students.length, students });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  try {
    const campusFilter = req.isSuperAdmin ? '' : 'WHERE campus = ?';
    const totalQuery = req.isSuperAdmin ? 'SELECT COUNT(*) as count FROM students' : 'SELECT COUNT(*) as count FROM students WHERE campus = ?';
    const totalStudents = db.prepare(totalQuery).get(...(req.isSuperAdmin ? [] : [req.userCampus])).count;
    const today = currentDateString();
    const todayVisitsQuery = req.isSuperAdmin ? 'SELECT COUNT(*) as count FROM access_tokens WHERE date(used_at) = ?' : 'SELECT COUNT(*) as count FROM access_tokens WHERE campus = ? AND date(used_at) = ?';
    const todayVisits = db.prepare(todayVisitsQuery).get(...(req.isSuperAdmin ? [today] : [req.userCampus, today])).count;
    const thisWeek = getPeriodRange('week');
    const thisMonth = getPeriodRange('month');
    const thisWeekVisitsQuery = req.isSuperAdmin ? 'SELECT COUNT(*) as count FROM access_tokens WHERE date(used_at) BETWEEN ? AND ?' : 'SELECT COUNT(*) as count FROM access_tokens WHERE campus = ? AND date(used_at) BETWEEN ? AND ?';
    const thisMonthVisitsQuery = req.isSuperAdmin ? 'SELECT COUNT(*) as count FROM access_tokens WHERE date(used_at) BETWEEN ? AND ?' : 'SELECT COUNT(*) as count FROM access_tokens WHERE campus = ? AND date(used_at) BETWEEN ? AND ?';
    const thisWeekVisits = db.prepare(thisWeekVisitsQuery).get(...(req.isSuperAdmin ? [thisWeek.start, thisWeek.end] : [req.userCampus, thisWeek.start, thisWeek.end])).count;
    const thisMonthVisits = db.prepare(thisMonthVisitsQuery).get(...(req.isSuperAdmin ? [thisMonth.start, thisMonth.end] : [req.userCampus, thisMonth.start, thisMonth.end])).count;
    const totalVisitsQuery = req.isSuperAdmin ? 'SELECT COUNT(*) as count FROM access_tokens' : 'SELECT COUNT(*) as count FROM access_tokens WHERE campus = ?';
    const totalVisits = db.prepare(totalVisitsQuery).get(...(req.isSuperAdmin ? [] : [req.userCampus])).count;
    res.json({ totalStudents, todayVisits, thisWeekVisits, thisMonthVisits, totalVisits });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

app.get('/api/admin/visits', requireAdminAuth, async (req, res) => {
  try {
    const { range = 'day', start, end, campus } = req.query;
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

    // Try Supabase first when configured
    if (supabase) {
      try {
        const startTs = `${periodStart}T00:00:00.000Z`;
        const endTs = `${periodEnd}T23:59:59.999Z`;
        let supabaseQuery = supabase
          .from('access_tokens')
          .select('id,token,valid_date,created_at,used_at,campus,students(id,name,phone,purpose)')
          .gte('used_at', startTs)
          .lte('used_at', endTs)
          .order('used_at', { ascending: false });

        if (!req.isSuperAdmin) {
          supabaseQuery = supabaseQuery.eq('campus', campusName);
        }

        const { data, error } = await supabaseQuery;

        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }

        const students = (data || []).map(row => ({
          name: row.students?.name || '',
          phone: row.students?.phone || '',
          purpose: row.students?.purpose || '',
          campus: row.campus || campusName,
          used_at: row.used_at,
          valid_date: row.valid_date
        }));

        return res.json({ range, start: periodStart, end: periodEnd, count: students.length, students });
      } catch (err) {
        console.warn('Supabase fallback to SQLite due to error:', err.message || err);
        // fall through to SQLite fallback
      }
    }

    // SQLite fallback
    const campusClause = req.isSuperAdmin ? '' : 'AND t.campus = ?';
    const params = req.isSuperAdmin ? [periodStart, periodEnd] : [campusName, periodStart, periodEnd];
    const visitors = db.prepare(
      `SELECT t.*, s.name, s.phone, s.purpose
       FROM access_tokens t
       JOIN students s ON t.student_id = s.id
       WHERE date(t.used_at) BETWEEN ? AND ? ${campusClause}
       ORDER BY t.used_at DESC`
    ).all(...params);

    const students = visitors.map(v => ({
      name: v.name,
      phone: v.phone,
      purpose: v.purpose,
      campus: v.campus,
      used_at: v.used_at,
      valid_date: v.valid_date
    }));

    res.json({ range, start: periodStart, end: periodEnd, count: students.length, students });
  } catch (error) {
    console.error('Visits query error:', error);
    res.status(500).json({ error: 'Failed to fetch visit data' });
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

startServer(PORT);

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

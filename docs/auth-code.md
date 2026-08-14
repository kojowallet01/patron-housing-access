# Auth, Sessions, Admin Routes & Env Handling — Reference

Collated from the actual source files. Line numbers refer to the files as of this writing.

- `server/index.js` — Express app, env loading, middleware, auth middleware, all API routes
- `server/db.js` — persistence layer (SQLite / Supabase): sessions, settings, students, tokens
- `src/auth.js` — client-side session helpers
- `src/config.js` — client config + `VITE_*` env handling
- `.env.example` — documented environment variables

---

## 1. Environment variables (.env handling)

`.env.example`:

```dotenv
# Campus Institute environment example
# Copy this file to .env and update the secret values.

# Core campus configuration
CAMPUS_INSTITUTE_NAME=CAMPUS INSTITUTE
DEFAULT_CAMPUS=TESANO CAMPUS

# Global fallback credentials
ADMIN_TOKEN=change-me-admin
SECURITY_TOKEN=change-me-security
SUPER_ADMIN_TOKEN=change-me-super-admin

# Campus-specific credentials (server-side only)
CAMPUS_ADMIN_TOKENS={"TESANO CAMPUS":"tesano-admin","CANTOMENT CAMPUS":"cantoment-admin","ASHIAMAN CAMPUS":"ashiaman-admin","LEGON CAMPUS":"legon-admin","TEMA CAMPUS":"tema-admin"}
CAMPUS_SECURITY_TOKENS={"TESANO CAMPUS":"tesano-security","CANTOMENT CAMPUS":"cantoment-security","ASHIAMAN CAMPUS":"ashiaman-security","LEGON CAMPUS":"legon-security","TEMA CAMPUS":"tema-security"}

# Frontend config (no secrets - auth is server-side via sessions)
VITE_CAMPUS=TESANO CAMPUS

# Optional local dev
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Supabase Postgres (real persistence on Render without a persistent disk).
# Create a free project at supabase.com, apply supabase/schema.sql in the
# SQL Editor, then set these two values:
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

How the server reads them — `server/index.js:42-67`:

```js
const app = express();
const PORT = Number(process.env.PORT || 3001);
const CAMPUS_INSTITUTE_NAME = process.env.CAMPUS_INSTITUTE_NAME || 'CAMPUS INSTITUTE';
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
```

`CAMPUS_ADMIN_TOKENS` / `CAMPUS_SECURITY_TOKENS` can be JSON or legacy `campus:token,` format — `server/index.js:68-100`:

```js
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
```

Storage backend selection — `server/db.js:6-21`:

```js
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
export const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const DB_FILE = process.env.DB_PATH || path.join(process.cwd(), 'patron-housing.db');

// ---------------------------------------------------------------------------
// SQLite backend (local development / fallback)
// ---------------------------------------------------------------------------
try {
  mkdirSync(path.dirname(DB_FILE), { recursive: true });
} catch (error) {
  console.warn('Could not create database directory:', error.message || error);
}

const sqlite = new Database(DB_FILE);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
```

Client-side env — `src/config.js:1-8, 69-81`. Vite only exposes `VITE_*` variables to the browser; secrets stay server-side:

```js
export const API_URL = import.meta.env.PROD
  ? '/api'  // Production: uses proxy or same origin
  : `${window.location.protocol}//${window.location.hostname}:3001/api`;

export const CAMPUS_INSTITUTE_NAME = 'CAMPUS INSTITUTE';
export const DEFAULT_CAMPUS = import.meta.env.VITE_CAMPUS || 'TESANO CAMPUS';
```

---

## 2. Client-side auth helpers

`src/auth.js` — stores the opaque session token in `localStorage` and validates it against the server:

```js
import { API_URL, CAMPUS_STORAGE_KEY } from './config'

export const SESSION_KEY = 'campus-institute-session'
export const ROLE_KEY = 'campus-institute-role'

export function getSessionToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(SESSION_KEY) || ''
}

export function setSession(token, role, campus) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_KEY, token)
  window.localStorage.setItem(ROLE_KEY, role)
  if (campus) {
    window.localStorage.setItem(CAMPUS_STORAGE_KEY, campus)
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_KEY)
  window.localStorage.removeItem(ROLE_KEY)
}

export function getStoredRole() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ROLE_KEY) || ''
}

export async function validateSession() {
  const sessionToken = getSessionToken()
  if (!sessionToken) {
    return { valid: false }
  }

  try {
    const response = await fetch(`${API_URL}/session`, {
      headers: { 'x-session-token': sessionToken }
    })
    if (!response.ok) {
      clearSession()
      return { valid: false }
    }
    return response.json()
  } catch {
    return { valid: false }
  }
}

export async function logoutSession() {
  const sessionToken = getSessionToken()
  if (sessionToken) {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { 'x-session-token': sessionToken }
      })
    } catch {
      // ignore network errors during logout
    }
  }
  clearSession()
}
```

Every authenticated request attaches the session token (and campus scope) — `src/config.js:47-59`:

```js
export function getCampusAuthHeaders(campusOverride) {
  const campus = campusOverride || getSelectedCampus();
  const headers = { 'x-campus': campus };

  if (typeof window !== 'undefined') {
    const sessionToken = window.localStorage.getItem('campus-institute-session');
    if (sessionToken) {
      headers['x-session-token'] = sessionToken;
    }
  }

  return headers;
}
```

---

## 3. Session storage (server, `server/db.js:200-250`)

Sessions are rows with an opaque UUID `id`, a role, a campus, and an expiry. Created on login, resolved on every protected request, deleted on logout.

```js
export async function createSession(session) {
  if (supabase) {
    const { error } = await supabase.from('sessions').insert({
      id: session.id,
      role: session.role,
      campus: session.campus,
      is_super_admin: Boolean(session.is_super_admin),
      created_at: session.created_at,
      expires_at: session.expires_at
    });
    if (error) throw error;
    return session;
  }

  sqlite.prepare(`INSERT INTO sessions (id, role, campus, is_super_admin, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(session.id, session.role, session.campus, session.is_super_admin ? 1 : 0, session.created_at, session.expires_at);
  return session;
}

export async function resolveSession(sessionToken) {
  if (!sessionToken) return null;
  const now = new Date().toISOString();

  if (supabase) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionToken)
      .gt('expires_at', now)
      .maybeSingle();
    if (error) {
      console.error('Supabase session lookup failed:', error.message || error);
      return null;
    }
    return data ? { ...data, is_super_admin: Boolean(data.is_super_admin) } : null;
  }

  return sqlite.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?')
    .get(sessionToken, now) || null;
}

export async function deleteSession(sessionToken) {
  if (!sessionToken) return;
  if (supabase) {
    const { error } = await supabase.from('sessions').delete().eq('id', sessionToken);
    if (error) console.error('Supabase session delete failed:', error.message || error);
    return;
  }
  sqlite.prepare('DELETE FROM sessions WHERE id = ?').run(sessionToken);
}
```

Settings (used to persist campus passwords and entrance QR codes) — `server/db.js:179-195`:

```js
export function getSettingSync(key) {
  return settingsCache.has(key) ? settingsCache.get(key) : null;
}

export async function setSetting(key, value) {
  settingsCache.set(key, value);

  if (supabase) {
    const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    if (error) {
      console.error('Supabase settings write failed:', error.message || error);
    }
    return;
  }

  sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
```

Campus password storage helpers — `server/index.js:104-156`:

```js
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
  } catch (error) {
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
```

---

## 4. Auth middleware

`requireAdminAuth` — `server/index.js:345-386`. Order of trust: (1) a valid session whose role allows admin access, (2) a static admin/super-admin token header, (3) optional `ALLOW_UNAUTHENTICATED` escape hatch, else 401 (or 503 if auth isn't configured at all):

```js
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
```

`requireSecurityAuth` — `server/index.js:388-429` (mirror for the security station, accepts `x-security-token`):

```js
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
```

Configuration guards — `server/index.js:431-447`:

```js
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
```

---

## 5. Login / session / logout endpoints

Login (`POST /api/validate-login`) — `server/index.js:617-670`. Validates the password against the campus role token, then creates a server-side session:

```js
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
```

Session check (`GET /api/session`) — `server/index.js:672-690`:

```js
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
```

Logout (`POST /api/logout`) — `server/index.js:692-700`:

```js
app.post('/api/logout', async (req, res) => {
  try {
    await deleteSession(req.get('x-session-token'));
    res.json({ success: true });
  } catch (error) {
    console.error('Logout failed:', error.message || error);
    res.status(500).json({ success: false, error: 'Logout failed.' });
  }
});
```

---

## 6. Admin route handlers

All admin routes are guarded by `requireAdminAuth`. `req.userCampus` is the scoped campus (the header campus for super admins, the session campus otherwise); `req.isSuperAdmin` gates super-admin-only behavior.

### GET /api/admin/students — `server/index.js:769-777`

```js
app.get('/api/admin/students', requireAdminAuth, async (req, res) => {
  try {
    const rows = await listStudents(req.isSuperAdmin ? null : req.userCampus);
    res.json({ count: rows.length, students: rows });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});
```

### GET /api/admin/stats — `server/index.js:779-799`

```js
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
```

### GET /api/admin/visits — `server/index.js:801-850`

```js
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
```

### GET /api/admin/analytics — `server/index.js:852-896`

```js
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
```

### POST /api/admin/students — `server/index.js:898-926`

```js
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
```

### POST /api/admin/students/:id/flag — `server/index.js:928-943`

```js
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
```

### PUT /api/admin/students/:id — edit a visitor

```js
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
```

### DELETE /api/admin/students/:id — remove a visitor and their history

```js
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
```

### GET /api/admin/students/:id/visits — visit history

```js
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
```

### GET /api/admin/export — full backup (students + tokens + settings)

```js
app.get('/api/admin/export', requireAdminAuth, async (req, res) => {
  try {
    const data = await exportAllData();
    res.setHeader('Content-Disposition', `attachment; filename="patron-housing-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});
```

### GET /api/admin/system-info — storage backend, counts, uptime

```js
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
```

### GET /api/admin/tokens/qr — QR codes for a date (today by default)

```js
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
```

### GET /api/admin/today — today's verified check-ins — `server/index.js:751-767`

```js
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
```

### Super-admin password management — `server/index.js:702-749`

```js
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
```

---

## 7. Security middleware & bootstrap

Helmet, CORS, JSON body limit, and rate limiting — `server/index.js:160-187`:

```js
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

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/admin') || req.path.startsWith('/super-admin')) {
    return next();
  }
  return apiLimiter(req, res, next);
});
app.use('/api/register', authLimiter);
app.use('/api/verify-token', authLimiter);
```

Server bootstrap — `server/index.js:1061-1105`. Auto-increments the port if busy, serves the built frontend from `dist/` when present:

```js
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

main().catch(error => {
  console.error('Startup failed:', error);
  process.exit(1);
});

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
```

---

## 8. Token / visit flow (supporting context)

Access-token generation and QR — `server/index.js:290-339`:

```js
function generateAccessToken() {
  let token = '';
  for (let i = 0; i < 4; i += 1) {
    token += Math.floor(Math.random() * 10);
  }
  return token;
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
  return {
    success: true,
    student: { name: student.name, phone: student.phone, campus: student.campus },
    token: tokenData.token,
    tokenQR,
    validDate: tokenData.valid_date,
    campus: student.campus
  };
}
```

Security verification (`POST /api/verify-token`, guarded by `requireSecurityAuth`) — `server/index.js:577-614`:

```js
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
```

---

## Auth flow summary

1. Admin/security opens the protected page → `RoleGate` asks for a role password.
2. Client posts `{ role, campus, password }` to `/api/validate-login`.
3. Server compares against `getCampusRoleToken(campus, role)` (env vars + stored settings map).
4. On success the server creates a session row (UUID `id`, role, campus, 24h expiry) and returns `sessionToken`.
5. Client stores it in `localStorage` and sends it as `x-session-token` + `x-campus` on every request.
6. `requireAdminAuth` / `requireSecurityAuth` resolve the session, scope `req.userCampus`, set `req.isSuperAdmin`, then let the handler run.
7. On logout the session row is deleted; the client clears `localStorage`.

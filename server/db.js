import Database from 'better-sqlite3';
import { mkdirSync, statSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

function createSqliteTables() {
  sqlite.prepare(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    purpose TEXT NOT NULL,
    campus TEXT NOT NULL DEFAULT 'TESANO CAMPUS',
    created_at TEXT NOT NULL
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS access_tokens (
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
    sqlite.prepare('ALTER TABLE students ADD COLUMN campus TEXT NOT NULL DEFAULT "TESANO CAMPUS"').run();
  } catch {
    // column already exists
  }

  try {
    sqlite.prepare('ALTER TABLE access_tokens ADD COLUMN campus TEXT NOT NULL DEFAULT "TESANO CAMPUS"').run();
  } catch {
    // column already exists
  }

  try {
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_students_campus ON students (campus)').run();
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_access_tokens_campus ON access_tokens (campus)').run();
  } catch {
    // ignore if index creation fails on older DBs
  }

  try {
    sqlite.prepare('ALTER TABLE access_tokens ADD COLUMN verified_at TEXT').run();
  } catch {
    // column already exists
  }

  try {
    sqlite.prepare('ALTER TABLE students ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0').run();
  } catch {
    // column already exists
  }

  try {
    sqlite.prepare('ALTER TABLE students ADD COLUMN flag_note TEXT').run();
  } catch {
    // column already exists
  }

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    campus TEXT NOT NULL,
    is_super_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`).run();

  const tableInfo = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='students'").get();
  if (tableInfo?.sql?.includes('phone TEXT NOT NULL UNIQUE')) {
    sqlite.pragma('foreign_keys = OFF');
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS students_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          purpose TEXT NOT NULL,
          campus TEXT NOT NULL DEFAULT 'TESANO CAMPUS',
          created_at TEXT NOT NULL,
          UNIQUE(phone, campus)
        );
        INSERT OR IGNORE INTO students_new SELECT id, name, phone, purpose, campus, created_at FROM students;
        DROP TABLE students;
        ALTER TABLE students_new RENAME TO students;
      `);
    } finally {
      sqlite.pragma('foreign_keys = ON');
    }
  }

  try {
    sqlite.prepare("UPDATE students SET campus = 'CANTOMENT CAMPUS' WHERE campus = 'CHRISTIANSBORG CAMPUS'").run();
    sqlite.prepare("UPDATE access_tokens SET campus = 'CANTOMENT CAMPUS' WHERE campus = 'CHRISTIANSBORG CAMPUS'").run();
    sqlite.prepare("UPDATE sessions SET campus = 'CANTOMENT CAMPUS' WHERE campus = 'CHRISTIANSBORG CAMPUS'").run();
    sqlite.prepare("UPDATE settings SET key = 'campus_qr_CANTOMENT_CAMPUS' WHERE key = 'campus_qr_CHRISTIANSBORG_CAMPUS'").run();
    sqlite.prepare("UPDATE settings SET value = REPLACE(value, 'CHRISTIANSBORG CAMPUS', 'CANTOMENT CAMPUS') WHERE key IN ('campus_admin_tokens', 'campus_security_tokens', 'campus_super_admin_tokens')").run();
  } catch {
    // tables may not exist yet on a fresh DB
  }
}

// ---------------------------------------------------------------------------
// Supabase backend
// ---------------------------------------------------------------------------
let supabase = null;
if (useSupabase) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error.message || error);
  }
}

async function checkSupabaseSchema() {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('settings').select('key').limit(1);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(
      `Supabase tables are not ready yet: ${error.message || error}\n` +
      'Run supabase/schema.sql in the Supabase SQL Editor once, then redeploy.'
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Settings (cached in memory for fast hot-path auth checks)
// ---------------------------------------------------------------------------
let settingsCache = new Map();

async function loadAllSettings() {
  if (supabase) {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) {
      console.error('Failed to load settings from Supabase:', error.message || error);
      settingsCache = new Map();
      return;
    }
    settingsCache = new Map((data || []).map(row => [row.key, row.value]));
    return;
  }

  const rows = sqlite.prepare('SELECT key, value FROM settings').all();
  settingsCache = new Map(rows.map(row => [row.key, row.value]));
}

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

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------
export async function findStudentByPhoneAndCampus(phone, campus) {
  if (supabase) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('phone', phone)
      .eq('campus', campus)
      .maybeSingle();
    if (error) {
      console.error('Supabase student lookup failed:', error.message || error);
      return null;
    }
    return data ? { ...data, flagged: Boolean(data.flagged) } : null;
  }
  return sqlite.prepare('SELECT * FROM students WHERE phone = ? AND campus = ?').get(phone.trim(), campus) || null;
}

export async function findStudentById(id) {
  if (supabase) {
    const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('Supabase student lookup failed:', error.message || error);
      return null;
    }
    return data ? { ...data, flagged: Boolean(data.flagged) } : null;
  }
  return sqlite.prepare('SELECT * FROM students WHERE id = ?').get(id) || null;
}

export async function insertStudent(student) {
  const row = {
    id: student.id,
    name: student.name,
    phone: student.phone,
    purpose: student.purpose,
    campus: student.campus,
    created_at: student.created_at,
    flagged: student.flagged ? 1 : 0,
    flag_note: student.flag_note || null
  };

  if (supabase) {
    const { error } = await supabase.from('students').insert(row);
    if (error) throw error;
    return student;
  }

  sqlite.prepare(`INSERT INTO students (id, name, phone, purpose, campus, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(student.id, student.name, student.phone, student.purpose, student.campus, student.created_at);
  return student;
}

export async function listStudents(campus) {
  if (supabase) {
    let query = supabase.from('students').select('*').order('created_at', { ascending: false });
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) {
      console.error('Supabase students list failed:', error.message || error);
      return [];
    }
    return (data || []).map(s => ({ ...s, flagged: Boolean(s.flagged) }));
  }

  const campusFilter = campus ? 'WHERE campus = ?' : '';
  const params = campus ? [campus] : [];
  return sqlite.prepare(`SELECT * FROM students ${campusFilter} ORDER BY created_at DESC`).all(...params);
}

export async function countStudents(campus) {
  if (supabase) {
    let query = supabase.from('students').select('id', { count: 'exact', head: true });
    if (campus) query = query.eq('campus', campus);
    const { count, error } = await query;
    if (error) {
      console.error('Supabase students count failed:', error.message || error);
      return 0;
    }
    return count || 0;
  }

  const query = campus ? 'SELECT COUNT(*) as count FROM students WHERE campus = ?' : 'SELECT COUNT(*) as count FROM students';
  return sqlite.prepare(query).get(...(campus ? [campus] : [])).count;
}

export async function countNewStudents(campus, start, end) {
  if (supabase) {
    let query = supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`);
    if (campus) query = query.eq('campus', campus);
    const { count, error } = await query;
    if (error) {
      console.error('Supabase new students count failed:', error.message || error);
      return 0;
    }
    return count || 0;
  }

  const sql = campus
    ? 'SELECT COUNT(*) as count FROM students WHERE campus = ? AND date(created_at) BETWEEN ? AND ?'
    : 'SELECT COUNT(*) as count FROM students WHERE date(created_at) BETWEEN ? AND ?';
  const params = campus ? [campus, start, end] : [start, end];
  return sqlite.prepare(sql).get(...params).count;
}

export async function updateStudentFlag(id, flagged, note) {
  if (supabase) {
    const { error } = await supabase
      .from('students')
      .update({ flagged: flagged ? 1 : 0, flag_note: (note || '').trim() })
      .eq('id', id);
    if (error) throw error;
    return;
  }
  sqlite.prepare('UPDATE students SET flagged = ?, flag_note = ? WHERE id = ?')
    .run(flagged ? 1 : 0, (note || '').trim(), id);
}

export async function updateStudent(id, updates) {
  const name = String(updates.name || '').trim();
  const phone = String(updates.phone || '').trim();
  const purpose = String(updates.purpose || '').trim();

  if (supabase) {
    const { error } = await supabase
      .from('students')
      .update({ name, phone, purpose })
      .eq('id', id);
    if (error) throw error;
    return;
  }

  sqlite.prepare('UPDATE students SET name = ?, phone = ?, purpose = ? WHERE id = ?')
    .run(name, phone, purpose, id);
}

export async function deleteStudent(id) {
  if (supabase) {
    const { error: tokenError } = await supabase.from('access_tokens').delete().eq('student_id', id);
    if (tokenError) throw tokenError;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  sqlite.prepare('DELETE FROM access_tokens WHERE student_id = ?').run(id);
  sqlite.prepare('DELETE FROM students WHERE id = ?').run(id);
}

export async function listTokensForStudent(studentId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('access_tokens')
      .select('*, students(id,name,phone,purpose)')
      .eq('student_id', studentId)
      .not('verified_at', 'is', null)
      .order('used_at', { ascending: false });
    if (error) {
      console.error('Supabase student visits failed:', error.message || error);
      return [];
    }
    return flattenTokenRows(data);
  }

  const rows = sqlite.prepare(
    `SELECT t.*, s.name, s.phone, s.purpose
     FROM access_tokens t
     JOIN students s ON t.student_id = s.id
     WHERE t.student_id = ? AND t.verified_at IS NOT NULL
     ORDER BY t.used_at DESC`
  ).all(studentId);
  return flattenTokenRows(rows);
}

export async function exportAllData() {
  if (supabase) {
    const [students, tokens, settings] = await Promise.all([
      supabase.from('students').select('*').order('created_at', { ascending: false }),
      supabase.from('access_tokens').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('key, value')
    ]);
    return {
      students: (students.data || []).map(s => ({ ...s, flagged: Boolean(s.flagged) })),
      tokens: tokens.data || [],
      settings: settings.data || []
    };
  }

  const students = sqlite.prepare('SELECT * FROM students ORDER BY created_at DESC').all();
  const tokens = sqlite.prepare('SELECT * FROM access_tokens ORDER BY created_at DESC').all();
  const settings = sqlite.prepare('SELECT key, value FROM settings').all();
  return { students, tokens, settings };
}

export async function restoreAllData(data) {
  const students = Array.isArray(data?.students) ? data.students : [];
  const tokens = Array.isArray(data?.tokens) ? data.tokens : [];
  const settings = Array.isArray(data?.settings) ? data.settings : [];

  if (supabase) {
    const { error: delTokens } = await supabase.from('access_tokens').delete().neq('id', '');
    if (delTokens) throw delTokens;
    const { error: delStudents } = await supabase.from('students').delete().neq('id', '');
    if (delStudents) throw delStudents;
    const { error: delSettings } = await supabase.from('settings').delete().neq('key', '');
    if (delSettings) throw delSettings;

    for (const s of students) {
      await insertStudent({ ...s, flagged: Boolean(s.flagged), flag_note: s.flag_note || '' });
    }
    for (const t of tokens) await insertToken(t);
    for (const k of settings) await setSetting(k.key, k.value);
    return { students: students.length, tokens: tokens.length, settings: settings.length };
  }

  const run = sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM access_tokens').run();
    sqlite.prepare('DELETE FROM students').run();
    sqlite.prepare('DELETE FROM settings').run();

    const insertStudentStmt = sqlite.prepare(`INSERT INTO students (id, name, phone, purpose, campus, created_at, flagged, flag_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const s of students) {
      insertStudentStmt.run(
        s.id,
        s.name,
        s.phone,
        s.purpose || '',
        s.campus || 'TESANO CAMPUS',
        s.created_at,
        s.flagged ? 1 : 0,
        s.flag_note || null
      );
    }

    const insertTokenStmt = sqlite.prepare(`INSERT INTO access_tokens (id, student_id, campus, token, valid_date, created_at, used_at, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const t of tokens) {
      insertTokenStmt.run(
        t.id,
        t.student_id,
        t.campus || 'TESANO CAMPUS',
        t.token,
        t.valid_date,
        t.created_at,
        t.used_at || t.created_at,
        t.verified_at || null
      );
    }

    const insertSettingStmt = sqlite.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const k of settings) {
      if (k && k.key) insertSettingStmt.run(k.key, k.value);
    }
  });
  run();

  settingsCache = new Map(settings.filter(k => k && k.key).map(row => [row.key, row.value]));
  return { students: students.length, tokens: tokens.length, settings: settings.length };
}

// ---------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------
export async function findTokenForStudentToday(studentId, campus, validDate) {
  if (supabase) {
    const { data, error } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('student_id', studentId)
      .eq('campus', campus)
      .eq('valid_date', validDate)
      .maybeSingle();
    if (error) {
      console.error('Supabase token lookup failed:', error.message || error);
      return null;
    }
    return data || null;
  }
  return sqlite.prepare('SELECT * FROM access_tokens WHERE student_id = ? AND campus = ? AND valid_date = ?')
    .get(studentId, campus, validDate) || null;
}

export async function tokenExistsForDate(token, validDate) {
  if (supabase) {
    const { data, error } = await supabase
      .from('access_tokens')
      .select('id')
      .eq('token', token)
      .eq('valid_date', validDate)
      .maybeSingle();
    if (error) {
      console.error('Supabase token collision check failed:', error.message || error);
      return false;
    }
    return Boolean(data);
  }
  return Boolean(sqlite.prepare('SELECT 1 FROM access_tokens WHERE token = ? AND valid_date = ?').get(token, validDate));
}

export async function insertToken(tokenData) {
  if (supabase) {
    const { error } = await supabase.from('access_tokens').insert({
      id: tokenData.id,
      student_id: tokenData.student_id,
      campus: tokenData.campus,
      token: tokenData.token,
      valid_date: tokenData.valid_date,
      created_at: tokenData.created_at,
      used_at: tokenData.used_at,
      verified_at: tokenData.verified_at ?? null
    });
    if (error) throw error;
    return tokenData;
  }

  sqlite.prepare(`INSERT INTO access_tokens (id, student_id, campus, token, valid_date, created_at, used_at, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(tokenData.id, tokenData.student_id, tokenData.campus, tokenData.token, tokenData.valid_date, tokenData.created_at, tokenData.used_at, tokenData.verified_at);
  return tokenData;
}

export async function findTokenByCode(campus, token, validDate) {
  if (supabase) {
    const { data, error } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('token', token)
      .eq('campus', campus)
      .eq('valid_date', validDate)
      .maybeSingle();
    if (error) {
      console.error('Supabase token lookup failed:', error.message || error);
      return null;
    }
    return data || null;
  }
  return sqlite.prepare('SELECT * FROM access_tokens WHERE token = ? AND campus = ? AND valid_date = ?')
    .get(token, campus, validDate) || null;
}

export async function markTokenVerified(id, verifiedAt) {
  if (supabase) {
    const { error } = await supabase
      .from('access_tokens')
      .update({ verified_at: verifiedAt, used_at: verifiedAt })
      .eq('id', id)
      .is('verified_at', null);
    if (error) throw error;
    return;
  }
  sqlite.prepare('UPDATE access_tokens SET verified_at = ?, used_at = ? WHERE id = ? AND verified_at IS NULL')
    .run(verifiedAt, verifiedAt, id);
}

function flattenTokenRows(rows) {
  return (rows || []).map(row => {
    const student = row.students || row;
    return {
      id: row.id,
      student_id: row.student_id,
      campus: row.campus,
      token: row.token,
      valid_date: row.valid_date,
      created_at: row.created_at,
      used_at: row.used_at,
      verified_at: row.verified_at,
      name: student.name || '',
      phone: student.phone || '',
      purpose: student.purpose || ''
    };
  });
}

export async function listTokensWithStudents(campus, start, end) {
  if (supabase) {
    let query = supabase
      .from('access_tokens')
      .select('*, students(id,name,phone,purpose)')
      .not('verified_at', 'is', null)
      .gte('verified_at', `${start}T00:00:00.000Z`)
      .lte('verified_at', `${end}T23:59:59.999Z`)
      .order('verified_at', { ascending: false });
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) {
      console.error('Supabase visits query failed:', error.message || error);
      return [];
    }
    return flattenTokenRows(data);
  }

  const campusClause = campus ? 'AND t.campus = ?' : '';
  const params = campus ? [start, end, campus] : [start, end];
  const rows = sqlite.prepare(
    `SELECT t.*, s.name, s.phone, s.purpose
     FROM access_tokens t
     JOIN students s ON t.student_id = s.id
     WHERE t.verified_at IS NOT NULL AND date(t.verified_at) BETWEEN ? AND ? ${campusClause}
     ORDER BY t.verified_at DESC`
  ).all(...params);
  return flattenTokenRows(rows);
}

export async function listTokensVerifiedOn(campus, date) {
  if (supabase) {
    let query = supabase
      .from('access_tokens')
      .select('*, students(id,name,phone,purpose)')
      .not('verified_at', 'is', null)
      .gte('verified_at', `${date}T00:00:00.000Z`)
      .lte('verified_at', `${date}T23:59:59.999Z`)
      .order('verified_at', { ascending: false });
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) {
      console.error('Supabase today query failed:', error.message || error);
      return [];
    }
    return flattenTokenRows(data);
  }

  const campusFilter = campus ? 'AND t.campus = ?' : '';
  const params = campus ? [date, campus] : [date];
  const rows = sqlite.prepare(
    `SELECT t.*, s.name, s.phone, s.purpose
     FROM access_tokens t
     JOIN students s ON t.student_id = s.id
     WHERE t.verified_at IS NOT NULL AND date(t.verified_at) = ? ${campusFilter}
     ORDER BY t.verified_at DESC`
  ).all(...params);
  return flattenTokenRows(rows);
}

export async function listTokensForDate(campus, validDate) {
  if (supabase) {
    let query = supabase
      .from('access_tokens')
      .select('*, students(id,name,phone,purpose)')
      .eq('valid_date', validDate)
      .order('created_at', { ascending: true });
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) {
      console.error('Supabase tokens-for-date query failed:', error.message || error);
      return [];
    }
    return flattenTokenRows(data);
  }

  const campusFilter = campus ? 'AND t.campus = ?' : '';
  const params = campus ? [validDate, campus] : [validDate];
  const rows = sqlite.prepare(
    `SELECT t.*, s.name, s.phone, s.purpose
     FROM access_tokens t
     JOIN students s ON t.student_id = s.id
     WHERE t.valid_date = ? ${campusFilter}
     ORDER BY t.created_at ASC`
  ).all(...params);
  return flattenTokenRows(rows);
}

export async function countVerifiedVisits(campus, date) {
  if (supabase) {
    let query = supabase
      .from('access_tokens')
      .select('id', { count: 'exact', head: true })
      .not('verified_at', 'is', null)
      .gte('verified_at', `${date}T00:00:00.000Z`)
      .lte('verified_at', `${date}T23:59:59.999Z`);
    if (campus) query = query.eq('campus', campus);
    const { count, error } = await query;
    if (error) {
      console.error('Supabase visit count failed:', error.message || error);
      return 0;
    }
    return count || 0;
  }

  const sql = campus
    ? 'SELECT COUNT(*) as count FROM access_tokens WHERE campus = ? AND verified_at IS NOT NULL AND date(verified_at) = ?'
    : 'SELECT COUNT(*) as count FROM access_tokens WHERE verified_at IS NOT NULL AND date(verified_at) = ?';
  return sqlite.prepare(sql).get(...(campus ? [campus, date] : [date])).count;
}

export async function countVerifiedVisitsBetween(campus, start, end) {
  if (supabase) {
    let query = supabase
      .from('access_tokens')
      .select('id', { count: 'exact', head: true })
      .not('verified_at', 'is', null)
      .gte('verified_at', `${start}T00:00:00.000Z`)
      .lte('verified_at', `${end}T23:59:59.999Z`);
    if (campus) query = query.eq('campus', campus);
    const { count, error } = await query;
    if (error) {
      console.error('Supabase visit count failed:', error.message || error);
      return 0;
    }
    return count || 0;
  }

  const sql = campus
    ? 'SELECT COUNT(*) as count FROM access_tokens WHERE campus = ? AND verified_at IS NOT NULL AND date(verified_at) BETWEEN ? AND ?'
    : 'SELECT COUNT(*) as count FROM access_tokens WHERE verified_at IS NOT NULL AND date(verified_at) BETWEEN ? AND ?';
  return sqlite.prepare(sql).get(...(campus ? [campus, start, end] : [start, end])).count;
}

export async function countAllVerifiedVisits(campus) {
  if (supabase) {
    let query = supabase
      .from('access_tokens')
      .select('id', { count: 'exact', head: true })
      .not('verified_at', 'is', null);
    if (campus) query = query.eq('campus', campus);
    const { count, error } = await query;
    if (error) {
      console.error('Supabase visit count failed:', error.message || error);
      return 0;
    }
    return count || 0;
  }

  const sql = campus
    ? 'SELECT COUNT(*) as count FROM access_tokens WHERE campus = ? AND verified_at IS NOT NULL'
    : 'SELECT COUNT(*) as count FROM access_tokens WHERE verified_at IS NOT NULL';
  return sqlite.prepare(sql).get(...(campus ? [campus] : [])).count;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function getSystemInfo() {  let dbSizeBytes = 0;
  let counts = { students: 0, tokens: 0, sessions: 0, settings: 0 };

  if (supabase) {
    return {
      storage: 'supabase',
      durable: true,
      dbSizeBytes,
      counts
    };
  }

  try {
    dbSizeBytes = statSync(DB_FILE).size || 0;
    counts = {
      students: sqlite.prepare('SELECT COUNT(*) as c FROM students').get().c,
      tokens: sqlite.prepare('SELECT COUNT(*) as c FROM access_tokens').get().c,
      sessions: sqlite.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
      settings: sqlite.prepare('SELECT COUNT(*) as c FROM settings').get().c
    };
  } catch (error) {
    console.error('System info error:', error.message || error);
  }

  return {
    storage: 'sqlite',
    durable: false,
    dbFile: DB_FILE,
    dbSizeBytes,
    counts
  };
}

export function closeDatabase() {
  if (!supabase && sqlite) {
    try {
      sqlite.close();
    } catch {
      // ignore if already closed
    }
  }
}

export async function init() {
  createSqliteTables();

  let schemaOk = true;
  if (useSupabase && supabase) {
    schemaOk = await checkSupabaseSchema();
  }

  await loadAllSettings();

  if (useSupabase && supabase && schemaOk) {
    console.log('Persistence: Supabase Postgres (durable across redeploys)');
  } else if (useSupabase && supabase) {
    console.log('Persistence: Supabase configured but tables missing — run supabase/schema.sql in the Supabase SQL Editor.');
  } else {
    console.log('Persistence: local SQLite (EPHEMERAL on Render — set SUPABASE_URL + SUPABASE_SERVICE_KEY for durable storage)');
  }
}

import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
export const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const DB_FILE = process.env.DB_PATH || path.join(import.meta.dirname, '..', 'aifsp.db');

const BACKUP_DIR = path.join(path.dirname(DB_FILE), 'backups');
const MAX_BACKUPS = 20;

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

async function snapshotDatabase() {
  if (useSupabase) return;
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(BACKUP_DIR, `aifsp-${stamp}.db`);
    await sqlite.backup(dest);
    const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith('aifsp-')).sort();
    while (files.length > MAX_BACKUPS) {
      unlinkSync(path.join(BACKUP_DIR, files.shift()));
    }
    console.log(`[backup] database snapshot saved to backups/${path.basename(dest)}`);
  } catch (error) {
    console.warn('[backup] snapshot failed:', error.message || error);
  }
}

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
    date_of_birth TEXT,
    campus TEXT NOT NULL DEFAULT 'TESANO CAMPUS',
    created_at TEXT NOT NULL,
    sms_opt_out INTEGER NOT NULL DEFAULT 0
  )`).run();

  try {
    sqlite.prepare('ALTER TABLE students ADD COLUMN date_of_birth TEXT').run();
  } catch {
    // column already exists
  }

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

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    phone TEXT,
    campus TEXT NOT NULL,
    rating INTEGER NOT NULL,
    category TEXT,
    comment TEXT,
    created_at TEXT NOT NULL
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS sms_logs (
    id TEXT PRIMARY KEY,
    campus TEXT NOT NULL,
    recipient_name TEXT,
    recipient_phone_masked TEXT NOT NULL,
    recipient_id TEXT,
    provider TEXT,
    provider_message_id TEXT,
    status TEXT NOT NULL,
    delivery_status TEXT,
    source TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS retention_schedules (
    id TEXT PRIMARY KEY,
    campus TEXT NOT NULL,
    run_at TEXT NOT NULL,
    status TEXT NOT NULL,
    templates TEXT NOT NULL,
    recipient_ids TEXT NOT NULL,
    cooldown_days INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    result TEXT
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS academic_terms (
    id TEXT PRIMARY KEY,
    campus TEXT NOT NULL,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS class_schedules (
    id TEXT PRIMARY KEY,
    term_id TEXT NOT NULL REFERENCES academic_terms(id),
    campus TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    classroom TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    instructor TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS class_bookings (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES class_schedules(id),
    student_id TEXT NOT NULL REFERENCES students(id),
    campus TEXT NOT NULL,
    class_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked',
    class_title_snapshot TEXT NOT NULL,
    description_snapshot TEXT NOT NULL DEFAULT '',
    day_of_week_snapshot INTEGER NOT NULL,
    start_time_snapshot TEXT NOT NULL,
    end_time_snapshot TEXT NOT NULL,
    classroom_snapshot TEXT NOT NULL,
    instructor_snapshot TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    calendar_added_at TEXT
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS class_attendance (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL UNIQUE REFERENCES class_bookings(id),
    class_id TEXT NOT NULL REFERENCES class_schedules(id),
    student_id TEXT NOT NULL REFERENCES students(id),
    class_date TEXT NOT NULL,
    status TEXT NOT NULL,
    verified_by TEXT NOT NULL,
    verified_at TEXT NOT NULL
  )`).run();

  sqlite.prepare(`CREATE TABLE IF NOT EXISTS class_notifications (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES class_bookings(id),
    student_id TEXT NOT NULL REFERENCES students(id),
    event TEXT NOT NULL,
    status TEXT NOT NULL,
    provider TEXT,
    provider_message_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  )`).run();

  const classBookingColumns = sqlite.prepare('PRAGMA table_info(class_bookings)').all().map((column) => column.name);
  if (!classBookingColumns.includes('calendar_added_at')) {
    sqlite.prepare('ALTER TABLE class_bookings ADD COLUMN calendar_added_at TEXT').run();
  }

  const classBookingsTable = sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'class_bookings'"
  ).get();
  if (/\bUNIQUE\s*\(\s*class_id\s*,\s*student_id\s*,\s*class_date\s*\)/i.test(classBookingsTable?.sql || '')) {
    sqlite.pragma('foreign_keys = OFF');
    try {
      sqlite.transaction(() => {
        sqlite.exec(`
          CREATE TABLE class_bookings_rebook (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL REFERENCES class_schedules(id),
            student_id TEXT NOT NULL REFERENCES students(id),
            campus TEXT NOT NULL,
            class_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'booked',
            class_title_snapshot TEXT NOT NULL,
            description_snapshot TEXT NOT NULL DEFAULT '',
            day_of_week_snapshot INTEGER NOT NULL,
            start_time_snapshot TEXT NOT NULL,
            end_time_snapshot TEXT NOT NULL,
            classroom_snapshot TEXT NOT NULL,
            instructor_snapshot TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            calendar_added_at TEXT
          );
          INSERT INTO class_bookings_rebook (
            id, class_id, student_id, campus, class_date, status, class_title_snapshot,
            description_snapshot, day_of_week_snapshot, start_time_snapshot, end_time_snapshot,
            classroom_snapshot, instructor_snapshot, created_at, updated_at, calendar_added_at
          )
          SELECT
            id, class_id, student_id, campus, class_date, status, class_title_snapshot,
            description_snapshot, day_of_week_snapshot, start_time_snapshot, end_time_snapshot,
            classroom_snapshot, instructor_snapshot, created_at, updated_at, calendar_added_at
          FROM class_bookings;
          DROP TABLE class_bookings;
          ALTER TABLE class_bookings_rebook RENAME TO class_bookings;
        `);
      })();
    } finally {
      sqlite.pragma('foreign_keys = ON');
    }
  }

  const studentColumns = sqlite.prepare('PRAGMA table_info(students)').all().map((column) => column.name);
  if (!studentColumns.includes('sms_opt_out')) {
    sqlite.prepare('ALTER TABLE students ADD COLUMN sms_opt_out INTEGER NOT NULL DEFAULT 0').run();
  }
  const smsLogColumns = sqlite.prepare('PRAGMA table_info(sms_logs)').all().map((column) => column.name);
  if (!smsLogColumns.includes('recipient_id')) sqlite.prepare('ALTER TABLE sms_logs ADD COLUMN recipient_id TEXT').run();
  if (!smsLogColumns.includes('provider_message_id')) sqlite.prepare('ALTER TABLE sms_logs ADD COLUMN provider_message_id TEXT').run();
  if (!smsLogColumns.includes('delivery_status')) sqlite.prepare('ALTER TABLE sms_logs ADD COLUMN delivery_status TEXT').run();
  const scheduleColumns = sqlite.prepare('PRAGMA table_info(retention_schedules)').all().map((column) => column.name);
  if (!scheduleColumns.includes('recipient_ids')) {
    sqlite.prepare("ALTER TABLE retention_schedules ADD COLUMN recipient_ids TEXT NOT NULL DEFAULT '[]'").run();
  }
  sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient_created ON sms_logs (recipient_id, created_at)').run();
  sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_retention_schedules_status_run_at ON retention_schedules (status, run_at)').run();
  sqlite.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_terms_one_active ON academic_terms (campus) WHERE status = 'active'").run();
  sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_class_schedules_term_status ON class_schedules (term_id, status)').run();
  sqlite.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_class_bookings_one_active_per_date
    ON class_bookings (class_id, student_id, class_date) WHERE status = 'booked'`).run();
  sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_class_bookings_campus_date ON class_bookings (class_date, status)').run();
  sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_class_bookings_student_date ON class_bookings (student_id, class_date)').run();
  sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_class_attendance_date_status ON class_attendance (class_date, status)').run();

  try {
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_feedback_campus ON feedback (campus)').run();
  } catch {
    // ignore
  }

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
          date_of_birth TEXT,
          campus TEXT NOT NULL DEFAULT 'TESANO CAMPUS',
          created_at TEXT NOT NULL,
          UNIQUE(phone, campus)
        );
        INSERT OR IGNORE INTO students_new (id, name, phone, purpose, date_of_birth, campus, created_at)
          SELECT id, name, phone, purpose, date_of_birth, campus, created_at FROM students;
        DROP TABLE students;
        ALTER TABLE students_new RENAME TO students;
      `);
    } finally {
      sqlite.pragma('foreign_keys = ON');
    }
  }

  try {
    sqlite.prepare('ALTER TABLE students ADD COLUMN date_of_birth TEXT').run();
  } catch {
    // column already exists
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

export async function checkClassScheduleSchema() {
  if (!supabase) return true;
  const requiredTables = [
    'academic_terms',
    'class_schedules',
    'class_bookings',
    'class_attendance',
    'class_notifications'
  ];
  const results = await Promise.all(requiredTables.map((table) =>
    supabase.from(table).select('id').limit(1)
  ));
  const missingTable = results.find((result) =>
    result.error && ['PGRST205', '42P01'].includes(result.error.code)
  );
  if (missingTable) {
    console.warn(
      '[classes] Supabase timetable tables are not ready. Apply supabase/class-schedule-migration.sql before using class registration.'
    );
    return false;
  }
  const failure = results.find((result) => result.error);
  if (failure) throw new Error(`Supabase timetable schema check failed: ${failure.error.message}`);

  const { error: calendarColumnError } = await supabase.from('class_bookings')
    .select('calendar_added_at').limit(1);
  if (calendarColumnError && calendarColumnError.code === '42703') {
    console.warn(
      '[classes] Calendar tracking migration is not ready. Re-run supabase/class-schedule-migration.sql before using class registration.'
    );
    return false;
  }
  if (calendarColumnError) {
    throw new Error(`Supabase timetable schema check failed: ${calendarColumnError.message}`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Settings (cached in memory for fast hot-path auth checks)
// ---------------------------------------------------------------------------
let settingsCache = new Map();
let supabaseHealthy = null;

export async function checkSupabaseHealth() {
  if (!supabase) return { configured: false, healthy: null, backend: 'sqlite' };
  try {
    const { error } = await supabase.from('settings').select('key').limit(1);
    const healthy = !error;
    supabaseHealthy = healthy;
    if (!healthy) console.warn('[health] Supabase query failed:', error.message || error);
    return { configured: true, healthy, backend: 'supabase' };
  } catch (err) {
    supabaseHealthy = false;
    console.warn('[health] Supabase unreachable:', err.message || err);
    return { configured: true, healthy: false, backend: 'supabase' };
  }
}

export function getSupabaseStatus() {
  return { configured: Boolean(supabase), healthy: supabaseHealthy, backend: supabase ? 'supabase' : 'sqlite' };
}

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
    let lastError;
    for (let attempt = 0; attempt <= 1; attempt++) {
      const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      if (!error) {
        supabaseHealthy = true;
        return;
      }
      lastError = error;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
    supabaseHealthy = false;
    console.error('Supabase settings write failed:', lastError.message || lastError);
    throw new Error(`Supabase settings write failed: ${lastError.message || 'unknown error'}`);
  }

  sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

// ---------------------------------------------------------------------------
// Sessions (cached in memory for high-performance authentication checks)
// ---------------------------------------------------------------------------
const sessionMemoryCache = new Map();
const SESSION_CACHE_TTL_MS = 30000;

export async function createSession(session) {
  sessionMemoryCache.set(session.id, { session, cachedAt: Date.now() });

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

  const cached = sessionMemoryCache.get(sessionToken);
  if (cached && (Date.now() - cached.cachedAt < SESSION_CACHE_TTL_MS) && cached.session.expires_at > now) {
    return cached.session;
  }

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
    const resolved = data ? { ...data, is_super_admin: Boolean(data.is_super_admin) } : null;
    if (resolved) {
      sessionMemoryCache.set(sessionToken, { session: resolved, cachedAt: Date.now() });
    }
    return resolved;
  }

  const resolved = sqlite.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?')
    .get(sessionToken, now) || null;
  if (resolved) {
    sessionMemoryCache.set(sessionToken, { session: resolved, cachedAt: Date.now() });
  }
  return resolved;
}

export async function deleteSession(sessionToken) {
  if (!sessionToken) return;
  sessionMemoryCache.delete(sessionToken);

  if (supabase) {
    const { error } = await supabase.from('sessions').delete().eq('id', sessionToken);
    if (error) console.error('Supabase session delete failed:', error.message || error);
    return;
  }
  sqlite.prepare('DELETE FROM sessions WHERE id = ?').run(sessionToken);
}

export async function deleteAllSessions() {
  sessionMemoryCache.clear();

  if (supabase) {
    const { error } = await supabase.from('sessions').delete().not('id', 'is', null);
    if (error) throw error;
    return;
  }

  sqlite.prepare('DELETE FROM sessions').run();
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
    return data ? { ...data, flagged: Boolean(data.flagged), sms_opt_out: Boolean(data.sms_opt_out) } : null;
  }
  return sqlite.prepare('SELECT * FROM students WHERE id = ?').get(id) || null;
}

export async function insertStudent(student) {
  const row = {
    id: student.id,
    name: student.name,
    phone: student.phone,
    purpose: student.purpose,
    date_of_birth: student.date_of_birth || null,
    campus: student.campus,
    created_at: student.created_at,
    flagged: student.flagged ? 1 : 0,
    flag_note: student.flag_note || null,
    sms_opt_out: student.sms_opt_out ? 1 : 0
  };

  if (supabase) {
    const { error } = await supabase.from('students').insert(row);
    if (error) throw error;
    return student;
  }

  sqlite.prepare(`INSERT INTO students (id, name, phone, purpose, date_of_birth, campus, created_at, sms_opt_out)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(student.id, student.name, student.phone, student.purpose, student.date_of_birth || null, student.campus, student.created_at, student.sms_opt_out ? 1 : 0);
  return student;
}

export async function registerStudentWithClassBookings(student, bookings, today, currentTime) {
  if (supabase) {
    const { data, error } = await supabase.rpc('register_student_with_class_bookings', {
      p_student: student,
      p_bookings: bookings,
      p_today: today,
      p_current_time: currentTime
    });
    if (error) throw new Error(error.message);
    return data;
  }

  const transaction = sqlite.transaction(() => {
    sqlite.prepare(`INSERT INTO students (id, name, phone, purpose, date_of_birth, campus, created_at, sms_opt_out)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)`).run(
      student.id, student.name, student.phone, student.purpose, student.date_of_birth, student.campus, student.created_at
    );

    const insertBooking = sqlite.prepare(`INSERT INTO class_bookings (
      id, class_id, student_id, campus, class_date, status, class_title_snapshot, description_snapshot,
      day_of_week_snapshot, start_time_snapshot, end_time_snapshot, classroom_snapshot,
      instructor_snapshot, created_at, updated_at
    ) VALUES (
      @id, @class_id, @student_id, @campus, @class_date, 'booked', @class_title_snapshot, @description_snapshot,
      @day_of_week_snapshot, @start_time_snapshot, @end_time_snapshot, @classroom_snapshot,
      @instructor_snapshot, @created_at, @updated_at
    )`);
    const createdBookings = [];

    for (const booking of bookings) {
      const classSchedule = sqlite.prepare('SELECT * FROM class_schedules WHERE id = ? AND campus = ?')
        .get(booking.class_id, student.campus);
      const term = classSchedule && sqlite.prepare('SELECT * FROM academic_terms WHERE id = ? AND campus = ?')
        .get(classSchedule.term_id, student.campus);
      if (!classSchedule || classSchedule.status !== 'published' || !term || term.status !== 'active') {
        throw new Error('Class is not open for booking');
      }
      if (booking.class_date < today || booking.class_date < term.start_date || booking.class_date > term.end_date ||
          new Date(`${booking.class_date}T00:00:00.000Z`).getUTCDay() !== classSchedule.day_of_week) {
        throw new Error('Class date is outside the schedule');
      }
      if (booking.class_date === today && currentTime >= classSchedule.end_time) {
        throw new Error('This class session has already ended and cannot be booked.');
      }

      const bookedCount = sqlite.prepare(`SELECT COUNT(*) AS count FROM class_bookings
        WHERE class_id = ? AND class_date = ? AND status = 'booked'`)
        .get(classSchedule.id, booking.class_date).count;
      if (bookedCount >= classSchedule.capacity) throw new Error('Class is full');

      const row = {
        ...booking,
        student_id: student.id,
        campus: student.campus,
        status: 'booked',
        class_title_snapshot: classSchedule.title,
        description_snapshot: classSchedule.description,
        day_of_week_snapshot: classSchedule.day_of_week,
        start_time_snapshot: classSchedule.start_time,
        end_time_snapshot: classSchedule.end_time,
        classroom_snapshot: classSchedule.classroom,
        instructor_snapshot: classSchedule.instructor,
        created_at: student.created_at,
        updated_at: student.created_at
      };
      insertBooking.run(row);
      createdBookings.push(row);
    }

    return { student, bookings: createdBookings };
  });
  return transaction.immediate();
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
    return (data || []).map(s => ({ ...s, flagged: Boolean(s.flagged), sms_opt_out: Boolean(s.sms_opt_out) }));
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
      .update({ name, phone, purpose, ...(updates.sms_opt_out !== undefined ? { sms_opt_out: updates.sms_opt_out ? 1 : 0 } : {}) })
      .eq('id', id);
    if (error) throw error;
    return;
  }

  if (updates.sms_opt_out !== undefined) {
    sqlite.prepare('UPDATE students SET name = ?, phone = ?, purpose = ?, sms_opt_out = ? WHERE id = ?')
      .run(name, phone, purpose, updates.sms_opt_out ? 1 : 0, id);
  } else {
    sqlite.prepare('UPDATE students SET name = ?, phone = ?, purpose = ? WHERE id = ?')
      .run(name, phone, purpose, id);
  }
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
    const [students, tokens, settings, terms, classes, bookings, attendance, notifications] = await Promise.all([
      supabase.from('students').select('*').order('created_at', { ascending: false }),
      supabase.from('access_tokens').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('key, value'),
      supabase.from('academic_terms').select('*'),
      supabase.from('class_schedules').select('*'),
      supabase.from('class_bookings').select('*'),
      supabase.from('class_attendance').select('*'),
      supabase.from('class_notifications').select('*')
    ]);
    return {
      students: (students.data || []).map(s => ({ ...s, flagged: Boolean(s.flagged) })),
      tokens: tokens.data || [],
      settings: settings.data || [],
      academicTerms: terms.data || [],
      classSchedules: classes.data || [],
      classBookings: bookings.data || [],
      classAttendance: attendance.data || [],
      classNotifications: notifications.data || []
    };
  }

  const students = sqlite.prepare('SELECT * FROM students ORDER BY created_at DESC').all();
  const tokens = sqlite.prepare('SELECT * FROM access_tokens ORDER BY created_at DESC').all();
  const settings = sqlite.prepare('SELECT key, value FROM settings').all();
  const academicTerms = sqlite.prepare('SELECT * FROM academic_terms').all();
  const classSchedules = sqlite.prepare('SELECT * FROM class_schedules').all();
  const classBookings = sqlite.prepare('SELECT * FROM class_bookings').all();
  const classAttendance = sqlite.prepare('SELECT * FROM class_attendance').all();
  const classNotifications = sqlite.prepare('SELECT * FROM class_notifications').all();
  return { students, tokens, settings, academicTerms, classSchedules, classBookings, classAttendance, classNotifications };
}

export async function restoreAllData(data) {
  const students = Array.isArray(data?.students) ? data.students : [];
  const tokens = Array.isArray(data?.tokens) ? data.tokens : [];
  const settings = Array.isArray(data?.settings) ? data.settings : [];
  const academicTerms = Array.isArray(data?.academicTerms) ? data.academicTerms : [];
  const classSchedules = Array.isArray(data?.classSchedules) ? data.classSchedules : [];
  const classBookings = Array.isArray(data?.classBookings) ? data.classBookings : [];
  const classAttendance = Array.isArray(data?.classAttendance) ? data.classAttendance : [];
  const classNotifications = Array.isArray(data?.classNotifications) ? data.classNotifications : [];

  if (supabase) {
    for (const table of ['class_notifications', 'class_attendance', 'class_bookings', 'class_schedules', 'academic_terms']) {
      const { error } = await supabase.from(table).delete().not('id', 'is', null);
      if (error) throw error;
    }
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
    for (const term of academicTerms) await saveAcademicTerm(term);
    for (const classSchedule of classSchedules) await saveClassSchedule(classSchedule);
    for (const booking of classBookings) {
      const { error } = await supabase.from('class_bookings').insert(booking);
      if (error) throw error;
    }
    if (classAttendance.length) {
      const { error } = await supabase.from('class_attendance').insert(classAttendance);
      if (error) throw error;
    }
    if (classNotifications.length) {
      const { error } = await supabase.from('class_notifications').insert(classNotifications);
      if (error) throw error;
    }
    for (const k of settings) await setSetting(k.key, k.value);
    return {
      students: students.length, tokens: tokens.length, settings: settings.length,
      academicTerms: academicTerms.length, classSchedules: classSchedules.length,
      classBookings: classBookings.length, classAttendance: classAttendance.length,
      classNotifications: classNotifications.length
    };
  }

  const run = sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM class_notifications').run();
    sqlite.prepare('DELETE FROM class_attendance').run();
    sqlite.prepare('DELETE FROM class_bookings').run();
    sqlite.prepare('DELETE FROM class_schedules').run();
    sqlite.prepare('DELETE FROM academic_terms').run();
    sqlite.prepare('DELETE FROM access_tokens').run();
    sqlite.prepare('DELETE FROM students').run();
    sqlite.prepare('DELETE FROM settings').run();

    const insertStudentStmt = sqlite.prepare(`INSERT INTO students (id, name, phone, purpose, date_of_birth, campus, created_at, flagged, flag_note, sms_opt_out)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const s of students) {
      insertStudentStmt.run(
        s.id,
        s.name,
        s.phone,
        s.purpose || '',
        s.date_of_birth || null,
        s.campus || 'TESANO CAMPUS',
        s.created_at,
        s.flagged ? 1 : 0,
        s.flag_note || null,
        s.sms_opt_out ? 1 : 0
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

    const insertTermStmt = sqlite.prepare(`INSERT INTO academic_terms
      (id, campus, name, start_date, end_date, status, created_at, updated_at)
      VALUES (@id, @campus, @name, @start_date, @end_date, @status, @created_at, @updated_at)`);
    for (const term of academicTerms) insertTermStmt.run(term);

    const insertClassStmt = sqlite.prepare(`INSERT INTO class_schedules (
      id, term_id, campus, title, description, day_of_week, start_time, end_time,
      classroom, capacity, instructor, status, created_at, updated_at
    ) VALUES (
      @id, @term_id, @campus, @title, @description, @day_of_week, @start_time, @end_time,
      @classroom, @capacity, @instructor, @status, @created_at, @updated_at
    )`);
    for (const classSchedule of classSchedules) insertClassStmt.run(classSchedule);

    const insertBookingStmt = sqlite.prepare(`INSERT INTO class_bookings (
      id, class_id, student_id, campus, class_date, status, class_title_snapshot,
      description_snapshot, day_of_week_snapshot, start_time_snapshot, end_time_snapshot,
      classroom_snapshot, instructor_snapshot, created_at, updated_at
    ) VALUES (
      @id, @class_id, @student_id, @campus, @class_date, @status, @class_title_snapshot,
      @description_snapshot, @day_of_week_snapshot, @start_time_snapshot, @end_time_snapshot,
      @classroom_snapshot, @instructor_snapshot, @created_at, @updated_at
    )`);
    for (const booking of classBookings) insertBookingStmt.run(booking);

    const insertAttendanceStmt = sqlite.prepare(`INSERT INTO class_attendance (
      id, booking_id, class_id, student_id, class_date, status, verified_by, verified_at
    ) VALUES (
      @id, @booking_id, @class_id, @student_id, @class_date, @status, @verified_by, @verified_at
    )`);
    for (const attendance of classAttendance) insertAttendanceStmt.run(attendance);

    const insertNotificationStmt = sqlite.prepare(`INSERT INTO class_notifications (
      id, booking_id, student_id, event, status, provider, provider_message_id, error, created_at
    ) VALUES (
      @id, @booking_id, @student_id, @event, @status, @provider, @provider_message_id, @error, @created_at
    )`);
    for (const notification of classNotifications) insertNotificationStmt.run(notification);

    const insertSettingStmt = sqlite.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const k of settings) {
      if (k && k.key) insertSettingStmt.run(k.key, k.value);
    }
  });
  run();

  settingsCache = new Map(settings.filter(k => k && k.key).map(row => [row.key, row.value]));
  return {
    students: students.length, tokens: tokens.length, settings: settings.length,
    academicTerms: academicTerms.length, classSchedules: classSchedules.length,
    classBookings: classBookings.length, classAttendance: classAttendance.length,
    classNotifications: classNotifications.length
  };
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

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRetention(campus) {
  let students;
  let tokens;

  if (supabase) {
    let sQuery = supabase.from('students').select('id,name,phone,purpose,campus,created_at,sms_opt_out');
    let tQuery = supabase.from('access_tokens').select('student_id,verified_at,used_at,created_at');
    if (campus) {
      sQuery = sQuery.eq('campus', campus);
      tQuery = tQuery.eq('campus', campus);
    }
    const [sRes, tRes] = await Promise.all([sQuery, tQuery]);
    if (sRes.error) console.error('Supabase retention students failed:', sRes.error.message || sRes.error);
    if (tRes.error) console.error('Supabase retention tokens failed:', tRes.error.message || tRes.error);
    students = (sRes.data || []).map((s) => ({ ...s }));
    tokens = (tRes.data || []).filter((t) => t.verified_at);
  } else {
    const campusClause = campus ? 'WHERE campus = ?' : '';
    const sParams = campus ? [campus] : [];
    students = sqlite.prepare(`SELECT id,name,phone,purpose,campus,created_at,sms_opt_out FROM students ${campusClause}`).all(...sParams);
    const where = campus ? 'WHERE verified_at IS NOT NULL AND campus = ?' : 'WHERE verified_at IS NOT NULL';
    const tParams = campus ? [campus] : [];
    tokens = sqlite.prepare(`SELECT student_id, verified_at, used_at FROM access_tokens ${where}`).all(...tParams);
  }

  const visitsByStudent = {};
  tokens.forEach((t) => {
    const sid = t.student_id;
    if (!visitsByStudent[sid]) visitsByStudent[sid] = [];
    visitsByStudent[sid].push(t.verified_at);
  });

  const now = Date.now();
  const records = students.map((s) => {
    const visitTimes = (visitsByStudent[s.id] || []).map((v) => new Date(v).getTime()).filter((t) => !Number.isNaN(t));
    const visitSet = [...new Set(visitTimes)].sort((a, b) => a - b);
    const visitCount = visitSet.length;
    const firstVisit = visitSet.length ? new Date(visitSet[0]).toISOString() : null;
    const lastVisit = visitSet.length ? new Date(visitSet[visitSet.length - 1]).toISOString() : null;
    const lastTs = visitSet.length ? visitSet[visitSet.length - 1] : null;
    const daysSince = lastTs ? Math.floor((now - lastTs) / DAY_MS) : null;
    const daysSinceReg = s.created_at ? Math.floor((now - new Date(s.created_at).getTime()) / DAY_MS) : null;

    let status;
    if (visitCount === 0) status = 'inactive';
    else if (visitCount >= 2 && daysSince <= 30) status = 'returning';
    else if (visitCount === 1 && daysSince <= 30) status = 'new';
    else if (daysSince <= 60) status = 'at_risk';
    else status = 'churned';

    return {
      id: s.id,
      name: s.name || '',
      phone: s.phone || '',
      purpose: s.purpose || '',
      campus: s.campus || '',
      sms_opt_out: Boolean(s.sms_opt_out),
      created_at: s.created_at || null,
      visit_count: visitCount,
      first_visit: firstVisit,
      last_visit: lastVisit,
      days_since_last: daysSince,
      days_since_registered: daysSinceReg,
      status
    };
  });

  const statusCounts = {};
  records.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  const total = records.length;
  const withVisits = records.filter((r) => r.visit_count > 0).length;
  const returning = records.filter((r) => r.visit_count > 1).length;
  const summary = {
    total,
    withVisits,
    returning,
    returningRate: total ? Math.round((returning / total) * 100) : 0,
    inactive: statusCounts.inactive || 0,
    new: statusCounts.new || 0,
    atRisk: statusCounts.at_risk || 0,
    churned: statusCounts.churned || 0
  };

  return { summary, records };
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

export async function getCampusStats(campus, today, weekStart, weekEnd, monthStart, monthEnd) {
  if (supabase) {
    const [totalStudents, todayVisits, thisWeekVisits, thisMonthVisits, totalVisits] = await Promise.all([
      countStudents(campus),
      countVerifiedVisits(campus, today),
      countVerifiedVisitsBetween(campus, weekStart, weekEnd),
      countVerifiedVisitsBetween(campus, monthStart, monthEnd),
      countAllVerifiedVisits(campus)
    ]);
    return { totalStudents, todayVisits, thisWeekVisits, thisMonthVisits, totalVisits };
  }

  const campusFilter = campus ? 'WHERE campus = ?' : '';
  const totalStudents = sqlite.prepare(`SELECT COUNT(*) as count FROM students ${campusFilter}`)
    .get(...(campus ? [campus] : [])).count;

  const visitParams = [today, weekStart, weekEnd, monthStart, monthEnd];
  let tokenClause = 'WHERE verified_at IS NOT NULL';
  if (campus) {
    tokenClause += ' AND campus = ?';
    visitParams.push(campus);
  }

  const visitStats = sqlite.prepare(`
    SELECT
      COUNT(*) as totalVisits,
      COALESCE(SUM(CASE WHEN date(verified_at) = ? THEN 1 ELSE 0 END), 0) as todayVisits,
      COALESCE(SUM(CASE WHEN date(verified_at) BETWEEN ? AND ? THEN 1 ELSE 0 END), 0) as thisWeekVisits,
      COALESCE(SUM(CASE WHEN date(verified_at) BETWEEN ? AND ? THEN 1 ELSE 0 END), 0) as thisMonthVisits
    FROM access_tokens
    ${tokenClause}
  `).get(...visitParams);

  return {
    totalStudents,
    todayVisits: visitStats?.todayVisits || 0,
    thisWeekVisits: visitStats?.thisWeekVisits || 0,
    thisMonthVisits: visitStats?.thisMonthVisits || 0,
    totalVisits: visitStats?.totalVisits || 0
  };
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

export async function countVerifiedVisitsForStudent(studentId) {
  if (!studentId) return 0;
  if (supabase) {
    const { count, error } = await supabase
      .from('access_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .not('verified_at', 'is', null);
    if (error) {
      console.warn('Supabase count verified visits error:', error.message || error);
      return 0;
    }
    return count || 0;
  }
  const row = sqlite.prepare('SELECT COUNT(*) as c FROM access_tokens WHERE student_id = ? AND verified_at IS NOT NULL').get(studentId);
  return row ? row.c : 0;
}

export async function insertFeedback(feedback) {
  if (supabase) {
    const { error } = await supabase.from('feedback').insert(feedback);
    if (error) throw new Error(`Supabase insert feedback failed: ${error.message}`);
    return feedback;
  }
  sqlite.prepare(`INSERT INTO feedback (id, student_id, phone, campus, rating, category, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    feedback.id,
    feedback.student_id || null,
    feedback.phone || null,
    feedback.campus,
    feedback.rating,
    feedback.category || null,
    feedback.comment || null,
    feedback.created_at
  );
  return feedback;
}

export async function listFeedback(campus, limit = 50) {
  if (supabase) {
    let query = supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(limit);
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase list feedback failed: ${error.message}`);
    return data || [];
  }
  const where = campus ? 'WHERE campus = ?' : '';
  const params = campus ? [campus, limit] : [limit];
  return sqlite.prepare(`SELECT * FROM feedback ${where} ORDER BY created_at DESC LIMIT ?`).all(...params);
}

export async function insertSmsLogs(logs) {
  if (!logs.length) return;

  if (supabase) {
    const { error } = await supabase.from('sms_logs').insert(logs);
    if (error) throw new Error(`Supabase insert SMS logs failed: ${error.message}`);
    return;
  }

  const insert = sqlite.prepare(`INSERT INTO sms_logs
    (id, campus, recipient_name, recipient_phone_masked, recipient_id, provider, provider_message_id, status, delivery_status, source, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertMany = sqlite.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.id,
        row.campus,
        row.recipient_name || null,
        row.recipient_phone_masked,
        row.recipient_id || null,
        row.provider || null,
        row.provider_message_id || null,
        row.status,
        row.delivery_status || null,
        row.source,
        row.error || null,
        row.created_at
      );
    }
  });
  insertMany(logs);
}

export async function listSmsLogs(campus, limit = 100) {
  if (supabase) {
    let query = supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase list SMS logs failed: ${error.message}`);
    return data || [];
  }

  const where = campus ? 'WHERE campus = ?' : '';
  const params = campus ? [campus, limit] : [limit];
  return sqlite.prepare(`SELECT * FROM sms_logs ${where} ORDER BY created_at DESC LIMIT ?`).all(...params);
}

export async function listRetentionSmsHistory(campus, since) {
  if (supabase) {
    let query = supabase
      .from('sms_logs')
      .select('recipient_id,status,source,created_at')
      .gte('created_at', since)
      .in('source', ['first-time-followup', 'at-risk-winback', 'manual-broadcast'])
      .not('recipient_id', 'is', null);
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase retention SMS history failed: ${error.message}`);
    return data || [];
  }
  const whereCampus = campus ? 'AND campus = ?' : '';
  const params = campus ? [since, campus] : [since];
  return sqlite.prepare(`SELECT recipient_id,status,source,created_at FROM sms_logs
    WHERE created_at >= ?
      AND source IN ('first-time-followup', 'at-risk-winback', 'manual-broadcast')
      AND recipient_id IS NOT NULL ${whereCampus}`).all(...params);
}

export async function updateSmsDeliveryStatus(providerMessageId, deliveryStatus) {
  if (supabase) {
    const { data, error } = await supabase
      .from('sms_logs')
      .update({ delivery_status: deliveryStatus })
      .eq('provider_message_id', providerMessageId)
      .select('id');
    if (error) throw new Error(`Supabase SMS delivery update failed: ${error.message}`);
    return data?.length || 0;
  }
  return sqlite.prepare('UPDATE sms_logs SET delivery_status = ? WHERE provider_message_id = ?')
    .run(deliveryStatus, providerMessageId).changes;
}

function parseRetentionSchedule(row) {
  return {
    ...row,
    templates: typeof row.templates === 'string' ? JSON.parse(row.templates) : row.templates,
    recipient_ids: typeof row.recipient_ids === 'string' ? JSON.parse(row.recipient_ids) : row.recipient_ids,
    result: typeof row.result === 'string' && row.result ? JSON.parse(row.result) : row.result
  };
}

export async function insertRetentionSchedule(schedule) {
  const row = {
    ...schedule,
    templates: JSON.stringify(schedule.templates),
    recipient_ids: JSON.stringify(schedule.recipient_ids),
    result: null
  };
  if (supabase) {
    const { error } = await supabase.from('retention_schedules').insert(row);
    if (error) throw new Error(`Supabase schedule insert failed: ${error.message}`);
    return schedule;
  }
  sqlite.prepare(`INSERT INTO retention_schedules
    (id,campus,run_at,status,templates,recipient_ids,cooldown_days,created_at,updated_at,result)
    VALUES (@id,@campus,@run_at,@status,@templates,@recipient_ids,@cooldown_days,@created_at,@updated_at,@result)`).run(row);
  return schedule;
}

export async function listRetentionSchedules(campus, limit = 50) {
  if (supabase) {
    let query = supabase.from('retention_schedules').select('*').order('run_at', { ascending: false }).limit(limit);
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase retention schedules failed: ${error.message}`);
    return (data || []).map(parseRetentionSchedule);
  }
  const where = campus ? 'WHERE campus = ?' : '';
  const params = campus ? [campus, limit] : [limit];
  return sqlite.prepare(`SELECT * FROM retention_schedules ${where} ORDER BY run_at DESC LIMIT ?`)
    .all(...params).map(parseRetentionSchedule);
}

export async function claimDueRetentionSchedules(now, limit = 10) {
  const staleBefore = new Date(Date.parse(now) - 5 * 60 * 1000).toISOString();
  if (supabase) {
    const { error: recoverError } = await supabase.from('retention_schedules')
      .update({ status: 'scheduled', updated_at: now })
      .eq('status', 'sending').lt('updated_at', staleBefore);
    if (recoverError) throw new Error(`Supabase stale schedule recovery failed: ${recoverError.message}`);
    const { data, error } = await supabase.from('retention_schedules')
      .select('*').eq('status', 'scheduled').lte('run_at', now).order('run_at').limit(limit);
    if (error) throw new Error(`Supabase due schedules query failed: ${error.message}`);
    const claimed = [];
    for (const schedule of data || []) {
      const { data: row, error: claimError } = await supabase.from('retention_schedules')
        .update({ status: 'sending', updated_at: now })
        .eq('id', schedule.id).eq('status', 'scheduled').select('*').maybeSingle();
      if (claimError) throw new Error(`Supabase schedule claim failed: ${claimError.message}`);
      if (row) claimed.push(parseRetentionSchedule(row));
    }
    return claimed;
  }
  const claim = sqlite.transaction(() => {
    sqlite.prepare(`UPDATE retention_schedules SET status = 'scheduled', updated_at = ?
      WHERE status = 'sending' AND updated_at < ?`).run(now, staleBefore);
    const due = sqlite.prepare(`SELECT * FROM retention_schedules
      WHERE status = 'scheduled' AND run_at <= ? ORDER BY run_at LIMIT ?`).all(now, limit);
    const update = sqlite.prepare(`UPDATE retention_schedules SET status = 'sending', updated_at = ?
      WHERE id = ? AND status = 'scheduled'`);
    return due.filter((schedule) => update.run(now, schedule.id).changes === 1).map(parseRetentionSchedule);
  });
  return claim();
}

export async function updateRetentionSchedule(id, status, result = null, updatedAt = new Date().toISOString()) {
  const serializedResult = result == null ? null : JSON.stringify(result);
  if (supabase) {
    const { error } = await supabase.from('retention_schedules')
      .update({ status, result: serializedResult, updated_at: updatedAt })
      .eq('id', id);
    if (error) throw new Error(`Supabase schedule update failed: ${error.message}`);
    return;
  }
  sqlite.prepare('UPDATE retention_schedules SET status = ?, result = ?, updated_at = ? WHERE id = ?')
    .run(status, serializedResult, updatedAt, id);
}

export async function cancelRetentionSchedule(id, campus) {
  if (supabase) {
    let query = supabase.from('retention_schedules')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'scheduled');
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw new Error(`Supabase schedule cancel failed: ${error.message}`);
    return Boolean(data);
  }
  const whereCampus = campus ? ' AND campus = ?' : '';
  const params = campus ? [new Date().toISOString(), id, campus] : [new Date().toISOString(), id];
  const result = sqlite.prepare(`UPDATE retention_schedules SET status = 'cancelled', updated_at = ?
    WHERE id = ? AND status = 'scheduled'${whereCampus}`).run(...params);
  return result.changes === 1;
}

// ---------------------------------------------------------------------------
// Academic timetable, bookings, and class attendance (separate from access_tokens)
// ---------------------------------------------------------------------------
export async function listAcademicTerms(campus) {
  if (supabase) {
    let query = supabase.from('academic_terms').select('*').order('start_date', { ascending: false });
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase academic terms query failed: ${error.message}`);
    return data || [];
  }
  const where = campus ? 'WHERE campus = ?' : '';
  return sqlite.prepare(`SELECT * FROM academic_terms ${where} ORDER BY start_date DESC`).all(...(campus ? [campus] : []));
}

export async function getAcademicTerm(id, campus) {
  if (supabase) {
    let query = supabase.from('academic_terms').select('*').eq('id', id);
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Supabase academic term lookup failed: ${error.message}`);
    return data || null;
  }
  const whereCampus = campus ? ' AND campus = ?' : '';
  return sqlite.prepare(`SELECT * FROM academic_terms WHERE id = ?${whereCampus}`).get(...(campus ? [id, campus] : [id])) || null;
}

export async function saveAcademicTerm(term) {
  if (supabase) {
    const { error } = await supabase.from('academic_terms').upsert(term, { onConflict: 'id' });
    if (error) throw new Error(`Supabase academic term save failed: ${error.message}`);
    return term;
  }
  sqlite.prepare(`INSERT INTO academic_terms (id, campus, name, start_date, end_date, status, created_at, updated_at)
    VALUES (@id, @campus, @name, @start_date, @end_date, @status, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET campus = excluded.campus, name = excluded.name,
    start_date = excluded.start_date, end_date = excluded.end_date, status = excluded.status,
    updated_at = excluded.updated_at`).run(term);
  return term;
}

export async function setOtherTermsInactive(campus, exceptId, updatedAt) {
  if (supabase) {
    const { error } = await supabase.from('academic_terms')
      .update({ status: 'inactive', updated_at: updatedAt })
      .eq('campus', campus).eq('status', 'active').neq('id', exceptId);
    if (error) throw new Error(`Supabase term deactivation failed: ${error.message}`);
    return;
  }
  sqlite.prepare(`UPDATE academic_terms SET status = 'inactive', updated_at = ?
    WHERE campus = ? AND status = 'active' AND id != ?`).run(updatedAt, campus, exceptId);
}

export async function listClassSchedules(campus, termId) {
  if (supabase) {
    let query = supabase.from('class_schedules').select('*').order('day_of_week').order('start_time');
    if (campus) query = query.eq('campus', campus);
    if (termId) query = query.eq('term_id', termId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase class schedule query failed: ${error.message}`);
    return data || [];
  }
  const filters = [];
  const params = [];
  if (campus) {
    filters.push('campus = ?');
    params.push(campus);
  }
  if (termId) {
    filters.push('term_id = ?');
    params.push(termId);
  }
  return sqlite.prepare(`SELECT * FROM class_schedules ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
    ORDER BY day_of_week, start_time`).all(...params);
}

export async function getClassSchedule(id, campus) {
  if (supabase) {
    let query = supabase.from('class_schedules').select('*').eq('id', id);
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Supabase class lookup failed: ${error.message}`);
    return data || null;
  }
  const whereCampus = campus ? ' AND campus = ?' : '';
  return sqlite.prepare(`SELECT * FROM class_schedules WHERE id = ?${whereCampus}`).get(...(campus ? [id, campus] : [id])) || null;
}

export async function saveClassSchedule(classSchedule) {
  if (supabase) {
    const { error } = await supabase.from('class_schedules').upsert(classSchedule, { onConflict: 'id' });
    if (error) throw new Error(`Supabase class schedule save failed: ${error.message}`);
    return classSchedule;
  }
  sqlite.prepare(`INSERT INTO class_schedules (
    id, term_id, campus, title, description, day_of_week, start_time, end_time,
    classroom, capacity, instructor, status, created_at, updated_at
  ) VALUES (
    @id, @term_id, @campus, @title, @description, @day_of_week, @start_time, @end_time,
    @classroom, @capacity, @instructor, @status, @created_at, @updated_at
  ) ON CONFLICT(id) DO UPDATE SET
    term_id = excluded.term_id, campus = excluded.campus, title = excluded.title,
    description = excluded.description, day_of_week = excluded.day_of_week,
    start_time = excluded.start_time, end_time = excluded.end_time, classroom = excluded.classroom,
    capacity = excluded.capacity, instructor = excluded.instructor, status = excluded.status,
    updated_at = excluded.updated_at`).run(classSchedule);
  return classSchedule;
}

const INITIAL_CLASS_SCHEDULES = [
  { title: 'Family Home Evening', day_of_week: 1, start_time: '18:30', classroom: 'MPR' },
  { title: 'Foundations of the Restoration', day_of_week: 2, start_time: '10:00', classroom: 'MPR' },
  { title: 'Master the Job Market', day_of_week: 2, start_time: '14:00', classroom: 'CR' },
  { title: 'Scripture Study', day_of_week: 2, start_time: '14:00', classroom: 'MPR' },
  { title: 'Piano Class', day_of_week: 2, start_time: '18:30', classroom: 'CR' },
  { title: 'My Covenant My Joy', day_of_week: 2, start_time: '18:30', classroom: 'MPR' },
  { title: 'Breakfast with the Prophet', day_of_week: 3, start_time: '10:00', classroom: 'MPR' },
  { title: 'Writings of John the Beloved', day_of_week: 3, start_time: '14:00', classroom: 'MPR' },
  { title: 'Learn a New Language', day_of_week: 3, start_time: '18:30', classroom: 'CR' },
  { title: 'Sacred Hymns', day_of_week: 3, start_time: '18:30', classroom: 'MPR' },
  { title: 'The Power to Become', day_of_week: 4, start_time: '10:00', classroom: 'MPR' },
  { title: 'Money Habits for Life', day_of_week: 4, start_time: '14:00', classroom: 'MPR' },
  { title: 'Games', day_of_week: 4, start_time: '14:00', classroom: 'CR' },
  { title: 'Teachings & Doctrines of the Book of Mormon, PathwayConnect', day_of_week: 4, start_time: '18:30', classroom: 'MPR' },
  { title: 'Eternal Family', day_of_week: 5, start_time: '10:00', classroom: 'MPR' },
  { title: 'Jesus Christ & His Everlasting Gospel', day_of_week: 5, start_time: '14:00', classroom: 'MPR' },
  { title: 'Women in the Scriptures', day_of_week: 5, start_time: '14:00', classroom: 'CR' },
  { title: 'Mission Preparation', day_of_week: 5, start_time: '18:30', classroom: 'CR' },
  { title: 'Connect & Play', day_of_week: 5, start_time: '18:30', classroom: 'MPR' }
];

export async function seedInitialTimetables(campuses) {
  const activeDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const dateValues = Object.fromEntries(activeDateParts.map(({ type, value }) => [type, value]));
  const startDate = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  const endDateValue = new Date(`${startDate}T00:00:00.000Z`);
  endDateValue.setUTCFullYear(endDateValue.getUTCFullYear() + 2);
  const endDate = endDateValue.toISOString().slice(0, 10);
  const timestamp = new Date().toISOString();

  for (const campus of campuses) {
    const terms = await listAcademicTerms(campus);
    if (terms.some((term) => term.id !== `initial-term-${campus.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)) continue;

    const termId = `initial-term-${campus.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (!terms.some((term) => term.id === termId)) {
      await saveAcademicTerm({
        id: termId,
        campus,
        name: 'Initial Academic Term',
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    for (const [index, classSeed] of INITIAL_CLASS_SCHEDULES.entries()) {
      const id = `initial-class-${campus.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`;
      if (await getClassSchedule(id, campus)) continue;
      const [hour, minute] = classSeed.start_time.split(':').map(Number);
      const endMinutes = (hour * 60 + minute + 60) % (24 * 60);
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
      await saveClassSchedule({
        id,
        term_id: termId,
        campus,
        ...classSeed,
        description: '',
        end_time: endTime,
        capacity: 100,
        instructor: '',
        status: 'published',
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }
}

export async function createClassBooking(booking, today) {
  if (supabase) {
    const { data, error } = await supabase.rpc('create_class_booking', {
      p_id: booking.id,
      p_class_id: booking.class_id,
      p_student_id: booking.student_id,
      p_class_date: booking.class_date,
      p_today: today,
      p_created_at: booking.created_at
    });
    if (error) throw new Error(error.message);
    return data;
  }

  const transaction = sqlite.transaction(() => {
    const schedule = sqlite.prepare('SELECT * FROM class_schedules WHERE id = ?').get(booking.class_id);
    const term = schedule && sqlite.prepare('SELECT * FROM academic_terms WHERE id = ?').get(schedule.term_id);
    if (!schedule || schedule.status !== 'published' || !term || term.status !== 'active') {
      throw new Error('Class is not open for booking');
    }
    if (booking.class_date < today || booking.class_date < term.start_date || booking.class_date > term.end_date ||
        new Date(`${booking.class_date}T00:00:00.000Z`).getUTCDay() !== schedule.day_of_week) {
      throw new Error('Class date is outside the schedule');
    }
    const bookedCount = sqlite.prepare(`SELECT COUNT(*) AS count FROM class_bookings
      WHERE class_id = ? AND class_date = ? AND status = 'booked'`).get(schedule.id, booking.class_date).count;
    if (bookedCount >= schedule.capacity) throw new Error('Class is full');
    const row = {
      ...booking,
      campus: schedule.campus,
      class_title_snapshot: schedule.title,
      description_snapshot: schedule.description,
      day_of_week_snapshot: schedule.day_of_week,
      start_time_snapshot: schedule.start_time,
      end_time_snapshot: schedule.end_time,
      classroom_snapshot: schedule.classroom,
      instructor_snapshot: schedule.instructor
    };
    sqlite.prepare(`INSERT INTO class_bookings (
      id, class_id, student_id, campus, class_date, status, class_title_snapshot, description_snapshot,
      day_of_week_snapshot, start_time_snapshot, end_time_snapshot, classroom_snapshot,
      instructor_snapshot, created_at, updated_at
    ) VALUES (
      @id, @class_id, @student_id, @campus, @class_date, @status, @class_title_snapshot, @description_snapshot,
      @day_of_week_snapshot, @start_time_snapshot, @end_time_snapshot, @classroom_snapshot,
      @instructor_snapshot, @created_at, @updated_at
    )`).run(row);
    return row;
  });
  return transaction();
}

export async function countActiveClassBookings(classId, classDate) {
  if (supabase) {
    const { count, error } = await supabase.from('class_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId).eq('class_date', classDate).eq('status', 'booked');
    if (error) throw new Error(`Supabase class capacity query failed: ${error.message}`);
    return count || 0;
  }
  return sqlite.prepare(`SELECT COUNT(*) AS count FROM class_bookings
    WHERE class_id = ? AND class_date = ? AND status = 'booked'`).get(classId, classDate).count;
}

export async function getClassAttendanceAnalytics(campus, startDate, endDate) {
  if (supabase) {
    const { data, error } = await supabase.rpc('get_class_attendance_analytics', {
      p_campus: campus,
      p_start_date: startDate,
      p_end_date: endDate
    });
    if (error) throw new Error(`Supabase class attendance analytics failed: ${error.message}`);
    return data;
  }

  const sessions = sqlite.prepare(`SELECT
      b.class_id,
      b.class_title_snapshot AS title,
      b.class_date,
      c.capacity,
      COUNT(*) AS registrations,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS attended,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent
    FROM class_bookings b
    JOIN class_schedules c ON c.id = b.class_id
    LEFT JOIN class_attendance a ON a.booking_id = b.id
    WHERE b.campus = ? AND b.class_date BETWEEN ? AND ? AND b.status = 'booked'
    GROUP BY b.class_id, b.class_title_snapshot, b.class_date, c.capacity
    ORDER BY b.class_date, b.class_title_snapshot`).all(campus, startDate, endDate);
  const scheduledClasses = sqlite.prepare(`SELECT c.day_of_week, c.capacity,
      t.start_date, t.end_date
    FROM class_schedules c
    JOIN academic_terms t ON t.id = c.term_id
    WHERE c.campus = ? AND c.status = 'published'
      AND t.start_date <= ? AND t.end_date >= ?`).all(campus, endDate, startDate);
  let totalCapacity = 0;
  for (const scheduledClass of scheduledClasses) {
    const firstDate = scheduledClass.start_date > startDate ? scheduledClass.start_date : startDate;
    const lastDate = scheduledClass.end_date < endDate ? scheduledClass.end_date : endDate;
    const occurrence = new Date(`${firstDate}T00:00:00.000Z`);
    const offset = (scheduledClass.day_of_week - occurrence.getUTCDay() + 7) % 7;
    occurrence.setUTCDate(occurrence.getUTCDate() + offset);
    while (occurrence.toISOString().slice(0, 10) <= lastDate) {
      totalCapacity += scheduledClass.capacity;
      occurrence.setUTCDate(occurrence.getUTCDate() + 7);
    }
  }
  const classes = new Map();
  const days = new Map();
  const summary = { totalBookings: 0, attended: 0, absent: 0, pending: 0, capacity: totalCapacity };
  sessions.forEach((session) => {
    const pending = session.registrations - session.attended - session.absent;
    summary.totalBookings += session.registrations;
    summary.attended += session.attended;
    summary.absent += session.absent;
    summary.pending += pending;

    const classStats = classes.get(session.class_id) || {
      class_id: session.class_id,
      title: session.title,
      registrations: 0,
      attended: 0,
      absent: 0
    };
    classStats.registrations += session.registrations;
    classStats.attended += session.attended;
    classStats.absent += session.absent;
    classes.set(session.class_id, classStats);

    const day = days.get(session.class_date) || {
      date: session.class_date,
      registrations: 0,
      attended: 0,
      absent: 0,
      pending: 0
    };
    day.registrations += session.registrations;
    day.attended += session.attended;
    day.absent += session.absent;
    day.pending += pending;
    days.set(session.class_date, day);
  });

  const repeatAbsences = sqlite.prepare(`SELECT
      a.student_id,
      s.name,
      s.phone,
      COUNT(*) AS absence_count
    FROM class_attendance a
    JOIN class_bookings b ON b.id = a.booking_id
    JOIN students s ON s.id = a.student_id
    WHERE b.campus = ? AND a.class_date BETWEEN ? AND ? AND a.status = 'absent'
    GROUP BY a.student_id, s.name, s.phone
    HAVING COUNT(*) >= 2
    ORDER BY absence_count DESC, s.name`).all(campus, startDate, endDate);

  const decidedAttendance = summary.attended + summary.absent;
  return {
    summary: {
      ...summary,
      attendanceRate: decidedAttendance ? Math.round((summary.attended / decidedAttendance) * 1000) / 10 : 0,
      capacityUtilization: summary.capacity ? Math.round((summary.totalBookings / summary.capacity) * 1000) / 10 : 0
    },
    classes: [...classes.values()].sort((first, second) =>
      second.registrations - first.registrations || first.title.localeCompare(second.title)
    ),
    dailyTrends: [...days.values()],
    repeatAbsences
  };
}

export async function listClassBookings({ campus, classId, classDate, studentId, status, bookingId } = {}) {
  let rows;
  if (supabase) {
    let query = supabase.from('class_bookings').select('*').order('class_date').order('start_time_snapshot');
    if (campus) query = query.eq('campus', campus);
    if (classId) query = query.eq('class_id', classId);
    if (classDate) query = query.eq('class_date', classDate);
    if (studentId) query = query.eq('student_id', studentId);
    if (status) query = query.eq('status', status);
    if (bookingId) query = query.eq('id', bookingId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase class booking query failed: ${error.message}`);
    rows = data || [];
  } else {
    const filters = [];
    const params = [];
    if (campus) {
      filters.push('c.campus = ?');
      params.push(campus);
    }
    if (classId) {
      filters.push('b.class_id = ?');
      params.push(classId);
    }
    if (classDate) {
      filters.push('b.class_date = ?');
      params.push(classDate);
    }
    if (studentId) {
      filters.push('b.student_id = ?');
      params.push(studentId);
    }
    if (status) {
      filters.push('b.status = ?');
      params.push(status);
    }
    if (bookingId) {
      filters.push('b.id = ?');
      params.push(bookingId);
    }
    rows = sqlite.prepare(`SELECT b.*, c.campus, s.name AS student_name, s.phone AS student_phone,
      s.date_of_birth AS student_date_of_birth,
      s.sms_opt_out AS student_sms_opt_out
      FROM class_bookings b
      JOIN class_schedules c ON c.id = b.class_id
      JOIN students s ON s.id = b.student_id
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY b.class_date, b.start_time_snapshot`).all(...params);
  }

  if (!rows.length) return [];
  const bookingIds = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.student_id))];
  if (supabase) {
    const [studentsResult, attendanceResult, notificationsResult] = await Promise.all([
      supabase.from('students').select('id,name,phone,date_of_birth,sms_opt_out').in('id', studentIds),
      supabase.from('class_attendance').select('*').in('booking_id', bookingIds),
      supabase.from('class_notifications').select('*').in('booking_id', bookingIds).order('created_at', { ascending: false })
    ]);
    for (const result of [studentsResult, attendanceResult, notificationsResult]) {
      if (result.error) throw new Error(`Supabase class booking details query failed: ${result.error.message}`);
    }
    const students = new Map((studentsResult.data || []).map((row) => [row.id, row]));
    const attendance = new Map((attendanceResult.data || []).map((row) => [row.booking_id, row]));
    const notifications = new Map();
    (notificationsResult.data || []).forEach((row) => {
      const current = notifications.get(row.booking_id) || [];
      current.push(row);
      notifications.set(row.booking_id, current);
    });
    return rows.map((row) => ({
      ...row,
      ...(students.get(row.student_id) ? {
        student_name: students.get(row.student_id).name,
        student_phone: students.get(row.student_id).phone,
        student_date_of_birth: students.get(row.student_id).date_of_birth || null,
        student_sms_opt_out: Boolean(students.get(row.student_id).sms_opt_out)
      } : {}),
      attendance: attendance.get(row.id) || null,
      notifications: notifications.get(row.id) || []
    }));
  }

  const attendanceRows = sqlite.prepare(`SELECT * FROM class_attendance WHERE booking_id IN (${bookingIds.map(() => '?').join(',')})`).all(...bookingIds);
  const notificationRows = sqlite.prepare(`SELECT * FROM class_notifications WHERE booking_id IN (${bookingIds.map(() => '?').join(',')}) ORDER BY created_at DESC`).all(...bookingIds);
  const attendance = new Map(attendanceRows.map((row) => [row.booking_id, row]));
  const notifications = new Map();
  notificationRows.forEach((row) => {
    const current = notifications.get(row.booking_id) || [];
    current.push(row);
    notifications.set(row.booking_id, current);
  });
  return rows.map((row) => ({
    ...row,
    student_sms_opt_out: Boolean(row.student_sms_opt_out),
    attendance: attendance.get(row.id) || null,
    notifications: notifications.get(row.id) || []
  }));
}

export async function updateFutureClassBookings(classId, status, today, updatedAt) {
  const affected = await listClassBookings({ classId, status: 'booked' });
  const rows = affected.filter((row) => row.class_date >= today);
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  if (supabase) {
    const { error } = await supabase.from('class_bookings').update({ status, updated_at: updatedAt }).in('id', ids);
    if (error) throw new Error(`Supabase booking update failed: ${error.message}`);
  } else {
    const update = sqlite.prepare('UPDATE class_bookings SET status = ?, updated_at = ? WHERE id = ? AND status = ?');
    const transaction = sqlite.transaction(() => ids.forEach((id) => update.run(status, updatedAt, id, 'booked')));
    transaction();
  }
  return rows;
}

export async function cancelClassBooking(id, studentId, updatedAt) {
  if (supabase) {
    const { data, error } = await supabase.from('class_bookings')
      .update({ status: 'cancelled', updated_at: updatedAt })
      .eq('id', id).eq('student_id', studentId).eq('status', 'booked')
      .select('*').maybeSingle();
    if (error) throw new Error(`Supabase booking cancellation failed: ${error.message}`);
    return data || null;
  }
  const result = sqlite.prepare(`UPDATE class_bookings SET status = 'cancelled', updated_at = ?
    WHERE id = ? AND student_id = ? AND status = 'booked'`).run(updatedAt, id, studentId);
  if (!result.changes) return null;
  return sqlite.prepare('SELECT * FROM class_bookings WHERE id = ?').get(id) || null;
}

export async function markClassBookingCalendarAdded(id, studentId, campus, addedAt) {
  if (supabase) {
    const { data, error } = await supabase.from('class_bookings')
      .update({ calendar_added_at: addedAt })
      .eq('id', id).eq('student_id', studentId).eq('campus', campus)
      .eq('status', 'booked').is('calendar_added_at', null)
      .select('id').maybeSingle();
    if (error) throw new Error(`Supabase calendar click tracking failed: ${error.message}`);
    return Boolean(data);
  }
  const result = sqlite.prepare(`UPDATE class_bookings SET calendar_added_at = ?
    WHERE id = ? AND student_id = ? AND campus = ? AND status = 'booked'
      AND calendar_added_at IS NULL`).run(addedAt, id, studentId, campus);
  return result.changes === 1;
}

export async function saveClassAttendance(attendance) {
  if (supabase) {
    const { error } = await supabase.from('class_attendance').upsert(attendance, { onConflict: 'booking_id' });
    if (error) throw new Error(`Supabase class attendance save failed: ${error.message}`);
    return attendance;
  }
  sqlite.prepare(`INSERT INTO class_attendance (
    id, booking_id, class_id, student_id, class_date, status, verified_by, verified_at
  ) VALUES (
    @id, @booking_id, @class_id, @student_id, @class_date, @status, @verified_by, @verified_at
  ) ON CONFLICT(booking_id) DO UPDATE SET status = excluded.status,
    verified_by = excluded.verified_by, verified_at = excluded.verified_at`).run(attendance);
  return attendance;
}

export async function insertClassNotification(notification) {
  if (supabase) {
    const { error } = await supabase.from('class_notifications').insert(notification);
    if (error) throw new Error(`Supabase class notification log failed: ${error.message}`);
    return notification;
  }
  sqlite.prepare(`INSERT INTO class_notifications (
    id, booking_id, student_id, event, status, provider, provider_message_id, error, created_at
  ) VALUES (
    @id, @booking_id, @student_id, @event, @status, @provider, @provider_message_id, @error, @created_at
  )`).run(notification);
  return notification;
}

export async function countClassBookingsForStudent(studentId) {
  if (supabase) {
    const { count, error } = await supabase.from('class_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId);
    if (error) throw new Error(`Supabase student class history lookup failed: ${error.message}`);
    return count || 0;
  }
  return sqlite.prepare('SELECT COUNT(*) AS count FROM class_bookings WHERE student_id = ?').get(studentId).count;
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

async function cleanupExpiredSessions() {
  const now = new Date().toISOString();
  if (supabase) {
    const { error } = await supabase.from('sessions').delete().lt('expires_at', now);
    if (error) console.warn('[cleanup] session cleanup failed:', error.message || error);
    return;
  }
  if (sqlite) {
    sqlite.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  }
}

export async function init() {
  createSqliteTables();

  if (!useSupabase && sqlite) {
    await snapshotDatabase();
    setInterval(() => { snapshotDatabase(); }, 24 * 60 * 60 * 1000).unref();
  }

  let schemaOk = true;
  if (useSupabase && supabase) {
    schemaOk = await checkSupabaseSchema();
  }

  await loadAllSettings();
  await cleanupExpiredSessions();
  setInterval(() => { cleanupExpiredSessions(); }, 24 * 60 * 60 * 1000).unref();

  if (useSupabase && supabase) {
    const health = await checkSupabaseHealth();
    setInterval(() => { checkSupabaseHealth(); }, 60 * 1000).unref();
    if (health.healthy && schemaOk) {
      console.log('Persistence: Supabase Postgres (durable across redeploys)');
    } else if (health.healthy) {
      console.log('Persistence: Supabase connected but tables missing — run supabase/schema.sql in the Supabase SQL Editor.');
    } else {
      console.log('Persistence: Supabase configured but UNREACHABLE — writes will fail. Check SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    }
  } else {
    console.log('Persistence: local SQLite (EPHEMERAL on Render — set SUPABASE_URL + SUPABASE_SERVICE_KEY for durable storage)');
  }
}

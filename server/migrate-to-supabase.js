import Database from 'better-sqlite3';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Run this once your Supabase schema exists (supabase/schema.sql applied in
// the SQL Editor) and SUPABASE_URL + SUPABASE_SERVICE_KEY are set:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node server/migrate-to-supabase.js

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment to run this migration.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const DB_FILE = process.env.DB_PATH || path.join(process.cwd(), 'patron-housing.db');
const db = new Database(DB_FILE, { readonly: true });

async function upsertRows(table, rows, conflictKey) {
  if (!rows.length) return 0;
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictKey });
    if (error) {
      console.error(`Error upserting ${table} batch:`, error);
      throw error;
    }
    inserted += batch.length;
    console.log(`Upserted ${table} ${i + 1}..${i + batch.length}`);
  }
  return inserted;
}

function normalizeStudents(rows) {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    purpose: row.purpose,
    campus: row.campus,
    created_at: row.created_at,
    flagged: row.flagged ?? 0,
    flag_note: row.flag_note ?? null
  }));
}

function normalizeAccessTokens(rows) {
  return rows.map(row => ({
    id: row.id,
    student_id: row.student_id,
    campus: row.campus,
    token: row.token,
    valid_date: row.valid_date,
    created_at: row.created_at,
    used_at: row.used_at,
    verified_at: row.verified_at ?? null
  }));
}

function normalizeSessions(rows) {
  return rows.map(row => ({
    id: row.id,
    role: row.role,
    campus: row.campus,
    is_super_admin: Boolean(row.is_super_admin),
    created_at: row.created_at,
    expires_at: row.expires_at
  }));
}

(async function main() {
  try {
    console.log('Starting migration to Supabase...');
    console.log(`Reading SQLite database: ${DB_FILE}`);

    const settings = db.prepare('SELECT key, value FROM settings').all();
    const students = db.prepare('SELECT * FROM students').all();
    const tokens = db.prepare('SELECT * FROM access_tokens').all();
    const sessions = db.prepare('SELECT * FROM sessions').all();

    console.log(`Found ${settings.length} settings, ${students.length} students, ${tokens.length} tokens, ${sessions.length} sessions.`);

    const settingsResult = await upsertRows('settings', settings, 'key');
    const studentsResult = await upsertRows('students', normalizeStudents(students), 'id');
    const tokensResult = await upsertRows('access_tokens', normalizeAccessTokens(tokens), 'id');
    const sessionsResult = await upsertRows('sessions', normalizeSessions(sessions), 'id');

    console.log(`Migration complete. Settings: ${settingsResult}, Students: ${studentsResult}, Tokens: ${tokensResult}, Sessions: ${sessionsResult}.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(2);
  }
})();

import Database from 'better-sqlite3';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment to run this migration.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const DB_FILE = path.join(process.cwd(), 'patron-housing.db');
const db = new Database(DB_FILE, { readonly: true });

async function upsertStudents() {
  const rows = db.prepare('SELECT id, name, phone, purpose, created_at FROM students').all();
  console.log(`Found ${rows.length} students in SQLite`);
  if (!rows.length) return { inserted: 0 };

  // Supabase upsert in batches
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('students').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error('Error upserting students batch:', error);
      throw error;
    }
    inserted += batch.length;
    console.log(`Upserted students ${i + 1}..${i + batch.length}`);
  }
  return { inserted };
}

async function upsertAccessTokens() {
  const rows = db.prepare('SELECT id, student_id, token, valid_date, created_at, used_at FROM access_tokens').all();
  console.log(`Found ${rows.length} access_tokens in SQLite`);
  if (!rows.length) return { inserted: 0 };

  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('access_tokens').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error('Error upserting access_tokens batch:', error);
      throw error;
    }
    inserted += batch.length;
    console.log(`Upserted access_tokens ${i + 1}..${i + batch.length}`);
  }
  return { inserted };
}

(async function main() {
  try {
    console.log('Starting migration to Supabase...');
    const studentsResult = await upsertStudents();
    const tokensResult = await upsertAccessTokens();
    console.log(`Migration complete. Students: ${studentsResult.inserted}, Tokens: ${tokensResult.inserted}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(2);
  }
})();

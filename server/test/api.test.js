import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pha-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.ALLOW_UNAUTHENTICATED = 'true';
process.env.SUPER_ADMIN_TOKEN = 'test-super-admin-token';
process.env.PORT = '0';

const SUPER_ADMIN_HEADERS = {
  'x-super-admin-token': 'test-super-admin-token',
  'x-campus': 'TESANO CAMPUS'
};

let server;
let baseUrl;
let db;

async function api(method, pathname, body, headers = {}) {
  const hasBody = body !== undefined && body !== null;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: hasBody ? JSON.stringify(body) : undefined
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

before(async () => {
  const index = await import(pathToFileURL(path.join(__dirname, '..', 'index.js')).href);
  db = await import(pathToFileURL(path.join(__dirname, '..', 'db.js')).href);
  await db.init();
  server = index.app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db?.closeDatabase) db.closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('GET /api returns service info', async () => {
  const { status, data } = await api('GET', '/api');
  assert.equal(status, 200);
  assert.ok(data.message.includes('API is available'));
  assert.ok(Array.isArray(data.campuses));
  assert.ok(data.campuses.length >= 1);
});

test('register creates a student', async () => {
  const { status, data } = await api('POST', '/api/register', {
    name: 'Test Student',
    phone: '+233 20 000 0001',
    purpose: 'Library visit',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.ok(data.studentId);
});

test('register rejects duplicate phone on same campus', async () => {
  const { status, data } = await api('POST', '/api/register', {
    name: 'Duplicate Person',
    phone: '+233 20 000 0001',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(status, 400);
  assert.ok(data.error);
});

test('generate-token returns a 4-digit token', async () => {
  const { status, data } = await api('POST', '/api/generate-token', {
    phone: '+233 20 000 0001',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(status, 200);
  assert.match(data.token, /^\d{4}$/);
});

test('verify-token validates a token', async () => {
  const gen = await api('POST', '/api/generate-token', {
    phone: '+233 20 000 0001',
    campus: 'TESANO CAMPUS'
  });
  const { status, data } = await api('POST', '/api/verify-token', {
    token: gen.data.token,
    campus: 'TESANO CAMPUS'
  });
  assert.equal(status, 200);
  assert.equal(data.valid, true);
  assert.equal(data.student.name, 'Test Student');
});

test('re-scanning a token preserves the original check-in time', async () => {
  const reg = await api('POST', '/api/register', {
    name: 'Rescan Student',
    phone: '+233 20 000 0002',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(reg.status, 200);

  const gen = await api('POST', '/api/generate-token', {
    phone: '+233 20 000 0002',
    campus: 'TESANO CAMPUS'
  });

  const first = await api('POST', '/api/verify-token', {
    token: gen.data.token,
    campus: 'TESANO CAMPUS'
  });
  assert.equal(first.status, 200);
  const firstVerifiedAt = first.data.verifiedAt;

  await new Promise((resolve) => setTimeout(resolve, 20));

  const second = await api('POST', '/api/verify-token', {
    token: gen.data.token,
    campus: 'TESANO CAMPUS'
  });
  assert.equal(second.status, 200);
  assert.notEqual(second.data.verifiedAt, firstVerifiedAt);

  const student = await db.findStudentByPhoneAndCampus('+233 20 000 0002', 'TESANO CAMPUS');
  const visits = await db.listTokensForStudent(student.id);
  assert.ok(visits.length >= 1);
  assert.equal(visits[0].used_at, firstVerifiedAt);
  assert.equal(visits[0].verified_at, firstVerifiedAt);
});

test('generate-token response includes verified visit history', async () => {
  const reg = await api('POST', '/api/register', {
    name: 'History Student',
    phone: '+233 20 000 0003',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(reg.status, 200);

  const gen = await api('POST', '/api/generate-token', {
    phone: '+233 20 000 0003',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(gen.status, 200);

  const verify = await api('POST', '/api/verify-token', {
    token: gen.data.token,
    campus: 'TESANO CAMPUS'
  });
  assert.equal(verify.status, 200);

  const gen2 = await api('POST', '/api/generate-token', {
    phone: '+233 20 000 0003',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(gen2.status, 200);
  assert.ok(Array.isArray(gen2.data.recentVisits));
  assert.ok(gen2.data.recentVisits.some((v) => v.used_at === verify.data.verifiedAt));
});

test('admin students list includes the registered student', async () => {
  const { status, data } = await api('GET', '/api/admin/students', null, SUPER_ADMIN_HEADERS);
  assert.equal(status, 200);
  assert.ok(data.students.some((s) => s.name === 'Test Student'));
});

test('admin can flag and unflag a student', async () => {
  const student = await db.findStudentByPhoneAndCampus('+233 20 000 0001', 'TESANO CAMPUS');

  const flag = await api('POST', `/api/admin/students/${student.id}/flag`, { flagged: true, note: 'Suspicious activity' }, SUPER_ADMIN_HEADERS);
  assert.equal(flag.status, 200);
  let row = await db.findStudentById(student.id);
  assert.equal(Boolean(row.flagged), true);
  assert.equal(row.flag_note, 'Suspicious activity');

  const unflag = await api('POST', `/api/admin/students/${student.id}/flag`, { flagged: false, note: '' }, SUPER_ADMIN_HEADERS);
  assert.equal(unflag.status, 200);
  row = await db.findStudentById(student.id);
  assert.equal(Boolean(row.flagged), false);
});

test('admin export returns backup structure', async () => {
  const { status, data } = await api('GET', '/api/admin/export', null, SUPER_ADMIN_HEADERS);
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.students));
  assert.ok(Array.isArray(data.tokens));
  assert.ok(Array.isArray(data.settings));
  assert.ok(data.students.some((s) => s.name === 'Test Student'));
});

test('export requires super admin', async () => {
  const { status } = await api('GET', '/api/admin/export');
  assert.equal(status, 403);
});

test('restore requires super admin', async () => {
  const { status } = await api('POST', '/api/admin/restore', { students: [], tokens: [], settings: [] });
  assert.equal(status, 403);
});

test('restore rejects malformed payloads', async () => {
  const { status, data } = await api('POST', '/api/admin/restore', { foo: 'bar' }, SUPER_ADMIN_HEADERS);
  assert.equal(status, 400);
  assert.ok(data.error);
});

test('restore replaces all data', async () => {
  const original = await db.findStudentByPhoneAndCampus('+233 20 000 0001', 'TESANO CAMPUS');
  assert.ok(original);

  const backup = {
    students: [
      {
        id: 'restore-student-1',
        name: 'Restored Student',
        phone: '+233 20 999 9999',
        purpose: 'Restored purpose',
        campus: 'TESANO CAMPUS',
        created_at: new Date().toISOString(),
        flagged: 1,
        flag_note: 'restored flag'
      }
    ],
    tokens: [
      {
        id: 'restore-token-1',
        student_id: 'restore-student-1',
        campus: 'TESANO CAMPUS',
        token: '4242',
        valid_date: '2099-01-01',
        created_at: new Date().toISOString(),
        used_at: new Date().toISOString(),
        verified_at: null
      }
    ],
    settings: [{ key: 'campus_name', value: 'TESANO CAMPUS' }]
  };

  const restore = await api('POST', '/api/admin/restore', backup, SUPER_ADMIN_HEADERS);
  assert.equal(restore.status, 200);
  assert.equal(restore.data.success, true);

  const students = await db.listStudents('TESANO CAMPUS');
  assert.equal(students.length, 1);
  assert.equal(students[0].name, 'Restored Student');
  assert.equal(Boolean(students[0].flagged), true);
  assert.equal(students[0].flag_note, 'restored flag');

  const tokens = await db.listTokensForDate('TESANO CAMPUS', '2099-01-01');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].token, '4242');

  assert.equal(db.getSettingSync('campus_name'), 'TESANO CAMPUS');
});

test('retention endpoint classifies students by visit recency', async () => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const iso = (offsetDays) => new Date(now - offsetDays * DAY).toISOString();

  const students = [
    { id: 'ret-active', name: 'Ret Active', phone: '+233 50 100 0001', purpose: 'Student', campus: 'TESANO CAMPUS', created_at: iso(90) },
    { id: 'ret-new', name: 'Ret New', phone: '+233 50 100 0002', purpose: 'Student', campus: 'TESANO CAMPUS', created_at: iso(10) },
    { id: 'ret-return', name: 'Ret Returning', phone: '+233 50 100 0003', purpose: 'Student', campus: 'TESANO CAMPUS', created_at: iso(120) },
    { id: 'ret-risk', name: 'Ret AtRisk', phone: '+233 50 100 0004', purpose: 'Visitor', campus: 'TESANO CAMPUS', created_at: iso(80) },
    { id: 'ret-gone', name: 'Ret Churned', phone: '+233 50 100 0005', purpose: 'Visitor', campus: 'TESANO CAMPUS', created_at: iso(200) },
    { id: 'ret-tier', name: 'Ret Inactive', phone: '+233 50 100 0006', purpose: 'Student', campus: 'TESANO CAMPUS', created_at: iso(30) }
  ];
  for (const s of students) await db.insertStudent(s);

  const token = (id, studentId, offsetDays) => db.insertToken({
    id,
    student_id: studentId,
    campus: 'TESANO CAMPUS',
    token: String(Math.floor(1000 + Math.random() * 8999)),
    valid_date: new Date(now - offsetDays * DAY).toISOString().slice(0, 10),
    created_at: iso(offsetDays),
    used_at: iso(offsetDays),
    verified_at: iso(offsetDays)
  });

  await token('t-ret-active', 'ret-active', 5);
  await token('t-ret-active2', 'ret-active', 1);
  await token('t-ret-new', 'ret-new', 2);
  await token('t-ret-return', 'ret-return', 100);
  await token('t-ret-return2', 'ret-return', 3);
  await token('t-ret-risk', 'ret-risk', 45);
  await token('t-ret-gone', 'ret-gone', 90);

  const { status, data } = await api('GET', '/api/admin/retention', null, SUPER_ADMIN_HEADERS);
  assert.equal(status, 200);

  const byId = {};
  data.records.forEach((r) => { byId[r.id] = r; });

  assert.equal(byId['ret-active'].status, 'returning');
  assert.equal(byId['ret-active'].visit_count, 2);
  assert.equal(byId['ret-new'].status, 'new');
  assert.equal(byId['ret-new'].visit_count, 1);
  assert.equal(byId['ret-return'].status, 'returning');
  assert.equal(byId['ret-return'].visit_count, 2);
  assert.equal(byId['ret-risk'].status, 'at_risk');
  assert.equal(byId['ret-gone'].status, 'churned');
  assert.equal(byId['ret-tier'].status, 'inactive');

  assert.ok(data.summary.total >= students.length);
  assert.equal(data.summary.returning >= 2, true);
});

test('SMS status reports disabled when not configured', async () => {
  const { status, data } = await api('GET', '/api/sms/status', null, SUPER_ADMIN_HEADERS);
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.sms.enabled, false);
});

test('SMS send returns 503 when not configured', async () => {
  const payload = { recipients: [{ phone: '0244123456', name: 'Test' }], message: 'Hello' };
  const { status, data } = await api('POST', '/api/sms/send', payload, SUPER_ADMIN_HEADERS);
  assert.equal(status, 503);
  assert.match(data.error, /not configured/i);
});

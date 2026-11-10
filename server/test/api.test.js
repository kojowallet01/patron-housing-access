import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pha-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.NODE_ENV = 'production';
process.env.ALLOW_UNAUTHENTICATED = 'true';
process.env.SUPER_ADMIN_TOKEN = 'test-super-admin-token';
process.env.SECURITY_TOKEN = 'test-security-token';
process.env.PORT = '0';

const SUPER_ADMIN_HEADERS = {
  'x-super-admin-token': 'test-super-admin-token',
  'x-campus': 'TESANO CAMPUS'
};
const SECURITY_HEADERS = {
  'x-security-token': 'test-security-token',
  'x-campus': 'TESANO CAMPUS'
};

let server;
let baseUrl;
let db;

async function registrationClassBooking(campus) {
  const campusName = campus || 'TESANO CAMPUS';
  let term = (await db.listAcademicTerms(campusName)).find((item) => item.status === 'active');
  if (!term) {
    const today = new Date().toISOString().slice(0, 10);
    const created = await api('POST', '/api/admin/academic-terms', {
      name: 'API Test Term',
      start_date: today,
      end_date: dateOffset(today, 365),
      status: 'active'
    }, { ...SUPER_ADMIN_HEADERS, 'x-campus': campusName });
    if (created.status !== 200) throw new Error(created.data?.error || 'Unable to create the API test term.');
    term = created.data.term;
  }

  let classSchedule = (await db.listClassSchedules(campusName, term.id))
    .find((item) => item.title === 'API Test Registration Class');
  if (!classSchedule) {
    const created = await api('POST', '/api/admin/classes', {
      term_id: term.id,
      title: 'API Test Registration Class',
      description: 'Registration requirement test fixture',
      day_of_week: 2,
      start_time: '00:00',
      end_time: '23:59',
      classroom: `API Test Registration ${term.id.slice(0, 40)}`,
      capacity: 5000,
      status: 'published'
    }, { ...SUPER_ADMIN_HEADERS, 'x-campus': campusName });
    if (created.status !== 200) throw new Error(created.data?.error || 'Unable to create the API test class.');
    classSchedule = created.data.class;
  }

  const earliest = term.start_date > new Date().toISOString().slice(0, 10)
    ? term.start_date
    : dateOffset(new Date().toISOString().slice(0, 10), 1);
  const classDate = nextWeekdayDate(classSchedule.day_of_week, dateOffset(earliest, -1));
  if (classDate > term.end_date) throw new Error('The active API test term is too short for a registration fixture.');
  return { classId: classSchedule.id, classDate };
}

async function api(method, pathname, body, headers = {}) {
  let requestBody = body;
  if (method === 'POST' && pathname === '/api/register' && body &&
      !Object.prototype.hasOwnProperty.call(body, 'classBookings')) {
    requestBody = {
      ...body,
      classBookings: [await registrationClassBooking(body.campus)]
    };
  }
  if (method === 'POST' && pathname === '/api/register' && requestBody &&
      !Object.prototype.hasOwnProperty.call(requestBody, 'date_of_birth')) {
    requestBody = { ...requestBody, date_of_birth: '1990-01-01' };
  }
  const hasBody = requestBody !== undefined && requestBody !== null;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: hasBody ? JSON.stringify(requestBody) : undefined
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data, headers: response.headers };
}

function dateOffset(date, offset) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}

function nextWeekdayDate(weekday, fromDate) {
  const currentWeekday = new Date(`${fromDate}T00:00:00.000Z`).getUTCDay();
  const offset = ((weekday - currentWeekday + 7) % 7) || 7;
  return dateOffset(fromDate, offset);
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
  const health = await api('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.classScheduleReady, true);
});

test('initial timetable seeds editable weekly classes once', async () => {
  const campus = 'API SEED TEST CAMPUS';
  await db.seedInitialTimetables([campus]);
  await db.seedInitialTimetables([campus]);
  const terms = await db.listAcademicTerms(campus);
  const classes = await db.listClassSchedules(campus, terms[0]?.id);
  assert.equal(terms.length, 1);
  assert.equal(terms[0].status, 'active');
  assert.equal(classes.length, 19);
  assert.ok(classes.every((classSchedule) => classSchedule.status === 'published'));
  assert.ok(classes.some((classSchedule) =>
    classSchedule.day_of_week === 2 && classSchedule.start_time === '14:00' && classSchedule.classroom === 'CR'
  ));
});

test('register creates a student', async () => {
  const { status, data } = await api('POST', '/api/register', {
    name: 'Test Student',
    phone: '+233 20 000 0001',
    date_of_birth: '1990-01-01',
    purpose: 'Library visit',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.ok(data.studentId);
  const student = await db.findStudentByPhoneAndCampus('+233 20 000 0001', 'TESANO CAMPUS');
  assert.equal(student.date_of_birth, '1990-01-01');
});

test('registration requires a valid non-future date of birth', async () => {
  for (const [phone, dateOfBirth] of [
    ['+233 20 000 0091', null],
    ['+233 20 000 0092', '2027-01-01'],
    ['+233 20 000 0093', '1990-02-30']
  ]) {
    const response = await api('POST', '/api/register', {
      name: 'Invalid Date of Birth',
      phone,
      date_of_birth: dateOfBirth,
      purpose: 'Registration validation',
      campus: 'TESANO CAMPUS'
    });
    assert.equal(response.status, 400);
    assert.match(response.data.error, /date of birth/i);
    assert.equal(await db.findStudentByPhoneAndCampus(phone, 'TESANO CAMPUS'), null);
  }
});

test('registration requires at least one valid class selection', async () => {
  const missingClass = await api('POST', '/api/register', {
    name: 'No Class Selection',
    phone: '+233 20 000 0090',
    purpose: 'Registration validation',
    campus: 'TESANO CAMPUS',
    classBookings: []
  });
  assert.equal(missingClass.status, 400);
  assert.equal(await db.findStudentByPhoneAndCampus('+233 20 000 0090', 'TESANO CAMPUS'), null);
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
  }, SECURITY_HEADERS);
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
  }, SECURITY_HEADERS);
  assert.equal(first.status, 200);
  const firstVerifiedAt = first.data.verifiedAt;

  await new Promise((resolve) => setTimeout(resolve, 20));

  const second = await api('POST', '/api/verify-token', {
    token: gen.data.token,
    campus: 'TESANO CAMPUS'
  }, SECURITY_HEADERS);
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
  }, SECURITY_HEADERS);
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
  assert.equal(status, 401);
});

test('restore requires super admin', async () => {
  const { status } = await api('POST', '/api/admin/restore', { students: [], tokens: [], settings: [] });
  assert.equal(status, 401);
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

test('admin can opt a member out of SMS and retention reflects the preference', async () => {
  const updated = await api('POST', '/api/admin/students/ret-new/sms-preference', { opted_out: true }, SUPER_ADMIN_HEADERS);
  assert.equal(updated.status, 200);
  assert.equal(updated.data.sms_opt_out, true);

  const retention = await api('GET', '/api/admin/retention', null, SUPER_ADMIN_HEADERS);
  const record = retention.data.records.find((row) => row.id === 'ret-new');
  assert.equal(record.sms_opt_out, true);

  const env = {
    SMS_ENABLED: process.env.SMS_ENABLED,
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    SMS_API_KEY: process.env.SMS_API_KEY,
    SMS_SENDER_ID: process.env.SMS_SENDER_ID
  };
  process.env.SMS_ENABLED = 'true';
  process.env.SMS_PROVIDER = 'arkesel';
  process.env.SMS_API_KEY = 'test-key';
  process.env.SMS_SENDER_ID = 'AIFSP';
  try {
    const send = await api('POST', '/api/sms/send', {
      recipients: [{ id: 'ret-new' }],
      message: 'Test'
    }, SUPER_ADMIN_HEADERS);
    assert.equal(send.status, 400);
    assert.match(send.data.error, /opted out/i);
  } finally {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('retention settings validate templates and cooldown', async () => {
  const initial = await api('GET', '/api/admin/retention/settings', null, SUPER_ADMIN_HEADERS);
  assert.equal(initial.status, 200);
  assert.equal(initial.data.settings.cooldownDays, 7);

  const invalid = await api('PUT', '/api/admin/retention/settings', {
    firstTimeFollowUp: 'Hello',
    atRiskWinback: 'Welcome back',
    cooldownDays: 0
  }, SUPER_ADMIN_HEADERS);
  assert.equal(invalid.status, 400);

  const saved = await api('PUT', '/api/admin/retention/settings', {
    firstTimeFollowUp: 'Hello {name} at {campus}',
    atRiskWinback: 'We miss you, {name}',
    cooldownDays: 10
  }, SUPER_ADMIN_HEADERS);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.settings.cooldownDays, 10);
});

test('auto campaign preview explains eligible and cooldown-excluded members and requires confirmation', async () => {
  const now = Date.now();
  const visitAt = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
  await db.insertStudent({
    id: 'ret-campaign-first',
    name: 'Campaign First Visit',
    phone: '+233 50 100 0090',
    purpose: 'Student',
    campus: 'TESANO CAMPUS',
    created_at: visitAt
  });
  await db.insertToken({
    id: 't-ret-campaign-first',
    student_id: 'ret-campaign-first',
    campus: 'TESANO CAMPUS',
    token: '8090',
    valid_date: visitAt.slice(0, 10),
    created_at: visitAt,
    used_at: visitAt,
    verified_at: visitAt
  });

  const preview = await api('GET', '/api/admin/retention/auto-campaign/preview', null, SUPER_ADMIN_HEADERS);
  assert.equal(preview.status, 200);
  assert.ok(preview.data.recipients.some((row) => row.id === 'ret-campaign-first'));

  const unconfirmed = await api('POST', '/api/admin/retention/auto-campaign', {}, SUPER_ADMIN_HEADERS);
  assert.equal(unconfirmed.status, 400);

  await db.insertSmsLogs([{
    id: 'ret-cooldown-log',
    campus: 'TESANO CAMPUS',
    recipient_name: 'Campaign First Visit',
    recipient_phone_masked: '***0090',
    recipient_id: 'ret-campaign-first',
    provider: 'arkesel',
    status: 'accepted',
    source: 'first-time-followup',
    created_at: new Date().toISOString()
  }]);
  const cooled = await api('GET', '/api/admin/retention/auto-campaign/preview', null, SUPER_ADMIN_HEADERS);
  assert.equal(cooled.status, 200);
  assert.equal(cooled.data.recipients.some((row) => row.id === 'ret-campaign-first'), false);
  assert.ok(cooled.data.cohorts.excludedCooldown >= 1);

  const confirmed = await api('POST', '/api/admin/retention/auto-campaign', {
    confirm: true,
    recipient_ids: ['ret-campaign-first'],
    settings: cooled.data.settings
  }, SUPER_ADMIN_HEADERS);
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.cohorts.totalEligible, 0);
});

test('retention campaign schedules can be created, listed, and cancelled', async () => {
  const visitAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  await db.insertStudent({
    id: 'ret-scheduled-member',
    name: 'Scheduled Member',
    phone: '+233 50 100 0091',
    purpose: 'Student',
    campus: 'TESANO CAMPUS',
    created_at: visitAt
  });
  await db.insertToken({
    id: 't-ret-scheduled-member',
    student_id: 'ret-scheduled-member',
    campus: 'TESANO CAMPUS',
    token: '8091',
    valid_date: visitAt.slice(0, 10),
    created_at: visitAt,
    used_at: visitAt,
    verified_at: visitAt
  });
  const preview = await api('GET', '/api/admin/retention/auto-campaign/preview', null, SUPER_ADMIN_HEADERS);
  const scheduledMember = preview.data.recipients.find((row) => row.id === 'ret-scheduled-member');
  assert.ok(scheduledMember);
  const runAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const created = await api('POST', '/api/admin/retention/schedules', {
    run_at: runAt,
    recipient_ids: [scheduledMember.id],
    settings: preview.data.settings
  }, SUPER_ADMIN_HEADERS);
  assert.equal(created.status, 201);
  assert.equal(created.data.schedule.status, 'scheduled');
  assert.deepEqual(created.data.schedule.recipient_ids, [scheduledMember.id]);

  const listed = await api('GET', '/api/admin/retention/schedules', null, SUPER_ADMIN_HEADERS);
  assert.ok(listed.data.schedules.some((schedule) => schedule.id === created.data.schedule.id));

  const cancelled = await api('DELETE', `/api/admin/retention/schedules/${created.data.schedule.id}`, null, SUPER_ADMIN_HEADERS);
  assert.equal(cancelled.status, 200);
  const cancelledAgain = await api('DELETE', `/api/admin/retention/schedules/${created.data.schedule.id}`, null, SUPER_ADMIN_HEADERS);
  assert.equal(cancelledAgain.status, 404);
});

test('due retention schedules are claimed once and can be marked complete', async () => {
  const now = new Date().toISOString();
  await db.insertRetentionSchedule({
    id: 'ret-due-schedule-test',
    campus: 'TESANO CAMPUS',
    run_at: new Date(Date.now() - 60_000).toISOString(),
    status: 'scheduled',
    templates: { firstTimeFollowUp: 'Hello {name}', atRiskWinback: 'Welcome {name}' },
    recipient_ids: ['ret-scheduled-member'],
    cooldown_days: 7,
    created_at: now,
    updated_at: now
  });
  const claimed = await db.claimDueRetentionSchedules(now, 10);
  assert.ok(claimed.some((schedule) => schedule.id === 'ret-due-schedule-test'));
  const claimedAgain = await db.claimDueRetentionSchedules(new Date().toISOString(), 10);
  assert.equal(claimedAgain.some((schedule) => schedule.id === 'ret-due-schedule-test'), false);

  await db.updateRetentionSchedule('ret-due-schedule-test', 'completed', { sms: { sent: 1 } });
  const listed = await db.listRetentionSchedules('TESANO CAMPUS');
  const schedule = listed.find((item) => item.id === 'ret-due-schedule-test');
  assert.equal(schedule.status, 'completed');
  assert.equal(schedule.result.sms.sent, 1);
});

test('campaign analytics counts verified returns after accepted campaign messages', async () => {
  const now = Date.now();
  const sentAt = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const returnedAt = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
  await db.insertStudent({
    id: 'ret-return-after-sms',
    name: 'Returned After SMS',
    phone: '+233 50 100 0092',
    purpose: 'Student',
    campus: 'TESANO CAMPUS',
    created_at: sentAt
  });
  await db.insertToken({
    id: 't-ret-return-after-sms',
    student_id: 'ret-return-after-sms',
    campus: 'TESANO CAMPUS',
    token: '8092',
    valid_date: returnedAt.slice(0, 10),
    created_at: returnedAt,
    used_at: returnedAt,
    verified_at: returnedAt
  });
  await db.insertSmsLogs([{
    id: 'ret-return-after-sms-log',
    campus: 'TESANO CAMPUS',
    recipient_name: 'Returned After SMS',
    recipient_phone_masked: '***0092',
    recipient_id: 'ret-return-after-sms',
    provider: 'termii',
    status: 'accepted',
    source: 'first-time-followup',
    created_at: sentAt
  }, {
    id: 'ret-failed-return-log',
    campus: 'TESANO CAMPUS',
    recipient_name: 'Returned After SMS',
    recipient_phone_masked: '***0092',
    recipient_id: 'ret-return-after-sms',
    provider: 'termii',
    status: 'failed',
    source: 'first-time-followup',
    created_at: new Date(Date.parse(sentAt) + 60_000).toISOString()
  }]);

  const analytics = await api('GET', '/api/admin/retention/analytics', null, SUPER_ADMIN_HEADERS);
  assert.equal(analytics.status, 200);
  const followUp = analytics.data.cohorts.find((cohort) => cohort.source === 'first-time-followup');
  assert.equal(followUp.returnedAfterSend, 1);
});

test('authenticated SMS delivery callback updates provider delivery status', async () => {
  await db.insertSmsLogs([{
    id: 'sms-delivery-callback-test',
    campus: 'TESANO CAMPUS',
    recipient_name: 'Delivery Test Recipient',
    recipient_phone_masked: '***7788',
    provider: 'termii',
    provider_message_id: 'provider-message-7788',
    status: 'accepted',
    delivery_status: 'pending',
    source: 'manual-broadcast',
    created_at: new Date().toISOString()
  }]);

  const oldToken = process.env.SMS_DELIVERY_WEBHOOK_TOKEN;
  process.env.SMS_DELIVERY_WEBHOOK_TOKEN = 'test-delivery-webhook-token';
  try {
    const unauthorized = await api('POST', '/api/sms/delivery', {
      provider_message_id: 'provider-message-7788',
      delivery_status: 'delivered'
    });
    assert.equal(unauthorized.status, 401);

    const delivered = await api('POST', '/api/sms/delivery', {
      provider_message_id: 'provider-message-7788',
      delivery_status: 'delivered'
    }, { 'x-sms-webhook-token': 'test-delivery-webhook-token' });
    assert.equal(delivered.status, 200);

    const logs = await api('GET', '/api/admin/sms/logs', null, SUPER_ADMIN_HEADERS);
    assert.equal(logs.data.logs.find((log) => log.id === 'sms-delivery-callback-test').delivery_status, 'delivered');
  } finally {
    if (oldToken === undefined) delete process.env.SMS_DELIVERY_WEBHOOK_TOKEN;
    else process.env.SMS_DELIVERY_WEBHOOK_TOKEN = oldToken;
  }
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

test('admin SMS history lists masked recipient send attempts by campus', async () => {
  await db.insertSmsLogs([{
    id: 'sms-log-test-1',
    campus: 'TESANO CAMPUS',
    recipient_name: 'SMS Test Recipient',
    recipient_phone_masked: '***1234',
    provider: 'arkesel',
    status: 'accepted',
    source: 'manual-broadcast',
    error: null,
    created_at: new Date().toISOString()
  }]);

  const { status, data } = await api('GET', '/api/admin/sms/logs', null, SUPER_ADMIN_HEADERS);
  assert.equal(status, 200);
  assert.ok(data.logs.some((log) => (
    log.id === 'sms-log-test-1' &&
    log.recipient_phone_masked === '***1234' &&
    log.status === 'accepted'
  )));
});

test('feedback submission and admin retrieval', async () => {
  const fb = {
    rating: 5,
    campus: 'TESANO CAMPUS',
    category: 'Quiet Study',
    comment: 'Great atmosphere today!'
  };
  const postRes = await api('POST', '/api/feedback', fb);
  assert.equal(postRes.status, 200);
  assert.equal(postRes.data.success, true);

  const getRes = await api('GET', '/api/admin/feedback', null, SUPER_ADMIN_HEADERS);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.data.success, true);
  assert.ok(getRes.data.total >= 1);
  assert.equal(getRes.data.ratingsBreakdown['5'] >= 1, true);
});

test('token response contains loyalty milestone', async () => {
  await api('POST', '/api/register', {
    name: 'Loyal Student',
    phone: '+233 20 999 8888',
    purpose: 'Study',
    campus: 'TESANO CAMPUS'
  });
  const gen = await api('POST', '/api/generate-token', {
    phone: '+233 20 999 8888',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(gen.status, 200);
  assert.ok(gen.data.milestone);
  assert.ok(gen.data.milestone.badge);
});

test('super-admin queries respect campus selection (Ashaiman shows 0, Tesano shows registered count)', async () => {
  const ashaimanHeaders = {
    'x-super-admin-token': 'test-super-admin-token',
    'x-campus': 'ASHIAMAN CAMPUS'
  };

  const tesanoHeaders = {
    'x-super-admin-token': 'test-super-admin-token',
    'x-campus': 'TESANO CAMPUS'
  };

  // 1. Check students list for Ashaiman
  const ashaimanStudents = await api('GET', '/api/admin/students', null, ashaimanHeaders);
  assert.equal(ashaimanStudents.status, 200);
  assert.equal(ashaimanStudents.data.count, 0);
  assert.equal(ashaimanStudents.data.students.length, 0);

  // 2. Check stats for Ashaiman
  const ashaimanStats = await api('GET', '/api/admin/stats', null, ashaimanHeaders);
  assert.equal(ashaimanStats.status, 200);
  assert.equal(ashaimanStats.data.totalStudents, 0);
  assert.equal(ashaimanStats.data.campus, 'ASHIAMAN CAMPUS');

  // 3. Check stats for Tesano
  const tesanoStats = await api('GET', '/api/admin/stats', null, tesanoHeaders);
  assert.equal(tesanoStats.status, 200);
  assert.ok(tesanoStats.data.totalStudents >= 3);
  assert.equal(tesanoStats.data.campus, 'TESANO CAMPUS');

  // 4. Check ALL CAMPUSES overview
  const allHeaders = {
    'x-super-admin-token': 'test-super-admin-token',
    'x-campus': 'ALL CAMPUSES'
  };
  const allStats = await api('GET', '/api/admin/stats', null, allHeaders);
  assert.equal(allStats.status, 200);
  assert.ok(allStats.data.totalStudents >= tesanoStats.data.totalStudents);
  assert.equal(allStats.data.campus, 'ALL CAMPUSES');
});

test('campus passwords are stored as hashes and staff sessions use HttpOnly cookies', async () => {
  const password = 'a-long-test-password-123';
  const saved = await api('POST', '/api/super-admin/passwords', {
    campus: 'LEGON CAMPUS',
    role: 'admin',
    password
  }, SUPER_ADMIN_HEADERS);
  assert.equal(saved.status, 200);

  const storedMap = JSON.parse(db.getSettingSync('campus_admin_tokens'));
  assert.match(storedMap['LEGON CAMPUS'], /^scrypt\$/);
  assert.equal(storedMap['LEGON CAMPUS'].includes(password), false);

  const passwordMap = await api('GET', '/api/super-admin/passwords', null, SUPER_ADMIN_HEADERS);
  assert.equal(passwordMap.status, 200);
  assert.equal(passwordMap.data.admin['LEGON CAMPUS'], true);
  assert.equal(JSON.stringify(passwordMap.data).includes(password), false);
  assert.equal(JSON.stringify(passwordMap.data).includes(storedMap['LEGON CAMPUS']), false);

  const login = await api('POST', '/api/validate-login', {
    role: 'admin',
    campus: 'LEGON CAMPUS',
    password
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.valid, true);
  assert.equal('sessionToken' in login.data, false);
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /^aifsp_session=/);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);

  const session = await api('GET', '/api/session', undefined, { cookie });
  assert.equal(session.status, 200);
  assert.equal(session.data.role, 'admin');
  assert.equal(session.data.campus, 'LEGON CAMPUS');

  await db.setSetting('campus_admin_tokens', JSON.stringify({
    ...storedMap,
    'CANTOMENT CAMPUS': 'legacy-campus-password'
  }));
  const legacyLogin = await api('POST', '/api/validate-login', {
    role: 'admin',
    campus: 'CANTOMENT CAMPUS',
    password: 'legacy-campus-password'
  });
  assert.equal(legacyLogin.data.valid, true);
  const upgradedMap = JSON.parse(db.getSettingSync('campus_admin_tokens'));
  assert.match(upgradedMap['CANTOMENT CAMPUS'], /^scrypt\$/);
  assert.equal(upgradedMap['CANTOMENT CAMPUS'].includes('legacy-campus-password'), false);
});

test('access-code issuance is throttled per phone and IP', async () => {
  const phone = '+233 20 000 0077';
  const registered = await api('POST', '/api/register', {
    name: 'Rate Limited Student',
    phone,
    purpose: 'Study',
    campus: 'TESANO CAMPUS'
  });
  assert.equal(registered.status, 200);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const request = await api('POST', '/api/generate-token', { phone, campus: 'TESANO CAMPUS' });
    assert.equal(request.status, 200);
  }
  const limited = await api('POST', '/api/generate-token', { phone, campus: 'TESANO CAMPUS' });
  assert.equal(limited.status, 429);
});

test('class bookings never grant campus access and class attendance stays separate', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const campus = 'TESANO CAMPUS';
  const termResponse = await api('POST', '/api/admin/academic-terms', {
    name: 'Test Academic Term',
    start_date: dateOffset(today, -1),
    end_date: dateOffset(today, 30),
    status: 'active'
  }, SUPER_ADMIN_HEADERS);
  assert.equal(termResponse.status, 200);
  const termId = termResponse.data.term.id;

  const todayWeekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const classBody = {
    term_id: termId,
    title: 'Foundations of the Restoration',
    description: 'Core course',
    day_of_week: todayWeekday,
    start_time: '00:00',
    end_time: '23:59',
    classroom: 'Room 101',
    capacity: 1,
    instructor: 'Test Instructor',
    status: 'published'
  };
  const firstClassResponse = await api('POST', '/api/admin/classes', classBody, SUPER_ADMIN_HEADERS);
  assert.equal(firstClassResponse.status, 200);
  const firstClass = firstClassResponse.data.class;

  const secondClassResponse = await api('POST', '/api/admin/classes', {
    ...classBody,
    title: 'Second Course',
    classroom: 'Room 102'
  }, SUPER_ADMIN_HEADERS);
  assert.equal(secondClassResponse.status, 200);
  const secondClass = secondClassResponse.data.class;
  const thirdClassResponse = await api('POST', '/api/admin/classes', {
    ...classBody,
    title: 'Third Course',
    classroom: 'Room 103'
  }, SUPER_ADMIN_HEADERS);
  assert.equal(thirdClassResponse.status, 200);
  const thirdClass = thirdClassResponse.data.class;
  const roomConflict = await api('POST', '/api/admin/classes', {
    ...classBody,
    title: 'Conflicting Course'
  }, SUPER_ADMIN_HEADERS);
  assert.equal(roomConflict.status, 409);

  const studentPhone = '+233 20 000 0081';
  const secondStudentPhone = '+233 20 000 0082';
  const firstRegistration = await api('POST', '/api/register', {
    name: 'Class Booking Student',
    phone: studentPhone,
    date_of_birth: '1994-06-15',
    purpose: 'Class attendance test',
    campus,
    classBookings: [{
      classId: firstClass.id,
      classDate: nextWeekdayDate(todayWeekday, today)
    }]
  });
  const secondRegistration = await api('POST', '/api/register', {
    name: 'Second Class Student',
    phone: secondStudentPhone,
    purpose: 'Class capacity test',
    campus,
    classBookings: [{
      classId: firstClass.id,
      classDate: nextWeekdayDate(todayWeekday, dateOffset(today, 7))
    }]
  });
  assert.equal(firstRegistration.status, 200);
  assert.equal(secondRegistration.status, 200);
  const fullClassRegistration = await api('POST', '/api/register', {
    name: 'Full Class Registration Student',
    phone: '+233 20 000 0084',
    purpose: 'Capacity rollback test',
    campus,
    classBookings: [{
      classId: firstClass.id,
      classDate: nextWeekdayDate(todayWeekday, today)
    }]
  });
  assert.equal(fullClassRegistration.status, 409);
  assert.equal(await db.findStudentByPhoneAndCampus('+233 20 000 0084', campus), null);

  const publicTimetable = await api('GET', `/api/classes?campus=${encodeURIComponent(campus)}`);
  assert.equal(publicTimetable.status, 200);
  assert.equal(publicTimetable.data.term.id, termId);
  assert.ok(publicTimetable.data.classes.some((course) => course.id === firstClass.id));
  const openAvailability = await api('GET', `/api/classes/availability?campus=${encodeURIComponent(campus)}&class_id=${firstClass.id}&date=${today}`);
  assert.equal(openAvailability.status, 200);
  assert.equal(openAvailability.data.available, true);
  assert.equal(openAvailability.data.remainingCapacity, 1);

  for (const classSchedule of [firstClass, secondClass, thirdClass]) {
    const booked = await api('POST', '/api/classes/bookings', {
      classId: classSchedule.id,
      classDate: today,
      name: 'Class Booking Student',
      phone: studentPhone,
      campus
    });
    assert.equal(booked.status, 201);
  }
  const fullAvailability = await api('GET', `/api/classes/availability?campus=${encodeURIComponent(campus)}&class_id=${firstClass.id}&date=${today}`);
  assert.equal(fullAvailability.data.available, false);
  assert.equal(fullAvailability.data.remainingCapacity, 0);

  const futureBooking = await api('POST', '/api/classes/bookings', {
    classId: secondClass.id,
    classDate: nextWeekdayDate(todayWeekday, dateOffset(today, 1)),
    name: 'Class Booking Student',
    phone: studentPhone,
    campus
  });
  assert.equal(futureBooking.status, 201);

  const student = await db.findStudentByPhoneAndCampus(studentPhone, campus);
  assert.deepEqual(await db.listTokensForStudent(student.id), []);
  const bookings = await api('GET', `/api/classes/bookings?phone=${encodeURIComponent(studentPhone)}&name=${encodeURIComponent('Class Booking Student')}&campus=${encodeURIComponent(campus)}`);
  assert.equal(bookings.status, 200);
  assert.equal(bookings.data.bookings.length, 5);
  const todaysBookings = bookings.data.bookings.filter((booking) => booking.class_date === today);
  assert.equal(todaysBookings.length, 3);
  assert.ok(bookings.data.bookings.every((booking) => booking.status === 'booked' && booking.attendance === null));

  const beforeCampusEntry = await api('GET', `/api/admin/classes/attendance?date=${today}`, null, SUPER_ADMIN_HEADERS);
  assert.equal(beforeCampusEntry.status, 200);
  assert.equal(beforeCampusEntry.data.summary.pending, 3);
  assert.equal(beforeCampusEntry.data.summary.bookedWithoutCampusEntry, 3);
  const unauthorizedClassReport = await api('GET', `/api/admin/classes/attendance?date=${today}`);
  assert.equal(unauthorizedClassReport.status, 401);
  const firstClassReport = await api('GET', `/api/admin/classes/attendance?date=${today}&class_id=${firstClass.id}`, null, SUPER_ADMIN_HEADERS);
  assert.equal(firstClassReport.status, 200);
  assert.equal(firstClassReport.data.roster.length, 1);
  assert.equal(firstClassReport.data.roster[0].student_date_of_birth, '1994-06-15');

  const firstClassBooking = todaysBookings.find((booking) => booking.class_id === firstClass.id);
  const secondClassBooking = todaysBookings.find((booking) => booking.class_id === secondClass.id);
  const refusedMark = await api('PUT', `/api/admin/classes/bookings/${firstClassBooking.id}/attendance`, {
    status: 'present'
  });
  assert.equal(refusedMark.status, 401);

  const accessToken = await api('POST', '/api/generate-token', { phone: studentPhone, campus });
  assert.equal(accessToken.status, 200);
  const verifiedEntry = await api('POST', '/api/verify-token', {
    token: accessToken.data.token,
    campus
  }, SECURITY_HEADERS);
  assert.equal(verifiedEntry.status, 200);
  assert.equal(verifiedEntry.data.valid, true);

  const afterCampusEntry = await api('GET', `/api/admin/classes/attendance?date=${today}`, null, SUPER_ADMIN_HEADERS);
  assert.equal(afterCampusEntry.data.summary.campusEntries, 1);
  assert.equal(afterCampusEntry.data.summary.pending, 3);
  assert.ok(afterCampusEntry.data.roster.every((booking) => booking.campus_attended));
  assert.ok(afterCampusEntry.data.roster.every((booking) => booking.campus_entry_at));

  const firstAttendance = await api('PUT', `/api/admin/classes/bookings/${firstClassBooking.id}/attendance`, {
    status: 'present'
  }, SUPER_ADMIN_HEADERS);
  const secondAttendance = await api('PUT', `/api/admin/classes/bookings/${secondClassBooking.id}/attendance`, {
    status: 'present'
  }, SUPER_ADMIN_HEADERS);
  const prematureAbsence = await api('PUT', `/api/admin/classes/bookings/${todaysBookings.find((booking) => booking.class_id === thirdClass.id).id}/attendance`, {
    status: 'absent'
  }, SUPER_ADMIN_HEADERS);
  assert.equal(firstAttendance.status, 200);
  assert.equal(secondAttendance.status, 200);
  assert.equal(prematureAbsence.status, 400);
  const finalReport = await api('GET', `/api/admin/classes/attendance?date=${today}`, null, SUPER_ADMIN_HEADERS);
  assert.equal(finalReport.data.summary.present, 2);
  assert.equal(finalReport.data.summary.pending, 1);
  const analytics = await api('GET', `/api/admin/classes/analytics?start_date=${today}&end_date=${today}`, null, SUPER_ADMIN_HEADERS);
  assert.equal(analytics.status, 200);
  assert.equal(analytics.data.summary.totalBookings, 3);
  assert.equal(analytics.data.summary.attended, 2);
  assert.equal(analytics.data.summary.pending, 1);
  assert.ok(analytics.data.summary.capacity >= 3);
  assert.ok(analytics.data.summary.capacityUtilization > 0);
  assert.ok(analytics.data.summary.capacityUtilization <= 100);
  assert.equal(analytics.data.classes.length, 3);
  const invalidAnalyticsRange = await api('GET', `/api/admin/classes/analytics?start_date=${dateOffset(today, 1)}&end_date=${today}`, null, SUPER_ADMIN_HEADERS);
  assert.equal(invalidAnalyticsRange.status, 400);

  const overCapacity = await api('POST', '/api/classes/bookings', {
    classId: firstClass.id,
    classDate: today,
    name: 'Second Class Student',
    phone: secondStudentPhone,
    campus
  });
  assert.equal(overCapacity.status, 409);

  const invalidDate = await api('POST', '/api/classes/bookings', {
    classId: firstClass.id,
    classDate: dateOffset(today, 1),
    name: 'Second Class Student',
    phone: secondStudentPhone,
    campus
  });
  assert.equal(invalidDate.status, 400);
});

test('rescheduling and cancelling classes preserve snapshots and notify affected bookings', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const campus = 'TESANO CAMPUS';
  const term = (await db.listAcademicTerms(campus)).find((item) => item.status === 'active');
  assert.ok(term);
  const futureDate = nextWeekdayDate((new Date(`${today}T00:00:00.000Z`).getUTCDay() + 2) % 7, today);
  const weekday = new Date(`${futureDate}T00:00:00.000Z`).getUTCDay();
  const classBody = {
    term_id: term.id,
    title: 'Schedule Change Course',
    description: 'Original schedule',
    day_of_week: weekday,
    start_time: '10:00',
    end_time: '11:00',
    classroom: 'Room 201',
    capacity: 5,
    instructor: 'Original Instructor',
    status: 'published'
  };
  const created = await api('POST', '/api/admin/classes', classBody, SUPER_ADMIN_HEADERS);
  assert.equal(created.status, 200);
  const classId = created.data.class.id;

  const registered = await api('POST', '/api/register', {
    name: 'Reschedule Student',
    phone: '+233 20 000 0083',
    purpose: 'Schedule change test',
    campus
  });
  assert.equal(registered.status, 200);
  const booked = await api('POST', '/api/classes/bookings', {
    classId,
    classDate: futureDate,
    name: 'Reschedule Student',
    phone: '+233 20 000 0083',
    campus
  });
  assert.equal(booked.status, 201);

  const changed = await api('POST', '/api/admin/classes', {
    ...classBody,
    id: classId,
    start_time: '14:00',
    end_time: '15:00',
    classroom: 'Room 202'
  }, SUPER_ADMIN_HEADERS);
  assert.equal(changed.status, 200);
  assert.equal(changed.data.notifications.skipped, 1);
  const rebookedAfterReschedule = await api('POST', '/api/classes/bookings', {
    classId,
    classDate: futureDate,
    name: 'Reschedule Student',
    phone: '+233 20 000 0083',
    campus
  });
  assert.equal(rebookedAfterReschedule.status, 201);
  assert.equal(rebookedAfterReschedule.data.booking.start_time_snapshot, '14:00');
  const calendarSelection = await api('POST', `/api/classes/bookings/${rebookedAfterReschedule.data.booking.id}/calendar`, {
    name: 'Reschedule Student',
    phone: '+233 20 000 0083',
    campus
  });
  assert.equal(calendarSelection.status, 200);
  assert.ok(calendarSelection.data.calendarAddedAt);
  const trackedBookingLookup = await api('GET', `/api/classes/bookings?phone=${encodeURIComponent('+233 20 000 0083')}&name=${encodeURIComponent('Reschedule Student')}&campus=${encodeURIComponent(campus)}`);
  const trackedBooking = trackedBookingLookup.data.bookings.find((booking) => booking.id === rebookedAfterReschedule.data.booking.id);
  assert.equal(trackedBooking.calendar_added_at, calendarSelection.data.calendarAddedAt);
  const studentBookings = await api('GET', `/api/classes/bookings?phone=${encodeURIComponent('+233 20 000 0083')}&name=${encodeURIComponent('Reschedule Student')}&campus=${encodeURIComponent(campus)}`);
  const historicalBooking = studentBookings.data.bookings.find((booking) => booking.status === 'schedule_changed');
  assert.ok(historicalBooking);
  assert.equal(historicalBooking.start_time_snapshot, '10:00');
  assert.equal(historicalBooking.attendance, null);
  assert.equal(historicalBooking.notifications[0].status, 'skipped');

  const secondBooking = await api('POST', '/api/classes/bookings', {
    classId,
    classDate: nextWeekdayDate(weekday, dateOffset(futureDate, 1)),
    name: 'Reschedule Student',
    phone: '+233 20 000 0083',
    campus
  });
  assert.equal(secondBooking.status, 201);
  const cancelled = await api('POST', '/api/admin/classes', {
    ...changed.data.class,
    status: 'cancelled'
  }, SUPER_ADMIN_HEADERS);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.notifications.skipped, 2);
  const afterCancellation = await api('GET', `/api/classes/bookings?phone=${encodeURIComponent('+233 20 000 0083')}&name=${encodeURIComponent('Reschedule Student')}&campus=${encodeURIComponent(campus)}`);
  assert.ok(afterCancellation.data.bookings.some((booking) => booking.status === 'class_cancelled'));

  const closedClassBooking = await api('POST', '/api/classes/bookings', {
    classId,
    classDate: nextWeekdayDate(weekday, dateOffset(futureDate, 8)),
    name: 'Reschedule Student',
    phone: '+233 20 000 0083',
    campus
  });
  assert.equal(closedClassBooking.status, 400);

  const reopened = await api('POST', '/api/admin/classes', {
    ...cancelled.data.class,
    status: 'published'
  }, SUPER_ADMIN_HEADERS);
  assert.equal(reopened.status, 200);
  const rebookedAfterCancellation = await api('POST', '/api/classes/bookings', {
    classId,
    classDate: futureDate,
    name: 'Reschedule Student',
    phone: '+233 20 000 0083',
    campus
  });
  assert.equal(rebookedAfterCancellation.status, 201);
});

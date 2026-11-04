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

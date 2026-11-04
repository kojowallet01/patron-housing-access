import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendBulk } from '../sms.js';

test('bulk SMS personalizes name and campus without calling the provider', async () => {
  const envKeys = ['SMS_ENABLED', 'SMS_PROVIDER', 'SMS_API_KEY', 'SMS_SENDER_ID'];
  const oldEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const requests = [];

  process.env.SMS_ENABLED = 'true';
  process.env.SMS_PROVIDER = 'arkesel';
  process.env.SMS_API_KEY = 'test-key';
  process.env.SMS_SENDER_ID = 'AIFSP';
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response('{"status":"success"}', { status: 200 });
  };

  try {
    const result = await sendBulk({
      recipients: [{ name: 'Ama', phone: '0244000111' }, { name: 'Kojo', phone: '0244000222' }],
      message: 'Hello {name}, visit {campus} soon.',
      templateValues: { campus: 'TESANO CAMPUS' }
    });

    assert.equal(result.sent, 2);
    assert.equal(requests[0].message, 'Hello Ama, visit TESANO CAMPUS soon.');
    assert.equal(requests[1].message, 'Hello Kojo, visit TESANO CAMPUS soon.');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      if (oldEnv[key] === undefined) delete process.env[key];
      else process.env[key] = oldEnv[key];
    }
  }
});

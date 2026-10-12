#!/usr/bin/env node
/**
 * Smoke test for per-manager boards, login, logout, PINs and lockout.
 *
 *   BASE_URL=https://<preview>.vercel.app DAYSLEFT_API_KEY=<key> node scripts/auth-smoke.mjs
 *
 * Needs Node 18+ (global fetch). No dependencies.
 *
 * It only touches these Redis keys (never a real manager's board, never the
 * legacy daysleft:tasks / daysleft:deleted):
 *   daysleft:board:{smoketest-a,smoketest-b,test,pin,session,sessionver,loginfail}:tasks
 *   and :deleted, daysleft:pin:* and daysleft:sessionver:* for the users smoketest-a,
 *   smoketest-b, tasks and deleted, daysleft:session:*, daysleft:loginfail:*
 * The users "tasks" and "deleted" exist only for the key-collision checks (old board
 * keys daysleft:{board}:tasks|deleted would have hit their login keys). Their PINs
 * are random and never printed.
 * Each run adds about 8 failed logins to your IP's counter (limit 50 per 15 min).
 * On a deployment protected by Vercel Authentication, also set
 * VERCEL_BYPASS=<Protection Bypass for Automation secret>.
 */

const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.DAYSLEFT_API_KEY || '';
if (!BASE_URL || !API_KEY) {
  console.error('Set BASE_URL and DAYSLEFT_API_KEY. See the header of this file.');
  process.exit(2);
}

const A = 'smoketest-a';
const B = 'smoketest-b';
const randomPin = () => String(Math.floor(100000 + Math.random() * 900000));
const runId = Date.now().toString(36);

let failures = 0;
let passes = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passes++;
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function call(method, path, { auth, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (process.env.VERCEL_BYPASS) headers['x-vercel-protection-bypass'] = process.env.VERCEL_BYPASS;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json };
}

const setPin = (username, pin, auth = API_KEY) => call('PUT', '/api/pin', { auth, body: { username, pin } });
const login = (username, pin) => call('POST', '/api/login', { body: { username, pin } });
const ids = (r) => (Array.isArray(r.json?.tasks) ? r.json.tasks.map((t) => t.id) : []);
const task = (id, title) => ({ id, title, date: '2030-01-01', time: '', completed: false });

async function main() {
  console.log(`Target: ${BASE_URL}\n`);

  console.log('PIN validation (PUT /api/pin)');
  check('no API key -> 401', (await setPin(A, '1234', '')).status === 401);
  check('wrong API key -> 401', (await setPin(A, '1234', 'not-the-key')).status === 401);
  for (const bad of ['123', '1234567', '12a4', ' 1234', '']) {
    check(`pin ${JSON.stringify(bad)} -> 400`, (await setPin(A, bad)).status === 400);
  }
  check('pin as a number -> 400', (await setPin(A, 1234)).status === 400);
  for (const bad of ['Upper', 'has space', 'x'.repeat(33), '', 'a.b']) {
    check(`username ${JSON.stringify(bad)} -> 400`, (await setPin(bad, '1234')).status === 400);
  }
  const pinA = randomPin();
  const pinB = randomPin();
  const setA = await setPin(A, pinA);
  check('set PIN for A -> 200', setA.status === 200, setA.text);
  check('response contains no PIN/hash', !setA.text.includes(pinA) && !/hash|salt/.test(setA.text));
  check('set 4-digit PIN for B -> 200', (await setPin(B, pinB.slice(0, 4))).status === 200);

  console.log('\nLogin');
  const okA = await login(A, pinA);
  check('A correct PIN -> 200 + token', okA.status === 200 && /^[a-f0-9]{64}$/.test(okA.json?.token ?? ''), okA.text);
  const okB = await login(B, pinB.slice(0, 4));
  check('B correct PIN -> 200 + token', okB.status === 200 && !!okB.json?.token);
  const tokenA = okA.json?.token;
  const tokenB = okB.json?.token;

  const wrongPin = await login(A, pinA === '000000' ? '111111' : '000000');
  const unknown = await login(`nouser-${runId}`.slice(0, 32), '1234');
  const badFormat = await login('Not Valid!', 'abcd');
  check('wrong PIN -> 401', wrongPin.status === 401);
  check('unknown user -> 401', unknown.status === 401);
  check('invalid format -> 401', badFormat.status === 401);
  check(
    'identical error bodies',
    wrongPin.text === unknown.text && unknown.text === badFormat.text,
    `${wrongPin.text} | ${unknown.text} | ${badFormat.text}`
  );
  check('error text is "Invalid username or PIN"', wrongPin.json?.error === 'Invalid username or PIN');
  // After the one wrong PIN above, a correct login resets A's failure counter.
  check('A logs in again (counter reset)', (await login(A, pinA)).status === 200);

  console.log('\nBrowser GET/PUT need a session');
  check('GET without auth -> 401', (await call('GET', '/api/tasks')).status === 401);
  check('GET with bogus token -> 401', (await call('GET', '/api/tasks', { auth: 'f'.repeat(64) })).status === 401);
  check('PUT without auth -> 401', (await call('PUT', '/api/tasks', { body: { tasks: [] } })).status === 401);
  check('PUT with API key -> 401', (await call('PUT', '/api/tasks', { auth: API_KEY, body: { tasks: [] } })).status === 401);

  console.log('\nBoard isolation (A vs B)');
  const tA = `smoke-a-${runId}`;
  const tB = `smoke-b-${runId}`;
  const putA = await call('PUT', '/api/tasks', { auth: tokenA, body: { tasks: [task(tA, 'A only')] } });
  check('A PUT own board -> 200', putA.status === 200, putA.text);
  const putB = await call('PUT', '/api/tasks?board=smoketest-a', { auth: tokenB, body: { tasks: [task(tB, 'B only')] } });
  check('B PUT (with ?board=A in URL) -> 200', putB.status === 200, putB.text);
  const getA = await call('GET', '/api/tasks', { auth: tokenA });
  const getB = await call('GET', '/api/tasks?board=smoketest-a', { auth: tokenB });
  check('A sees its task, not B\'s', ids(getA).includes(tA) && !ids(getA).includes(tB), getA.text);
  check('B (even with ?board=A) sees only B', ids(getB).includes(tB) && !ids(getB).includes(tA), getB.text);
  const keyGetA = await call('GET', `/api/tasks?board=${A}`, { auth: API_KEY });
  check('API key GET ?board=A sees A', ids(keyGetA).includes(tA) && !ids(keyGetA).includes(tB));

  console.log('\nHermes POST/DELETE');
  check('POST without key -> 401', (await call('POST', '/api/tasks', { body: { title: 'x', date: '2030-01-01' } })).status === 401);
  check('POST with session token -> 401', (await call('POST', '/api/tasks', { auth: tokenA, body: { title: 'x', date: '2030-01-01' } })).status === 401);
  check('POST invalid board -> 400', (await call('POST', '/api/tasks', { auth: API_KEY, body: { title: 'x', date: '2030-01-01', board: 'Bad Board' } })).status === 400);

  const ext = `smoke-ext-${runId}`;
  const postA = await call('POST', '/api/tasks', { auth: API_KEY, body: { title: 'Hermes to A', date: '2030-01-02', board: A, externalId: ext } });
  check('POST board=A -> 201', postA.status === 201, postA.text);
  check('stored task has no "board" field', postA.json?.task && !('board' in postA.json.task));
  const dupA = await call('POST', '/api/tasks', { auth: API_KEY, body: { title: 'again', date: '2030-01-02', board: A, externalId: ext } });
  check('same externalId on A -> duplicate', dupA.status === 200 && dupA.json?.duplicate === true);
  const postB = await call('POST', '/api/tasks', { auth: API_KEY, body: { title: 'Hermes to B', date: '2030-01-02', board: B, externalId: ext } });
  check('same externalId on B -> new task (per board)', postB.status === 201, postB.text);
  check('A token sees the Hermes task', ids(await call('GET', '/api/tasks', { auth: tokenA })).includes(postA.json?.task?.id));
  check('B token does not see A\'s Hermes task', !ids(await call('GET', '/api/tasks', { auth: tokenB })).includes(postA.json?.task?.id));

  const extTest = `smoke-test-${runId}`;
  const postNoBoard = await call('POST', '/api/tasks', { auth: API_KEY, body: { title: 'No board', date: '2030-01-03', externalId: extTest } });
  check('POST without board -> 201', postNoBoard.status === 201, postNoBoard.text);
  const testBoard = await call('GET', '/api/tasks', { auth: API_KEY });
  check('API key GET without board = "test" board, has it', ids(testBoard).includes(postNoBoard.json?.task?.id));
  check('it is not on A', !ids(await call('GET', '/api/tasks', { auth: tokenA })).includes(postNoBoard.json?.task?.id));

  check('DELETE without key -> 401', (await call('DELETE', `/api/tasks/${ext}?board=${A}`)).status === 401);
  check('DELETE invalid board -> 400', (await call('DELETE', `/api/tasks/${ext}?board=NOPE!`, { auth: API_KEY })).status === 400);
  const delA = await call('DELETE', `/api/tasks/${ext}?board=${A}`, { auth: API_KEY });
  check('DELETE externalId on A -> 200', delA.status === 200, delA.text);
  check('B\'s task with the same externalId survives', ids(await call('GET', '/api/tasks', { auth: tokenB })).includes(postB.json?.task?.id));
  const delB = await call('DELETE', `/api/tasks/${postB.json?.task?.id}?board=${B}`, { auth: API_KEY });
  check('DELETE by id on B -> 200', delB.status === 200);
  const delTest = await call('DELETE', `/api/tasks/${extTest}`, { auth: API_KEY });
  check('DELETE without board -> removes from "test"', delTest.status === 200, delTest.text);
  check('DELETE missing id -> 404', (await call('DELETE', `/api/tasks/${extTest}`, { auth: API_KEY })).status === 404);

  console.log('\nLockout and PIN reset');
  const wrong = pinA === '000000' ? '111111' : '000000';
  for (let i = 1; i <= 5; i++) await login(A, wrong);
  const lockedRight = await login(A, pinA);
  check('after 5 failures, correct PIN -> 401', lockedRight.status === 401);
  check('locked error is identical', lockedRight.text === wrongPin.text, lockedRight.text);
  check('other user B still logs in', (await login(B, pinB.slice(0, 4))).status === 200);
  const newPinA = randomPin();
  check('PUT /api/pin resets A -> 200', (await setPin(A, newPinA)).status === 200);
  check('A logs in right away with the new PIN', (await login(A, newPinA)).status === 200);
  check('old PIN no longer works', (await login(A, pinA)).status === 401);

  console.log('\nPIN reset ends existing sessions');
  // tokenA was issued before the reset above; any session from before a PIN set must be dead.
  check('A\'s pre-reset token: GET -> 401', (await call('GET', '/api/tasks', { auth: tokenA })).status === 401);
  check('A\'s pre-reset token: PUT -> 401', (await call('PUT', '/api/tasks', { auth: tokenA, body: { tasks: [] } })).status === 401);
  check('B\'s token still works (GET)', (await call('GET', '/api/tasks', { auth: tokenB })).status === 200);
  const freshA = await login(A, newPinA);
  check('A logs in again -> new token works', freshA.status === 200 &&
    (await call('GET', '/api/tasks', { auth: freshA.json?.token })).status === 200);
  check('re-setting the same PIN also ends sessions', (await setPin(A, newPinA)).status === 200 &&
    (await call('GET', '/api/tasks', { auth: freshA.json?.token })).status === 401);
  check('B\'s token still works after the second reset', (await call('GET', '/api/tasks', { auth: tokenB })).status === 200);
  const cleanupA = (await login(A, newPinA)).json?.token;

  console.log('\nLogout ends only the caller\'s own session');
  const s1 = (await login(A, newPinA)).json?.token;
  const s2 = (await login(A, newPinA)).json?.token;
  check('token works before logout', (await call('GET', '/api/tasks', { auth: s1 })).status === 200);
  check('logout without token -> 401', (await call('POST', '/api/logout')).status === 401);
  check('logout with malformed token -> 401', (await call('POST', '/api/logout', { auth: 'not-a-token' })).status === 401);
  const out = await call('POST', '/api/logout', { auth: s1 });
  check('logout -> 200', out.status === 200, out.text);
  check('response contains no token', !out.text.includes(s1));
  check('same token: GET -> 401', (await call('GET', '/api/tasks', { auth: s1 })).status === 401);
  check('same token: PUT -> 401', (await call('PUT', '/api/tasks', { auth: s1, body: { tasks: [] } })).status === 401);
  check('logout again is harmless -> 200', (await call('POST', '/api/logout', { auth: s1 })).status === 200);
  check('A\'s other session still works', (await call('GET', '/api/tasks', { auth: s2 })).status === 200);
  check('B\'s session still works', (await call('GET', '/api/tasks', { auth: tokenB })).status === 200);
  check('cleanup session still works', (await call('GET', '/api/tasks', { auth: cleanupA })).status === 200);
  await call('POST', '/api/logout', { auth: s2 });

  console.log('\nBoard names cannot touch login keys');
  // With the old layout, board "pin" wrote daysleft:pin:tasks (user "tasks"'s PIN) and board
  // "sessionver" wrote daysleft:sessionver:tasks (user "tasks"'s session version), etc.
  const victims = {};
  for (const user of ['tasks', 'deleted']) {
    const pin = randomPin();
    check(`set PIN for user "${user}"`, (await setPin(user, pin)).status === 200);
    const r = await login(user, pin);
    check(`user "${user}" logs in`, r.status === 200);
    victims[user] = { pin, token: r.json?.token };
  }
  for (const board of ['pin', 'session', 'sessionver', 'loginfail']) {
    const ext = `smoke-collide-${board}-${runId}`;
    const p = await call('POST', '/api/tasks', { auth: API_KEY, body: { title: `on ${board}`, date: '2030-01-04', board, externalId: ext } });
    check(`POST to board "${board}" -> 201`, p.status === 201, p.text);
    check(`board "${board}" holds the task`, ids(await call('GET', `/api/tasks?board=${board}`, { auth: API_KEY })).includes(p.json?.task?.id));
    // DELETE writes both :tasks and :deleted for the board.
    check(`DELETE on board "${board}" -> 200`, (await call('DELETE', `/api/tasks/${ext}?board=${board}`, { auth: API_KEY })).status === 200);
  }
  for (const [user, v] of Object.entries(victims)) {
    check(`user "${user}": existing session still valid`, (await call('GET', '/api/tasks', { auth: v.token })).status === 200);
    const again = await login(user, v.pin);
    check(`user "${user}": PIN still works`, again.status === 200, again.text);
    await call('POST', '/api/logout', { auth: v.token });
    await call('POST', '/api/logout', { auth: again.json?.token });
  }

  console.log('\nCleanup');
  check('A board emptied', (await call('PUT', '/api/tasks', { auth: cleanupA, body: { tasks: [] } })).status === 200);
  check('B board emptied', (await call('PUT', '/api/tasks', { auth: tokenB, body: { tasks: [] } })).status === 200);
  await call('POST', '/api/logout', { auth: cleanupA });
  await call('POST', '/api/logout', { auth: tokenB });

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('Smoke test crashed:', e instanceof Error ? e.message : e);
  process.exit(1);
});

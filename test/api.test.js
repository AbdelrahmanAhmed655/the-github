'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handler, store } = require('../src/app');

// Bind to port 0 so the OS picks a free port — a hardcoded port is the classic
// way an integration test flakes on a shared CI runner.
let server;
let base;

test.before(async () => {
  server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  // undici keeps sockets alive, and server.close() alone waits for them —
  // which is how an integration test ends up hanging a CI job forever.
  server.closeAllConnections();
  server.close();
});

test.beforeEach(() => store.reset());

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('GET /health reports ok', async () => {
  const { status, body } = await call('GET', '/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.node, 'string');
});

test('GET / serves the web page', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /<title>/);
});

test('GET /api/calc computes a result', async () => {
  const { status, body } = await call('GET', '/api/calc?op=multiply&a=6&b=7');
  assert.equal(status, 200);
  assert.equal(body.result, 42);
});

test('GET /api/calc returns 400 on a bad operation', async () => {
  const { status, body } = await call('GET', '/api/calc?op=nope&a=1&b=2');
  assert.equal(status, 400);
  assert.match(body.error, /unknown operation/);
});

test('todos can be created, listed, toggled and deleted', async () => {
  const created = await call('POST', '/api/todos', { title: 'read the docs' });
  assert.equal(created.status, 201);
  const { id } = created.body.todo;

  const listed = await call('GET', '/api/todos');
  assert.equal(listed.body.todos.length, 1);

  const toggled = await call('POST', `/api/todos/${id}/toggle`);
  assert.equal(toggled.body.todo.done, true);

  const deleted = await call('DELETE', `/api/todos/${id}`);
  assert.equal(deleted.status, 200);
  assert.equal((await call('GET', '/api/todos')).body.todos.length, 0);
});

test('POST /api/todos rejects a missing title', async () => {
  const { status, body } = await call('POST', '/api/todos', { title: '' });
  assert.equal(status, 400);
  assert.match(body.error, /title is required/);
});

test('unknown routes return 404', async () => {
  const { status } = await call('GET', '/api/nothing-here');
  assert.equal(status, 404);
});

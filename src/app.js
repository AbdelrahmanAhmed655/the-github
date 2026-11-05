'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { calculate } = require('./lib/calc');
const { TodoStore } = require('./lib/todos');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const START_TIME = Date.now();

const store = new TodoStore();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function serveIndex(res) {
  fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err, data) => {
    if (err) {
      json(res, 500, { error: 'could not read index.html' });
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': data.length,
    });
    res.end(data);
  });
}

// The whole API in one place. `handler` is exported separately from the server so
// tests can drive it without binding a port in CI.
async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = `${req.method} ${url.pathname}`;

  try {
    if (route === 'GET /' || route === 'GET /index.html') {
      return serveIndex(res);
    }

    if (route === 'GET /health') {
      return json(res, 200, {
        status: 'ok',
        uptimeSeconds: Math.round((Date.now() - START_TIME) / 1000),
        version: process.env.APP_VERSION || 'dev',
        commit: process.env.GIT_COMMIT || 'local',
        node: process.version,
      });
    }

    if (route === 'GET /api/calc') {
      const op = url.searchParams.get('op') || 'add';
      const a = Number(url.searchParams.get('a'));
      const b = Number(url.searchParams.get('b'));
      return json(res, 200, { op, a, b, result: calculate(op, a, b) });
    }

    if (route === 'GET /api/todos') {
      return json(res, 200, { todos: store.list() });
    }

    if (route === 'POST /api/todos') {
      const body = await readBody(req);
      return json(res, 201, { todo: store.add(body.title) });
    }

    const toggleMatch = url.pathname.match(/^\/api\/todos\/(\d+)\/toggle$/);
    if (req.method === 'POST' && toggleMatch) {
      const todo = store.toggle(toggleMatch[1]);
      return todo
        ? json(res, 200, { todo })
        : json(res, 404, { error: 'todo not found' });
    }

    const idMatch = url.pathname.match(/^\/api\/todos\/(\d+)$/);
    if (req.method === 'DELETE' && idMatch) {
      return store.remove(idMatch[1])
        ? json(res, 200, { deleted: Number(idMatch[1]) })
        : json(res, 404, { error: 'todo not found' });
    }

    return json(res, 404, { error: `no route for ${route}` });
  } catch (err) {
    return json(res, 400, { error: err.message });
  }
}

module.exports = { handler, store };

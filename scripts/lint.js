#!/usr/bin/env node
'use strict';

// A tiny stand-in for ESLint so the `lint` job in CI has something real to run
// without pulling in dependencies. Swap it for ESLint whenever you like.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// This file is the linter, so it is not in its own scope — a rule like the
// `debugger` check below would otherwise match the rule's own source.
const ROOTS = ['src', 'test'];
const problems = [];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

const files = ROOTS.filter((dir) => fs.existsSync(dir)).flatMap(walk);

for (const file of files) {
  // 1. Does it even parse?
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    problems.push(`${file}: syntax error\n${err.stderr.toString().trim()}`);
    continue;
  }

  // 2. A few style rules worth failing a build over.
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (/\s+$/.test(line)) {
      problems.push(`${at}: trailing whitespace`);
    }
    if (line.includes('\t')) {
      problems.push(`${at}: tab character — use spaces`);
    }
    if (line.length > 100) {
      problems.push(`${at}: line is ${line.length} chars (max 100)`);
    }
    if (/\bdebugger\b/.test(line)) {
      problems.push(`${at}: leftover debugger statement`);
    }
  });
}

console.log(`linted ${files.length} file(s)`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:`);
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  process.exit(1);
}

console.log('no problems found');

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../src/lib/calc');

test('adds two numbers', () => {
  assert.equal(calculate('add', 2, 3), 5);
});

test('subtracts, multiplies and divides', () => {
  assert.equal(calculate('subtract', 9, 4), 5);
  assert.equal(calculate('multiply', 3, 4), 12);
  assert.equal(calculate('divide', 10, 4), 2.5);
});

test('rejects division by zero', () => {
  assert.throws(() => calculate('divide', 1, 0), /cannot divide by zero/);
});

test('rejects an unknown operation', () => {
  assert.throws(() => calculate('power', 2, 8), /unknown operation/);
});

test('rejects non-numeric operands', () => {
  assert.throws(() => calculate('add', Number('abc'), 1), /finite numbers/);
});

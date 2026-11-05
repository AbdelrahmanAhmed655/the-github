'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TodoStore } = require('../src/lib/todos');

test('starts empty', () => {
  assert.deepEqual(new TodoStore().list(), []);
});

test('adds todos with incrementing ids', () => {
  const store = new TodoStore();
  assert.deepEqual(store.add('learn jobs'), { id: 1, title: 'learn jobs', done: false });
  assert.equal(store.add('learn runners').id, 2);
  assert.equal(store.list().length, 2);
});

test('trims the title and rejects an empty one', () => {
  const store = new TodoStore();
  assert.equal(store.add('  spaced  ').title, 'spaced');
  assert.throws(() => store.add('   '), /title is required/);
});

test('toggles and removes', () => {
  const store = new TodoStore();
  const { id } = store.add('learn steps');
  assert.equal(store.toggle(id).done, true);
  assert.equal(store.toggle(id).done, false);
  assert.equal(store.toggle(999), null);
  assert.equal(store.remove(id), true);
  assert.equal(store.remove(id), false);
});

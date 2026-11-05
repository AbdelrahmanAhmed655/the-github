'use strict';

// In-memory store. Nothing is persisted, so every CI run starts from a clean slate
// just like every GitHub Actions job starts on a clean runner.

class TodoStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.items = new Map();
    this.nextId = 1;
  }

  list() {
    return [...this.items.values()];
  }

  add(title) {
    const trimmed = typeof title === 'string' ? title.trim() : '';
    if (!trimmed) {
      throw new Error('title is required');
    }
    const todo = { id: this.nextId++, title: trimmed, done: false };
    this.items.set(todo.id, todo);
    return todo;
  }

  toggle(id) {
    const todo = this.items.get(Number(id));
    if (!todo) {
      return null;
    }
    todo.done = !todo.done;
    return todo;
  }

  remove(id) {
    return this.items.delete(Number(id));
  }
}

module.exports = { TodoStore };

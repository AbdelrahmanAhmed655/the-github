'use strict';

// Pure functions — easy to unit test, which is the point of the `test` job in CI.

const OPERATIONS = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => {
    if (b === 0) {
      throw new Error('cannot divide by zero');
    }
    return a / b;
  },
};

function calculate(op, a, b) {
  const fn = OPERATIONS[op];
  if (!fn) {
    throw new Error(`unknown operation: ${op}`);
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('both operands must be finite numbers');
  }
  return fn(a, b);
}

module.exports = { calculate, OPERATIONS };

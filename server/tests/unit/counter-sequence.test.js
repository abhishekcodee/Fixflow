import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Counter, getNextComplaintNumber } from '../../src/models/Counter.js';

describe('Counter & Sequence Generation Unit Tests', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('should generate complaint numbers formatted as FIX-YYYYMM-XXXX', async () => {
    let mockSeq = 0;
    mock.method(Counter, 'findOneAndUpdate', async () => {
      mockSeq += 1;
      return { seq: mockSeq };
    });

    const number1 = await getNextComplaintNumber();
    const number2 = await getNextComplaintNumber();

    const now = new Date();
    const expectedPrefix = `FIX-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    assert.ok(number1.startsWith(expectedPrefix));
    assert.strictEqual(number1.endsWith('0001'), true);

    assert.ok(number2.startsWith(expectedPrefix));
    assert.strictEqual(number2.endsWith('0002'), true);

    assert.notStrictEqual(number1, number2);
  });

  it('should generate collision-safe numbers if database counter throws an error', async () => {
    mock.method(Counter, 'findOneAndUpdate', async () => {
      throw new Error('Database temporarily unavailable');
    });

    const number1 = await getNextComplaintNumber();
    const number2 = await getNextComplaintNumber();

    assert.ok(number1.startsWith('FIX-'));
    assert.ok(number2.startsWith('FIX-'));
    assert.notStrictEqual(number1, number2);
  });
});

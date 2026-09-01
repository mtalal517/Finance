import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addMonthsToDate } from '../lib/finance/dates';

/**
 * Date arithmetic is string maths on `YYYY-MM-DD` throughout the app, so these
 * tests are about the awkward months rather than about `Date`.
 */
describe('adding months to a date', () => {
  it('keeps the day of the month when the next month is long enough', () => {
    assert.equal(addMonthsToDate('2026-09-05', 1), '2026-10-05');
  });

  it('clamps to the last day when the target month is shorter', () => {
    assert.equal(addMonthsToDate('2026-01-31', 1), '2026-02-28');
  });

  it('clamps to the 29th in a leap year', () => {
    assert.equal(addMonthsToDate('2028-01-31', 1), '2028-02-29');
  });

  it('rolls over into the next year', () => {
    assert.equal(addMonthsToDate('2026-12-15', 1), '2027-01-15');
  });

  it('advances a quarter and a year in one step', () => {
    assert.equal(addMonthsToDate('2026-09-05', 3), '2026-12-05');
    assert.equal(addMonthsToDate('2026-09-05', 12), '2027-09-05');
  });

  it('goes backwards for a negative delta', () => {
    assert.equal(addMonthsToDate('2026-03-31', -1), '2026-02-28');
  });
});

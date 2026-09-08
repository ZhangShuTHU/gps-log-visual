import { describe, expect, it } from 'vitest';
import { formatLocalSolarTime, formatUtcTime } from './solar-time.js';

describe('solar time utilities', () => {
  const utcNoon = new Date('2026-08-30T12:00:00Z');

  it('formats the scene clock explicitly as UTC', () => {
    expect(formatUtcTime(utcNoon)).toBe('12:00 UTC');
  });

  it('derives local solar time from longitude', () => {
    expect(formatLocalSolarTime(utcNoon, 120)).toBe('20:00');
    expect(formatLocalSolarTime(utcNoon, -75)).toBe('07:00');
  });

  it('handles invalid input without leaking NaN into the interface', () => {
    expect(formatUtcTime(new Date('invalid'))).toBe('--:-- UTC');
    expect(formatLocalSolarTime(utcNoon, Number.NaN)).toBe('--:--');
  });
});

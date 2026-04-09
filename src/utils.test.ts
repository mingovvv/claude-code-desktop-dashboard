import { describe, it, expect } from 'vitest';
import { fmtTokens } from './utils';

describe('fmtTokens', () => {
  it('formats millions', () => {
    expect(fmtTokens(1_500_000)).toBe('1.5M');
  });

  it('formats thousands', () => {
    expect(fmtTokens(3_200)).toBe('3.2K');
  });

  it('returns plain number below 1000', () => {
    expect(fmtTokens(999)).toBe('999');
    expect(fmtTokens(0)).toBe('0');
  });
});

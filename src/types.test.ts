import { describe, it, expect } from 'vitest';
import { calcCost, getProjectName, PRICING } from './types';

describe('calcCost', () => {
  const usage = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

  it('calculates cost for exact model name', () => {
    const cost = calcCost(usage, 'claude-sonnet-4-6');
    const expected = (1000 * PRICING['claude-sonnet-4-6'].input + 500 * PRICING['claude-sonnet-4-6'].output) / 1_000_000;
    expect(cost).toBeCloseTo(expected);
  });

  it('strips date suffix from model name', () => {
    const withSuffix = calcCost(usage, 'claude-haiku-4-5-20251001');
    const withoutSuffix = calcCost(usage, 'claude-haiku-4-5');
    expect(withSuffix).toBeCloseTo(withoutSuffix);
  });

  it('falls back to default for unknown model', () => {
    const cost = calcCost(usage, 'claude-unknown-9-9');
    const expected = (1000 * PRICING['default'].input + 500 * PRICING['default'].output) / 1_000_000;
    expect(cost).toBeCloseTo(expected);
  });

  it('includes cache costs', () => {
    const usageWithCache = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1000, cache_read_input_tokens: 2000 };
    const cost = calcCost(usageWithCache, 'claude-sonnet-4-6');
    const p = PRICING['claude-sonnet-4-6'];
    const expected = (1000 * p.cacheWrite + 2000 * p.cacheRead) / 1_000_000;
    expect(cost).toBeCloseTo(expected);
  });
});

describe('getProjectName', () => {
  it('extracts last segment from Unix path', () => {
    expect(getProjectName('/home/user/projects/my-app')).toBe('my-app');
  });

  it('extracts last segment from Windows path', () => {
    expect(getProjectName('C:\\Users\\user\\Desktop\\my-project')).toBe('my-project');
  });

  it('returns Unknown for empty string', () => {
    expect(getProjectName('')).toBe('Unknown');
  });

  it('handles path with trailing slash', () => {
    expect(getProjectName('/home/user/projects/app/')).toBe('app');
  });
});

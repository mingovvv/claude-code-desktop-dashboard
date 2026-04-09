import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseSessionFile } from './parser';

const tmpDir = path.join(os.tmpdir(), 'parser-test-' + process.pid);

function writeTmpJsonl(name: string, lines: object[]): string {
  fs.mkdirSync(tmpDir, { recursive: true });
  const p = path.join(tmpDir, name + '.jsonl');
  fs.writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n'));
  return p;
}

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('parseSessionFile — costUSD', () => {
  it('uses costUSD directly when present and > 0', async () => {
    const filePath = writeTmpJsonl('session-with-cost', [
      { type: 'user', timestamp: '2024-01-01T00:00:00Z', role: 'user' },
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:01Z',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
        costUSD: 0.001234,
      },
    ]);

    const result = await parseSessionFile(filePath, 'test-project');
    expect(result).not.toBeNull();
    // Should use costUSD (0.001234), not the calcCost value
    expect(result!.totalCost).toBeCloseTo(0.001234, 6);
  });

  it('falls back to calcCost when costUSD is absent', async () => {
    const filePath = writeTmpJsonl('session-no-cost', [
      { type: 'user', timestamp: '2024-01-01T00:00:00Z', role: 'user' },
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:01Z',
        message: {
          model: 'default',
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
        // no costUSD field
      },
    ]);

    const result = await parseSessionFile(filePath, 'test-project');
    expect(result).not.toBeNull();
    // Should use calcCost, which for 'default' model returns some value > 0
    expect(result!.totalCost).toBeGreaterThan(0);
  });

  it('falls back to calcCost when costUSD is 0', async () => {
    const filePath = writeTmpJsonl('session-zero-cost', [
      { type: 'user', timestamp: '2024-01-01T00:00:00Z', role: 'user' },
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:01Z',
        message: {
          model: 'default',
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
        costUSD: 0,
      },
    ]);

    const result = await parseSessionFile(filePath, 'test-project');
    expect(result).not.toBeNull();
    // costUSD=0 → should fall back to calcCost → some value > 0
    expect(result!.totalCost).toBeGreaterThan(0);
  });

  it('returns null for empty session', async () => {
    const filePath = writeTmpJsonl('session-empty', [
      { type: 'user', timestamp: '2024-01-01T00:00:00Z', role: 'user' },
    ]);

    const result = await parseSessionFile(filePath, 'test-project');
    expect(result).toBeNull();
  });
});

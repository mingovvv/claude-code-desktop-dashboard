import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import type { TokenUsage, SessionStats, AggregatedStats } from '../types';
import { calcCost, getProjectName } from '../types';

// ─── Raw JSONL line shape ─────────────────────────────────────────────────────
export interface RawLine {
  type?: string;
  message?: {
    usage?: Partial<TokenUsage>;
    model?: string;
    content?: unknown;
  };
  usage?: Partial<TokenUsage>;
  model?: string;
  costUSD?: number;
  timestamp?: string;
  session_id?: string;
  role?: string;
}

// ─── Parse a single .jsonl session file ──────────────────────────────────────
export async function parseSessionFile(
  filePath: string,
  projectPath: string,
): Promise<SessionStats | null> {
  return new Promise((resolve) => {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheWrite = 0;
    let totalCacheRead = 0;
    let totalCost = 0;
    let messageCount = 0;
    let userMessageCount = 0;
    let toolCallCount = 0;
    const models = new Set<string>();
    let firstTimestamp = '';
    let lastTimestamp = '';

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const obj: RawLine = JSON.parse(line);

        if (obj.timestamp) {
          if (!firstTimestamp || obj.timestamp < firstTimestamp) firstTimestamp = obj.timestamp;
          if (!lastTimestamp || obj.timestamp > lastTimestamp) lastTimestamp = obj.timestamp;
        }

        if (obj.type === 'user' || obj.role === 'user') {
          userMessageCount++;
          messageCount++;
          return;
        }

        if (obj.type !== 'assistant') return;

        messageCount++;

        const usage: Partial<TokenUsage> = obj.message?.usage ?? obj.usage ?? {};
        const model: string = obj.message?.model ?? obj.model ?? 'default';

        const inp = usage.input_tokens ?? 0;
        const out = usage.output_tokens ?? 0;
        const cw  = usage.cache_creation_input_tokens ?? 0;
        const cr  = usage.cache_read_input_tokens ?? 0;

        if (inp + out + cw + cr === 0) return;

        totalInput      += inp;
        totalOutput     += out;
        totalCacheWrite += cw;
        totalCacheRead  += cr;

        if (typeof obj.costUSD === 'number' && obj.costUSD > 0) {
          totalCost += obj.costUSD;
        } else {
          totalCost += calcCost(
            { input_tokens: inp, output_tokens: out, cache_creation_input_tokens: cw, cache_read_input_tokens: cr },
            model,
          );
        }

        if (model) models.add(model);

        if (obj.message?.content && Array.isArray(obj.message.content)) {
          toolCallCount += (obj.message.content as Array<{ type: string }>)
            .filter((c) => c.type === 'tool_use').length;
        }
      } catch {
        // skip malformed lines
      }
    });

    rl.on('error', () => resolve(null));
    rl.on('close', () => {
      if (totalInput + totalOutput + totalCacheWrite + totalCacheRead === 0) {
        resolve(null);
        return;
      }

      const sessionId = path.basename(filePath, '.jsonl');
      resolve({
        sessionId,
        projectPath,
        projectName: getProjectName(projectPath),
        startTime: firstTimestamp || new Date(0).toISOString(),
        endTime: lastTimestamp || new Date(0).toISOString(),
        totalInput,
        totalOutput,
        totalCacheWrite,
        totalCacheRead,
        totalCost,
        messageCount,
        userMessageCount,
        toolCallCount,
        models: [...models],
      });
    });
  });
}

// ─── Empty stats sentinel ─────────────────────────────────────────────────────
export function emptyStats(): AggregatedStats {
  return {
    sessions: [],
    daily: [],
    projects: [],
    totalCost: 0,
    totalInput: 0,
    totalOutput: 0,
    totalCacheWrite: 0,
    totalCacheRead: 0,
    totalSessions: 0,
    totalMessages: 0,
    parseErrors: 0,
    lastUpdated: new Date().toISOString(),
  };
}

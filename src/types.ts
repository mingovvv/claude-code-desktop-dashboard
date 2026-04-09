export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface SessionMessage {
  type: 'user' | 'assistant';
  timestamp: string;
  sessionId: string;
  projectPath: string;
  usage?: TokenUsage;
  model?: string;
  requestId?: string;
}

export interface SessionStats {
  sessionId: string;
  projectPath: string;
  projectName: string;
  startTime: string;
  endTime: string;
  totalInput: number;
  totalOutput: number;
  totalCacheWrite: number;
  totalCacheRead: number;
  totalCost: number;
  messageCount: number;
  userMessageCount: number;
  toolCallCount: number;
  models: string[];
  firstUserMessage?: string;
}

export interface DailyStats {
  date: string;
  totalInput: number;
  totalOutput: number;
  totalCacheWrite: number;
  totalCacheRead: number;
  totalCost: number;
  messageCount: number;
  sessionCount: number;
}

export interface ProjectStats {
  projectPath: string;
  projectName: string;
  totalInput: number;
  totalOutput: number;
  totalCacheWrite: number;
  totalCacheRead: number;
  totalCost: number;
  sessionCount: number;
  messageCount: number;
  lastActive: string;
  models: Record<string, number>;
}

export interface AggregatedStats {
  sessions: SessionStats[];
  daily: DailyStats[];
  projects: ProjectStats[];
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  totalCacheWrite: number;
  totalCacheRead: number;
  totalSessions: number;
  totalMessages: number;
  parseErrors: number;
  lastUpdated: string;
}

export interface ActiveSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  startTime: string;
  currentInput: number;
  currentOutput: number;
  currentCacheWrite: number;
  currentCacheRead: number;
  currentCost: number;
  messageCount: number;
  lastMessageTime: string;
  burnRatePerMin: number;
  isIdle: boolean;
  recentUserMessages: string[];
}

export interface BudgetSettings {
  monthlyBudget: number;
  alertAt80: boolean;
  alertAt100: boolean;
  alert80Sent: boolean;
  alert100Sent: boolean;
  alertResetMonth: string;
}

export interface AppSettings {
  budget: BudgetSettings;
  sessionEndTimeoutMin: number;
}

export type CsvExportType = 'sessions' | 'daily';
export type CsvDateRange = 'thisMonth' | 'last3Months' | 'all';

export interface CsvExportRequest {
  type: CsvExportType;
  dateRange: CsvDateRange;
}

export interface CsvExportResult {
  cancelled: boolean;
  filePath?: string;
}

export const PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-opus-4-6':   { input: 15.0,  output: 75.0,  cacheWrite: 18.75, cacheRead: 1.5  },
  'claude-opus-4-5':   { input: 15.0,  output: 75.0,  cacheWrite: 18.75, cacheRead: 1.5  },
  'claude-sonnet-4-6': { input: 3.0,   output: 15.0,  cacheWrite: 3.75,  cacheRead: 0.3  },
  'claude-sonnet-4-5': { input: 3.0,   output: 15.0,  cacheWrite: 3.75,  cacheRead: 0.3  },
  'claude-haiku-4-5':  { input: 0.8,   output: 4.0,   cacheWrite: 1.0,   cacheRead: 0.08 },
  'claude-haiku-3-5':  { input: 0.25,  output: 1.25,  cacheWrite: 0.3,   cacheRead: 0.03 },
  'default':           { input: 3.0,   output: 15.0,  cacheWrite: 3.75,  cacheRead: 0.3  },
};

export function calcCost(usage: TokenUsage, model: string): number {
  const stripped = model.replace(/-\d{8}$/, '');
  const normalizedModel = PRICING[stripped] ? stripped : 'default';
  const price = PRICING[normalizedModel];
  return (
    (usage.input_tokens * price.input +
      usage.output_tokens * price.output +
      usage.cache_creation_input_tokens * price.cacheWrite +
      usage.cache_read_input_tokens * price.cacheRead) /
    1_000_000
  );
}

export function getProjectName(projectPath: string): string {
  if (!projectPath) return 'Unknown';
  const normalized = projectPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Unknown';
}

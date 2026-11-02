export interface AgyQuotaBucket {
  remaining_fraction?: number;
  remaining_amount?: number;
  reset_time?: string;
  reset_in_seconds?: number;
  disabled?: boolean;
  used_percentage?: number;
  resets_at?: number | string;
  cycle_mode?: string;
}

export interface AgyStatusData {
  product?: string;
  version?: string;
  conversation_id?: string;
  agent_state?: 'idle' | 'working' | 'tool_use' | 'reviewing' | 'error' | string;
  model: {
    id?: string;
    display_name: string;
    effort?: string;
  };
  context_window: {
    context_window_size: number;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
    total_input_tokens?: number;
    total_output_tokens?: number;
    current_usage?: unknown;
  };
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number | string };
    seven_day?: { used_percentage?: number; resets_at?: number | string };
    daily?: { used_percentage?: number; resets_at?: number | string };
  };
  quota?: Record<string, AgyQuotaBucket>;
  current_dir?: string;
  workspace?: {
    current_dir: string;
    project_dir?: string;
  };
  vcs?: {
    type?: string;
    branch?: string;
    dirty?: boolean;
  };
  artifact_count?: number;
  task_count?: number;
  subagents?: unknown[];
  plan_tier?: string;
  terminal_width?: number;
  cost?: {
    total_usd?: number;
    subagent_usd?: number;
    estimated?: number | boolean;
  };
  effort?: {
    level: string;
  };
}

export interface Block {
  id: string;
  priority: number;
  width: number;
  lines: string[];
}

export interface Segment {
  id: string;
  priority: number;
  render(data: AgyStatusData, allocWidth: number): Block;
  enabled(data: AgyStatusData): boolean;
}

export type BorderStyle = 'rounded' | 'square' | 'double' | 'thick' | 'ascii' | 'none';

export interface StatusBlocksConfig {
  segments?: string[];
  stackWithDefault?: boolean;
  remoteUsage?: boolean;
  border?: BorderStyle;
}

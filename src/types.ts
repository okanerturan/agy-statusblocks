export interface AgyStatusData {
  product?: string;
  conversation_id?: string;
  agent_state?: 'idle' | 'working' | 'tool_use' | 'reviewing' | 'error' | string;
  model: {
    id?: string;
    display_name: string;
  };
  context_window: {
    context_window_size: number;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
    total_input_tokens?: number;
    total_output_tokens?: number;
    current_usage?: unknown;
  };
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
    estimated?: number;
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
  render(data: AgyStatusData, availWidth: number): Block;
  enabled(data: AgyStatusData): boolean;
}

export interface StatusBlocksConfig {
  segments?: string[];
  stackWithDefault?: boolean;
}

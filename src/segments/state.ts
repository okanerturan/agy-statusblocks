import type { Segment } from '../types.js';
import { color, c, visibleLength } from '../colors.js';

const STATE_CONFIG: Record<string, { label: string; color: string }> = {
  idle: { label: '● IDLE', color: c.green },
  working: { label: '● RUNNING', color: c.geminiCyan },
  tool_use: { label: '● TOOL USE', color: c.yellow },
  reviewing: { label: '● REVIEW', color: c.purple },
  error: { label: '● ERROR', color: c.red },
};

export const stateSegment: Segment = {
  id: 'state',
  priority: 35,
  enabled: (data) => Boolean(data.agent_state || data.task_count || data.artifact_count || data.subagents?.length),
  render(data) {
    const rawState = (data.agent_state || 'idle').toLowerCase();
    const stateCfg = STATE_CONFIG[rawState] || { label: `● ${rawState.toUpperCase()}`, color: c.dim };

    const line1 = color(stateCfg.label, stateCfg.color, c.bold);

    // Line 2: orchestration telemetry
    const counters: string[] = [];
    if (data.task_count != null && data.task_count > 0) {
      counters.push(`${data.task_count} task${data.task_count === 1 ? '' : 's'}`);
    }
    if (data.subagents && data.subagents.length > 0) {
      counters.push(`${data.subagents.length} subagent${data.subagents.length === 1 ? '' : 's'}`);
    }
    if (data.artifact_count != null && data.artifact_count > 0) {
      counters.push(`${data.artifact_count} artifact${data.artifact_count === 1 ? '' : 's'}`);
    }

    const line2 = counters.length > 0
      ? color(counters.join(' · '), c.dim)
      : color('orchestration idle', c.dim);

    const lines = [line1, line2];
    const width = Math.max(...lines.map(visibleLength));
    return { id: 'state', priority: 35, width, lines };
  },
};

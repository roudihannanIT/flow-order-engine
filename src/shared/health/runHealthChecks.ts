import { withTimeout } from '../utils/withTimeout.js';

export type HealthCheck = () => Promise<void>;

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: Record<string, 'up' | 'down'>;
}

// Runs every check in parallel. A check that throws or exceeds the timeout is reported as "down".
export async function runHealthChecks(
  checks: Record<string, HealthCheck>,
  timeoutMs = 2000,
): Promise<HealthReport> {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, check]): Promise<[string, 'up' | 'down']> => {
      try {
        await withTimeout(check(), timeoutMs, name);
        return [name, 'up'];
      } catch {
        return [name, 'down'];
      }
    }),
  );

  return {
    status: entries.every(([, state]) => state === 'up') ? 'ok' : 'degraded',
    checks: Object.fromEntries(entries),
  };
}

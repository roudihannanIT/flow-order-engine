import { withTimeout } from '../utils/withTimeout.js';

export interface ShutdownStep {
  name: string;
  run: () => Promise<void>;
}

export async function runShutdownSteps(steps: ShutdownStep[], stepTimeoutMs = 5000): Promise<void> {
  for (const step of steps) {
    try {
      await withTimeout(step.run(), stepTimeoutMs, step.name);
      console.log(`Shutdown: ${step.name} stopped`);
    } catch (error) {
      console.error(`Shutdown: ${step.name} failed:`, error);
    }
  }
}

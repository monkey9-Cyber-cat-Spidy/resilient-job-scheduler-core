import { test, describe } from 'node:test';
import assert from 'node:assert';
import { JobScheduler } from '../src/jobScheduler.mjs';

describe('Resilient Job Scheduler Core Suite', () => {
  const scheduler = new JobScheduler(2000);

  test('should acquire lease and complete successful job execution', async () => {
    scheduler.scheduleJob('job-1', async () => 'PAYLOAD_PROCESSED');
    const res = await scheduler.acquireAndExecute('job-1', 'worker-A');
    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.result, 'PAYLOAD_PROCESSED');
  });

  test('should escalate to DEAD_LETTER when maximum retries exhausted', async () => {
    scheduler.scheduleJob('job-flaky', async () => { throw new Error('DB Connection Timeout'); }, 2);
    const r1 = await scheduler.acquireAndExecute('job-flaky', 'worker-B');
    assert.strictEqual(r1.status, 'RETRY_SCHEDULED');

    const r2 = await scheduler.acquireAndExecute('job-flaky', 'worker-C');
    assert.strictEqual(r2.status, 'DEAD_LETTER');
  });
});

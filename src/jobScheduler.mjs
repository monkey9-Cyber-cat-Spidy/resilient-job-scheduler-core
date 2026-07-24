export class JobScheduler {
  constructor(leaseTtlMs = 5000) {
    this.leaseTtlMs = leaseTtlMs;
    this.jobs = new Map();
  }

  scheduleJob(jobId, runFn, maxRetries = 3) {
    this.jobs.set(jobId, {
      id: jobId,
      runFn,
      maxRetries,
      retryCount: 0,
      leaseHolder: null,
      leaseExpiresAt: 0,
      status: 'PENDING'
    });
  }

  async acquireAndExecute(jobId, workerId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const now = Date.now();
    if (job.leaseHolder && job.leaseExpiresAt > now) {
      return { status: 'LOCKED', leaseHolder: job.leaseHolder };
    }

    // Acquire lease
    job.leaseHolder = workerId;
    job.leaseExpiresAt = now + this.leaseTtlMs;
    job.status = 'RUNNING';

    try {
      const result = await job.runFn();
      job.status = 'COMPLETED';
      return { status: 'SUCCESS', result };
    } catch (err) {
      job.retryCount++;
      if (job.retryCount >= job.maxRetries) {
        job.status = 'DEAD_LETTER';
        return { status: 'DEAD_LETTER', error: err.message };
      } else {
        job.status = 'PENDING';
        job.leaseHolder = null;
        return { status: 'RETRY_SCHEDULED', retryCount: job.retryCount };
      }
    }
  }
}

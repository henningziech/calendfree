// backend/src/jobs/queue.ts
import PgBoss from 'pg-boss';
import { config } from '../config.js';

let boss: PgBoss | null = null;

/** Initialize and start the pg-boss job queue. */
export async function startJobQueue(): Promise<PgBoss> {
  boss = new PgBoss({
    connectionString: config.DATABASE_URL,
    retryLimit: 3,
    retryDelay: 60, // 1 minute
    retryBackoff: true,
    expireInHours: 24,
    archiveCompletedAfterSeconds: 7 * 24 * 60 * 60, // 7 days
  });

  boss.on('error', (err) => {
    console.error('pg-boss error:', err);
  });

  await boss.start();
  return boss;
}

/** Get the pg-boss instance. */
export function getQueue(): PgBoss {
  if (!boss) throw new Error('Job queue not started. Call startJobQueue() first.');
  return boss;
}

/** Stop the job queue gracefully. */
export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10000 });
    boss = null;
  }
}

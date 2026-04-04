import { createApp } from './app';
import { config } from './config';
import { pool } from './db/connection';
import { startNotificationJob } from './jobs/notification.job';

const app = createApp();

async function start() {
  try {
    // Test DB connection
    await pool.query('SELECT 1');
    console.log('Database connected');

    app.listen(config.port, () => {
      console.log(`Bee Forest API running on http://localhost:${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      startNotificationJob();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

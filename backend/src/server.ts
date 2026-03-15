import { buildApp } from './app.js';
import { config } from './config.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Calendfree backend running on port ${config.PORT}`);
    app.log.info(`API docs: ${config.BACKEND_URL}/api/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

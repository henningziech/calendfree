import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Set environment before any backend imports — dummy values are fine since
// docgen mode skips all infrastructure that needs live connections.
process.env.NODE_ENV = 'docgen';
process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.GOOGLE_CLIENT_ID = 'dummy';
process.env.GOOGLE_CLIENT_SECRET = 'dummy';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback';
process.env.SESSION_SECRET = 'dummy-session-secret-at-least-32-chars!!';
process.env.ENCRYPTION_KEY = '0'.repeat(64);

async function main() {
  const { buildApp } = await import('../../backend/src/app.js');

  const app = await buildApp();
  await app.ready();

  const spec = app.swagger();

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(__dirname, '..', 'openapi');
  mkdirSync(outDir, { recursive: true });

  const outPath = resolve(outDir, 'calendfree.json');
  writeFileSync(outPath, JSON.stringify(spec, null, 2));

  console.log(`OpenAPI spec written to ${outPath}`);
  console.log(`  Paths: ${Object.keys(spec.paths || {}).length}`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});

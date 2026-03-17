// backend/src/routes/embed.ts
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function embedRoutes(app: FastifyInstance) {
  let embedScript: string;

  try {
    embedScript = readFileSync(join(__dirname, '../../..', 'embed', 'calendfree-embed.js'), 'utf-8');
  } catch {
    embedScript = '// Embed script not found';
  }

  /** GET /embed.js — Serve the embed widget script */
  app.get('/embed.js', {
    schema: {
      summary: 'Get embed widget script',
      description: 'Serves the JavaScript embed widget for integrating Calendfree booking into third-party websites.',
      tags: ['System'],
      security: [],
    },
  }, async (request, reply) => {
    reply
      .header('Content-Type', 'application/javascript')
      .header('Cache-Control', 'public, max-age=3600')
      .header('Access-Control-Allow-Origin', '*')
      .send(embedScript);
  });
}

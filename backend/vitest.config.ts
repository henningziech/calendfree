import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgresql://calendfree:calendfree@localhost:5432/calendfree',
      REDIS_URL: 'redis://localhost:6379',
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/auth/google/callback',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
      ENCRYPTION_KEY: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      BACKEND_URL: 'http://localhost:3001',
      FRONTEND_URL: 'http://localhost:5173',
      NODE_ENV: 'test',
    },
  },
});

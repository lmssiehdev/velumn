import { db } from '@repo/db/index';
import { webEnv } from '@repo/utils/env/web';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  plugins: [nextCookies()],
  socialProviders: {
    discord: {
      clientId: webEnv.DISCORD_CLIENT_ID,
      clientSecret: webEnv.DISCORD_CLIENT_SECRET,
      scope: ['identify', 'email', 'guilds'],
      disableDefaultScope: true,
      enabled: true,
    },
  },
});

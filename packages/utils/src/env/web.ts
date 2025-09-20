import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const webEnv = createEnv({
  server: {
    DISCORD_CLIENT_ID: z.string(),
    DISCORD_CLIENT_SECRET: z.string(),
    BETTER_AUTH_SECRET: z.string(),
  },
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});

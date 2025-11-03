import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const dashEnv = createEnv({
    client: {
        NEXT_PUBLIC_DISCORD_CLIENT_ID: z.string(),
        NEXT_PUBLIC_BETTER_AUTH_URL: z.string(),
    },
    server: {
        DISCORD_CLIENT_SECRET: z.string(),
        BETTER_AUTH_SECRET: z.string(),
        // Database
        DATABASE_URL: z.string(),
        // Payments
        POLAR_ACCESS_TOKEN: z.string(),
        POLAR_WEBHOOK_SECRET: z.string(),
    },
    experimental__runtimeEnv: {
        NEXT_PUBLIC_DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
        NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    },
    skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),

});

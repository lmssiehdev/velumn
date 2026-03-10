import { vercel } from "@t3-oss/env-core/presets-zod";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const webEnv = createEnv({
	client: {
		NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
	},
	extends: [vercel()],
});

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const botEnv = createEnv({
	server: {
		DISCORD_BOT_TOKEN: z.string().min(1),
		MEILISEARCH_HOST: z.string().min(1).optional(),
		MEILISEARCH_MASTER_KEY: z.string().min(1).optional(),
		MEILISEARCH_API_KEY: z.string().min(1),
		NEXT_PUBLIC_VELUMN_URL: z.string().min(1),
		NEXT_PUBLIC_VELUMN_DASHBOARD_URL: z.string().min(1),
	},
	runtimeEnv: process.env,
});

import { vercel } from "@t3-oss/env-core/presets-zod";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const dashboardEnv = createEnv({
	server: {
		DATABASE_URL: z.url().min(1),
		DISCORD_CLIENT_SECRET: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(1),
		AXIOM_TOKEN: z.string().min(1),
	},
	client: {
		NEXT_PUBLIC_DISCORD_CLIENT_ID: z.string().min(1),
		NEXT_PUBLIC_VELUMN_API_URL: z.string(),
		NEXT_PUBLIC_VELUMN_DASHBOARD_URL: z.string(),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
		NEXT_PUBLIC_VELUMN_API_URL: process.env.NEXT_PUBLIC_VELUMN_API_URL,
		NEXT_PUBLIC_VELUMN_DASHBOARD_URL:
			process.env.NEXT_PUBLIC_VELUMN_DASHBOARD_URL,
	},
	extends: [vercel()],
});

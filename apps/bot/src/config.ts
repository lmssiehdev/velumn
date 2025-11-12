import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const botEnv = createEnv({
	server: {
		DISCORD_BOT_TOKEN: z.string().min(1),
	},
	runtimeEnv: process.env,
});

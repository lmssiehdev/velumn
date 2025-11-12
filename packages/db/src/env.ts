import { createEnv } from "@t3-oss/env-core";
import "dotenv/config";
import z from "zod";

export const dbEnv = createEnv({
	server: {
		DATABASE_URL: z.url(),
	},
	runtimeEnv: process.env,
});

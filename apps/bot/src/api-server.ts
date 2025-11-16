import { trpcServer } from "@hono/trpc-server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type z from "zod";
import { botRouter } from "./helpers/trpc";

export function validateParams<Schema extends z.ZodSchema>(
	schema: Schema,
	response?: object,
) {
	return zValidator("json", schema, (result, c) => {
		if (!result.success) {
			return c.json(
				response ?? {
					error: "Invalid params",
				},
				400,
			);
		}
	});
}
export const BotApi = new Hono()
	.use(
		"/*",
		cors({
			origin: "*",
			credentials: true,
			allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			allowHeaders: ["Origin", "Content-Type", "Accept", "X-Requested-With"],
			maxAge: 3600,
		}),
	)
	.use(
		"/trpc/*",
		trpcServer({
			router: botRouter,
			createContext: (_opts, c) => ({
				secret: c.req.header("x-velumn-secret"),
			}),
		}),
	)
	.get("/health", (c) => {
		return c.text("OK");
	});

BotApi.onError((err, c) => {
	console.log({ apiError: err });
	return c.json({ success: false, error: err.message }, 500);
});

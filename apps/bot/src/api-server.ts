import { trpcServer } from "@hono/trpc-server";
import { zValidator } from "@hono/zod-validator";
import { apiLogger } from "@repo/logger";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type z from "zod";
import { getHonoIp } from "./helpers/rate-limit";
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

export const customLogger = (message: string, ...rest: string[]) => {
	apiLogger.info(`[API] ${message}`, {
		...rest,
	});
};

export const BotApi = new Hono()
	.use(logger(customLogger))
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
				ip: getHonoIp(c),
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

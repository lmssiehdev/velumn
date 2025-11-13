import { trpcServer } from "@hono/trpc-server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
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
export const BotApi = new Hono().use(
	"/trpc/*",
	trpcServer({
		router: botRouter,
		createContext: (_opts, c) => ({
			secret: c.req.header("x-velumn-secret"),
		}),
	}),
);

BotApi.onError((err, c) => {
	return c.json({ success: false, error: err.message }, 500);
});

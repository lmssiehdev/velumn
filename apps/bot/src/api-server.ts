import { trpcServer } from "@hono/trpc-server";
import { apiLogger } from "@repo/logger";
import type { Client } from "discord.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { getHonoIp, getTrustedClientIp } from "./helpers/rate-limit";
import { createBotRouter } from "./helpers/trpc";
import type { BotApiOperations } from "./http/operations";

export interface BotApiOptions {
	readonly allowedOrigins: readonly string[];
	readonly apiSecret: string;
	readonly discordClient: Client<true>;
	readonly operations: BotApiOperations;
}

const customLogger = (message: string, ...rest: string[]) => {
	apiLogger.info(`[API] ${message}`, { ...rest });
};

export const makeBotApi = ({
	allowedOrigins,
	apiSecret,
	discordClient,
	operations,
}: BotApiOptions) => {
	const router = createBotRouter({ apiSecret, discordClient });

	return new Hono()
		.use(logger(customLogger))
		.use(
			"/*",
			cors({
				origin: [...allowedOrigins],
				credentials: false,
				allowMethods: ["GET", "POST", "OPTIONS"],
				allowHeaders: ["content-type", "x-velumn-secret", "x-velumn-client-ip"],
				maxAge: 3600,
			}),
		)
		.use(
			"/trpc/*",
			trpcServer({
				router,
				createContext: (_opts, context) => {
					const secret = context.req.header("x-velumn-secret");
					return {
						secret,
						ip: getHonoIp(context),
						trustedClientIp: getTrustedClientIp({
							providedSecret: secret,
							expectedSecret: apiSecret,
							propagatedIp: context.req.header("x-velumn-client-ip"),
						}),
						operations,
					};
				},
			}),
		)
		.get("/health", async (context) => {
			const readiness = await operations.getReadiness(context.req.raw.signal);
			return context.json(readiness, readiness.ready ? 200 : 503);
		})
		.onError((error, context) => {
			apiLogger.error("api_error", { error });
			return context.json(
				{ success: false, error: "Internal server error" },
				500,
			);
		});
};

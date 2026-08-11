import { trpcServer } from "@hono/trpc-server";
import { apiLogger } from "@repo/logger";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { BotApiOperations } from "./contracts";
import { getTrustedClientIp, makeRateLimiter } from "./rate-limit";
import { botRouter } from "./router";

export interface BotApiOptions {
	readonly allowedOrigins: readonly string[];
	readonly apiSecret: string;
	readonly operations: BotApiOperations;
}

const customLogger = (message: string, ...rest: string[]) => {
	apiLogger.info(`[API] ${message}`, { ...rest });
};

export const makeBotApi = ({
	allowedOrigins,
	apiSecret,
	operations,
}: BotApiOptions) => {
	const rateLimiter = makeRateLimiter();
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
				router: botRouter,
				createContext: (_opts, context) => {
					const secret = context.req.header("x-velumn-secret");
					return {
						apiSecret,
						secret,
						trustedClientIp: getTrustedClientIp({
							providedSecret: secret,
							expectedSecret: apiSecret,
							propagatedIp: context.req.header("x-velumn-client-ip"),
						}),
						operations,
						rateLimiter,
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

export type { BotApiOperations } from "./contracts";
export type { BotRouter } from "./router";

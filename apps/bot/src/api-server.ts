import { trpcServer } from "@hono/trpc-server";
import { apiLogger } from "@repo/logger";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { botEnv } from "./config";
import { getHonoIp } from "./helpers/rate-limit";
import { botRouter } from "./helpers/trpc";

export const customLogger = (message: string, ...rest: string[]) => {
	apiLogger.info(`[API] ${message}`, {
		...rest,
	});
};

const DEFAULT_ALLOWED_ORIGINS = [
	botEnv.NEXT_PUBLIC_VELUMN_URL,
	botEnv.NEXT_PUBLIC_VELUMN_DASHBOARD_URL,
];

export const BotApi = new Hono()
	.use(logger(customLogger))
	.use(
		"/*",
		cors({
			origin: DEFAULT_ALLOWED_ORIGINS,
			credentials: false,
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["content-type", "x-velumn-secret"],
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
	apiLogger.error("api_error", { error: err });
	return c.json({ success: false, error: err.message }, 500);
});

import type { BotApiOptions } from "@repo/api/server";
import type { Server } from "bun";
import { Effect, Layer, Redacted, Schema, type Scope } from "effect";
import type { SearchIndex } from "../adapters/search";
import { BotConfig } from "../config/bot-config";
import type { ReconciliationJobs } from "../indexing/jobs";
import { Readiness } from "../runtime/readiness";
import { makeBotApiOperations } from "./operations";

type FetchHandler = (request: Request) => Response | Promise<Response>;

interface ServerHandle {
	readonly stop: (closeActiveConnections?: boolean) => void | Promise<void>;
}

interface BotHttpServerOptions {
	readonly makeFetch?: (
		options: BotApiOptions,
	) => FetchHandler | Promise<FetchHandler>;
	readonly serve?: (options: {
		readonly port: number;
		readonly fetch: FetchHandler;
	}) => ServerHandle;
}

const gracefulStopTimeout = "2 seconds" as const;
const forcedStopTimeout = "1 second" as const;

export class BotHttpServerError extends Schema.TaggedError<BotHttpServerError>()(
	"BotHttpServerError",
	{
		operation: Schema.Literals(["build", "listen", "close"]),
		cause: Schema.Defect(),
	},
) {}

const defaultMakeFetch = async (options: BotApiOptions) => {
	const { makeBotApi } = await import("@repo/api/server");
	return makeBotApi(options).fetch;
};

const defaultServe = ({ port, fetch }: { port: number; fetch: FetchHandler }) =>
	Bun.serve({ port, fetch }) as Server<undefined>;

export const makeBotHttpServer = (
	options: BotHttpServerOptions = {},
): Effect.Effect<
	ServerHandle,
	BotHttpServerError,
	Scope.Scope | BotConfig | Readiness | ReconciliationJobs | SearchIndex
> =>
	Effect.gen(function* () {
		const config = yield* BotConfig;
		const readiness = yield* Readiness;
		const operations = yield* makeBotApiOperations();
		const apiOptions: BotApiOptions = {
			allowedOrigins: config.allowedOrigins,
			apiSecret: Redacted.value(config.apiSecret),
			operations,
		};
		const fetch = yield* Effect.tryPromise({
			try: () =>
				Promise.resolve((options.makeFetch ?? defaultMakeFetch)(apiOptions)),
			catch: (cause) => new BotHttpServerError({ operation: "build", cause }),
		});
		const server = yield* Effect.acquireRelease(
			Effect.try({
				try: () =>
					(options.serve ?? defaultServe)({ port: config.apiPort, fetch }),
				catch: (cause) =>
					new BotHttpServerError({ operation: "listen", cause }),
			}),
			(server) => {
				const stop = (
					force: boolean,
					timeout: typeof gracefulStopTimeout | typeof forcedStopTimeout,
				) =>
					Effect.tryPromise({
						try: () => Promise.resolve(server.stop(force)),
						catch: (cause) =>
							new BotHttpServerError({ operation: "close", cause }),
					}).pipe(Effect.timeout(timeout));

				return readiness.setHttpReady(false).pipe(
					Effect.andThen(stop(false, gracefulStopTimeout)),
					Effect.catch((error) =>
						Effect.logWarning("Graceful bot HTTP server shutdown failed", {
							error,
						}).pipe(
							Effect.andThen(stop(true, forcedStopTimeout)),
							Effect.catch((forceError) =>
								Effect.logWarning("Forced bot HTTP server shutdown failed", {
									error: forceError,
								}),
							),
						),
					),
				);
			},
		);

		yield* readiness.setHttpReady(true);
		yield* Effect.logInfo("Bot HTTP server ready", { port: config.apiPort });
		return server;
	});

export const BotHttpServer = Layer.effectDiscard(makeBotHttpServer());

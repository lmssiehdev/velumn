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
			(server) =>
				readiness.setHttpReady(false).pipe(
					Effect.andThen(
						Effect.tryPromise({
							try: () => Promise.resolve(server.stop(false)),
							catch: (cause) =>
								new BotHttpServerError({ operation: "close", cause }),
						}),
					),
					Effect.catch((error) =>
						Effect.logWarning("Failed to close bot HTTP server", { error }),
					),
				),
		);

		yield* readiness.setHttpReady(true);
		yield* Effect.logInfo("Bot HTTP server ready", { port: config.apiPort });
		return server;
	});

export const BotHttpServer = Layer.effectDiscard(makeBotHttpServer());

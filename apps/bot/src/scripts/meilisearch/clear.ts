import { MeiliSearch } from "meilisearch";
import { Config, Effect, Redacted, Schema } from "effect";
import { MESSAGES_INDEX_NAME } from "../../constants";

const program = Effect.gen(function* () {
	const host = yield* Config.schema(
		Schema.NonEmptyString,
		"MEILISEARCH_HOST",
	).pipe(Config.withDefault("http://127.0.0.1:7700"));
	const apiKey = yield* Config.schema(
		Schema.NonEmptyString,
		"MEILISEARCH_API_KEY",
	).pipe(Config.map(Redacted.make));
	const client = new MeiliSearch({ host, apiKey: Redacted.value(apiKey) });

	yield* Effect.tryPromise(() =>
		client.index(MESSAGES_INDEX_NAME).deleteAllDocuments(),
	);
	console.log("MeiliSearch index cleared");
});

await Effect.runPromise(program);

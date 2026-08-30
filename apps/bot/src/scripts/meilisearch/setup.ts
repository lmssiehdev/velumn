import { MeiliSearch } from "meilisearch";
import { Config, Effect, Option, Redacted, Schema } from "effect";
import { MESSAGES_INDEX_NAME } from "../../constants";

const program = Effect.gen(function* () {
	const host = yield* Config.schema(
		Schema.NonEmptyString,
		"MEILISEARCH_HOST",
	).pipe(Config.withDefault("http://127.0.0.1:7700"));
	const masterKey = yield* Config.option(
		Config.schema(Schema.NonEmptyString, "MEILISEARCH_MASTER_KEY").pipe(
			Config.map(Redacted.make),
		),
	);
	const client = new MeiliSearch({
		host,
		apiKey: Option.getOrUndefined(Option.map(masterKey, Redacted.value)),
	});

	yield* Effect.tryPromise(() =>
		client.index(MESSAGES_INDEX_NAME).updateSettings({
			searchableAttributes: ["title", "content"],
			filterableAttributes: ["serverId", "threadId"],
			sortableAttributes: ["timestamp"],
		}),
	);
	console.log("MeiliSearch index configured");
});

await Effect.runPromise(program);

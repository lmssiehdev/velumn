# Discord API Spec Source

Status: vendored pinned reference

The Discord HTTP API OpenAPI source used during rewrite research is vendored at [`../vendor/discord-api-spec/openapi.json`](../vendor/discord-api-spec/openapi.json). Machine-readable provenance is stored beside it in [`source.json`](../vendor/discord-api-spec/source.json), and Discord's MIT license is retained in that directory.

| Field      | Value                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository | [`discord/discord-api-spec`](https://github.com/discord/discord-api-spec)                                                                             |
| Commit     | [`e2bb9417565db2b26b1ea960c63b7f9075d799ab`](https://github.com/discord/discord-api-spec/commit/e2bb9417565db2b26b1ea960c63b7f9075d799ab)             |
| File       | `specs/openapi.json`                                                                                                                                  |
| Blob       | [`specs/openapi.json`](https://github.com/discord/discord-api-spec/blob/e2bb9417565db2b26b1ea960c63b7f9075d799ab/specs/openapi.json)                  |
| Raw URL    | [`raw.githubusercontent.com`](https://raw.githubusercontent.com/discord/discord-api-spec/e2bb9417565db2b26b1ea960c63b7f9075d799ab/specs/openapi.json) |
| SHA-256    | `f6cd197cbe47eeb6967a606980636b7fab3f72863255e17cd087cbbfe2f03bd2`                                                                                    |
| Byte count | `1184027`                                                                                                                                             |
| License    | MIT                                                                                                                                                   |

Run `npm run discord-spec:check` to validate the vendored file and provenance without network access. Run `npm run discord-spec:update` to deliberately refresh the snapshot from upstream `main`.

Warning: Discord labels this specification as a preview. It is reference material only, not an authoritative compatibility contract or a generated-code input. Confirm behavior against the Discord developer documentation and the installed discord.js/types before production changes.

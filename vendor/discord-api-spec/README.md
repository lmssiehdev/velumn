# Discord API Specification

This directory vendors Discord's preview v10 HTTP API OpenAPI document for local inspection during Discord payload, endpoint, component, and serialization work.

- `openapi.json`: exact upstream document.
- `source.json`: pinned commit, source URL, SHA-256, and byte count.
- `LICENSE`: upstream MIT license.

Run `npm run discord-spec:check` to validate the local copy without network access. Run `npm run discord-spec:update` to fetch the latest `main` revision and update its provenance.

The specification is a preview reference, not an authoritative compatibility contract or generated-code input. Check it alongside Discord's developer documentation, the installed `discord-api-types` version, discord.js runtime behavior, and representative payload tests.

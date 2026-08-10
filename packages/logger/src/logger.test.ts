import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { Transport } from "@axiomhq/logging";

const originalToken = process.env.AXIOM_TOKEN;
let importId = 0;

const loadLogger = async (token?: string) => {
	if (token === undefined) {
		delete process.env.AXIOM_TOKEN;
	} else {
		process.env.AXIOM_TOKEN = token;
	}

	importId += 1;
	return import(`./logger.ts?test=${importId}`);
};

after(() => {
	if (originalToken === undefined) {
		delete process.env.AXIOM_TOKEN;
	} else {
		process.env.AXIOM_TOKEN = originalToken;
	}
});

describe("legacy logger transports", () => {
	it("uses only the console transport regardless of AXIOM_TOKEN", async () => {
		for (const token of [undefined, "   ", "test-token"]) {
			const { logger } = await loadLogger(token);

			assert.deepEqual(
				logger.initConfig.transports.map(
					(transport: Transport) => transport.constructor.name,
				),
				["ConsoleTransport"],
			);
		}
	});

	it("preserves the service logger APIs", async () => {
		const { apiLogger, botLogger, logger } = await loadLogger("test-token");

		assert.deepEqual(
			logger.initConfig.transports.map(
				(transport: Transport) => transport.constructor.name,
			),
			["ConsoleTransport"],
		);
		assert.equal(logger.initConfig.logLevel, "error");
		assert.equal(apiLogger.initConfig.args?.service, "api");
		assert.equal(botLogger.initConfig.args?.service, "bot");
	});
});

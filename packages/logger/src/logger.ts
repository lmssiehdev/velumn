import { ConsoleTransport, Logger } from "@axiomhq/logging";

export const logger = new Logger({
	logLevel: "error",
	transports: [
		new ConsoleTransport({
			prettyPrint: true,
		}),
	],
});

export const botLogger = logger.with({
	service: "bot",
});

export const apiLogger = logger.with({
	service: "api",
});

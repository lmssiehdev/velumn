import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, ConsoleTransport, Logger } from "@axiomhq/logging";

const axiom = new Axiom({
	token: process.env.AXIOM_TOKEN!,
});

export const logger = new Logger({
	logLevel: "error",
	transports: [
		new AxiomJSTransport({
			axiom,
			dataset: "bot",
		}),
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

import { Axiom } from '@axiomhq/js';
import { AxiomJSTransport, ConsoleTransport, Logger } from '@axiomhq/logging';

const axiom = new Axiom({
  token: process.env.AXIOM_TOKEN!,
});

export const logger = new Logger({
  logLevel: 'error',
  transports: [
    new AxiomJSTransport({
      axiom,
      dataset: 'bot',
    }),
    new ConsoleTransport({
      prettyPrint: true,
    }),
  ],
});

export function safeStringify(obj: unknown) {
  try {
    if (obj instanceof Error) {
      // Errors don't serialize well, so we extract what we want
      // We stringify so that we can log the error message and stack trace in a single log event
      return JSON.stringify(obj.stack ?? obj.message);
    }
    // Avoid crashing on circular references
    return JSON.stringify(obj);
  } catch (_e) {
    return obj;
  }
}

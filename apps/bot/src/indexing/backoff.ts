export const boundedExponentialDelayMs = (options: {
	readonly initialDelayMs: number;
	readonly maximumDelayMs: number;
	readonly attemptCount: number;
}): number =>
	Math.min(
		options.maximumDelayMs,
		options.initialDelayMs *
			2 ** Math.min(30, Math.max(0, options.attemptCount - 1)),
	);

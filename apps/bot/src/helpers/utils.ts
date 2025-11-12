export function shuffle<T>(array: T[]): T[] {
	const newArray = array.slice();

	for (let i = newArray.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));

		[newArray[i], newArray[j]] = [newArray[j]!, newArray[i]!];
	}

	return newArray;
}

import { logger } from "@repo/logger";
import type { ZodSchema } from "zod";

export function safeParse<T>(
	schema: ZodSchema<T>,
	value: unknown,
	defaultValue: T,
	logError = true,
): T {
	const result = schema.safeParse(value);
	if (result.success) {
		return result.data;
	}
	const errorStack = new Error().stack;

	if (logError) {
		logger.error(
			"Zod parsing failed.\n" +
				`1. Schema: ${schema.description || "UnnamedSchema"}\n` +
				`2. Input: ${JSON.stringify(value, null, 2)}\n` +
				`3. Zod Error: ${result.error}\n` +
				`4. Call Stack: ${errorStack}`,
		);
	}

	return defaultValue;
}

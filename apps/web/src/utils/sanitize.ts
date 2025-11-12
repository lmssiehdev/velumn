import sanitizeHtml from "sanitize-html";

export function sanitizeJsonLd<T>(jsonLdObject: T): T {
	const sanitizeText = (text: string) =>
		sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });

	const sanitizeRecursive = (obj: unknown): unknown => {
		if (typeof obj === "string") {
			return sanitizeText(obj);
		}
		if (Array.isArray(obj)) {
			return obj.map(sanitizeRecursive);
		}
		if (obj && typeof obj === "object") {
			const sanitized: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(obj)) {
				sanitized[key] = sanitizeRecursive(value);
			}
			return sanitized;
		}
		return obj;
	};

	return sanitizeRecursive(jsonLdObject) as T;
}

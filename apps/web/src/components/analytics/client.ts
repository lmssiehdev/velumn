import posthog from "posthog-js";

export function trackEvent(key: string, payload?: Record<string, unknown>) {
	return posthog.capture(key, payload ?? null);
}

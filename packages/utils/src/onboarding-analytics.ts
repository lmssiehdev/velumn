export type OnboardingEventName =
	| "server_selected"
	| "discord_authorization_opened"
	| "bot_connected"
	| "channel_selection_submitted"
	| "indexing_successfully_started";

export async function captureOnboardingEvent({
	event,
	properties,
	serverId,
	userId,
}: {
	event: OnboardingEventName;
	properties?: Record<string, string | number>;
	serverId: string;
	userId: string;
}) {
	const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
	if (!apiKey) return;

	try {
		await fetch("https://us.i.posthog.com/capture/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: apiKey,
				event,
				properties: {
					distinct_id: userId,
					server_id: serverId,
					source: "dashboard_onboarding",
					...properties,
				},
			}),
		});
	} catch {
		// Analytics must never interrupt onboarding.
	}
}

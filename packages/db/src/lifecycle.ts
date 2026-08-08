export const PENDING_INVITE_MAX_AGE_MS = 30 * 60 * 1000;

export type OnboardingLifecycle =
	| "invite_required"
	| "waiting_for_bot"
	| "select_channels"
	| "bot_disconnected"
	| "ready";

export type OnboardingLifecycleFacts = {
	userId: string;
	membership: null | {
		finishedOnboarding: boolean;
		kickedAt: Date | null;
	};
	pendingInvite: null | {
		userId: string;
		updatedAt: Date | null;
	};
};

export function isPendingInviteFresh(
	pendingInvite: NonNullable<OnboardingLifecycleFacts["pendingInvite"]>,
	now = new Date(),
) {
	return (
		pendingInvite.updatedAt !== null &&
		now.getTime() - pendingInvite.updatedAt.getTime() <=
			PENDING_INVITE_MAX_AGE_MS
	);
}

/** Derives presentation state from persisted facts; it does not advance state. */
export function resolveOnboardingLifecycle(
	facts: OnboardingLifecycleFacts,
	now = new Date(),
): OnboardingLifecycle {
	if (facts.membership) {
		if (facts.membership.kickedAt) {
			if (
				facts.pendingInvite?.userId === facts.userId &&
				isPendingInviteFresh(facts.pendingInvite, now)
			) {
				return "waiting_for_bot";
			}
			return "bot_disconnected";
		}
		return facts.membership.finishedOnboarding ? "ready" : "select_channels";
	}

	if (
		facts.pendingInvite?.userId === facts.userId &&
		isPendingInviteFresh(facts.pendingInvite, now)
	) {
		return "waiting_for_bot";
	}

	return "invite_required";
}

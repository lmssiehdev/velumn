"use client";

import type { DBChannel } from "@repo/db/schema/discord";
import { useMutation } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { toast } from "sonner";
import type { RawDiscordGuild } from "@/app/onboarding/_fetchUserGuilds";
import { useTRPC } from "@/lib/trpc";

export type SortChannel = DBChannel & { enabled: boolean };

export type OnboardingContextType = {
	selectedGuildId: string | null;
	channels: SortChannel[];
	guilds: RawDiscordGuild[];

	setChannels: (channels: SortChannel[]) => void;
	toggleChannel: (channelId: string, enabled: boolean) => void;
	handleInviteCreation: (guildId: string) => void;
	trpc: ReturnType<typeof useTRPC>;
	inviteUrl: string | null;
};

const OnboardingContext = createContext<OnboardingContextType>(
	{} as OnboardingContextType,
);

export function useOnboardingContext() {
	const context = useContext(OnboardingContext);

	if (!context) {
		throw new Error(
			"useOnboardingContext must be used within a OnboardingProvider",
		);
	}

	return context;
}

export function OnboardingProvider({
	children,
	initialChannels,
	initialGuildId,
	guilds,
}: {
	children: React.ReactNode;
	initialChannels: SortChannel[];
	initialGuildId: string | null;
	guilds: RawDiscordGuild[];
}) {
	const trpc = useTRPC();
	const [inviteUrl, setInviteUrl] = useState<string | null>(null);
	const [selectedGuildId] = useState(initialGuildId);
	const [channels, setChannels] = useState<SortChannel[]>(initialChannels);

	const inviteUrlMutation = useMutation(
		trpc.server.createServerInvite.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
			onSuccess({ inviteUrl }) {
				setInviteUrl(inviteUrl);
			},
		}),
	);

	const setChannelsOnly = (newChannels: SortChannel[]) => {
		setChannels(newChannels);
	};

	const toggleChannel = (channelId: string, enabled: boolean) => {
		setChannels((prev) =>
			prev.map((c) => (c.id === channelId ? { ...c, enabled } : c)),
		);
	};

	// uh memo me
	const value: OnboardingContextType = {
		selectedGuildId,
		channels,
		guilds,
		setChannels: setChannelsOnly,
		toggleChannel,
		trpc,
		handleInviteCreation: async (serverId: string) =>
			await inviteUrlMutation.mutateAsync({ serverId }),
		inviteUrl,
	};

	return (
		<OnboardingContext.Provider value={value}>
			{children}
		</OnboardingContext.Provider>
	);
}

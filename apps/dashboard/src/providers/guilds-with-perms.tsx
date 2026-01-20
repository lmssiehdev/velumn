"use client";
import { createContext, useContext, useMemo } from "react";
import type { RawDiscordGuild } from "@/app/onboarding/_fetchUserGuilds";

type GuildsContext = {
	guilds: RawDiscordGuild[];
};
const GuildsContext = createContext<GuildsContext>({} as GuildsContext);

export function useRawDiscordGuilds() {
	const context = useContext(GuildsContext);
	if (!context) {
		throw new Error("server must be used inside a ServerContextProvider");
	}
	return context;
}

export function RawDiscordGuildsProvider({
	guilds,
	children,
}: {
	children: React.ReactNode;
	guilds: RawDiscordGuild[];
}) {
	const value = useMemo(() => ({ guilds }), [guilds]);

	return (
		<GuildsContext.Provider value={value}>{children}</GuildsContext.Provider>
	);
}

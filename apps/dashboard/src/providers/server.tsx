"use client";
import type { DBServer } from "@repo/db/schema/discord";
import { useParams } from "next/navigation";
import { createContext, useContext, useMemo } from "react";

type ServerContext = {
	servers: (DBServer & { finishedOnboarding?: boolean })[];
	server: (DBServer & { finishedOnboarding?: boolean }) | undefined;
};
const ServerContext = createContext<ServerContext>({} as ServerContext);

export function useServer() {
	const context = useContext(ServerContext);
	if (!context) {
		throw new Error("server must be used inside a ServerContextProvider");
	}
	return context;
}

export function ServerProvider({
	servers,
	children,
}: {
	children: React.ReactNode;
	servers: (DBServer & { finishedOnboarding?: boolean })[];
}) {
	const router = useParams();

	const value = useMemo(
		() => ({ servers, server: servers?.find((s) => s.id === router.id) }),
		[router.id, servers],
	);

	return (
		<ServerContext.Provider value={value}>{children}</ServerContext.Provider>
	);
}

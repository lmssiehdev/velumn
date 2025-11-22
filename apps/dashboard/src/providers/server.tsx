"use client";
import type { DBServer } from "@repo/db/schema/discord";
import { createContext, useContext, useMemo } from "react";

type ServerContext = { server: DBServer };
const ServerContext = createContext<ServerContext>({} as ServerContext);

export function useServer() {
	const context = useContext(ServerContext);
	if (!context) {
		throw new Error("server must be used inside a ServerContextProvider");
	}
	return context;
}

export function ServerProvider({
	server,
	children,
}: {
	children: React.ReactNode;
	server: DBServer;
}) {
	const value = useMemo(() => ({ server }), [server.id, server]);

	return (
		<ServerContext.Provider value={value}>{children}</ServerContext.Provider>
	);
}

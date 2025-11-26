"use client";
import React, { createContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const HashContext = createContext<string>("");

export function useHash() {
	const context = React.useContext(HashContext);
	if (context === undefined) {
		throw new Error("useHash must be used within a HashProvider");
	}
	return context;
}

export function HashProvider({ children }: { children: React.ReactNode }) {
	const [hash, setHash] = useState<string>("");
	useEffect(() => {
		const updateHash = () => setHash(window.location.hash);
		updateHash();
		window.addEventListener("hashchange", updateHash);
		return () => window.removeEventListener("hashchange", updateHash);
	}, []);

	return <HashContext.Provider value={hash}>{children}</HashContext.Provider>;
}

export function MessageHighlight({
	messageId,
	children,
	className,
}: {
	messageId: string;
	children: React.ReactNode;
	className?: string;
}) {
	const currentHash = useHash();
	const isHashFocused = currentHash === `#${messageId}`;
	const [isHighlighted, setIsHighlighted] = useState(false);
	useEffect(() => {
		if (!isHashFocused) return;
		setIsHighlighted(true);
		const timeout = setTimeout(() => setIsHighlighted(false), 1000);
		return () => clearTimeout(timeout);
	}, [isHashFocused]);

	return (
		<div
			id={messageId}
			className={cn(
				className,
				"group rounded-sm transition-colors duration-300 ease-in-out",
				{
					"bg-purple-300/10": isHighlighted,
				},
			)}
		>
			{children}
		</div>
	);
}

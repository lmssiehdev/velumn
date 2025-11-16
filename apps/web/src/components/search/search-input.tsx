/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: sanitized on the server :) */
"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const SearchModal = dynamic(() => import("./search-modal"), { ssr: false });

export default function SearchPortal({ serverId }: { serverId: string }) {
	const [container, setContainer] = useState<HTMLElement | null>(null);

	useLayoutEffect(() => {
		setContainer(document.getElementById("search-box"));
	}, []);

	if (!container) return null;
	return createPortal(<SearchInput serverId={serverId} />, container);
}

export function SearchInput({ serverId }: { serverId: string }) {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	return (
		<>
			<button
				onClick={() => {
					setOpen(true);
				}}
				className="flex h-9 items-center gap-2 border-b px-3 border border-input hover:bg-accent/80 cursor-pointer"
			>
				<MagnifyingGlassIcon
					className="size-5 shrink-0 opacity-50"
					weight="bold"
				/>
				<div className="text-muted-foreground w-full rounded-md bg-transparent text-sm outline-hidden mr-8">
					Search community...
				</div>
				<kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none">
					<span className="text-xs">⌘</span>K
				</kbd>
			</button>
			<SearchModal serverId={serverId} open={open} setOpen={setOpen} />
		</>
	);
}

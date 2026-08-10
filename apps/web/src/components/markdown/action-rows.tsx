"use client";

import type { DBMessage } from "@repo/db/schema/discord";
import { ComponentType } from "discord-api-types/v10";
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button";
import { DiscordEmojiToImage } from "./emoji";

type DBDiscordComponent = NonNullable<DBMessage["components"]>[number];
type DBButtonComponent = Extract<
	DBDiscordComponent["components"][number],
	{ style: number }
>;

function isButtonComponent(
	component: DBDiscordComponent["components"][number],
): component is DBButtonComponent {
	return (
		component.type === ComponentType.Button && !("unsupported" in component)
	);
}

export function ActionRows({
	components,
}: {
	components: DBDiscordComponent[] | null;
}) {
	if (!components?.length) return null;
	return (
		<div className="space-y-2">
			{components.map((c, idx) => (
				<Row key={idx} components={c.components} />
			))}
		</div>
	);
}

function Row({ components }: { components: DBDiscordComponent["components"] }) {
	return (
		<div className="flex items-center flex-wrap gap-2">
			{components.map((c, idx) => {
				if (isButtonComponent(c)) {
					return <ButtonRow key={idx} component={c} />;
				}
				return null;
			})}
		</div>
	);
}

function ButtonRow({ component }: { component: DBButtonComponent }) {
	return (
		<button
			onClick={() => {
				if (!component.url) return;
				window.open(component.url, "_blank");
			}}
			disabled={component.disabled}
			className={buttonVariants({
				variant: "outline",
				size: "sm",
				className: cn(
					"flex items-center gap-2 rounded-md max-w-60 w-fit overflow-hidden",
					{
						"opacity-50": component.disabled,
					},
				),
			})}
		>
			{component.emoji && (
				<DiscordEmojiToImage
					className="size-5 inline-block"
					name={component.emoji.name!}
					animated={component.emoji.animated!}
					id={component.emoji.id!}
				/>
			)}
			{component.label && <span className="truncate">{component.label}</span>}
		</button>
	);
}

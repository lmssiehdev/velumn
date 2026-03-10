"use client";

import { Button } from "@/components/ui/button";
import { trackEvent } from "./client";
import type { ClientEventKey, ClientEvents } from "./types";

export function TrackButton<E extends ClientEventKey>(
	props: React.ComponentPropsWithoutRef<typeof Button> & {
		eventKey: E;
		eventData: ClientEvents[E];
	},
) {
	const { eventKey, eventData, ...rest } = props;

	return (
		<Button
			{...rest}
			onClick={(e) => {
				trackEvent(eventKey, eventData);
				rest.onClick?.(e);
			}}
		/>
	);
}

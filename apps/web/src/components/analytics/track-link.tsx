"use client";

import Link from "next/link";
import { trackEvent } from "./client";
import type { ClientEventKey, EventPayload } from "./types";

export function TrackLink<E extends ClientEventKey | (string & {})>(
	props: React.ComponentPropsWithoutRef<typeof Link> & {
		eventKey: E;
		eventData: EventPayload<E>;
	},
) {
	const { eventKey, eventData, ...rest } = props;

	return (
		<Link
			{...rest}
			onClick={(e) => {
				trackEvent(eventKey, eventData);
				rest.onClick?.(e);
			}}
		/>
	);
}

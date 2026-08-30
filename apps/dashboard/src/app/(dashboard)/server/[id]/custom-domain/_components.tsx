"use client";

import {
	ArrowsClockwiseIcon,
	GlobeIcon,
	TrashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CustomDomainSettings({
	initialDomain,
}: {
	serverId: string;
	initialDomain: string | null;
}) {
	const hasLinkedDomain = Boolean(initialDomain);

	return (
		<div className="space-y-6">
			<div className="rounded-lg border p-6">
				<div className="mb-4">
					<h2 className="font-semibold text-lg">Custom domain</h2>
					<p className="text-muted-foreground text-sm">
						Custom domains let Velumn serve this server&apos;s forum content
						from a dedicated hostname.
					</p>
				</div>

				<div className="mb-4 rounded-md border bg-muted/40 px-4 py-3 text-sm">
					<p className="font-medium">
						Custom domain management is temporarily read-only
					</p>
					<p className="mt-1 text-muted-foreground">
						Changes are unavailable while domain management is being migrated.
						Existing domain routing is unaffected.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
					<div className="flex-1">
						<label
							className="mb-2 block font-medium text-sm"
							htmlFor="custom-domain"
						>
							{hasLinkedDomain ? "Linked domain" : "Custom domain"}
						</label>
						<Input
							disabled={!hasLinkedDomain}
							id="custom-domain"
							placeholder="community.example.com"
							readOnly
							value={initialDomain ?? ""}
						/>
					</div>
					{hasLinkedDomain ? (
						<div className="flex items-end gap-2">
							<Button disabled type="button" variant="outline">
								<ArrowsClockwiseIcon />
								Refresh
							</Button>
							<Button disabled type="button" variant="destructive">
								<TrashIcon />
								Remove
							</Button>
						</div>
					) : (
						<Button className="sm:self-end" disabled type="button">
							<GlobeIcon />
							Add domain
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

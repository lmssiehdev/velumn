"use client";

import {
	ArrowsClockwiseIcon,
	CheckIcon,
	CopyIcon,
	GlobeIcon,
	TrashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/lib/trpc";
import type { AppRouter } from "@/server/trpc/root";

type DomainCheckResult =
	inferRouterOutputs<AppRouter>["domains"]["checkDomain"];

export function CustomDomainSettings({
	serverId,
	initialDomain,
}: {
	serverId: string;
	initialDomain: string | null;
}) {
	const trpc = useTRPC();
	const [domainInput, setDomainInput] = React.useState(initialDomain ?? "");
	const [linkedDomain, setLinkedDomain] = React.useState(initialDomain ?? "");

	const domainStatus = useQuery(
		trpc.domains.checkDomain.queryOptions(
			{ serverId },
			{
				enabled: Boolean(linkedDomain),
				refetchInterval: 60_000,
				retry: false,
			},
		),
	);

	const addDomain = useMutation(
		trpc.domains.addDomain.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
			onSuccess(data) {
				setLinkedDomain(data.domain);
				setDomainInput(data.domain);
				toast.success("Custom domain added.");
				void domainStatus.refetch();
			},
		}),
	);

	const removeDomain = useMutation(
		trpc.domains.removeDomain.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
			onSuccess() {
				setLinkedDomain("");
				setDomainInput("");
				toast.success("Custom domain removed.");
			},
		}),
	);

	const hasLinkedDomain = Boolean(linkedDomain);
	const isPending = addDomain.isPending || removeDomain.isPending;

	return (
		<div className="space-y-6">
			<div className="rounded-lg border p-6">
				<div className="mb-4">
					<h2 className="font-semibold text-lg">Custom domain</h2>
					<p className="text-muted-foreground text-sm">
						Attach a single custom hostname to this server and let Velumn serve
						its forum content from that domain.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
					<div className="flex-1">
						<Input
							autoComplete="off"
							disabled={hasLinkedDomain || isPending}
							onChange={(event) => setDomainInput(event.target.value)}
							placeholder="community.example.com"
							value={domainInput}
						/>
					</div>
					{hasLinkedDomain ? (
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => void domainStatus.refetch()}
							>
								<ArrowsClockwiseIcon />
								Refresh
							</Button>
							<Button
								type="button"
								variant="destructive"
								disabled={isPending}
								onClick={() => {
									if (!window.confirm(`Remove ${linkedDomain}?`)) {
										return;
									}
									removeDomain.mutate({ serverId });
								}}
							>
								<TrashIcon />
								Remove
							</Button>
						</div>
					) : (
						<Button
							type="button"
							disabled={!domainInput.trim() || isPending}
							onClick={() =>
								addDomain.mutate({
									serverId,
									domain: domainInput,
								})
							}
						>
							<GlobeIcon />
							Add domain
						</Button>
					)}
				</div>
			</div>

			{hasLinkedDomain && (
				<div className="rounded-lg border p-6">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<div>
							<h3 className="font-semibold">Domain status</h3>
							<p className="text-muted-foreground text-sm">
								Velumn checks the linked hostname against Vercel and the
								required DNS configuration.
							</p>
						</div>
						<StatusPill
							isLoading={domainStatus.isFetching}
							result={domainStatus.data}
						/>
					</div>

					<div className="mb-4 text-sm">
						<div className="font-medium">{linkedDomain}</div>
						{domainStatus.data?.message && (
							<p className="text-muted-foreground mt-1">
								{domainStatus.data.message}
							</p>
						)}
					</div>

					{domainStatus.data?.dnsRecords.length ? (
						<div className="space-y-3">
							<div className="font-medium text-sm">Required DNS records</div>
							<DomainDnsTable records={domainStatus.data.dnsRecords} />
						</div>
					) : null}
				</div>
			)}
		</div>
	);
}

function StatusPill({
	result,
	isLoading,
}: {
	result?: DomainCheckResult;
	isLoading: boolean;
}) {
	const label = isLoading
		? "Checking"
		: result?.status === "valid_configuration"
			? "Connected"
			: result?.status === "pending_verification"
				? "Action required"
				: "Unavailable";
	const className = isLoading
		? "border-neutral-300 bg-neutral-100 text-neutral-700"
		: result?.status === "valid_configuration"
			? "border-emerald-200 bg-emerald-50 text-emerald-700"
			: result?.status === "pending_verification"
				? "border-amber-200 bg-amber-50 text-amber-700"
				: "border-red-200 bg-red-50 text-red-700";

	return (
		<span
			className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${className}`}
		>
			{result?.status === "valid_configuration" && <CheckIcon />}
			{label}
		</span>
	);
}

function DomainDnsTable({ records }: { records: DomainCheckResult["dnsRecords"] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Type</TableHead>
					<TableHead>Name</TableHead>
					<TableHead>Value</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{records.map((record) => (
					<TableRow key={`${record.type}-${record.name}-${record.value}`}>
						<TableCell>{record.type}</TableCell>
						<TableCell>{record.name}</TableCell>
						<TableCell>
							<div className="flex items-center gap-2">
								<CopyButton value={record.value} />
								<span className="truncate">{record.value}</span>
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function CopyButton({ value }: { value: string }) {
	const [copied, setCopied] = React.useState(false);

	return (
		<Button
			type="button"
			size="icon-sm"
			variant="ghost"
			onClick={async () => {
				await navigator.clipboard.writeText(value);
				setCopied(true);
				window.setTimeout(() => setCopied(false), 1500);
			}}
		>
			{copied ? <CheckIcon /> : <CopyIcon />}
		</Button>
	);
}

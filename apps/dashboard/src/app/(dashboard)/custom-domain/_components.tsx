/** biome-ignore-all lint/correctness/noChildrenProp: <explanation> */
"use client";

import {
	ArrowsClockwiseIcon,
	CheckIcon,
	CircleNotchIcon,
	CopyIcon,
	LinkSimpleIcon,
	PlusIcon,
	SealCheckIcon,
	SealWarningIcon,
	TrashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import * as React from "react";
import { toast } from "sonner";
import z from "zod";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { AppRouter } from "@/server/trpc/root";
import type { DNSRecord } from "@/server/trpc/routers/domains";

type DomainCheckOutput =
	inferRouterOutputs<AppRouter>["domains"]["checkDomain"];

const formSchema = z.object({
	domain: z
		.string()
		.min(1, "Domain must be at least 1 character.")
		.transform((val) => {
			return val.startsWith("http://") || val.startsWith("https://")
				? val
				: `https://${val}`;
		})
		.pipe(
			z.url({
				hostname: z.regexes.domain,
				error: "Please enter a valid domain",
			}),
		)
		.transform((val) => val.replace(/^https?:\/\//, "")),
});

export function CustomDomainInputGroup({
	initialDomain,
}: {
	initialDomain: string;
}) {
	const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
	const [componentState, setComponentState] = React.useState<
		"linked" | "unlinked"
	>(initialDomain ? "linked" : "unlinked");
	const [canRefresh, setCanRefresh] = React.useState(true);

	const form = useForm({
		defaultValues: {
			domain: initialDomain,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			addDomainMutation.mutate({
				domain: value.domain,
			});
		},
	});

	const trpc = useTRPC();

	const addDomainMutation = useMutation(
		trpc.domains.addDomain.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
			onSuccess() {
				toast.success("Domain added!");
				domainData.refetch();
				setComponentState("linked");
			},
		}),
	);

	const domainData = useQuery(
		trpc.domains.checkDomain.queryOptions(undefined, {
			enabled: initialDomain !== undefined && initialDomain !== "",
			refetchInterval: 60000,
			staleTime: 30000,
			retry: false,
		}),
	);

	const removeDomainMutation = useMutation(
		trpc.domains.removeDomain.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
		}),
	);

	React.useEffect(() => {
		if (canRefresh) return;

		const timeRemaining = 30000 - (Date.now() - domainData.dataUpdatedAt);
		const timeout = setTimeout(() => setCanRefresh(true), timeRemaining);

		return () => clearTimeout(timeout);
	}, [domainData.dataUpdatedAt, canRefresh]);

	function handleRefresh() {
		if (!canRefresh) return;

		setCanRefresh(false);
		domainData.refetch();
	}
	const hasLinkedDomain = componentState === "linked";

	return (
		<div>
			<ConfirmDomainDeletion
				title={`Remove ${form.getFieldValue("domain")}?`}
				open={confirmDeleteOpen}
				onOpenChange={setConfirmDeleteOpen}
			>
				<Button
					variant="destructive"
					disabled={removeDomainMutation.isPending}
					onClick={() => {
						removeDomainMutation.mutate(undefined, {
							onSuccess: () => {
								setConfirmDeleteOpen(false);
								toast.success("Domain removed!");
								domainData.refetch();
								setComponentState("unlinked");
								form.reset();
							},
						});
					}}
				>
					{removeDomainMutation.isPending ? "Removing..." : "Remove"}
				</Button>
			</ConfirmDomainDeletion>
			<form
				id="bug-report-form"
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					<form.Field
						name="domain"
						children={(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<ButtonGroup className="w-full">
										<ButtonGroup className="w-full">
											<ButtonGroupText asChild className="bg-transparent">
												<Label htmlFor="url">https://</Label>
											</ButtonGroupText>
											<InputGroup data-invalid={isInvalid} className="w-full">
												<InputGroupInput
													className={cn({
														hasLinkedDomain: "cursor-not-allowed",
													})}
													placeholder={"community.yourdomain.com"}
													disabled={hasLinkedDomain}
													id={field.name}
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													aria-invalid={isInvalid}
													autoComplete="off"
												/>
												<InputGroupAddon align="inline-end">
													<LinkSimpleIcon />
												</InputGroupAddon>
											</InputGroup>
										</ButtonGroup>
										{hasLinkedDomain ? (
											<ButtonGroup>
												<Button
													type="button"
													onClick={() => {
														setConfirmDeleteOpen(true);
													}}
													disabled={removeDomainMutation.isPending}
													variant="outline"
													size="icon"
												>
													<TrashIcon />
												</Button>
												<Button
													type="button"
													onClick={handleRefresh}
													disabled={!canRefresh || domainData.isFetching}
													variant="outline"
													size="icon"
												>
													<ArrowsClockwiseIcon />
												</Button>
											</ButtonGroup>
										) : (
											<ButtonGroup>
												<Button
													variant="outline"
													type="submit"
													disabled={addDomainMutation.isPending}
												>
													{addDomainMutation.isPending ? (
														<>
															<CircleNotchIcon className="animate-spin" />{" "}
															Adding...
														</>
													) : (
														<>
															<PlusIcon /> Add Domain
														</>
													)}
												</Button>
											</ButtonGroup>
										)}
									</ButtonGroup>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					/>
				</FieldGroup>
			</form>
			{hasLinkedDomain ? (
				<BadgeComponent
					data={domainData.data}
					isLoading={domainData.isFetching}
				/>
			) : null}
		</div>
	);
}

const BadgeComponent = ({
	data,
	isLoading,
}: {
	data?: DomainCheckOutput;
	isLoading: boolean;
}) => {
	if (isLoading) {
		return (
			<Badge
				variant="outline"
				className="mt-2 flex items-center px-2 py-1 text-neutral-700"
			>
				<CircleNotchIcon weight="duotone" className="animate-spin size-8" />
				Fetching configuration..
			</Badge>
		);
	}
	switch (data?.status) {
		case "valid_configuration":
			return (
				<Badge
					variant="outline"
					className="mt-2 flex items-center px-2 py-1 text-neutral-700"
				>
					<SealCheckIcon className="text-green-700" weight="duotone" />
					Connected
				</Badge>
			);
		case "pending_verification":
			return (
				<div className="">
					<Badge
						variant="outline"
						className="mt-2 flex items-center px-2 py-1 text-neutral-700"
					>
						<SealWarningIcon weight="duotone" />
						DNS configurations required
					</Badge>
					<div className="my-4">
						<div className="text-sm font-semibold mb-1">DNS Configuration</div>
						<p className="text-neutral-700">
							Please add the following records to your DNS configuration to
							successfully deploy your documentation on the custom domain added.
						</p>
						<DNSTable dnsData={data?.dnsData.map((v) => v.dnsRecord)} />
					</div>
				</div>
			);
		case "unhandled_error":
			return (
				<Badge
					variant="outline"
					className="mt-2 flex items-center px-2 py-1 text-neutral-700"
				>
					<SealWarningIcon weight="duotone" />
					Error fetching domain configuration
				</Badge>
			);
		default:
			return (
				<Badge
					variant="outline"
					className="mt-2 flex items-center px-2 py-1 text-neutral-700"
				>
					<SealWarningIcon weight="duotone" />
					DNS configurations required
				</Badge>
			);
	}
};

export function DNSTable({ dnsData }: { dnsData: DNSRecord[] }) {
	return (
		<Table className="text-neutral-700">
			<TableHeader>
				<TableRow>
					<TableHead className="w-[100px]">Type</TableHead>
					<TableHead>Name</TableHead>
					<TableHead>Value</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{dnsData.map((data) => (
					<TableRow key={data.value}>
						<TableCell className="font-medium">{data.type}</TableCell>
						<TableCell>{data.name}</TableCell>
						<TableCell>
							<div className="flex items-center gap-2 overflow-hidden">
								<CopyButton text={data.value} />
								<span className="max-w-md truncate break-all">
									{data.value}
								</span>
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

// TODO: abstract this
export function ConfirmDomainDeletion({
	title,
	open,
	onOpenChange,
	children,
}: {
	title?: string;
	open: boolean;
	onOpenChange: (v: boolean) => void;
	children: React.ReactNode;
}) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>
						Existing links to this domain may break. Re-adding the domain may
						require reconfiguration.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						asChild
						onClick={(e) => e.preventDefault()}
						className={buttonVariants({ variant: "destructive" })}
					>
						{children}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

// Move me elsewhere maybe?
export const CopyButton = ({ text }: { text: string }) => {
	const [isCopied, setIsCopied] = React.useState(false);
	const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

	const handleCopy = async () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		await navigator.clipboard.writeText(text);
		setIsCopied(true);

		timeoutRef.current = setTimeout(() => {
			setIsCopied(false);
			timeoutRef.current = null;
		}, 4000);
	};

	React.useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return (
		<button className="shrink-0" onClick={handleCopy}>
			{isCopied ? <CheckIcon /> : <CopyIcon />}
		</button>
	);
};

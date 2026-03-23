"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useServer } from "@/providers/server";

const SEGMENT_LABELS: Record<string, string> = {
	channels: "Channels",
	"custom-domain": "Custom Domain",
};

function toTitleCase(segment: string) {
	return segment
		.split("-")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function ServerBreadcrumbs() {
	const pathname = usePathname();
	const { server } = useServer();

	if (!server) {
		return null;
	}

	const segments = pathname.split("/").filter(Boolean);
	const routeSegments = segments.slice(2);
	const serverHref = `/server/${server.id}`;

	return (
		<Breadcrumb className="py-4">
			<BreadcrumbList>
				{routeSegments.length === 0 ? (
					<BreadcrumbItem>
						<BreadcrumbPage>{server.name}</BreadcrumbPage>
					</BreadcrumbItem>
				) : (
					<>
						<BreadcrumbItem>
							<Link href={serverHref}>{server.name}</Link>
						</BreadcrumbItem>
						{routeSegments.map((segment, index) => {
							const href = `${serverHref}/${routeSegments.slice(0, index + 1).join("/")}`;
							const label = SEGMENT_LABELS[segment] ?? toTitleCase(segment);
							const isLast = index === routeSegments.length - 1;

							return (
								<BreadcrumbItem key={href}>
									<BreadcrumbSeparator />
									{isLast ? (
										<BreadcrumbPage>{label}</BreadcrumbPage>
									) : (
										<Link href={href}>{label}</Link>
									)}
								</BreadcrumbItem>
							);
						})}
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

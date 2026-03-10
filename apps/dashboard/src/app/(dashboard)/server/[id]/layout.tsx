import { ServerBreadcrumbs } from "@/components/server-breadcrumbs";

export default function ServerLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="py-2">
			<ServerBreadcrumbs />
			{children}
		</div>
	);
}

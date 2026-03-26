import { normalizeHostHeader } from "@repo/utils/helpers/domains";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ForumShell } from "@/components/forum/shell";
import { getTenantServerOrNotFound } from "./_lib/tenant";

type Props = {
	children: React.ReactNode;
	params: Promise<{ domain: string }>;
};

export default async function Layout(props: Props) {
	const { domain } = await props.params;
	const requestHeaders = await headers();
	const requestHost = requestHeaders.get("host");

	if (!requestHost) {
		notFound();
	}

	if (normalizeHostHeader(requestHost) !== normalizeHostHeader(domain)) {
		notFound();
	}

	await getTenantServerOrNotFound(domain);

	return <ForumShell>{props.children}</ForumShell>;
}

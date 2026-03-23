import { ForumShell } from "@/components/forum/shell";
import { getTenantServerOrNotFound } from "./_lib/tenant";

type Props = {
	children: React.ReactNode;
	params: Promise<{ domain: string }>;
};

export default async function Layout(props: Props) {
	const { domain } = await props.params;
	await getTenantServerOrNotFound(domain);

	return <ForumShell>{props.children}</ForumShell>;
}

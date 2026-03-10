import { notFound, permanentRedirect } from "next/navigation";
import { getTenantServerOrNotFound } from "../../_lib/tenant";

export default async function Page({
	params,
}: {
	params: Promise<{ domain: string; id: string }>;
}) {
	const { domain, id } = await params;
	const { server } = await getTenantServerOrNotFound(domain);

	if (server.id !== id) {
		notFound();
	}

	permanentRedirect("/");
}

/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: it's oki */
import { codeToHtml } from "shiki";

async function highlightCode(code: string, lang = "plaintext") {
	const html = await codeToHtml(code, {
		lang,
		theme: "one-light",
	});

	return html;
}

export async function Code({
	code,
	language,
	isInline = false,
}: {
	code: string;
	language?: string;
	isInline?: boolean;
}) {
	const highlightedCode = await highlightCode(code, language);

	if (isInline) {
		return (
			<span
				className="inline-code not-prose inline-block rounded border border-neutral-300 text-sm *:whitespace-normal"
				dangerouslySetInnerHTML={{
					__html: highlightedCode,
				}}
			/>
		);
	}
	return (
		<div
			className="not-prose overflow-auto rounded border border-neutral-300 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2"
			dangerouslySetInnerHTML={{
				__html: highlightedCode,
			}}
		/>
	);
}

import { codeToHtml } from 'shiki';

async function highlightCode(code: string, lang = 'plaintext') {
  const html = await codeToHtml(code, {
    lang,
    theme: 'one-light',
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
      className="not-prose rounded border border-neutral-300"
      dangerouslySetInnerHTML={{
        __html: highlightedCode,
      }}
    />
  );
}

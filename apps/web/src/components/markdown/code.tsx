import { codeToHtml } from 'shiki';

async function highlightCode(code: string, lang = "plaintext") {
  const html = await codeToHtml(code, {
    lang,
    theme: 'one-light',
  });

  return html;
}

export async function Code({ code, language, isInline = false }: { code: string; language?: string; isInline?: boolean }) {
  const highlightedCode = await highlightCode(code, language);

  if (isInline) {
    return <span className='*:whitespace-normal inline-block text-sm inline-code rounded border border-neutral-300 not-prose'
      dangerouslySetInnerHTML={{
        __html: highlightedCode,
      }} />
  }
  return (
    <div
      className='rounded border border-neutral-300 not-prose'
      dangerouslySetInnerHTML={{
        __html: highlightedCode,
      }}
    />
  );
}
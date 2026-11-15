import * as React from 'react';

// The little Markdown the specs and changelogs use: paragraphs, `- ` lists,
// `code` and [links](https://…). Anything else stays as written, as text:
// nothing here is ever HTML.

function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 1)
          return <code key={i}>{part.slice(1, -1)}</code>;
        const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
        if (link)
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {link[1]}
            </a>
          );
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export function InlineText({ text }: { text: string }) {
  return <Inline text={text.replace(/\s*\n\s*/g, ' ')} />;
}

export function Prose({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l, j) => /^\s*[-*] /.test(l) || (j > 0 && /^\s{2,}\S/.test(l)))) {
          const items: string[] = [];
          for (const l of lines) {
            if (/^\s*[-*] /.test(l)) items.push(l.replace(/^\s*[-*] /, ''));
            else items[items.length - 1] += ` ${l.trim()}`;
          }
          return (
            <ul key={i} className="my-2 list-disc ps-5">
              {items.map((item, j) => (
                <li key={j}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-2">
            <InlineText text={block} />
          </p>
        );
      })}
    </div>
  );
}

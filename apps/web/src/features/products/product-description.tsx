import type { Product } from '@eum/api/types';
import type { ReactNode } from 'react';

function isSafeHref(value: string): boolean {
  if (
    Array.from(value).some((character) => (character.codePointAt(0) ?? 0) < 33) ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return false;
  }
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\+\+[^+]+\+\+|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('++') && part.endsWith('++')) {
      return <u key={key}>{part.slice(2, -2)}</u>;
    }
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (linkMatch?.[1] && linkMatch[2] && isSafeHref(linkMatch[2])) {
      return (
        <a key={key} href={linkMatch[2]} className="underline" rel="nofollow">
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

/** Admin 상세 설명의 제한된 Markdown 서식을 안전한 React 노드로 표시합니다. */
export function ProductDescription({
  content,
  format,
}: {
  content: string;
  format?: Product['detailDescriptionFormat'];
}) {
  if (format !== 'rich-v1') {
    return <div className="mb-20 text-body-m whitespace-pre-line text-text-2">{content}</div>;
  }

  const lines = content.split('\n');
  return (
    <div className="mb-20 text-body-m text-text-2">
      {lines.map((line, index) =>
        line.startsWith('- ') ? (
          <ul key={`line-${index}`} className="list-disc pl-24">
            <li>{renderInline(line.slice(2), `line-${index}`)}</li>
          </ul>
        ) : line ? (
          <p key={`line-${index}`}>
            {renderInline(line, `line-${index}`)}
            {index < lines.length - 1 ? <br /> : null}
          </p>
        ) : (
          <br key={`line-${index}`} />
        ),
      )}
    </div>
  );
}

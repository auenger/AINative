import React from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// MarkdownRenderer — wraps react-markdown with dark-theme styling
// ---------------------------------------------------------------------------

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/** Custom heading components with size hierarchy */
const Heading: Record<string, React.FC<React.HTMLAttributes<HTMLHeadingElement>>> = {
  h1: ({ children, ...props }) => (
    <h1 className="text-xl font-bold text-on-surface mt-6 mb-3 pb-2 border-b border-outline-variant/20" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-lg font-bold text-on-surface mt-5 mb-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base font-bold text-on-surface mt-4 mb-2" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-sm font-bold text-on-surface mt-3 mb-1.5" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="text-xs font-bold text-on-surface-variant mt-3 mb-1" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="text-[10px] font-bold text-on-surface-variant mt-2 mb-1 uppercase tracking-widest" {...props}>
      {children}
    </h6>
  ),
};

/** Paragraph */
const MdParagraph: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, ...props }) => (
  <p className="text-sm text-on-surface-variant leading-relaxed mb-3" {...props}>
    {children}
  </p>
);

/** Unordered list */
const MdUl: React.FC<React.HTMLAttributes<HTMLUListElement>> = ({ children, ...props }) => (
  <ul className="list-disc list-inside space-y-1 mb-3 ml-2 text-sm text-on-surface-variant" {...props}>
    {children}
  </ul>
);

/** Ordered list */
const MdOl: React.FC<React.HTMLAttributes<HTMLOListElement>> = ({ children, ...props }) => (
  <ol className="list-decimal list-inside space-y-1 mb-3 ml-2 text-sm text-on-surface-variant" {...props}>
    {children}
  </ol>
);

/** List item — detects GFM task checkbox patterns */
const MdLi: React.FC<React.LiHTMLAttributes<HTMLLIElement>> = ({ children, ...props }) => {
  return (
    <li className="text-sm text-on-surface-variant leading-relaxed" {...props}>
      {children}
    </li>
  );
};

/** Inline code */
const MdInlineCode: React.FC<React.HTMLAttributes<HTMLElement>> = ({ children, ...props }) => (
  <code
    className="bg-surface-container-highest text-primary px-1.5 py-0.5 rounded text-[12px] font-mono"
    {...props}
  >
    {children}
  </code>
);

/** Code block */
const MdPre: React.FC<React.HTMLAttributes<HTMLPreElement>> = ({ children, ...props }) => (
  <pre
    className="bg-surface-container-highest border border-outline-variant/10 p-4 rounded-lg overflow-x-auto mb-4 text-[12px] leading-relaxed font-mono"
    {...props}
  >
    {children}
  </pre>
);

/** Blockquote */
const MdBlockquote: React.FC<React.HTMLAttributes<HTMLQuoteElement>> = ({ children, ...props }) => (
  <blockquote
    className="border-l-2 border-primary/40 pl-4 my-3 text-sm text-on-surface-variant italic opacity-80"
    {...props}
  >
    {children}
  </blockquote>
);

/** Link */
const MdLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({ children, href, ...props }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
    {...props}
  >
    {children}
  </a>
);

/** Table */
const MdTable: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, ...props }) => (
  <div className="overflow-x-auto mb-4 rounded-lg border border-outline-variant/10">
    <table className="w-full text-sm" {...props}>
      {children}
    </table>
  </div>
);

/** Table head */
const MdThead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => (
  <thead className="bg-surface-container-high/50" {...props}>
    {children}
  </thead>
);

/** Table body */
const MdTbody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => (
  <tbody className="divide-y divide-outline-variant/10" {...props}>
    {children}
  </tbody>
);

/** Table row */
const MdTr: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, ...props }) => (
  <tr className="hover:bg-surface-container-high/20 transition-colors" {...props}>
    {children}
  </tr>
);

/** Table header cell */
const MdTh: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, ...props }) => (
  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-outline" {...props}>
    {children}
  </th>
);

/** Table data cell */
const MdTd: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, ...props }) => (
  <td className="px-3 py-2 text-xs text-on-surface-variant" {...props}>
    {children}
  </td>
);

/** Horizontal rule */
const MdHr: React.FC<React.HTMLAttributes<HTMLHRElement>> = (props) => (
  <hr className="border-outline-variant/20 my-4" {...props} />
);

/** Strong */
const MdStrong: React.FC<React.HTMLAttributes<HTMLElement>> = ({ children, ...props }) => (
  <strong className="font-bold text-on-surface" {...props}>
    {children}
  </strong>
);

/** Emphasis */
const MdEm: React.FC<React.HTMLAttributes<HTMLElement>> = ({ children, ...props }) => (
  <em className="italic text-on-surface" {...props}>
    {children}
  </em>
);

// Build the component map for react-markdown
const components = {
  h1: Heading.h1,
  h2: Heading.h2,
  h3: Heading.h3,
  h4: Heading.h4,
  h5: Heading.h5,
  h6: Heading.h6,
  p: MdParagraph,
  ul: MdUl,
  ol: MdOl,
  li: MdLi,
  code: MdInlineCode,
  pre: MdPre,
  blockquote: MdBlockquote,
  a: MdLink,
  table: MdTable,
  thead: MdThead,
  tbody: MdTbody,
  tr: MdTr,
  th: MdTh,
  td: MdTd,
  hr: MdHr,
  strong: MdStrong,
  em: MdEm,
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  if (!content || content.trim().length === 0) {
    return null;
  }

  return (
    <div className={cn('md-renderer', className)}>
      <ReactMarkdown components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

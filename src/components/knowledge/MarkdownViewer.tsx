"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "./MermaidBlock";
import type { Components } from "react-markdown";

interface MarkdownViewerProps {
  content: string;
}

const components: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-[#F0F0F0] mt-8 mb-4 pb-2 border-b border-[rgba(255,255,255,0.08)] first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-[#F0F0F0] mt-7 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-[#DEDEDE] mt-5 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-[#DEDEDE] mt-4 mb-1.5 uppercase tracking-wide">{children}</h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="text-[#C0C0C0] leading-relaxed mb-4 text-sm">{children}</p>
  ),

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#F7941D] hover:text-[#e8851a] underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),

  // Code blocks
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    const code = String(children).replace(/\n$/, "");

    // Inline code
    if (!match) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-[rgba(247,148,29,0.1)] text-[#F7941D] text-xs font-mono border border-[rgba(247,148,29,0.15)]"
          {...props}
        >
          {children}
        </code>
      );
    }

    // Mermaid diagrams
    if (lang === "mermaid") {
      return <MermaidBlock code={code} />;
    }

    // Code block
    return (
      <div className="my-4 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)]">
        {lang && (
          <div className="flex items-center justify-between px-4 py-2 bg-[rgba(255,255,255,0.04)] border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-[10px] font-mono text-[#606060] uppercase tracking-wider">{lang}</span>
          </div>
        )}
        <pre className="bg-[#0D0D0D] px-4 py-3 overflow-x-auto">
          <code className="text-xs font-mono text-[#C8C8C8] leading-relaxed whitespace-pre">{children}</code>
        </pre>
      </div>
    );
  },

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="my-4 pl-4 border-l-2 border-[#F7941D]/40 text-[#9A9A9A] italic">
      {children}
    </blockquote>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="my-3 space-y-1 pl-5 list-none">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 space-y-1 pl-5 list-decimal marker:text-[#606060]">{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-[#C0C0C0] text-sm leading-relaxed flex gap-2">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#F7941D]/50 flex-shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),

  // Tables
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)]">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[rgba(255,255,255,0.04)]">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">{children}</tbody>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#9A9A9A] uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-xs text-[#C0C0C0]">{children}</td>
  ),

  // Horizontal rule
  hr: () => <hr className="my-6 border-[rgba(255,255,255,0.08)]" />,

  // Strong / em
  strong: ({ children }) => (
    <strong className="font-semibold text-[#F0F0F0]">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-[#DEDEDE]">{children}</em>
  ),

  // Task list items (GFM)
  input: ({ type, checked, ...props }) => {
    if (type === "checkbox") {
      return (
        <span
          className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border mr-1.5 flex-shrink-0 ${
            checked
              ? "bg-[#F7941D] border-[#F7941D]"
              : "border-[rgba(255,255,255,0.2)] bg-transparent"
          }`}
        >
          {checked && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      );
    }
    return <input type={type} checked={checked} {...props} />;
  },
};

// Override li to handle task list items differently
const componentsWithTaskList: Components = {
  ...components,
  li: ({ children, className, ...props }) => {
    const isTaskItem = className?.includes("task-list-item");
    if (isTaskItem) {
      return (
        <li className={`text-[#C0C0C0] text-sm leading-relaxed flex gap-2 items-start ${className ?? ""}`} {...props}>
          {children}
        </li>
      );
    }
    return (
      <li className="text-[#C0C0C0] text-sm leading-relaxed flex gap-2" {...(props as object)}>
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#F7941D]/50 flex-shrink-0" />
        <span className="flex-1">{children}</span>
      </li>
    );
  },
};

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="min-h-full">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentsWithTaskList}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown text-base">
      <ReactMarkdown remarkPlugins={plugins}>{text}</ReactMarkdown>
    </div>
  );
});

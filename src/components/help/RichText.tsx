import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** Renders the small markdown the guides and the assistant use: paragraphs, lists, **bold**, and [[screen:key|Label]] links. */
export const RichText = ({ text, onScreen }: { text: string; onScreen?: (key: string) => void }) => {
  const inline = (s: string, k: string): ReactNode[] =>
    s.split(/(\[\[screen:[a-z-]+\|[^\]]+\]\]|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => {
      const link = part.match(/^\[\[screen:([a-z-]+)\|([^\]]+)\]\]$/);
      if (link) {
        return onScreen
          ? <button key={`${k}${i}`} type="button" onClick={() => onScreen(link[1])}
              className="inline-flex items-center gap-0.5 rounded bg-blue-50 dark:bg-blue-950 px-1.5 text-blue-700 dark:text-blue-300 font-medium hover:underline">
              {link[2]}<ArrowRight className="h-3 w-3" /></button>
          : <b key={`${k}${i}`}>{link[2]}</b>;
      }
      if (part.startsWith("**")) return <b key={`${k}${i}`}>{part.slice(2, -2)}</b>;
      return <span key={`${k}${i}`}>{part}</span>;
    });
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*(\d+[.)]|[-*•])\s+/.test(l) || !l.trim())) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.filter((l) => l.trim()).map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s+/, ""));
          const Tag = ordered ? "ol" : "ul";
          return <Tag key={bi} className={`${ordered ? "list-decimal" : "list-disc"} ml-5 space-y-1`}>{items.map((it, ii) => <li key={ii}>{inline(it, `${bi}-${ii}-`)}</li>)}</Tag>;
        }
        // a heading line followed by a list
        if (lines.length > 1 && lines.slice(1).every((l) => /^\s*(\d+[.)]|[-*•])\s+/.test(l))) {
          const ordered = /^\s*\d/.test(lines[1]);
          const Tag = ordered ? "ol" : "ul";
          return (
            <div key={bi}><p>{inline(lines[0].replace(/^#+\s*/, ""), `${bi}h`)}</p>
              <Tag className={`${ordered ? "list-decimal" : "list-disc"} ml-5 space-y-1 mt-1`}>
                {lines.slice(1).map((l, ii) => <li key={ii}>{inline(l.replace(/^\s*(\d+[.)]|[-*•])\s+/, ""), `${bi}-${ii}-`)}</li>)}</Tag></div>
          );
        }
        return <p key={bi}>{lines.map((l, li) => <span key={li}>{li > 0 && <br />}{inline(l.replace(/^#+\s*/, ""), `${bi}-${li}-`)}</span>)}</p>;
      })}
    </div>
  );
};

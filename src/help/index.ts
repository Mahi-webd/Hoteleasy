// The in-app guides (src/help/articles/*.md). The assistant gets the same text (scripts/build-help.mjs).
export interface Article { id: string; title: string; screen: string; tags: string[]; body: string }

const files = import.meta.glob("./articles/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const ARTICLES: Article[] = Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([path, raw]) => {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta: Record<string, string> = {};
  (m?.[1] ?? "").split("\n").forEach((l) => { const i = l.indexOf(":"); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  return {
    id: path.replace(/^.*\/(.*)\.md$/, "$1"), title: meta.title ?? "", screen: meta.screen ?? "",
    tags: (meta.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean), body: (m?.[2] ?? raw).trim(),
  };
});

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(["how", "the", "and", "for", "can", "what", "where", "this", "that", "with", "does", "want", "need", "you", "are", "please", "into", "from", "when", "who", "why", "your", "our", "his", "her", "its", "get", "make"]);

/** Simple search: tags and title count most, then the text. */
export const searchArticles = (q: string, screen?: string, limit = 5): Article[] => {
  const ws = words(q);
  if (!ws.length) return screen ? ARTICLES.filter((a) => a.screen === screen).slice(0, limit) : [];
  return ARTICLES.map((a) => {
    const title = a.title.toLowerCase(); const body = a.body.toLowerCase(); const tags = a.tags.join(" ");
    let score = 0;
    for (const w of ws) {
      const stem = w.replace(/(ing|ed|es|s)$/, "");
      if (tags.includes(stem)) score += 4;
      if (title.includes(stem)) score += 3;
      if (body.includes(stem)) score += 1;
    }
    if (screen && a.screen === screen) score += 0.5;
    return { a, score };
  }).filter((x) => x.score >= 2).sort((x, y) => y.score - x.score).slice(0, limit).map((x) => x.a);
};

/** Questions to start with, by screen. */
export const SUGGESTED: Record<string, string[]> = {
  dashboard: ["How do I check in a guest?", "How do I make a new booking?", "What should I set up first?"],
  reservations: ["How do I check in a guest?", "How do I check out a guest and print the invoice?", "How do I extend a guest's stay?"],
  billing: ["How do I take an M-Pesa payment?", "How do I add a laundry charge to a bill?", "How do I void a payment entered by mistake?"],
  pos: ["How do I bill a table and take payment?", "How do I charge a meal to a guest's room?", "How do I give a discount?"],
  kds: ["How does the kitchen screen work?"],
  housekeeping: ["How do I mark a room as cleaned?", "How do I report a problem in a room?"],
  maintenance: ["How do I report a problem?", "How do I mark a repair as fixed?"],
  audit: ["How do I close the day?", "What does 'day is closed' mean?"],
  rates: ["How do I set weekend prices?", "How do I add half board?"],
  inventory: ["How do I receive goods from a supplier?", "How do I do a stock count?"],
  staff: ["How do I make the rota?", "How do I run payroll?"],
  "my-shifts": ["How do I clock in?", "How do I ask for leave?"],
  settings: ["How do I invite a new staff member?", "How do I set up M-Pesa prompts?"],
  roles: ["How do I make a role that can't give refunds?"],
  companies: ["How do I bill a company for a stay?"],
  channels: ["How do I connect Airbnb?"],
  online: ["How do I share my booking page?"],
  "online-checkin": ["How does online check-in work?"],
  requests: ["How do guests send requests?"],
  finance: ["How do I record an expense?"],
  reports: ["Where do I see occupancy for last month?"],
};

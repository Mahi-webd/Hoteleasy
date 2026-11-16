import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpen, Loader2, MessageCircleQuestion, Search, Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { ARTICLES, SUGGESTED, searchArticles, type Article } from "@/help";
import { RichText } from "./RichText";

interface Msg { role: "user" | "assistant"; content: string; id?: string | null; guides?: Article[]; note?: string; rated?: boolean }

/** "Ask HotelEasy": a help button on every staff screen, with an assistant and the guides. */
export const HelpAssistant = ({ screen, onNavigate }: { screen: string; onNavigate: (key: string) => void }) => {
  const { hotel } = useCurrentHotel();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ask" | "guides">("ask");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);
  const [find, setFind] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("hoteleasy:help", show);
    return () => window.removeEventListener("hoteleasy:help", show);
  }, []);
  // on busy touch screens (POS, kitchen) the floating button could cover a Pay button: use the top-bar button there
  const floating = !["pos", "kds"].includes(screen);

  const go = (key: string) => { onNavigate(key); setOpen(false); };

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs(history); setText(""); setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistant", {
        body: { hotel_id: hotel.id, screen, messages: history.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error || !data || data.fallback || !data.answer) {
        const guides = searchArticles(question, screen, 3);
        setMsgs([...history, {
          role: "assistant", guides,
          content: guides.length ? "These guides should help:" : "I couldn't find a guide for that. Try other words, or ask a manager.",
          note: data?.message ?? (error ? "The assistant isn't reachable right now." : undefined),
        }]);
      } else {
        setMsgs([...history, { role: "assistant", content: data.answer, id: data.id }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const rate = async (i: number, helpful: boolean) => {
    const m = msgs[i];
    if (!m.id) return;
    setMsgs((x) => x.map((y, j) => (j === i ? { ...y, rated: true } : y)));
    await supabase.rpc("assistant_feedback" as never, { _id: m.id, _helpful: helpful } as never);
  };

  const submit = (e: FormEvent) => { e.preventDefault(); ask(text); };
  const suggestions = SUGGESTED[screen] ?? SUGGESTED.dashboard;
  const found = find.trim() ? searchArticles(find, undefined, 8) : ARTICLES;

  return (
    <>
      {floating && <Button onClick={() => setOpen(true)} aria-label="Help: ask HotelEasy"
        className="fixed bottom-5 right-5 z-40 rounded-full h-12 shadow-lg bg-blue-700 hover:bg-blue-800 print:hidden pl-4 pr-5">
        <MessageCircleQuestion className="h-5 w-5 mr-2" />Help
      </Button>}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="p-4 border-b space-y-1">
            <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" />Ask HotelEasy</SheetTitle>
            <SheetDescription>How to do anything in HotelEasy, in plain words.</SheetDescription>
            <div className="flex gap-1 pt-2">
              <Button size="sm" variant={tab === "ask" ? "default" : "ghost"} onClick={() => setTab("ask")}><MessageCircleQuestion className="mr-1 h-4 w-4" />Ask</Button>
              <Button size="sm" variant={tab === "guides" ? "default" : "ghost"} onClick={() => { setTab("guides"); setArticle(null); }}><BookOpen className="mr-1 h-4 w-4" />Guides</Button>
            </div>
          </SheetHeader>

          {tab === "ask" ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="help-chat">
                {!msgs.length && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">Ask how to do something, for example how to check a guest out or bill a table. I explain; I can't change anything for you.</p>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s) => (
                        <button key={s} onClick={() => ask(s)} className="text-left text-sm rounded-lg border px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                    <div className={m.role === "user" ? "rounded-2xl rounded-br-sm bg-blue-700 text-white px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap"
                      : "rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-slate-800 px-3 py-2 max-w-[95%]"} data-testid={m.role === "assistant" ? "help-answer" : undefined}>
                      {m.role === "user" ? m.content : (
                        <>
                          {m.note && <p className="text-xs text-slate-500 mb-1">{m.note}</p>}
                          <RichText text={m.content} onScreen={go} />
                          {m.guides?.map((g) => (
                            <button key={g.id} onClick={() => { setTab("guides"); setArticle(g); }} className="mt-2 flex w-full items-center gap-2 rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 text-left text-sm hover:bg-slate-50">
                              <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />{g.title}</button>
                          ))}
                          {m.id && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                              {m.rated ? "Thanks for the feedback." : (<>Did this help?
                                <button aria-label="Helpful" className="p-1 hover:text-green-600" onClick={() => rate(i, true)}><ThumbsUp className="h-3.5 w-3.5" /></button>
                                <button aria-label="Not helpful" className="p-1 hover:text-red-600" onClick={() => rate(i, false)}><ThumbsDown className="h-3.5 w-3.5" /></button></>)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {busy && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Thinking…</div>}
                <div ref={end} />
              </div>
              <form onSubmit={submit} className="border-t p-3 flex gap-2 items-end">
                <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. How do I charge a meal to a guest's room?"
                  aria-label="Your question" className="resize-none"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
                <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Ask"><Send className="h-4 w-4" /></Button>
              </form>
              {msgs.length > 0 && <button className="text-xs text-slate-500 pb-2" onClick={() => setMsgs([])}>Start again</button>}
            </>
          ) : article ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="help-article">
              <button className="text-sm text-blue-700 flex items-center gap-1" onClick={() => setArticle(null)}><ArrowLeft className="h-4 w-4" />All guides</button>
              <h3 className="font-semibold text-lg">{article.title}</h3>
              <RichText text={article.body} onScreen={go} />
              <Button size="sm" variant="outline" onClick={() => go(article.screen)}>Open this screen</Button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input className="pl-8" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search the guides" aria-label="Search the guides" /></div>
              <div className="flex flex-col gap-1">
                {found.map((g) => (
                  <button key={g.id} onClick={() => setArticle(g)} className="text-left text-sm rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 border">{g.title}</button>
                ))}
                {!found.length && <p className="text-sm text-slate-500">No guide matches. Try other words, or ask in the Ask tab.</p>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

/** Small Help button for the top bar (opens the same panel). */
export const HelpButton = () => (
  <Button variant="ghost" size="icon" aria-label="Help" title="Help: ask HotelEasy" onClick={() => window.dispatchEvent(new Event("hoteleasy:help"))}>
    <MessageCircleQuestion className="h-5 w-5" />
  </Button>
);

// WhatsApp: inbox (guests' chats, the bot's answers, take over / hand back, replies) and per-hotel setup.
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { Bot, Copy, ExternalLink, Info, Loader2, MessageCircle, RefreshCw, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import {
  markRead, useConversations, useEnsureWebhook, useMessages, useNewWebhook, useSaveWhatsApp, useSendReply, useSetMode, useWhatsAppSettings,
  webhookUrl, windowOpen, type WaConversation, type WhatsAppSettings,
} from "@/hooks/useWhatsApp";
import { cn } from "@/lib/utils";

const copy = async (text: string, what: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Could not copy; select and copy it yourself"); }
};
const who = (c: WaConversation) => c.name || `+${c.wa_id}`;

const WhatsAppPage = () => {
  const { allowed } = useCurrentHotel();
  const settings = useWhatsAppSettings();
  const admin = allowed("whatsapp.edit");
  const [tab, setTab] = useState("inbox");
  if (settings.isLoading) return <LoadingBlock />;
  if (settings.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="WhatsApp" />
        <Card><CardContent className="p-6 text-sm space-y-2">
          <p className="font-medium">WhatsApp needs a database update first.</p>
          <p className="text-slate-600">Run <code>supabase/migrations/20261117230000_whatsapp.sql</code> in the Supabase SQL Editor, then reload this page.</p>
        </CardContent></Card>
      </div>
    );
  }
  const s = settings.data;
  return (
    <div className="space-y-4">
      <PageHeader title="WhatsApp" subtitle="Guests write to your WhatsApp number; the bot answers from your hotel's information, or your team replies here" />
      {s && !s.enabled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm flex flex-wrap items-center gap-3">
          <MessageCircle className="h-4 w-4 text-amber-700" />
          <span className="flex-1">WhatsApp isn't connected yet. {admin ? "Connect your number under Setup." : "Ask the owner or a manager to connect it."}</span>
          {admin && <Button size="sm" onClick={() => setTab("setup")}>Set it up</Button>}
        </div>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          {admin && <TabsTrigger value="setup">Setup</TabsTrigger>}
        </TabsList>
        <TabsContent value="inbox"><Inbox s={s} canReply={allowed("whatsapp.reply")} /></TabsContent>
        {admin && s && <TabsContent value="setup"><Setup s={s} /></TabsContent>}
      </Tabs>
    </div>
  );
};
export default WhatsAppPage;

// ---------------------------------------------------------------- free replies meter
const FreeMeter = ({ s }: { s: WhatsAppSettings }) => {
  const pct = s.free_limit ? Math.min(100, Math.round((s.sent_this_month / s.free_limit) * 100)) : 100;
  const left = Math.max(0, s.free_limit - s.sent_this_month);
  return (
    <div className="space-y-1 text-sm" title="Meta gives each WhatsApp number 1,000 free replies a month (replies inside 24 hours of the guest's message).">
      <div className="flex justify-between gap-3"><span className="text-slate-600">Free replies this month</span>
        <span className="tabular-nums font-medium">{s.sent_this_month.toLocaleString()} / {s.free_limit.toLocaleString()}</span></div>
      <Progress value={pct} className={cn("h-2", pct >= 90 && "[&>div]:bg-amber-500")} />
      <p className="text-xs text-slate-500">{left > 0 ? `${left.toLocaleString()} left` : s.stop_at_free_limit ? "Used up: the bot and replies pause until next month" : "Used up: further replies are charged by Meta"}</p>
    </div>
  );
};

// ---------------------------------------------------------------- inbox
const Inbox = ({ s, canReply }: { s: WhatsAppSettings | null; canReply: boolean }) => {
  const list = useConversations();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "staff">("all");
  const rows = useMemo(() => (list.data ?? []).filter((c) => filter === "all" || c.mode === "staff"), [list.data, filter]);
  const open = (list.data ?? []).find((c) => c.id === openId) ?? null;
  const needPerson = (list.data ?? []).filter((c) => c.mode === "staff" && c.unread > 0).length;

  if (list.isLoading) return <LoadingBlock />;
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card className={cn("overflow-hidden", open && "hidden lg:block")}>
        <CardHeader className="pb-3 space-y-3">
          {s && <FreeMeter s={s} />}
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
            <Button size="sm" variant={filter === "staff" ? "default" : "outline"} onClick={() => setFilter("staff")}>
              Need a person{needPerson ? <Badge className="ml-1.5 bg-red-600">{needPerson}</Badge> : null}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!rows.length ? (
            <div className="p-6"><EmptyState icon={MessageCircle} title={filter === "staff" ? "Nobody is waiting for a person" : "No conversations yet"}>
              {filter === "all" && "When a guest writes to your WhatsApp number, the chat appears here."}</EmptyState></div>
          ) : (
            <ul className="divide-y max-h-[65vh] overflow-y-auto">
              {rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { setOpenId(c.id); if (c.unread) markRead(c.id); }}
                    className={cn("w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900", c.id === openId && "bg-slate-100 dark:bg-slate-800")}>
                    <div className="flex items-center gap-2">
                      <span className={cn("flex-1 truncate", c.unread ? "font-semibold" : "font-medium")}>{who(c)}</span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{formatDistanceToNowStrict(new Date(c.last_message_at), { addSuffix: false })}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="flex-1 truncate text-sm text-slate-600">{c.last_preview}</span>
                      {c.mode === "staff" ? <Badge variant="outline" className="border-amber-300 text-amber-800 text-[10px]">Person</Badge>
                        : <Badge variant="outline" className="text-[10px]">Bot</Badge>}
                      {c.unread > 0 && <Badge className="bg-green-600 tabular-nums">{c.unread}</Badge>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {open ? <Chat c={open} s={s} canReply={canReply} onBack={() => setOpenId(null)} />
        : <Card className="hidden lg:flex items-center justify-center min-h-[420px]"><p className="text-sm text-slate-500">Choose a conversation</p></Card>}
    </div>
  );
};

const Chat = ({ c, s, canReply, onBack }: { c: WaConversation; s: WhatsAppSettings | null; canReply: boolean; onBack: () => void }) => {
  const msgs = useMessages(c.id);
  const send = useSendReply();
  const setMode = useSetMode();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.data?.length, c.id]);
  useEffect(() => { if (c.unread) markRead(c.id); }, [c.id, c.unread]);

  const open = windowOpen(c);
  const hoursLeft = c.last_inbound_at ? Math.max(0, 24 - (Date.now() - new Date(c.last_inbound_at).getTime()) / 3600_000) : 0;
  const limitHit = !!s && s.stop_at_free_limit && s.sent_this_month >= s.free_limit;
  const blocked = !s?.enabled ? "WhatsApp is switched off for this hotel."
    : !open ? "More than 24 hours since the guest last wrote. You can reply for free again as soon as they write."
    : limitHit ? "This month's free replies are used up." : "";

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    send.mutate({ conversationId: c.id, body }, { onSuccess: () => setText("") });
  };

  return (
    <Card className="flex flex-col min-h-[520px]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 border-b py-3">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>Back</Button>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base truncate">{who(c)}</CardTitle>
          <CardDescription className="text-xs">+{c.wa_id} · {open ? `Free reply window: ${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m left` : "Reply window closed"}</CardDescription>
        </div>
        {canReply && (c.mode === "bot"
          ? <Button size="sm" variant="outline" disabled={setMode.isPending} onClick={() => setMode.mutate({ id: c.id, mode: "staff" })}><UserRound className="mr-1 h-4 w-4" />Take over</Button>
          : <Button size="sm" variant="outline" disabled={setMode.isPending} onClick={() => setMode.mutate({ id: c.id, mode: "bot" })}><Bot className="mr-1 h-4 w-4" />Let the bot answer</Button>)}
      </CardHeader>
      <CardContent className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] dark:bg-slate-900 p-4 max-h-[60vh]">
        {msgs.isLoading ? <LoadingBlock /> : (msgs.data ?? []).map((m) => (
          <div key={m.id} className={cn("flex", m.direction === "in" ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words",
              m.direction === "in" ? "bg-white dark:bg-slate-800" : m.sender === "bot" ? "bg-sky-100 dark:bg-sky-950" : "bg-[#d9fdd3] dark:bg-emerald-950",
              m.status === "failed" && "ring-1 ring-red-400")}>
              {m.direction === "out" && <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{m.sender === "bot" ? "Bot" : "Staff"}</div>}
              {m.body}
              <div className="mt-1 text-right text-[10px] text-slate-500">
                {format(new Date(m.created_at), "d MMM HH:mm")}
                {m.status === "failed" && <span className="ml-1 text-red-600" title={m.error ?? ""}>· not delivered</span>}
                {m.status === "pending" && <span className="ml-1">· sending…</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </CardContent>
      <div className="border-t p-3 space-y-2">
        {c.mode === "bot" && <p className="text-xs text-slate-500 flex items-center gap-1"><Bot className="h-3.5 w-3.5" />The bot is answering. If you reply, you take over and the bot stays quiet in this chat.</p>}
        {!canReply ? <p className="text-xs text-slate-500">You can read this chat; replying needs the "Reply to guests on WhatsApp" permission.</p>
          : blocked ? <p className="text-sm text-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-md p-2" role="status">{blocked}</p>
          : (
            <div className="flex gap-2">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} placeholder="Write a reply…" aria-label="Reply to the guest"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
              <Button onClick={submit} disabled={send.isPending || !text.trim()} aria-label="Send reply" className="self-end">
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
      </div>
    </Card>
  );
};

// ---------------------------------------------------------------- connection check
/** What Meta last did with this hotel's webhook, in plain words, with the fix to try. */
const ConnectionCheck = ({ s, onUseId }: { s: WhatsAppSettings; onUseId: (id: string) => void }) => {
  if (!("last_hook_result" in s)) return null;   // diagnostics update not run yet
  const when = s.last_hook_at ? formatDistanceToNowStrict(new Date(s.last_hook_at), { addSuffix: true }) : null;
  const ids = (s.last_hook_detail ?? "").split(",").map((x) => x.trim()).filter((x) => /^\d{6,25}$/.test(x));
  const tone = (good: boolean) => good ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30";
  let good = false, title: string, body: React.ReactNode;
  switch (s.last_hook_result) {
    case "ok":
      good = !s.last_send_error;
      title = `Meta is reaching HotelEasy (last message ${when})`;
      body = s.last_send_error ? <SendErrorHelp error={s.last_send_error} /> : "Messages arrive and replies are being sent.";
      break;
    case "test_ok":
      good = true;
      title = `Meta's test message reached HotelEasy ${when}`;
      body = "The Callback URL, verify token and app secret are right. Real guest messages arrive once your Meta app is published (App settings → Basic → publish / Live). Then send a message from your phone.";
      break;
    case "bad_signature":
      title = `Meta reached HotelEasy ${when}, but the app secret doesn't match`;
      body = "Copy the App secret of the same Meta app that has this webhook (App settings → Basic → App secret → Show), paste it below and save. Then send another message.";
      break;
    case "no_secret":
      title = `Meta reached HotelEasy ${when}, but no app secret is saved`;
      body = "Paste the App secret below (App settings → Basic) and save.";
      break;
    case "other_number":
      title = `Meta sent a message ${when} for a different Phone number ID`;
      body = (
        <span>Meta used <code>{ids.join(", ") || s.last_hook_detail}</code>, but <code>{s.phone_number_id ?? "nothing"}</code> is saved. The Phone number ID is under WhatsApp → API Setup (it's not the phone number or the Business Account ID).
          {ids.length === 1 && <Button size="sm" variant="outline" className="ml-2 mt-1" onClick={() => onUseId(ids[0])}>Use {ids[0]}</Button>}
          {ids.length === 1 && <span className="block mt-1">Then click Save.</span>}</span>
      );
      break;
    default:
      title = "Meta hasn't sent anything here yet";
      body = (
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Meta → your app → WhatsApp → <b>Configuration</b>: the Callback URL must be the one below and show as verified.</li>
          <li>Under <b>Webhook fields</b>, click <b>Manage</b> and <b>Subscribe</b> to <b>messages</b>.</li>
          <li>Send a WhatsApp message to your hotel number. With Meta's test number, first add your phone under API Setup → <b>To</b>.</li>
          <li>Reload this page: this box will say what happened.</li>
        </ol>
      );
  }
  return (
    <div className={cn("rounded-lg border p-4 text-sm space-y-1", tone(good))} role="status">
      <div className="font-medium">{good ? "✅ " : "⚠️ "}{title}</div>
      <div className="text-slate-700 dark:text-slate-300">{body}</div>
    </div>
  );
};

const SendErrorHelp = ({ error }: { error: string }) => {
  const e = error.toLowerCase();
  const hint = /token|session|oauth|expired|190/.test(e) ? "The access token was refused or has expired. Use a permanent System User token and save it below."
    : /recipient|allowed list|131030/.test(e) ? "With Meta's test number, replies only go to numbers added under WhatsApp → API Setup → To. Add the guest's number there, or use your real business number."
    : /window|re-engagement|131047/.test(e) ? "More than 24 hours since the guest wrote; WhatsApp only allows free replies after the guest writes again."
    : "Check the access token and phone number in Meta.";
  return <span>A reply could not be sent: <i>{error}</i>. {hint}</span>;
};

// ---------------------------------------------------------------- setup
const Setup =({ s }: { s: WhatsAppSettings }) => {
  const save = useSaveWhatsApp();
  const newHook = useNewWebhook();
  useEnsureWebhook(s);
  const init = () => ({
    enabled: s.enabled, bot_enabled: s.bot_enabled, bot_mode: (s.bot_mode ?? "menu") as "menu" | "ai",
    phone_number_id: s.phone_number_id ?? "", waba_id: s.waba_id ?? "",
    display_number: s.display_number ?? "", bot_name: s.bot_name ?? "", instructions: s.instructions ?? "", handoff_message: s.handoff_message ?? "",
    free_limit: s.free_limit, stop_at_free_limit: s.stop_at_free_limit, access_token: "", app_secret: "",
  });
  const [f, setF] = useState(init);
  useEffect(() => setF(init()), [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const url = s.hook_key ? webhookUrl(s.hook_key) : "";
  const idProblem = f.phone_number_id && !/^\d{6,25}$/.test(f.phone_number_id.trim()) ? "The Phone number ID is the long number from Meta, digits only." : "";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px] items-start">
      <div className="space-y-4">
        <ConnectionCheck s={s} onUseId={(id) => set("phone_number_id", id)} />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">1. Connect your WhatsApp number</CardTitle>
            <CardDescription>From your Meta app: <a className="underline inline-flex items-center gap-1" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps<ExternalLink className="h-3 w-3" /></a> → your app → WhatsApp → API Setup.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="wa-pnid">Phone number ID</Label><Input id="wa-pnid" inputMode="numeric" value={f.phone_number_id} onChange={(e) => set("phone_number_id", e.target.value.replace(/\s/g, ""))} placeholder="e.g. 123456789012345" />
                {idProblem && <p className="text-xs text-red-600">{idProblem}</p>}</div>
              <div className="space-y-1"><Label htmlFor="wa-waba">WhatsApp Business Account ID</Label><Input id="wa-waba" inputMode="numeric" value={f.waba_id} onChange={(e) => set("waba_id", e.target.value.replace(/\s/g, ""))} placeholder="optional" /></div>
              <div className="space-y-1"><Label htmlFor="wa-num">The number guests write to</Label><Input id="wa-num" value={f.display_number} onChange={(e) => set("display_number", e.target.value)} placeholder="+254 7xx xxx xxx" /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="wa-token">Access token</Label>
                <Input id="wa-token" type="password" autoComplete="off" value={f.access_token} onChange={(e) => set("access_token", e.target.value)} placeholder={s.has_access_token ? "Saved. Leave empty to keep it" : "Permanent token (System User)"} />
                <p className="text-xs text-slate-500">Use a permanent System User token with <code>whatsapp_business_messaging</code>. Temporary test tokens stop after 24 hours.</p></div>
              <div className="space-y-1"><Label htmlFor="wa-secret">App secret</Label>
                <Input id="wa-secret" type="password" autoComplete="off" value={f.app_secret} onChange={(e) => set("app_secret", e.target.value)} placeholder={s.has_app_secret ? "Saved. Leave empty to keep it" : "App settings → Basic → App secret"} />
                <p className="text-xs text-slate-500">Used to check that messages really come from Meta.</p></div>
            </div>
            <p className="text-xs text-slate-500 flex items-start gap-1"><Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />The token and secret are stored so that nobody, including you, can read them back. To change one, type the new value.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">2. Tell Meta where to send messages</CardTitle>
            <CardDescription>In your Meta app: WhatsApp → Configuration → Webhook → Edit. Paste these two, click Verify and save, then subscribe to <b>messages</b>.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Callback URL</Label>
              <div className="flex gap-2"><Input readOnly value={url} className="font-mono text-xs" aria-label="Callback URL" /><Button variant="outline" size="icon" onClick={() => copy(url, "Callback URL")} aria-label="Copy callback URL"><Copy className="h-4 w-4" /></Button></div></div>
            <div className="space-y-1"><Label>Verify token</Label>
              <div className="flex gap-2"><Input readOnly value={s.verify_token ?? ""} className="font-mono text-xs" aria-label="Verify token" /><Button variant="outline" size="icon" onClick={() => copy(s.verify_token ?? "", "Verify token")} aria-label="Copy verify token"><Copy className="h-4 w-4" /></Button></div></div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="flex-1">This address is only for your hotel. Keep it private.</span>
              <Button variant="ghost" size="sm" disabled={newHook.isPending} onClick={() => { if (window.confirm("Make a new address and token? You'll need to paste the new ones into Meta.")) newHook.mutate(); }}><RefreshCw className="mr-1 h-3.5 w-3.5" />Make a new address</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">3. The bot</CardTitle>
            <CardDescription>Answers guests from your HotelEasy information and hands the chat to your team when needed. Your team can take over any chat at any time.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 rounded-md border p-3">
              <Switch checked={f.bot_enabled} onCheckedChange={(v) => set("bot_enabled", v)} aria-label="Bot answers guests" />
              <span><span className="font-medium">{f.bot_enabled ? "The bot answers guests" : "Only your team answers"}</span>
                <span className="block text-xs text-slate-500">When off, every message waits in the Inbox for your team.</span></span>
            </label>
            {f.bot_enabled && (
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Type of bot">
                {([
                  ["menu", "Menu bot (free)", "Menu and buttons: rooms & prices, check availability for dates, the guest's booking, location & contact, talk to staff. Uses only your HotelEasy data. No AI, no extra cost."],
                  ["ai", "Smart bot (AI)", "Understands free questions in English or Swahili, plus your extra facts below. Needs the ANTHROPIC_API_KEY secret (Claude, paid per use). Without it, the menu bot answers."],
                ] as const).map(([k, title, text]) => (
                  <button key={k} type="button" role="radio" aria-checked={f.bot_mode === k} onClick={() => set("bot_mode", k)}
                    className={cn("rounded-lg border p-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900", f.bot_mode === k && "ring-2 ring-primary")}>
                    <span className="font-medium">{title}</span><span className="mt-1 block text-xs text-slate-500">{text}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {f.bot_mode === "ai" && <div className="space-y-1"><Label htmlFor="wa-name">Bot's name (optional)</Label><Input id="wa-name" maxLength={40} value={f.bot_name} onChange={(e) => set("bot_name", e.target.value)} placeholder="e.g. Amani" /></div>}
              <div className="space-y-1"><Label htmlFor="wa-hand">Message when handing over (optional)</Label><Input id="wa-hand" maxLength={500} value={f.handoff_message} onChange={(e) => set("handoff_message", e.target.value)} placeholder="A member of our team will reply shortly." /></div>
            </div>
            {f.bot_mode === "ai" && (
              <div className="space-y-1"><Label htmlFor="wa-notes">Extra facts for the bot (optional)</Label>
                <Textarea id="wa-notes" rows={4} maxLength={4000} value={f.instructions} onChange={(e) => set("instructions", e.target.value)}
                  placeholder={["Airport pickup from JKIA: KES 3,500 one way, book a day ahead.", "Parking is free.", "Pool open 7am–9pm. Gym 24h."].join("\n")} />
                <p className="text-xs text-slate-500">Anything guests often ask that isn't on your booking page. The bot only says what it's told.</p></div>
            )}
            <p className="text-xs text-slate-500">The bot reads your rooms, prices and availability from the booking page, so keep it switched on (Online → Setup). Guests are recognised by their WhatsApp number when it matches the phone on their booking.</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Cost</CardTitle>
            <CardDescription>HotelEasy only <b>replies</b> to guests who write first, within 24 hours. It never starts chats or sends templates, which are always charged.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <FreeMeter s={s} />
            <div className="space-y-1"><Label htmlFor="wa-limit">Free replies per month</Label>
              <Input id="wa-limit" type="number" min={0} max={100000} value={f.free_limit} onChange={(e) => set("free_limit", Math.max(0, Number(e.target.value) || 0))} />
              <p className="text-xs text-slate-500">Meta's free tier: 1,000 replies per WhatsApp number per month (since 1 Oct 2026). Change it if Meta changes.</p></div>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={f.stop_at_free_limit} onCheckedChange={(v) => set("stop_at_free_limit", v)} />
              <span>Stop at the free limit <span className="block text-xs text-slate-500">After that, messages still arrive here but nothing is sent until next month, so Meta never charges you.</span></span>
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <label className="flex items-center gap-3 rounded-md border p-3">
              <Switch checked={f.enabled} onCheckedChange={(v) => set("enabled", v)} aria-label="WhatsApp on" />
              <span><span className="font-medium">{f.enabled ? "WhatsApp is on" : "WhatsApp is off"}</span>
                <span className="block text-xs text-slate-500">Needs the Phone number ID, access token and app secret.</span></span>
            </label>
            <Button className="w-full" disabled={save.isPending || !!idProblem} onClick={() => save.mutate({ ...f, phone_number_id: f.phone_number_id.trim() }, { onSuccess: () => setF((x) => ({ ...x, access_token: "", app_secret: "" })) })}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

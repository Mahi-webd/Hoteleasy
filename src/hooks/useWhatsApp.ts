// WhatsApp: per-hotel setup, the inbox (live), staff replies through the `whatsapp` Edge Function.
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";

const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as T;
};

export interface WhatsAppSettings {
  enabled: boolean; bot_enabled: boolean; bot_mode?: "menu" | "ai"; phone_number_id: string | null; waba_id: string | null; display_number: string | null;
  bot_name: string | null; instructions: string | null; handoff_message: string | null; free_limit: number; stop_at_free_limit: boolean;
  sent_this_month: number; can_edit: boolean; hook_key: string | null; verify_token: string | null;
  has_access_token: boolean; has_app_secret: boolean; ready: boolean;
  /** Last call from Meta (missing until the whatsapp_diagnostics update has run). */
  last_hook_at?: string | null; last_hook_result?: "ok" | "test_ok" | "bad_signature" | "no_secret" | "other_number" | null; last_hook_detail?: string | null;
  last_send_error?: string | null;
}
export interface WhatsAppSave {
  enabled: boolean; bot_enabled: boolean; bot_mode: "menu" | "ai"; phone_number_id: string; waba_id: string; display_number: string; bot_name: string;
  instructions: string; handoff_message: string; free_limit: number; stop_at_free_limit: boolean; access_token?: string; app_secret?: string;
}
export interface WaConversation {
  id: string; hotel_id: string; wa_id: string; name: string | null; mode: "bot" | "staff"; unread: number;
  last_inbound_at: string | null; last_message_at: string; last_preview: string | null;
}
export interface WaMessage {
  id: string; conversation_id: string; direction: "in" | "out"; sender: "guest" | "bot" | "staff"; body: string;
  status: "received" | "pending" | "sent" | "failed"; error: string | null; created_at: string;
}

/** The address Meta sends this hotel's messages to. */
export const webhookUrl = (hookKey: string) =>
  `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1/whatsapp/${hookKey}`;

/** Within 24 hours of the guest's last message a reply is a free-form "service" message. */
export const windowOpen = (c: Pick<WaConversation, "last_inbound_at">) =>
  !!c.last_inbound_at && Date.now() - new Date(c.last_inbound_at).getTime() < 24 * 3600_000;

export const useWhatsAppSettings = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["whatsapp", "settings", hotel.id],
    queryFn: () => rpc<WhatsAppSettings | null>("whatsapp_settings_get", { _hotel_id: hotel.id }),
  });
};

export const useSaveWhatsApp = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: WhatsAppSave) => rpc<WhatsAppSettings>("whatsapp_settings_save", {
      _hotel_id: hotel.id, _enabled: s.enabled, _bot_enabled: s.bot_enabled, _phone_number_id: s.phone_number_id, _waba_id: s.waba_id,
      _display_number: s.display_number, _bot_name: s.bot_name, _instructions: s.instructions, _handoff_message: s.handoff_message,
      _free_limit: s.free_limit, _stop_at_free_limit: s.stop_at_free_limit, _access_token: s.access_token || null, _app_secret: s.app_secret || null,
      _bot_mode: s.bot_mode,
    }),
    onSuccess: (d) => { qc.setQueryData(["whatsapp", "settings", hotel.id], d); toast.success("WhatsApp settings saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useNewWebhook = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rpc<WhatsAppSettings>("whatsapp_new_hook", { _hotel_id: hotel.id }),
    onSuccess: (d) => { qc.setQueryData(["whatsapp", "settings", hotel.id], d); toast.success("New webhook address made: update it in Meta"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

/** A hotel that has never saved WhatsApp settings has no webhook address yet: make one when setup opens. */
export const useEnsureWebhook = (s: WhatsAppSettings | null | undefined) => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  useEffect(() => {
    if (!s || !s.can_edit || s.hook_key) return;
    rpc<WhatsAppSettings>("whatsapp_new_hook", { _hotel_id: hotel.id })
      .then((d) => qc.setQueryData(["whatsapp", "settings", hotel.id], d))
      .catch(() => null);
  }, [s, hotel.id, qc]);
};

/** Conversations, newest first, kept live. */
export const useConversations = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel(`wa-${hotel.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `hotel_id=eq.${hotel.id}` },
        () => qc.invalidateQueries({ queryKey: ["whatsapp", "conversations"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `hotel_id=eq.${hotel.id}` },
        () => qc.invalidateQueries({ queryKey: ["whatsapp", "messages"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hotel.id, qc]);
  return useQuery({
    queryKey: ["whatsapp", "conversations", hotel.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_conversations" as never).select("*")
        .eq("hotel_id", hotel.id).order("last_message_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as WaConversation[];
    },
    refetchInterval: 30_000,
  });
};

export const useMessages = (conversationId: string | null) =>
  useQuery({
    queryKey: ["whatsapp", "messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_messages" as never).select("*")
        .eq("conversation_id", conversationId!).order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as WaMessage[];
    },
    refetchInterval: 20_000,
  });

export const markRead = (conversationId: string) => rpc("whatsapp_mark_read", { _conversation_id: conversationId }).catch(() => null);

export const useSetMode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: string; mode: "bot" | "staff" }) => rpc("whatsapp_set_mode", { _conversation_id: a.id, _mode: a.mode }),
    onSuccess: (_d, a) => { qc.invalidateQueries({ queryKey: ["whatsapp", "conversations"] }); toast.success(a.mode === "bot" ? "The bot answers this guest again" : "You've taken over; the bot stays quiet"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useSendReply = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { conversationId: string; body: string }) => {
      const { error } = await supabase.functions.invoke("whatsapp", { body: { action: "reply", conversation_id: a.conversationId, body: a.body } });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const msg = ctx && typeof ctx.json === "function" ? await ctx.json().then((b: { error?: string }) => b.error).catch(() => null) : null;
        throw new Error(msg || "Could not reach the WhatsApp service. Is the whatsapp function deployed?");
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["whatsapp"] }); },
    onError: (e) => { qc.invalidateQueries({ queryKey: ["whatsapp", "messages"] }); toast.error(friendlyError(e)); },
  });
};

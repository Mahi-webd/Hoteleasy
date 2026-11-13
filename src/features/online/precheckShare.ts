import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { getPrecheckLink, useMarkPrecheckShared, waNumber } from "@/hooks/useOnline";
import { friendlyError } from "@/lib/format";

/** Share the online check-in link by WhatsApp, email or clipboard, and remember that it was sent. */
export const usePrecheckShare = () => {
  const { hotel } = useCurrentHotel();
  const mark = useMarkPrecheckShared();
  return async (a: { id: string; check_in: string; guests?: { first_name: string; phone?: string | null; email?: string | null } | null }, how: "wa" | "mail" | "copy") => {
    try {
      const url = await getPrecheckLink(a.id);
      const msg = `Hello ${a.guests?.first_name ?? ""}, we look forward to welcoming you to ${hotel.name} on ${format(parseISO(a.check_in), "EEEE d MMMM")}. `
        + `Save time at reception by checking in online: ${url}`;
      if (how === "wa") window.open(`https://wa.me/${waNumber(a.guests?.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
      else if (how === "mail") window.location.href = `mailto:${a.guests?.email ?? ""}?subject=${encodeURIComponent(`Check in online for your stay at ${hotel.name}`)}&body=${encodeURIComponent(msg)}`;
      else { await navigator.clipboard.writeText(url).catch(() => { throw new Error("Could not copy; your browser blocked it"); }); toast.success("Check-in link copied"); }
      mark.mutate(a.id);
    } catch (e) { toast.error(friendlyError(e)); }
  };
};


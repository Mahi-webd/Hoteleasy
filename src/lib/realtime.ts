// Live database updates for staff screens.
//
// Always open live channels through liveChannel(): it joins only after the live connection carries the
// signed-in token. A channel joined during page load can otherwise reach the server as a visitor; the
// database then (rightly) hides the hotel's rows and the screen only updates on its slow refresh.
// Each mount also gets a fresh channel name, so a late "leave" from a previous mount can't cancel it.
import { supabase } from "@/integrations/supabase/client";

type Channel = ReturnType<typeof supabase.channel>;

/** Opens a live channel; returns the function that closes it (use it as the effect cleanup). */
export const liveChannel = (name: string, build: (ch: Channel) => Channel): (() => void) => {
  let ch: Channel | null = null;
  let gone = false;
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    } catch { /* join anyway; the screen's refresh still works */ }
    if (gone) return;
    ch = build(supabase.channel(`${name}-${Math.random().toString(36).slice(2, 10)}`)).subscribe();
  })();
  return () => {
    gone = true;
    if (ch) supabase.removeChannel(ch);
  };
};

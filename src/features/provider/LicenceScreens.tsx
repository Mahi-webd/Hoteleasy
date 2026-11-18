// What hotel staff see about their HotelEasy licence: a warning before it ends, a stop screen after.
import { format, parseISO } from "date-fns";
import { AlertTriangle, Building2, CalendarClock, LogOut, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useHotel } from "@/contexts/HotelContext";
import type { HotelLicense } from "@/lib/db-types";

const day = (d: string | null) => (d ? format(parseISO(d), "EEEE d MMMM yyyy") : "");

const Support = ({ l }: { l: HotelLicense }) => {
  const s = l.support ?? { name: null, email: null, phone: null };
  if (!s.email && !s.phone) return <p>Please contact your HotelEasy provider.</p>;
  return (
    <div className="space-y-1">
      <p>Contact {s.name || "your HotelEasy provider"}:</p>
      {s.phone && <p><a className="inline-flex items-center gap-1.5 underline" href={`tel:${s.phone}`}><Phone className="h-4 w-4" />{s.phone}</a></p>}
      {s.email && <p><a className="inline-flex items-center gap-1.5 underline" href={`mailto:${s.email}`}><Mail className="h-4 w-4" />{s.email}</a></p>}
    </div>
  );
};

/** Full-page stop when the hotel's licence has ended, is suspended or hasn't started. */
export const LicenceBlocked = () => {
  const { hotel, license, memberships, switchHotel } = useHotel();
  const { signOut, user } = useAuth();
  if (!license || !hotel) return null;
  const others = memberships.filter((m) => m.hotel_id !== hotel.id && !["expired", "suspended", "not_started"].includes(m.license?.state ?? "active"));
  const title = license.state === "suspended" ? "This hotel's HotelEasy account is paused"
    : license.state === "not_started" ? "This hotel's HotelEasy licence hasn't started yet"
    : "This hotel's HotelEasy licence has ended";
  const body = license.state === "suspended" ? "Nobody at this hotel can use HotelEasy until the account is reactivated."
    : license.state === "not_started" ? `You can start using HotelEasy on ${day(license.starts_on)}.`
    : `The licence ended on ${day(license.ends_on)}. Your data is safe; renew to continue using HotelEasy.`;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 p-6 text-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700"><AlertTriangle className="h-6 w-6" /></div>
            <div><p className="text-xs text-slate-500">{hotel.name}</p><h1 className="text-lg font-semibold">{title}</h1></div>
          </div>
          <p className="text-slate-700 dark:text-slate-300">{body}</p>
          <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-900"><Support l={license} /></div>
          {others.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Your other hotels:</p>
              {others.map((m) => <Button key={m.hotel_id} variant="outline" size="sm" className="mr-1" onClick={() => switchHotel(m.hotel_id)}><Building2 className="mr-1 h-4 w-4" />{m.hotels.name}</Button>)}
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-3 text-xs text-slate-500">
            <span>Signed in as {user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-1 h-4 w-4" />Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/** Owners and managers: the licence ends soon. */
export const LicenceBanner = () => {
  const { license, role } = useHotel();
  if (!license || license.state !== "expiring" || !(role === "owner" || role === "manager")) return null;
  const d = license.days_left ?? 0;
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="status">
      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1 space-y-1">
        <p><strong>Your HotelEasy licence ends {d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}, on {day(license.ends_on)}.</strong> After that nobody at the hotel can sign in.</p>
        <div className="text-xs"><Support l={license} /></div>
      </div>
    </div>
  );
};

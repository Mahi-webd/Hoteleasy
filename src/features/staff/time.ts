import { addDays } from "@/lib/format";

/** yyyy-MM-dd of an instant in the hotel's time zone. */
export const dateIn = (iso: string | Date, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof iso === "string" ? new Date(iso) : iso);

/** HH:mm of an instant in the hotel's time zone. */
export const timeIn = (iso: string | Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(typeof iso === "string" ? new Date(iso) : iso);

export const hoursBetween = (a: string, b: string, breakMin = 0) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000 - breakMin / 60);

/** Monday of the week containing a date. */
export const mondayOf = (isoDate: string) => {
  const d = new Date(`${isoDate}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return addDays(isoDate, -dow);
};

/** A generous UTC window around local days, filtered precisely afterwards with dateIn. */
export const windowIso = (fromDate: string, toDate: string) => [`${addDays(fromDate, -1)}T00:00:00Z`, `${addDays(toDate, 2)}T00:00:00Z`] as const;

/** A local date + HH:mm in the hotel's zone as an ISO instant (works for any zone via Intl offset lookup). */
export const localToIso = (date: string, time: string, tz: string) => {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(guess).reduce<Record<string, string>>((m, p) => ({ ...m, [p.type]: p.value }), {});
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return new Date(guess.getTime() - (asLocal - guess.getTime())).toISOString();
};

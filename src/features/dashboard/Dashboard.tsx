import { useEffect, useMemo, useState } from "react";
import { BedDouble, Calendar, Clock, DollarSign, Home, LogIn, LogOut, Percent, Plus, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useActivity, useReservations, useRooms } from "@/hooks/useHotelQueries";
import { LoadingBlock } from "@/components/common/PageHeader";
import { ROOM_STATUS, addDays, formatMoney, guestName, timeAgo, todayIn } from "@/lib/format";
import type { RoomStatus } from "@/lib/db-types";

const ACTIVITY_DOT: Record<string, string> = {
  reservation: "bg-orange-500",
  checkin: "bg-blue-500",
  checkout: "bg-green-500",
  cancel: "bg-red-500",
  staff: "bg-purple-500",
  payment: "bg-emerald-500",
  invoice: "bg-indigo-500",
  billing: "bg-slate-500",
  housekeeping: "bg-teal-500",
  maintenance: "bg-orange-600",
  pos: "bg-pink-500",
};

const useClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const Dashboard = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
  const { user } = useAuth();
  const { hotel, can } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const now = useClock();
  const rooms = useRooms();
  const res = useReservations({ from: addDays(today, -40), to: addDays(today, 30) });
  const activity = useActivity();
  const seeMoney = can("owner", "manager", "accountant", "front_desk");

  const stats = useMemo(() => {
    const list = res.data ?? [];
    const roomList = rooms.data ?? [];
    const sellable = roomList.filter((r) => r.status !== "out_of_order").length;
    const inHouse = list.filter((r) => r.status === "checked_in");
    const arrivals = list.filter((r) => r.status === "confirmed" && r.check_in <= today);
    const departures = inHouse.filter((r) => r.check_out <= today);
    // Room revenue for nights already in this month (stays that are or were in house).
    const monthStart = today.slice(0, 8) + "01";
    let monthRevenue = 0;
    list.filter((r) => r.status === "checked_in" || r.status === "checked_out").forEach((r) => {
      for (let d = r.check_in; d < r.check_out; d = addDays(d, 1)) {
        if (d >= monthStart && d <= today) monthRevenue += Number(r.rate_per_night);
      }
    });
    const tonight = inHouse.reduce((s, r) => s + Number(r.rate_per_night), 0);
    const statusCounts = roomList.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
    // Next 7 nights: booked rooms (confirmed or in house) per night.
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i);
      const booked = list.filter((r) => (r.status === "confirmed" || r.status === "checked_in") && r.check_in <= d && r.check_out > d).length;
      return { d, booked, pct: sellable ? Math.round((booked / sellable) * 100) : 0 };
    });
    return {
      total: roomList.length,
      sellable,
      inHouse,
      arrivals,
      departures,
      occupancy: sellable ? Math.round((inHouse.length / sellable) * 100) : 0,
      monthRevenue,
      tonight,
      adr: inHouse.length ? tonight / inHouse.length : 0,
      statusCounts,
      forecast,
    };
  }, [res.data, rooms.data, today]);

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: hotel.timezone }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = ((user?.user_metadata?.full_name as string) || "").split(" ")[0];

  if (rooms.isLoading || res.isLoading) return <LoadingBlock />;

  const kpis = [
    { title: "Occupancy tonight", value: `${stats.occupancy}%`, sub: `${stats.inHouse.length} of ${stats.sellable} rooms`, icon: Percent, color: "bg-blue-500" },
    { title: "Arrivals to check in", value: stats.arrivals.length, sub: "Due today or late", icon: LogIn, color: "bg-green-500" },
    { title: "Departures due", value: stats.departures.length, sub: "Checking out today", icon: LogOut, color: "bg-orange-500" },
    seeMoney
      ? { title: "Room revenue this month", value: formatMoney(stats.monthRevenue, hotel.currency), sub: `Avg rate tonight ${formatMoney(stats.adr, hotel.currency)}`, icon: DollarSign, color: "bg-purple-500" }
      : { title: "Guests in house", value: stats.inHouse.reduce((s, r) => s + r.adults + r.children, 0), sub: "People staying tonight", icon: Users, color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-1">{greeting}{firstName ? `, ${firstName}` : ""}!</h2>
        <p className="text-blue-100">Here's what's happening at {hotel.name} today</p>
        <div className="flex flex-wrap items-center mt-4 gap-4 text-sm">
          <span className="flex items-center"><Calendar className="mr-1 h-4 w-4" />
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: hotel.timezone })}
          </span>
          <span className="flex items-center"><Clock className="mr-1 h-4 w-4" />
            {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: hotel.timezone })}
          </span>
          {can("owner", "manager", "front_desk") && (
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onNavigate?.("reservations")}>
              <Plus className="mr-1 h-4 w-4" />Reservations
            </Button>
          )}
        </div>
      </div>

      {stats.total === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Start by adding your rooms</div>
              <div className="text-sm text-slate-600">Create room types and rooms, then you can take reservations.</div>
            </div>
            <Button onClick={() => onNavigate?.("rooms")}><BedDouble className="mr-2 h-4 w-4" />Set up rooms</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((k) => (
          <Card key={k.title} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">{k.title}</CardTitle>
              <div className={`${k.color} p-2 rounded-lg`}><k.icon className="h-4 w-4 text-white" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">{k.value}</div>
              <div className="text-sm text-slate-500">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-blue-600" />Arrivals</CardTitle>
            <CardDescription>Guests due to check in</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats.arrivals.length ? (
              <p className="text-sm text-slate-500">No one waiting to check in.</p>
            ) : (
              <div className="space-y-3">
                {stats.arrivals.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div>
                      <p className="font-medium">{guestName(a.guests)}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {a.rooms ? `Room ${a.rooms.room_number}` : `${a.room_types?.name} · room not assigned`} · {a.nights} night{a.nights === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge variant={a.guests?.is_vip ? "default" : a.check_in < today ? "destructive" : "secondary"}>
                      {a.guests?.is_vip ? "VIP" : a.check_in < today ? "Late" : "Today"}
                    </Badge>
                  </div>
                ))}
                {stats.arrivals.length > 6 && (
                  <Button variant="link" className="px-0" onClick={() => onNavigate?.("reservations")}>See all {stats.arrivals.length}</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><Clock className="mr-2 h-5 w-5 text-green-600" />Recent activity</CardTitle>
            <CardDescription>Latest actions by your team</CardDescription>
          </CardHeader>
          <CardContent>
            {!activity.data?.length ? (
              <p className="text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.data.map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${ACTIVITY_DOT[a.kind] ?? "bg-slate-400"}`} />
                    <div className="flex-1">
                      <p className="text-sm">{a.message}</p>
                      <p className="text-xs text-slate-500">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><Home className="mr-2 h-5 w-5 text-purple-600" />Room status</CardTitle>
            <CardDescription>{stats.total} rooms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(Object.keys(ROOM_STATUS) as RoomStatus[]).map((s) => {
                const n = stats.statusCounts[s] ?? 0;
                return (
                  <button key={s} onClick={() => onNavigate?.("rooms")} className="text-left p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${ROOM_STATUS[s].dot}`} />{ROOM_STATUS[s].label}</div>
                    <div className="text-2xl font-bold">{n}</div>
                    <Progress value={stats.total ? (n / stats.total) * 100 : 0} className="mt-1 h-1.5" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><BedDouble className="mr-2 h-5 w-5 text-indigo-600" />Next 7 nights</CardTitle>
            <CardDescription>Rooms booked per night</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.forecast.map((f) => (
              <div key={f.d} className="flex items-center gap-3 text-sm">
                <span className="w-20 text-slate-600">{new Date(f.d + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</span>
                <Progress value={f.pct} className="h-2 flex-1" />
                <span className="w-16 text-right">{f.booked}/{stats.sellable}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

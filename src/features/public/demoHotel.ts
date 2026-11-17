// Sample hotel for previewing the guest website locally at /book/demo.
// Only used when running `npm run dev` (import.meta.env.DEV); never part of a production build.
import type { PublicHotel } from "@/lib/db-types";
import type { BookingResult, Offer } from "@/hooks/useOnline";

export const DEMO_SLUG = "demo";

const U = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=70`;
const today = new Date().toISOString().slice(0, 10);

export const demoHotel: PublicHotel = {
  name: "Lakeside Lodge", city: "Naivasha", address: "Moi South Lake Road", country: "Kenya", phone: "+254 712 345 678", email: "stay@example.com",
  currency: "KES", checkin_time: "14:00", checkout_time: "10:00", prices_include_tax: true, tax_rate: 18, today,
  headline: "Our lodge, your quiet place by the lake",
  description: "Wake to fish eagles over the water, take breakfast on the lawn and let the afternoon slip by at the pool. A small lodge on the shore of Lake Naivasha, an easy drive from Nairobi.",
  photo_url: U("photo-1566073771259-6a8506099945"),
  policies: "No smoking in rooms.\nChildren under 5 stay free.\nID required at check-in.",
  payment_instructions: "Pay on arrival by cash, card or M-Pesa.",
  whatsapp: "0712345678", free_cancel_days: 3, min_nights: 1, max_nights: 30, max_advance_days: 365,
  gallery: [
    "photo-1520250497591-112f2f40a3f4", "photo-1571896349842-33c89424de2d", "photo-1551882547-ff40c63fe5fa",
    "photo-1414235077428-338989a2e8c0", "photo-1590490360182-c33d57733427", "photo-1582719478250-c89cae4dc85b",
  ].map(U),
  features: [
    { title: "Restaurant", text: "Seasonal plates from the farms around the lake, tilapia from the morning catch and a long wine list.", photo_url: U("photo-1414235077428-338989a2e8c0") },
    { title: "Pool & spa", text: "A heated pool facing the water, a small sauna and massages in the garden.", photo_url: U("photo-1520250497591-112f2f40a3f4") },
    { title: "Things to do", text: "Boat rides to Crescent Island, cycling in Hell's Gate and sundowners on the jetty.", photo_url: null },
  ],
  site: {
    theme: "lake", heading_font: "cormorant",
    hero: { tagline: "Boutique lodge on the lake shore", waves: true },
    marquee: ["Lake views", "Local food", "Quiet nights", "Boat safaris"],
    notice: { text: "Festive packages are now open: three nights for the price of two" },
    social: { instagram: "https://www.instagram.com/", facebook: "https://www.facebook.com/" },
    seo: { title: "Lakeside Lodge · Naivasha", description: "A small lodge on the shore of Lake Naivasha. Book direct." },
    offers: [
      { title: "Long weekend escape", text: "Three nights by the lake with breakfast on the lawn and a boat ride to Crescent Island.",
        photo_url: U("photo-1520250497591-112f2f40a3f4"), from_date: today, to_date: "2027-03-31", min_nights: 3, price: 39000, price_label: "2 adults, breakfast included" },
      { title: "Festive season", text: "Christmas dinner on the jetty and a New Year's bonfire.",
        photo_url: U("photo-1414235077428-338989a2e8c0"), from_date: "2026-12-20", to_date: "2027-01-02", min_nights: 2, price: 52000, price_label: "2 adults, half board" },
      { title: "Midweek calm", text: "Stay Monday to Thursday and the fourth night is on us.", photo_url: null, min_nights: 4, price: null },
    ],
  },
  room_types: [
    { id: "demo-garden", name: "Garden room", description: "Calm room facing the garden with a private terrace.", max_occupancy: 2,
      amenities: ["King bed", "Terrace", "Rain shower", "Wi-Fi"], photo_url: U("photo-1582719478250-c89cae4dc85b"), gallery: [U("photo-1590490360182-c33d57733427")], rate: 14500 },
    { id: "demo-studio", name: "Lake view studio", description: "Wide windows over the water and a sofa bed for a third guest.", max_occupancy: 3,
      amenities: ["Lake view", "Sofa bed", "Kitchenette", "Wi-Fi"], photo_url: U("photo-1590490360182-c33d57733427"), gallery: [], rate: 18500 },
    { id: "demo-suite", name: "Lodge suite", description: "Our largest room, with a bath tub and its own lounge.", max_occupancy: 2,
      amenities: ["Bath tub", "Lounge", "Lake view"], photo_url: U("photo-1618773928121-c32242e63f39"), gallery: [], rate: 26000 },
  ],
  reviews: { count: 24, average: 4.7, recent: [
    { name: "Amina W.", overall: 5, comment: "The quietest weekend we've had in years. Breakfast on the lawn was perfect.", month: "Oct 2026", response: "Thank you Amina, come back soon!" },
    { name: "David K.", overall: 4, comment: "Lovely rooms and staff, the pool is the best part.", month: "Sep 2026", response: null },
  ] },
};

const nightsBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));

export const demoAvailability = (checkIn: string, checkOut: string, guests: number): Offer[] => {
  const nights = nightsBetween(checkIn, checkOut);
  return demoHotel.room_types.map((t, i) => ({
    room_type_id: t.id, name: t.name, available: [4, 2, 1][i] ?? 1, fits: guests <= t.max_occupancy,
    nights, rate: t.rate, total: t.rate * nights, uniform: true, restriction: null,
  }));
};

export const demoBooking = (a: { roomTypeId: string; checkIn: string; checkOut: string; firstName: string; lastName: string; email: string }): BookingResult => {
  const t = demoHotel.room_types.find((x) => x.id === a.roomTypeId) ?? demoHotel.room_types[0];
  const nights = nightsBetween(a.checkIn, a.checkOut);
  return {
    code: "HE-DEMO01", room_type: t.name, check_in: a.checkIn, check_out: a.checkOut, nights, rate: t.rate, total: t.rate * nights,
    currency: demoHotel.currency, guest: `${a.firstName} ${a.lastName}`, email: a.email, plan: null,
  };
};

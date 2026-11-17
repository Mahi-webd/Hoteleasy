import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

// self-hosted (Geist: SIL OFL; Instrument Serif: SIL OFL)
const geist = localFont({ src: "./fonts/geist-latin-wght-normal.woff2", weight: "100 900", variable: "--font-geist", display: "swap" });
const instrument = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HotelEasy — the operating system for hotels in Kenya",
  description:
    "Front desk, M-Pesa payments, restaurant, housekeeping, Booking.com and Airbnb sync and owner reports in one system. Built for hotels in Kenya.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "HotelEasy — run the hotel, not the paperwork",
    description:
      "One system for the front desk, M-Pesa, restaurant, housekeeping and owner reports. Built for hotels in Kenya.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3efe7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${instrument.variable}`}>
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}

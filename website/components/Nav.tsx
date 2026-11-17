"use client";

import { useEffect, useState } from "react";
import { APP_URL } from "@/lib/content";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.02em] ${light ? "text-paper" : "text-ink"}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? "#fbf9f4" : "#15171b"} />
        <path d="M9 14.5 16 9l7 5.5V23H9z" fill="none" stroke={light ? "#15171b" : "#fbf9f4"} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 23v-4.5h4V23" fill="none" stroke="#b07f3c" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      HotelEasy
    </span>
  );
}

const links = [
  ["Product", "#product"],
  ["Film", "#film"],
  ["Pricing", "#pricing"],
  ["Questions", "#faq"],
] as const;

export default function Nav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
        solid ? "bg-stone/80 shadow-[0_1px_0_rgba(21,23,27,.08)] backdrop-blur-xl" : ""
      }`}
    >
      <nav className="shell flex h-[72px] items-center gap-8">
        <a href="#top" aria-label="HotelEasy, back to top">
          <Logo />
        </a>
        <ul className="ml-auto hidden items-center gap-8 text-[15px] text-ink/80 md:flex">
          {links.map(([label, href]) => (
            <li key={href}>
              <a href={href} className="transition-colors hover:text-ink">
                {label}
              </a>
            </li>
          ))}
          <li>
            <a href={APP_URL} className="transition-colors hover:text-ink">
              Sign in
            </a>
          </li>
        </ul>
        <a href={APP_URL} className="btn btn-dark ml-auto min-h-[42px] px-5 md:ml-0">
          Start free trial
        </a>
      </nav>
    </header>
  );
}

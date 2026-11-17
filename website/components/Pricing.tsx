"use client";

import { useState } from "react";
import { APP_URL, plans } from "@/lib/content";

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <>
      <div role="group" aria-label="Billing period" className="mt-10 inline-flex rounded-full border border-line bg-paper p-1 text-[14px]">
        {[false, true].map((y) => (
          <button
            key={String(y)}
            type="button"
            aria-pressed={yearly === y}
            onClick={() => setYearly(y)}
            className={`min-h-[40px] rounded-full px-5 transition-colors ${yearly === y ? "bg-ink text-paper" : "text-ink/70 hover:text-ink"}`}
          >
            {y ? "Yearly — two months free" : "Monthly"}
          </button>
        ))}
      </div>
      <div className="mt-10 grid gap-px overflow-hidden rounded-[18px] border border-line bg-line md:grid-cols-3">
        {plans.map((p) => {
          const price = p.monthly ? (yearly ? p.monthly * 10 : p.monthly) : 0;
          const featured = "featured" in p && p.featured;
          return (
            <div key={p.name} className={`flex flex-col p-8 ${featured ? "bg-night text-paper" : "bg-paper"}`}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="display text-[32px]">{p.name}</h3>
                {featured && <span className="text-[13px] text-brass-soft">Most chosen</span>}
              </div>
              <p className={`mt-2 text-[15px] ${featured ? "text-paper/70" : "text-mute"}`}>{p.for}</p>
              <p className="mt-8 whitespace-nowrap">
                {price ? (
                  <>
                    <span className="text-[15px] opacity-70">KES </span>
                    <span className="text-[44px] font-medium tracking-[-0.03em] tabular-nums">{price.toLocaleString("en-KE")}</span>
                    <span className="text-[15px] opacity-70"> / {yearly ? "year" : "month"}</span>
                  </>
                ) : (
                  <span className="text-[44px] font-medium tracking-[-0.03em]">Tailored</span>
                )}
              </p>
              <ul className={`mt-8 flex-1 space-y-3 border-t pt-8 text-[15px] ${featured ? "border-white/15" : "border-line"}`}>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <svg className="mt-[5px] shrink-0 text-brass" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M3 8.5 6.5 12 13 4.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href={APP_URL} className={`btn mt-10 ${featured ? "btn-light" : "btn-dark"}`}>
                {price ? "Start free trial" : "Talk to us"}
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}

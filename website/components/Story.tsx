"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { APP_URL, chapters } from "@/lib/content";

const HotelScene = dynamic(() => import("./HotelScene"), { ssr: false });

function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const q = matchMedia("(min-width: 900px)");
    const on = () => setWide(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return wide;
}

function canWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const rise = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Story() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const wide = useWide();
  const heroFade = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const reduced = !!useReducedMotion();
  const [active, setActive] = useState(true);
  const [gl, setGl] = useState<boolean | null>(null);

  useEffect(() => setGl(canWebGL()), []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="top" className="relative">
      {/* the model stays pinned while the chapters scroll past it */}
      <div className="sticky top-0 h-svh -mb-[100svh] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,#fbf9f4_0%,#f3efe7_55%,#ebe5da_100%)]" />
        {gl && <HotelScene progress={scrollYProgress} layout={wide ? "wide" : "narrow"} active={active} reduced={reduced} />}
        {gl === false && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/shots/01_dashboard.webp" alt="" className="shot absolute right-[5vw] top-[22%] w-[min(54vw,720px)] max-[899px]:top-[12%] max-[899px]:w-[90vw]" />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[52%] bg-gradient-to-r from-stone via-stone/80 to-transparent min-[900px]:block" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-stone to-transparent" />
        <motion.div aria-hidden style={{ opacity: heroFade }} className="pointer-events-none absolute inset-x-0 top-0 h-[62%] bg-gradient-to-b from-stone via-stone/85 to-transparent min-[900px]:hidden" />
        <ProgressRail progress={scrollYProgress} />
      </div>

      {/* hero */}
      <div className="relative z-10 flex h-svh items-start min-[900px]:items-center">
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }} className="shell pt-28 min-[900px]:pt-0">
          <div className="max-w-[560px]">
            <motion.p variants={rise} className="eyebrow">Hotel operating system · Made in Kenya</motion.p>
            <motion.h1 variants={rise} className="display mt-5 text-[clamp(46px,6.4vw,92px)]">
              Run the hotel.
              <br />
              <em className="text-brass">Not the paperwork.</em>
            </motion.h1>
            <motion.p variants={rise} className="mt-6 max-w-[46ch] text-[17px] text-mute">
              HotelEasy brings the front desk, M-Pesa, the restaurant, housekeeping and your Booking.com calendar into one calm system — for everyone from the owner to the night porter.
            </motion.p>
            <motion.div variants={rise} className="mt-9 flex flex-wrap gap-3">
              <a className="btn btn-dark" href={APP_URL}>Start free trial</a>
              <a className="btn btn-line bg-stone/70 backdrop-blur" href="#film">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4v16l13-8z" /></svg>
                Watch the 3-minute film
              </a>
            </motion.div>
          </div>
        </motion.div>
        <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-[13px] text-mute min-[900px]:block">Scroll to walk through the building</div>
      </div>

      {chapters.map((c) => (
        <div key={c.id} className="relative z-10 flex h-svh items-end pb-6 min-[900px]:items-center min-[900px]:pb-0">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.55 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="shell"
          >
            <div className="max-w-[470px] rounded-2xl bg-paper/85 p-6 backdrop-blur-md max-[899px]:shadow-[0_20px_60px_-30px_rgba(0,0,0,.3)] min-[900px]:bg-transparent min-[900px]:p-0 min-[900px]:backdrop-blur-none">
              <p className="eyebrow">{c.eyebrow}</p>
              <h2 className="display mt-4 text-[clamp(30px,3.4vw,46px)]">{c.title}</h2>
              <p className="mt-4 text-mute">{c.body}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/shots/${c.shot}.webp`} alt={c.alt} loading="lazy" className="shot mt-7 hidden aspect-[16/10] w-full object-cover object-left-top min-[900px]:block" />
            </div>
          </motion.div>
        </div>
      ))}
    </section>
  );
}

function ProgressRail({ progress }: { progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  return (
    <div className="absolute right-6 top-1/2 hidden h-40 w-px -translate-y-1/2 bg-line min-[900px]:block">
      <motion.div className="absolute inset-x-0 top-0 origin-top bg-ink" style={{ scaleY: progress, height: "100%" }} />
    </div>
  );
}

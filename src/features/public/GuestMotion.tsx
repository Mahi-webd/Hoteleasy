// Motion for the guest website: animated water waves between sections, a slow photo slideshow,
// content that fades up as it scrolls into view, soft parallax and a self-drawing section mark.
// Everything stays still for visitors who ask their device for reduced motion.
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The hotel can switch the waves off (Online → Website); everything else keeps working. */
export const WavesOn = createContext(true);

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Calls back once when the element first scrolls into view. */
const useInView = <T extends Element>(rootMargin = "0px 0px -8% 0px") => {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin, threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, shown] as const;
};

/** Fades and lifts its content in the first time it scrolls into view. */
export const Reveal = ({ children, className, delay = 0, style }: { children: ReactNode; className?: string; delay?: number; style?: CSSProperties }) => {
  const [ref, shown] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("gs-reveal", shown && "is-shown", className)} style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }}>
      {children}
    </div>
  );
};

/** A small wave between two lines that draws itself when it comes into view. */
export const WaveMark = ({ className }: { className?: string }) => {
  const [ref, shown] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("gs-draw flex justify-center", shown && "is-shown", className)} aria-hidden="true">
      <svg width="132" height="18" viewBox="0 0 132 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path pathLength={1} d="M2 9 H40" opacity="0.4" />
        <path pathLength={1} d="M46 9 q 5 -7 10 0 t 10 0 t 10 0 t 10 0" />
        <path pathLength={1} d="M92 9 H130" opacity="0.4" />
      </svg>
    </div>
  );
};

/** Moves an element a little slower than the page while scrolling. Returns a ref for it. */
export const useParallax = <T extends HTMLElement>(amount = 0.1) => {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.parentElement?.getBoundingClientRect() ?? el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      const offset = (r.top + r.height / 2 - window.innerHeight / 2) * -amount;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.14)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [amount]);
  return ref;
};

/** A photo that drifts gently with the scroll, cropped by a rounded frame. */
export const ParallaxImage = ({ src, alt, className, frameClassName }: { src: string; alt: string; className?: string; frameClassName?: string }) => {
  const img = useParallax<HTMLImageElement>(0.08);
  return (
    <div className={cn("overflow-hidden", frameClassName)}>
      <img ref={img} src={src} alt={alt} loading="lazy" className={cn("h-full w-full object-cover will-change-transform", className)} />
    </div>
  );
};

type WaveLayer = { alpha: number; amp: number; length: number; speed: number; base: number };
const LAYERS: WaveLayer[] = [
  { alpha: 0.28, amp: 0.30, length: 1.35, speed: 0.22, base: 0.34 },
  { alpha: 0.55, amp: 0.24, length: 0.95, speed: -0.3, base: 0.5 },
  { alpha: 1, amp: 0.18, length: 0.7, speed: 0.4, base: 0.66 },
];
const SOFT: WaveLayer[] = LAYERS.map((l) => ({ ...l, alpha: l.alpha * 0.18 }));

/**
 * Layered moving water drawn on a canvas, filled with a theme colour (a CSS variable name such as "background").
 * edge="top": sits on top of a section, wavy line on top (use at the top of the next section's colour).
 * edge="bottom": hangs below a section, wavy line at the bottom.
 */
export const Waves = ({ fill = "background", edge = "top", height = 72, soft = false, className }: {
  fill?: "background" | "primary" | "primary-foreground" | "card"; edge?: "top" | "bottom"; height?: number; soft?: boolean; className?: string;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const on = useContext(WavesOn);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const color = getComputedStyle(c).getPropertyValue(`--${fill}`).trim() || "0 0% 100%";
    const layers = soft ? SOFT : LAYERS;
    const still = prefersReducedMotion();
    let t = Math.random() * 10, last = performance.now(), raf = 0, visible = false;

    const draw = () => {
      const w = c.clientWidth, h = c.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (const L of layers) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += 8) {
          const k = (x / (Math.max(w, 320) * L.length)) * Math.PI * 2;
          const y = h * L.base + Math.sin(k + t * L.speed) * h * L.amp * 0.5 + Math.sin(k * 2.2 - t * L.speed * 0.8) * h * L.amp * 0.22;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = `hsl(${color} / ${L.alpha})`;
        ctx.fill();
      }
    };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    const loop = (now: number) => {
      t += Math.min(0.05, (now - last) / 1000);
      last = now;
      draw();
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(c);
    resize();
    const io = typeof IntersectionObserver !== "undefined" && !still
      ? new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
          if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
        })
      : null;
    io?.observe(c);
    return () => { ro?.disconnect(); io?.disconnect(); cancelAnimationFrame(raf); };
  }, [fill, soft, on]);
  if (!on) return null;
  return (
    <canvas ref={ref} aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-0 z-10 block w-full print:hidden",
        edge === "top" ? "bottom-[calc(100%-1px)]" : "top-[calc(100%-1px)] -scale-y-100", className)}
      style={{ height }} />
  );
};

/** Full-bleed photos that cross-fade every few seconds with a slow zoom. */
export const HeroSlides = ({ photos }: { photos: string[] }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (photos.length < 2 || prefersReducedMotion()) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % photos.length), 6500);
    return () => window.clearInterval(id);
  }, [photos.length]);
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {photos.map((p, k) => (
        <img key={p + k} src={p} alt="" loading={k === 0 ? "eager" : "lazy"}
          className={cn("gs-kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out",
            k === i ? "opacity-100" : "opacity-0")}
          style={{ animationDelay: `${-k * 3}s` }} />
      ))}
    </div>
  );
};

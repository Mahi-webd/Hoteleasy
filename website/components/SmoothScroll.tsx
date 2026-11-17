"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/** Gentle inertial scrolling; skipped for people who prefer reduced motion. */
export default function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: -72 } });
    return () => lenis.destroy();
  }, []);
  return null;
}

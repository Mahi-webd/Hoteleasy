"use client";

import { useRef, useState } from "react";

export default function Film() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    setPlaying(true);
    video.current?.play().catch(() => setPlaying(false));
  };
  return (
    <div className="relative mt-14 aspect-video overflow-hidden rounded-[18px] bg-black shadow-[0_60px_120px_-50px_rgba(0,0,0,.8)] ring-1 ring-white/10">
      <video
        ref={video}
        src="/pitch.mp4"
        poster="/shots/01_dashboard.webp"
        preload="metadata"
        playsInline
        controls={playing}
        onEnded={() => setPlaying(false)}
        className="h-full w-full object-cover"
      />
      {!playing && (
        <button
          type="button"
          onClick={play}
          aria-label="Play the HotelEasy film, 3 minutes 18 seconds"
          className="group absolute inset-0 flex items-end justify-between gap-6 bg-gradient-to-t from-night/90 via-night/30 to-transparent p-[clamp(20px,4vw,48px)] text-left text-paper"
        >
          <span>
            <span className="display block text-[clamp(26px,3vw,40px)]">A day at a HotelEasy hotel</span>
            <span className="mt-2 block text-[14px] text-paper/70">3 min 18 s · with narration</span>
          </span>
          <span className="grid size-[clamp(64px,7vw,88px)] shrink-0 place-items-center rounded-full bg-paper text-ink transition-transform duration-500 group-hover:scale-105">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 4v16l13-8z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

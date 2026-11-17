# HotelEasy marketing website

The public site for HotelEasy: a scroll story through a 3D architectural model of a hotel,
the product film, modules, pricing and FAQ.

Stack: Next.js (static export), TypeScript, Tailwind CSS v4, React Three Fiber + drei,
Motion, Lenis. Fonts (Geist, Instrument Serif — both SIL OFL) are self-hosted in `app/fonts`.

## Run locally

```bash
cd website
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in website/out
```

## Deploy on Vercel

Create a second Vercel project from the same GitHub repo and set **Root Directory** to
`website`. Vercel detects Next.js; no environment variables are needed.

## Editing content

All copy, plans, FAQs and screenshots are in `lib/content.ts`. Screenshots live in
`public/shots`, the film is `public/pitch.mp4`. Prices are placeholders — update `plans`.
The 3D model and camera path are in `components/HotelScene.tsx` (`KEYS` = one camera
position per chapter).

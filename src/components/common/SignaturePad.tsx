import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

const W = 600, H = 200;

/** Finger/mouse signature box. Calls onChange with a PNG data URL, or null when cleared. */
export const SignaturePad = ({ onChange, label = "Sign here" }: { onChange: (png: string | null) => void; label?: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0f172a";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true; last.current = pos(e);
    const ctx = e.currentTarget.getContext("2d")!; const p = last.current;
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = "#0f172a"; ctx.fill();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d")!; const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false; last.current = null; strokes.current += 1;
    setEmpty(false); onChange(ref.current!.toDataURL("image/png"));
  };
  const clear = () => {
    ref.current!.getContext("2d")!.clearRect(0, 0, W, H);
    strokes.current = 0; setEmpty(true); onChange(null);
  };

  return (
    <div className="space-y-1">
      <div className="relative rounded-md border-2 border-dashed border-slate-300 bg-white">
        <canvas ref={ref} width={W} height={H} aria-label={label} role="img"
          className="w-full h-40 touch-none cursor-crosshair rounded-md"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 text-sm">{label}</span>}
        <div className="pointer-events-none absolute left-6 right-6 bottom-8 border-b border-slate-300" />
      </div>
      <div className="flex justify-end"><Button type="button" size="sm" variant="ghost" onClick={clear} disabled={empty}><Eraser className="mr-1 h-4 w-4" />Clear</Button></div>
    </div>
  );
};

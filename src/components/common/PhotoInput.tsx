// Photo fields for the guest website settings: upload from the device (phone camera roll or computer)
// or paste a link. PhotoField holds one photo; PhotoList holds several, in order.
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Link2, Loader2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { uploadSitePhoto, type PhotoKind } from "@/lib/sitePhotos";
import { cn } from "@/lib/utils";

const isHttps = (u: string) => /^https:\/\/[^\s"'<>]+$/i.test(u.trim());

const useUploader = (kind: PhotoKind) => {
  const { hotel } = useCurrentHotel();
  const [busy, setBusy] = useState(0);
  const upload = async (files: File[]) => {
    const urls: string[] = [];
    setBusy(files.length);
    for (const f of files) {
      try { urls.push(await uploadSitePhoto(hotel.id, f, kind)); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
      finally { setBusy((n) => n - 1); }
    }
    if (urls.length) toast.success(urls.length === 1 ? "Photo uploaded" : `${urls.length} photos uploaded`);
    return urls;
  };
  return { busy, upload };
};

const Thumb = ({ src, className }: { src: string; className?: string }) => {
  const [bad, setBad] = useState(false);
  return bad || !isHttps(src)
    ? <div className={cn("flex items-center justify-center bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800", className)}>No preview</div>
    : <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className={cn("object-cover", className)} />;
};

/** One photo: preview, Upload, paste a link, remove. */
export const PhotoField = ({ id, value, onChange, kind, placeholder }: {
  id?: string; value: string; onChange: (v: string) => void; kind: PhotoKind; placeholder?: string;
}) => {
  const file = useRef<HTMLInputElement>(null);
  const { busy, upload } = useUploader(kind);
  return (
    <div className="flex items-center gap-2">
      <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md border">
        {value ? <Thumb src={value} className={cn("h-full w-full", kind === "logo" && "object-contain bg-slate-800")} /> : <div className="flex h-full items-center justify-center text-slate-300"><ImagePlus className="h-4 w-4" /></div>}
      </div>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Upload, or paste a https:// link"} className="min-w-0 flex-1" />
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden"
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const [u] = await upload([f]); if (u) onChange(u); } }} />
      <Button type="button" variant="outline" size="sm" disabled={busy > 0} onClick={() => file.current?.click()} aria-label="Upload a photo">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}<span className="ml-1 hidden sm:inline">Upload</span>
      </Button>
      {value && <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} aria-label="Remove photo"><X className="h-4 w-4" /></Button>}
    </div>
  );
};

/** Several photos in order: upload many at once, paste links, reorder, remove. */
export const PhotoList = ({ value, onChange, kind, max, label }: {
  value: string[]; onChange: (v: string[]) => void; kind: PhotoKind; max: number; label: string;
}) => {
  const file = useRef<HTMLInputElement>(null);
  const { busy, upload } = useUploader(kind);
  const [link, setLink] = useState("");
  const photos = value.filter((u) => u.trim());
  const room = max - photos.length;
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const addLink = () => {
    if (!isHttps(link)) { toast.error("Links must start with https://"); return; }
    onChange([...photos, link.trim()].slice(0, max)); setLink("");
  };
  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" aria-label={label}>
          {photos.map((u, i) => (
            <li key={u + i} className="group relative overflow-hidden rounded-md border">
              <Thumb src={u} className="aspect-[4/3] w-full" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] text-white">First</span>}
              {!isHttps(u) && <span className="absolute inset-x-0 bottom-0 bg-red-600/90 px-1 text-[10px] text-white">Not https</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`} className="rounded p-1 text-white disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`} className="rounded p-1 text-white"><Trash2 className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label={`Move photo ${i + 1} later`} className="rounded p-1 text-white disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
          {Array.from({ length: busy }).map((_, i) => (
            <li key={`busy-${i}`} className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={file} type="file" multiple accept="image/jpeg,image/png,image/webp,image/*" className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, room));
            e.target.value = "";
            if (!files.length) return;
            const urls = await upload(files);
            if (urls.length) onChange([...photos, ...urls].slice(0, max));
          }} />
        <Button type="button" variant="outline" size="sm" disabled={room <= 0 || busy > 0} onClick={() => file.current?.click()}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}Upload photos
        </Button>
        <div className="flex min-w-[220px] flex-1 items-center gap-1">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a https:// link" aria-label={`Add a ${label.toLowerCase()} link`}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} />
          <Button type="button" variant="ghost" size="sm" disabled={!link.trim() || room <= 0} onClick={addLink}><Link2 className="mr-1 h-4 w-4" />Add</Button>
        </div>
        <span className="text-xs text-slate-500">{photos.length} of {max}</span>
      </div>
    </div>
  );
};

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, Type, PenTool, ImagePlus, Square, Trash2, Download, Loader2, MousePointer2, Check, X as XIcon,
  RotateCcw, ShieldCheck, AlertCircle, Eraser,
} from "lucide-react";
import {
  baseName, canvasToBlob, downloadBlob, hexToRgb01, openPdfjs, openPdfLib, pdfBlob, readBuffer, renderPage, textToPng,
} from "../lib/pdf";
import { rgb } from "pdf-lib";

const S = 1.3; // نسبة العرض (بكسل لكل نقطة)

type Annot =
  | { id: number; page: number; type: "text"; x: number; y: number; text: string; size: number; color: string }
  | { id: number; page: number; type: "image"; x: number; y: number; w: number; h: number; url: string; kind: "png" | "jpg" }
  | { id: number; page: number; type: "rect"; x: number; y: number; w: number; h: number; color: string };

type Pending =
  | { type: "text"; text: string }
  | { type: "rect" }
  | { type: "image"; url: string; w: number; h: number; kind: "png" | "jpg" }
  | null;

interface PageInfo { w: number; h: number; url: string }

function SignatureModal({ onDone, onClose }: { onDone: (url: string, w: number, h: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#1d4ed8");
  const [empty, setEmpty] = useState(true);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    setEmpty(false);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  const done = () => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 0) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
    const pad = 6;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(c.width, x1 + pad); y1 = Math.min(c.height, y1 + pad);
    const out = document.createElement("canvas");
    out.width = x1 - x0; out.height = y1 - y0;
    out.getContext("2d")!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    const w = 150;
    onDone(out.toDataURL("image/png"), w, (out.height / out.width) * w);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-xl font-bold text-slate-800">ارسم توقيعك</h3>
        <p className="mb-3 text-sm text-slate-500">استخدم الماوس أو إصبعك للرسم داخل المربع.</p>
        <canvas
          ref={ref}
          width={900}
          height={360}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drawing.current = false)}
          className="w-full cursor-crosshair touch-none rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"
        />
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-slate-600">لون القلم:</span>
          {["#1d4ed8", "#111827", "#dc2626"].map((c) => (
            <button key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-slate-800" : "border-white shadow"}`} style={{ background: c }} />
          ))}
          <button onClick={clear} className="mr-auto flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><Eraser size={15} /> مسح</button>
        </div>
        <div className="mt-5 flex gap-3">
          <button disabled={empty} onClick={done} className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-40">استخدام التوقيع</button>
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-600 hover:bg-slate-50">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage({ mode }: { mode: "edit" | "sign" }) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [annots, setAnnots] = useState<Annot[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Blob | null>(null);
  const idRef = useRef(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; resize?: boolean; ow?: number; oh?: number } | null>(null);

  const loadFile = async (f: File) => {
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      setError("اختر ملف PDF");
      return;
    }
    setError(null); setLoading(true); setFile(f); setPages([]); setAnnots([]); setSel(null); setSaved(null);
    try {
      const pdf = await openPdfjs(await readBuffer(f));
      const infos: PageInfo[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const c = await renderPage(pdf, i, S * 1.5);
        const blob = await canvasToBlob(c, "image/jpeg", 0.85);
        infos.push({ w: c.width / (S * 1.5), h: c.height / (S * 1.5), url: URL.createObjectURL(blob) });
        c.width = 0;
        setPages([...infos]);
      }
    } catch (e) {
      console.error(e);
      setError("تعذّر فتح الملف. قد يكون محميًا بكلمة مرور أو تالفًا.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.sx) / S, dy = (e.clientY - d.sy) / S;
      setAnnots((a) =>
        a.map((x) => {
          if (x.id !== d.id) return x;
          if (d.resize && x.type !== "text") return { ...x, w: Math.max(10, d.ow! + dx), h: Math.max(10, d.oh! + dy) };
          return { ...x, x: d.ox + dx, y: d.oy + dy };
        })
      );
    };
    const up = () => (dragRef.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const placeAt = (pageIdx: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!pending) {
      setSel(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S;
    const id = idRef.current++;
    if (pending.type === "text")
      setAnnots((a) => [...a, { id, page: pageIdx, type: "text", x, y: y - 14, text: pending.text, size: 16, color: "#111827" }]);
    else if (pending.type === "rect")
      setAnnots((a) => [...a, { id, page: pageIdx, type: "rect", x: x - 50, y: y - 12, w: 100, h: 24, color: "#ffffff" }]);
    else
      setAnnots((a) => [...a, { id, page: pageIdx, type: "image", x: x - pending.w / 2, y: y - pending.h / 2, w: pending.w, h: pending.h, url: pending.url, kind: pending.kind }]);
    setSel(id);
    setPending(null);
  };

  const startDrag = (e: React.PointerEvent, a: Annot, resize = false) => {
    e.stopPropagation();
    setSel(a.id);
    dragRef.current = {
      id: a.id, sx: e.clientX, sy: e.clientY, ox: a.x, oy: a.y, resize,
      ow: a.type !== "text" ? a.w : undefined, oh: a.type !== "text" ? a.h : undefined,
    };
  };

  const update = useCallback((id: number, patch: Partial<Annot>) => {
    setAnnots((a) => a.map((x) => (x.id === id ? ({ ...x, ...patch } as Annot) : x)));
  }, []);

  const onImage = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const w = Math.min(180, img.naturalWidth);
        setPending({ type: "image", url, w, h: (img.naturalHeight / img.naturalWidth) * w, kind: f.type === "image/jpeg" ? "jpg" : "png" });
      };
      img.src = url;
    };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!file) return;
    setSaving(true); setError(null);
    try {
      const doc = await openPdfLib(await readBuffer(file));
      const pgs = doc.getPages();
      for (const a of annots) {
        const page = pgs[a.page];
        const H = pages[a.page].h;
        if (a.type === "text") {
          if (!a.text.trim()) continue;
          const t = await textToPng(a.text, a.size, a.color);
          const img = await doc.embedPng(t.bytes);
          page.drawImage(img, { x: a.x, y: H - a.y - t.height, width: t.width, height: t.height });
        } else if (a.type === "image") {
          const bytes = new Uint8Array(await (await fetch(a.url)).arrayBuffer());
          const img = a.kind === "jpg" ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
          page.drawImage(img, { x: a.x, y: H - a.y - a.h, width: a.w, height: a.h });
        } else {
          const [r, g, b] = hexToRgb01(a.color);
          page.drawRectangle({ x: a.x, y: H - a.y - a.h, width: a.w, height: a.h, color: rgb(r, g, b) });
        }
      }
      const bytes = await doc.save();
      const blob = pdfBlob(bytes);
      setSaved(blob);
      downloadBlob(blob, `${baseName(file.name)}-edited.pdf`);
    } catch (e) {
      console.error(e);
      setError("حدث خطأ أثناء حفظ الملف");
    } finally {
      setSaving(false);
    }
  };

  const current = annots.find((a) => a.id === sel) || null;
  const title = mode === "sign" ? "تعبئة وتوقيع PDF" : "تعديل PDF";

  if (!file)
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              {mode === "sign" ? <PenTool size={28} /> : <Type size={28} />}
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800">{title}</h1>
            <p className="mt-2 text-slate-500">أضف نصوصًا وتوقيعًا وصورًا وأغطية بيضاء فوق صفحات الملف.</p>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); }}
            className="flex flex-col items-center rounded-3xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center"
          >
            <input ref={fileInput} type="file" hidden accept=".pdf,application/pdf" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            <button onClick={() => fileInput.current?.click()} className="flex items-center gap-3 rounded-xl bg-blue-500 px-8 py-4 text-lg font-bold text-white shadow-lg hover:scale-[1.02]">
              <Upload size={22} /> اختر ملف PDF
            </button>
            <p className="mt-4 text-slate-500">أو اسحب الملف وأفلته هنا</p>
            <p className="mt-6 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} className="text-emerald-500" /> ملفاتك لا تغادر جهازك أبدًا</p>
          </div>
          {error && <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} /> {error}</div>}
        </div>
      </div>
    );

  const tb = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition";
  const active = (on: boolean) => (on ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200");

  return (
    <div className="min-h-[80vh] bg-slate-200">
      {/* شريط الأدوات */}
      <div className="sticky top-[57px] z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5">
          <button className={`${tb} ${active(pending === null)}`} onClick={() => setPending(null)}><MousePointer2 size={16} /> تحديد</button>
          <button className={`${tb} ${active(pending?.type === "text" && pending.text === "نص")}`} onClick={() => setPending({ type: "text", text: "نص" })}><Type size={16} /> نص</button>
          <button className={`${tb} ${active(false)}`} onClick={() => setSigOpen(true)}><PenTool size={16} /> توقيع</button>
          <button className={`${tb} ${active(pending?.type === "image")}`} onClick={() => imgInput.current?.click()}><ImagePlus size={16} /> صورة</button>
          <input ref={imgInput} type="file" hidden accept="image/png,image/jpeg" onChange={(e) => { if (e.target.files?.[0]) onImage(e.target.files[0]); e.target.value = ""; }} />
          <button className={`${tb} ${active(pending?.type === "rect")}`} onClick={() => setPending({ type: "rect" })}><Square size={16} /> تغطية</button>
          <button className={`${tb} ${active(pending?.type === "text" && pending.text === "✓")}`} onClick={() => setPending({ type: "text", text: "✓" })}><Check size={16} /></button>
          <button className={`${tb} ${active(pending?.type === "text" && pending.text === "✗")}`} onClick={() => setPending({ type: "text", text: "✗" })}><XIcon size={16} /></button>
          <div className="mr-auto flex items-center gap-2">
            <button onClick={() => { setFile(null); setPages([]); setAnnots([]); setSaved(null); }} className={`${tb} text-slate-500 hover:bg-slate-100`}><RotateCcw size={16} /> ملف آخر</button>
            <button disabled={saving || loading} onClick={save} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="spin" /> : <Download size={16} />} حفظ وتحميل
            </button>
          </div>
        </div>

        {/* خصائص العنصر المحدد */}
        {current && (
          <div className="border-t border-slate-100 bg-slate-50">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
              {current.type === "text" && (
                <>
                  <input
                    autoFocus
                    dir="auto"
                    value={current.text}
                    onChange={(e) => update(current.id, { text: e.target.value })}
                    className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-blue-500"
                  />
                  <label className="flex items-center gap-2 text-slate-600">الحجم
                    <input type="number" min={6} max={120} value={current.size} onChange={(e) => update(current.id, { size: Math.max(6, +e.target.value || 12) })} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5" />
                  </label>
                </>
              )}
              {(current.type === "text" || current.type === "rect") && (
                <label className="flex items-center gap-2 text-slate-600">اللون
                  <input type="color" value={current.color} onChange={(e) => update(current.id, { color: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                </label>
              )}
              {current.type !== "text" && <span className="text-slate-400">اسحب الزاوية السفلية لتغيير الحجم</span>}
              <button onClick={() => { setAnnots((a) => a.filter((x) => x.id !== current.id)); setSel(null); }} className="mr-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /> حذف</button>
            </div>
          </div>
        )}
        {pending && (
          <div className="bg-blue-600 py-1.5 text-center text-sm text-white">
            {pending.type === "image" ? "اضغط على الصفحة لوضع الصورة/التوقيع" : pending.type === "rect" ? "اضغط على الصفحة لوضع مربع التغطية" : "اضغط على المكان الذي تريد إضافة النص فيه"}
          </div>
        )}
      </div>

      {error && <div className="mx-auto mt-4 flex max-w-xl items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} /> {error}</div>}
      {saved && <div className="mx-auto mt-4 max-w-xl rounded-xl bg-emerald-50 p-3 text-center text-sm text-emerald-700">تم الحفظ! إذا لم يبدأ التحميل <button className="font-bold underline" onClick={() => downloadBlob(saved, `${baseName(file.name)}-edited.pdf`)}>اضغط هنا</button></div>}

      {/* الصفحات */}
      <div className="overflow-auto px-4 py-6">
        <div className="mx-auto flex w-max flex-col items-center gap-6" dir="ltr">
          {pages.map((p, i) => (
            <div key={i}>
              <div className="mb-1 text-center text-xs text-slate-500">صفحة {i + 1}</div>
              <div
                onClick={(e) => placeAt(i, e)}
                className={`relative bg-white shadow-lg ${pending ? "cursor-crosshair" : ""}`}
                style={{ width: p.w * S, height: p.h * S }}
              >
                <img src={p.url} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
                {annots.filter((a) => a.page === i).map((a) => {
                  const on = a.id === sel;
                  const common = {
                    left: a.x * S, top: a.y * S,
                  };
                  return (
                    <div
                      key={a.id}
                      onPointerDown={(e) => startDrag(e, a)}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute cursor-move touch-none ${on ? "outline outline-2 outline-blue-500" : "hover:outline hover:outline-1 hover:outline-blue-300"}`}
                      style={
                        a.type === "text"
                          ? { ...common, fontSize: a.size * S, lineHeight: 1.7, color: a.color, whiteSpace: "pre", padding: `0 ${4 * S}px`, fontWeight: 500, fontFamily: "Cairo, Arial, sans-serif" }
                          : { ...common, width: a.w * S, height: a.h * S, background: a.type === "rect" ? a.color : undefined }
                      }
                    >
                      {a.type === "text" && <span dir="auto">{a.text || " "}</span>}
                      {a.type === "image" && <img src={a.url} alt="" draggable={false} className="pointer-events-none h-full w-full select-none" />}
                      {on && a.type !== "text" && (
                        <span
                          onPointerDown={(e) => startDrag(e, a, true)}
                          className="absolute -right-2 -bottom-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-blue-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {loading && <div className="flex items-center gap-2 py-6 text-slate-500"><Loader2 className="spin" size={18} /> جارٍ تحميل الصفحات...</div>}
        </div>
      </div>

      {sigOpen && (
        <SignatureModal
          onClose={() => setSigOpen(false)}
          onDone={(url, w, h) => { setPending({ type: "image", url, w, h, kind: "png" }); setSigOpen(false); }}
        />
      )}
    </div>
  );
}

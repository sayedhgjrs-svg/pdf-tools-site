import { useState } from "react";
import { RotateCw, Trash2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import type { PageItem } from "../lib/runners";

function Skeleton() {
  return <div className="h-full w-full animate-pulse bg-slate-200" />;
}

interface SelectProps {
  thumbs: (string | null)[];
  selected: Set<number>;
  onChange: (s: Set<number>) => void;
  danger?: boolean;
}

export function SelectGrid({ thumbs, selected, onChange, danger }: SelectProps) {
  const toggle = (n: number) => {
    const s = new Set(selected);
    s.has(n) ? s.delete(n) : s.add(n);
    onChange(s);
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50" onClick={() => onChange(new Set(thumbs.map((_, i) => i + 1)))}>
          تحديد الكل
        </button>
        <button className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50" onClick={() => onChange(new Set())}>
          إلغاء التحديد
        </button>
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50"
          onClick={() => onChange(new Set(thumbs.map((_, i) => i + 1).filter((n) => n % 2 === 1)))}
        >
          الفردية
        </button>
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50"
          onClick={() => onChange(new Set(thumbs.map((_, i) => i + 1).filter((n) => n % 2 === 0)))}
        >
          الزوجية
        </button>
        <span className="text-slate-500">محدد: {selected.size} من {thumbs.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {thumbs.map((t, i) => {
          const on = selected.has(i + 1);
          return (
            <button
              key={i}
              onClick={() => toggle(i + 1)}
              className={`relative rounded-xl border-2 p-1.5 transition ${
                on ? (danger ? "border-red-500 bg-red-50" : "border-blue-500 bg-blue-50") : "border-transparent bg-white shadow-sm hover:border-slate-300"
              }`}
            >
              <div className={`aspect-[3/4] overflow-hidden rounded-md bg-slate-100 ${on && danger ? "opacity-50" : ""}`}>
                {t ? <img src={t} alt="" className="h-full w-full object-contain" /> : <Skeleton />}
              </div>
              <div className="mt-1 text-xs text-slate-500">{i + 1}</div>
              {on && (
                <span className={`absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full text-white ${danger ? "bg-red-500" : "bg-blue-500"}`}>
                  {danger ? <Trash2 size={13} /> : <Check size={14} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface OrgProps {
  thumbs: (string | null)[];
  items: PageItem[];
  onChange: (i: PageItem[]) => void;
}

export function OrganizeGrid({ thumbs, items, onChange }: OrgProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const a = items.slice();
    const [x] = a.splice(from, 1);
    a.splice(to, 0, x);
    onChange(a);
  };
  const rotate = (i: number) => onChange(items.map((p, k) => (k === i ? { ...p, rot: (p.rot + 90) % 360 } : p)));
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">اسحب الصفحات لإعادة ترتيبها، أو استخدم الأزرار للتدوير والحذف.</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((it, i) => (
          <div
            key={it.src}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
              setOver(null);
            }}
            className={`cursor-grab rounded-xl border-2 bg-white p-1.5 shadow-sm transition ${
              over === i && drag !== i ? "border-emerald-500" : "border-transparent"
            } ${drag === i ? "opacity-40" : ""}`}
          >
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-slate-100">
              {thumbs[it.src] ? (
                <img
                  src={thumbs[it.src]!}
                  alt=""
                  draggable={false}
                  className="max-h-full max-w-full object-contain transition-transform"
                  style={{ transform: `rotate(${it.rot}deg) scale(${it.rot % 180 ? 0.72 : 1})` }}
                />
              ) : (
                <Skeleton />
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{it.src + 1}</span>
              <span className="flex">
                <button onClick={() => move(i, i + 1)} className="rounded p-1 hover:bg-slate-100" title="تأخير"><ArrowLeft size={14} /></button>
                <button onClick={() => move(i, i - 1)} className="rounded p-1 hover:bg-slate-100" title="تقديم"><ArrowRight size={14} /></button>
                <button onClick={() => rotate(i)} className="rounded p-1 hover:bg-slate-100" title="تدوير"><RotateCw size={14} /></button>
                <button onClick={() => remove(i)} className="rounded p-1 text-red-500 hover:bg-red-50" title="حذف"><Trash2 size={14} /></button>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

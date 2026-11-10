import { useEffect, useRef, useState } from "react";
import { ChevronDown, X, FileText, Gift } from "lucide-react";
import { categories, tools, catById } from "../lib/tools";

const quick = ["compress", "edit", "sign", "merge", "delete", "crop"];

export default function Header({ route }: { route: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header ref={ref} className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[57px] max-w-7xl items-center gap-5 px-4">
        <a href="#/" className="flex items-center gap-2 text-xl font-extrabold text-slate-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white"><FileText size={19} /></span>
          بي دي إف برو
        </a>

        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${open ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"}`}
        >
          كل الأدوات <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {quick.map((id) => {
            const t = tools.find((x) => x.id === id)!;
            return (
              <a key={id} href={`#/tool/${id}`} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                {t.title.replace(" PDF", "").replace("ملفات ", "")}
              </a>
            );
          })}
        </nav>

        <div className="mr-auto flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
          <Gift size={16} /> مجاني 100%
        </div>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 top-[57px] z-30 bg-black/20" onClick={() => setOpen(false)} />
          <div className="fade-in absolute inset-x-0 top-full z-40 max-h-[calc(100vh-57px)] overflow-y-auto border-b border-slate-200 bg-white shadow-xl">
            <div className="relative mx-auto max-w-7xl px-6 py-8">
              <button onClick={() => setOpen(false)} className="absolute top-4 left-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={22} /></button>
              <div className="columns-1 gap-8 sm:columns-2 lg:columns-4 xl:columns-5">
                {categories.map((c) => {
                  const list = tools.filter((t) => t.cat === c.id);
                  return (
                    <div key={c.id} className="mb-7 break-inside-avoid">
                      <div className="mb-3 text-xs font-bold tracking-wide text-slate-400">{c.title}</div>
                      <ul className="space-y-1">
                        {list.map((t) => {
                          const Icon = t.icon;
                          const cat = catById(t.cat);
                          return (
                            <li key={t.id}>
                              <a href={`#/tool/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cat.bg} ${cat.text}`}><Icon size={15} /></span>
                                <span>{t.title}</span>
                                {t.isNew && <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">جديد</span>}
                                {t.soon && <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">قريبًا</span>}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload, Download, Loader2, AlertCircle, RotateCcw, CheckCircle2, FileArchive, ShieldCheck, Clock } from "lucide-react";
import { catById, toolById } from "../lib/tools";
import { runners, type PageItem, type Field } from "../lib/runners";
import { OutFile, downloadBlob, downloadZip, formatSize } from "../lib/pdf";
import { useThumbs } from "../components/useThumbs";
import FileCard from "../components/FileCard";
import { OrganizeGrid, SelectGrid } from "../components/PageGrids";

function Dropzone({
  accept, multiple, label, onFiles, color,
}: { accept: string; multiple: boolean; label: string; onFiles: (f: File[]) => void; color: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition ${
        hover ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
      }`}
    >
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        className={`flex items-center gap-3 rounded-xl px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02] hover:shadow-xl ${color}`}
      >
        <Upload size={22} /> {label}
      </button>
      <p className="mt-4 text-slate-500">أو اسحب الملفات وأفلتها هنا</p>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={15} className="text-emerald-500" />
        ملفاتك لا تُرفع إلى أي سيرفر، المعالجة تتم بالكامل داخل متصفحك
      </p>
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  const base = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  if (f.type === "checkbox")
    return (
      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-600" />
        <span>{f.label}</span>
      </label>
    );
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-slate-700">{f.label}</span>
      {f.type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          {f.options!.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      ) : f.type === "color" ? (
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-20 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
      ) : f.type === "number" ? (
        <input type="number" value={value} min={f.min} max={f.max} onChange={(e) => onChange(e.target.value)} className={base} />
      ) : (
        <input type="text" value={value} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} className={base} dir="auto" />
      )}
      {f.hint && <span className="mt-1 block text-xs text-slate-400">{f.hint}</span>}
    </label>
  );
}

export default function ToolPage({ toolId }: { toolId: string }) {
  const tool = toolById(toolId)!;
  const runner = runners[toolId];
  const cat = catById(tool.cat);

  const [files, setFiles] = useState<File[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<PageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<OutFile[] | null>(null);

  const defaults = useMemo(() => Object.fromEntries(runner.fields.map((f) => [f.key, f.def])), [runner]);

  useEffect(() => {
    setFiles([]); setValues(defaults); setSelected(new Set()); setItems([]);
    setResults(null); setError(null); setProgress(0);
  }, [toolId, defaults]);

  const single = runner.input === "pdf";
  const needThumbs = !!runner.ui;
  const { thumbs, total, error: thumbErr } = useThumbs(needThumbs ? files[0] ?? null : null, Infinity, 200);

  useEffect(() => {
    if (runner.ui === "organize") setItems(Array.from({ length: total }, (_, i) => ({ src: i, rot: 0 })));
    setSelected(new Set());
  }, [total, runner.ui, files]);

  // تعبئة مسبقة للحقول
  useEffect(() => {
    if (runner.prefill && files[0]) {
      runner.prefill(files[0]).then((p) => setValues((v) => ({ ...v, ...p }))).catch(() => {});
    }
  }, [files, runner]);

  const addFiles = (list: File[]) => {
    setError(null);
    const ok = list.filter((f) =>
      runner.input === "images" ? f.type.startsWith("image/") : /\.pdf$/i.test(f.name) || f.type === "application/pdf"
    );
    if (!ok.length) {
      setError(runner.input === "images" ? "اختر ملفات صور فقط (JPG, PNG, WebP...)" : "اختر ملفات PDF فقط");
      return;
    }
    setFiles((prev) => (single ? [ok[0]] : [...prev, ...ok]));
  };

  const move = (i: number, d: -1 | 1) =>
    setFiles((p) => {
      const a = p.slice();
      [a[i], a[i + d]] = [a[i + d], a[i]];
      return a;
    });

  const minFiles = runner.minFiles ?? 1;
  const canRun = files.length >= minFiles && !busy;

  const run = async () => {
    setBusy(true); setError(null); setProgress(0);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const res = await runner.run({
        files, values, selected: Array.from(selected), pageItems: items, progress: setProgress,
      });
      setResults(res);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "حدث خطأ أثناء المعالجة. تأكد أن الملف سليم وغير محمي بكلمة مرور.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFiles([]); setResults(null); setError(null); setValues(defaults); setProgress(0);
  };

  const Icon = tool.icon;
  const accept = runner.input === "images" ? "image/*" : ".pdf,application/pdf";
  const visibleFields = runner.fields.filter((f) => !f.showIf || f.showIf(values));

  return (
    <div className="min-h-[70vh] bg-slate-50 pb-28">
      <div className="mx-auto max-w-6xl px-4 pt-10">
        <div className="mb-8 text-center">
          <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${cat.bg} ${cat.text}`}>
            <Icon size={28} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800">{tool.title}</h1>
          <p className="mt-2 text-slate-500">{tool.desc}</p>
        </div>

        {results ? (
          <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-col items-center text-center">
              <CheckCircle2 size={56} className="text-emerald-500" />
              <h2 className="mt-3 text-2xl font-bold text-slate-800">تمت العملية بنجاح!</h2>
            </div>
            <ul className="space-y-2">
              {results.slice(0, 50).map((r, i) => (
                <li key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-700" dir="ltr">{r.name}</div>
                      <div className="text-xs text-slate-400">{formatSize(r.blob.size)}</div>
                    </div>
                    <button onClick={() => downloadBlob(r.blob, r.name)} className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                      <Download size={16} /> تحميل
                    </button>
                  </div>
                  {r.note && <p className="mt-2 text-xs text-amber-600">{r.note}</p>}
                </li>
              ))}
            </ul>
            {results.length > 50 && <p className="mt-2 text-center text-xs text-slate-400">عرض أول 50 ملفًا، حمّل الكل بصيغة ZIP.</p>}
            {results.length > 1 && (
              <button onClick={() => downloadZip(results, `${tool.id}.zip`)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 font-bold text-white hover:bg-slate-900">
                <FileArchive size={18} /> تحميل الكل (ZIP)
              </button>
            )}
            <button onClick={reset} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 font-semibold text-slate-600 hover:bg-slate-50">
              <RotateCcw size={16} /> معالجة ملف آخر
            </button>
          </div>
        ) : files.length === 0 ? (
          <div className="mx-auto max-w-3xl">
            <Dropzone
              accept={accept}
              multiple={!single}
              color={cat.dot}
              label={runner.input === "images" ? "اختر الصور" : single ? "اختر ملف PDF" : "اختر ملفات PDF"}
              onFiles={addFiles}
            />
            {error && <ErrorBox msg={error} />}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-6">
              {/* الملفات */}
              {(!needThumbs || true) && (
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start gap-5">
                    {files.map((f, i) => (
                      <FileCard
                        key={f.name + f.size + i}
                        file={f}
                        index={i}
                        total={files.length}
                        image={runner.input === "images"}
                        onMove={single ? undefined : (d) => move(i, d)}
                        onRemove={() => setFiles((p) => p.filter((_, k) => k !== i))}
                      />
                    ))}
                    <AddMore single={single} accept={accept} onFiles={addFiles} />
                  </div>
                  {files.length < minFiles && (
                    <p className="mt-4 flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle size={16} /> أضف {minFiles - files.length} ملف على الأقل للمتابعة
                    </p>
                  )}
                  {!single && files.length > 1 && <p className="mt-3 text-xs text-slate-400">رتّب الملفات بالأسهم، سيتم تطبيق الترتيب كما يظهر هنا.</p>}
                </div>
              )}

              {/* الصفحات */}
              {needThumbs && (
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  {thumbErr ? (
                    <ErrorBox msg={thumbErr} />
                  ) : total === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400"><Loader2 className="spin" /> جارٍ تحميل الصفحات...</div>
                  ) : runner.ui === "select" ? (
                    <>
                      <p className="mb-3 text-sm font-semibold text-slate-600">{runner.selectHint}</p>
                      <SelectGrid thumbs={thumbs} selected={selected} onChange={setSelected} danger={toolId === "delete"} />
                    </>
                  ) : (
                    <OrganizeGrid thumbs={thumbs} items={items} onChange={setItems} />
                  )}
                </div>
              )}
            </div>

            {/* الخيارات */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-slate-800">الخيارات</h3>
                {visibleFields.length === 0 ? (
                  <p className="text-sm text-slate-400">لا توجد خيارات إضافية لهذه الأداة.</p>
                ) : (
                  <div className="space-y-4">
                    {visibleFields.map((f) => (
                      <FieldInput key={f.key} f={f} value={values[f.key]} onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))} />
                    ))}
                  </div>
                )}
                <button
                  disabled={!canRun}
                  onClick={run}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-lg font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${cat.dot} hover:brightness-95`}
                >
                  {busy ? (<><Loader2 className="spin" size={20} /> جارٍ المعالجة...</>) : runner.action}
                </button>
                {busy && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${cat.dot} transition-all`} style={{ width: `${Math.max(8, progress * 100)}%` }} />
                  </div>
                )}
                {error && <ErrorBox msg={error} />}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function AddMore({ single, accept, onFiles }: { single: boolean; accept: string; onFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" hidden accept={accept} multiple={!single} onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <button onClick={() => ref.current?.click()} className="flex h-[210px] w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-blue-400 hover:text-blue-500">
        {single ? <Upload size={26} /> : <Plus size={28} />}
        <span className="text-xs font-semibold">{single ? "تغيير الملف" : "إضافة ملفات"}</span>
      </button>
    </>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle size={18} className="mt-0.5 shrink-0" /> <span>{msg}</span>
    </div>
  );
}

export function SoonPage({ toolId }: { toolId: string }) {
  const tool = toolById(toolId)!;
  const Icon = tool.icon;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon size={32} /></div>
      <h1 className="text-3xl font-extrabold text-slate-800">{tool.title}</h1>
      <p className="mt-2 text-slate-500">{tool.desc}</p>
      <div className="mt-6 flex items-center gap-2 rounded-full bg-amber-50 px-5 py-2 font-semibold text-amber-700"><Clock size={18} /> هذه الأداة قادمة قريبًا</div>
      <a href="#/" className="mt-6 text-blue-600 hover:underline">العودة إلى كل الأدوات</a>
    </div>
  );
}

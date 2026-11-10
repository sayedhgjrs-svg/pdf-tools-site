import { useMemo, useState } from "react";
import { Search, ShieldCheck, Zap, Gift, UserX, Heart } from "lucide-react";
import { categories, tools, catById, type Tool } from "../lib/tools";

function Card({ t }: { t: Tool }) {
  const Icon = t.icon;
  const cat = catById(t.cat);
  return (
    <a
      href={`#/tool/${t.id}`}
      className={`group relative flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg ${t.soon ? "opacity-70" : ""}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cat.bg} ${cat.text} transition group-hover:scale-110`}>
        <Icon size={24} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-bold text-slate-800">
          {t.title}
          {t.isNew && <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">جديد</span>}
          {t.soon && <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">قريبًا</span>}
        </span>
        <span className="mt-1 block text-sm leading-6 text-slate-500">{t.desc}</span>
      </span>
    </a>
  );
}

export default function Home() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return tools.filter((t) => (t.title + t.desc).toLowerCase().includes(s));
  }, [q]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-16 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-bold text-emerald-700">
            <Gift size={16} /> مجاني بالكامل • بدون تسجيل • بدون حدود
          </span>
          <h1 className="mt-5 text-4xl leading-tight font-extrabold text-slate-900 md:text-5xl">
            كل أدوات PDF التي تحتاجها
            <span className="block text-emerald-600">في مكان واحد وبشكل مجاني</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            ادمج، قسّم، اضغط، عدّل ووقّع ملفات PDF بسهولة. كل شيء يتم داخل متصفحك، فملفاتك تبقى خاصة وآمنة.
          </p>
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400" size={20} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن أداة... مثال: دمج، ضغط، توقيع"
              className="w-full rounded-2xl border border-slate-200 bg-white py-4 pr-12 pl-4 text-base shadow-lg outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16">
        {filtered ? (
          <section>
            <h2 className="mb-5 text-xl font-bold text-slate-800">نتائج البحث ({filtered.length})</h2>
            {filtered.length ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map((t) => <Card key={t.id} t={t} />)}</div>
            ) : (
              <p className="py-10 text-center text-slate-400">لا توجد أدوات مطابقة لبحثك.</p>
            )}
          </section>
        ) : (
          <>
            <section className="mb-12">
              <h2 className="mb-5 text-2xl font-extrabold text-slate-800">الأدوات الأكثر استخدامًا</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tools.filter((t) => t.popular).slice(0, 9).map((t) => <Card key={t.id} t={t} />)}
              </div>
            </section>

            {categories.map((c) => {
              const list = tools.filter((t) => t.cat === c.id);
              return (
                <section key={c.id} className="mb-10">
                  <h2 className="mb-4 flex items-center gap-3 text-xl font-bold text-slate-800">
                    <span className={`h-6 w-1.5 rounded-full ${c.dot}`} /> {c.title}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{list.map((t) => <Card key={t.id} t={t} />)}</div>
                </section>
              );
            })}
          </>
        )}
      </div>

      {/* المميزات */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: ShieldCheck, t: "خصوصية تامة", d: "المعالجة تتم على جهازك ولا يتم رفع أي ملف لسيرفر." },
            { i: Gift, t: "مجاني للأبد", d: "كل الأدوات بدون اشتراك أو علامات مائية أو حدود للاستخدام." },
            { i: UserX, t: "بدون تسجيل", d: "ادخل واستخدم الأداة مباشرة بدون إنشاء حساب." },
            { i: Zap, t: "سريع وخفيف", d: "نتائج فورية بدون انتظار الرفع والتحميل من السيرفر." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm"><Icon size={26} /></div>
              <h3 className="font-bold text-slate-800">{t}</h3>
              <p className="mt-1 text-sm text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
        صُنع بـ <Heart size={13} className="mx-0.5 inline fill-red-500 text-red-500" /> • بي دي إف برو - أدوات PDF مجانية © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

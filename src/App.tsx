import { useEffect, useState } from "react";
import Header from "./components/Header";
import Home from "./pages/Home";
import ToolPage, { SoonPage } from "./pages/ToolPage";
import EditorPage from "./pages/EditorPage";
import { PrivacyPage, AboutPage, ContactPage } from "./pages/StaticPages";
import { toolById } from "./lib/tools";
import { runners } from "./lib/runners";

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || "#/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

const staticTitles: Record<string, string> = {
  "#/privacy": "سياسة الخصوصية - بي دي إف برو",
  "#/about": "من نحن - بي دي إف برو",
  "#/contact": "اتصل بنا - بي دي إف برو",
};

export default function App() {
  const hash = useHashRoute();
  const m = hash.match(/^#\/tool\/([\w-]+)/);
  const id = m?.[1];
  const tool = id ? toolById(id) : undefined;

  useEffect(() => {
    if (staticTitles[hash]) document.title = staticTitles[hash];
    else document.title = tool ? `${tool.title} مجانًا - بي دي إف برو` : "بي دي إف برو - أدوات PDF مجانية أونلاين";
  }, [tool, hash]);

  let page;
  if (hash === "#/privacy") page = <PrivacyPage />;
  else if (hash === "#/about") page = <AboutPage />;
  else if (hash === "#/contact") page = <ContactPage />;
  else if (!tool) page = <Home />;
  else if (tool.soon || (!runners[tool.id] && tool.id !== "edit" && tool.id !== "sign")) page = <SoonPage toolId={tool.id} />;
  else if (tool.id === "edit" || tool.id === "sign") page = <EditorPage key={tool.id} mode={tool.id} />;
  else page = <ToolPage toolId={tool.id} />;

  return (
    <div dir="rtl" className="min-h-screen bg-white">
      <Header route={hash} />
      {page}
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap gap-8 justify-center md:justify-between items-start">
          <div>
            <h3 className="text-xl font-bold mb-4 text-emerald-400">بي دي إف برو</h3>
            <p className="text-gray-400 text-sm max-w-xs">أدوات PDF مجانية وآمنة تعمل داخل متصفحك مباشرة، بدون رفع ملفات.</p>
          </div>
          <div>
            <h4 className="font-bold mb-3">روابط مهمة</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><a href="#/privacy" className="hover:text-emerald-400 transition">سياسة الخصوصية</a></li>
              <li><a href="#/about" className="hover:text-emerald-400 transition">من نحن</a></li>
              <li><a href="#/contact" className="hover:text-emerald-400 transition">اتصل بنا</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3">جميع الأدوات</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><a href="#/tool/merge" className="hover:text-emerald-400 transition">دمج ملفات PDF</a></li>
              <li><a href="#/tool/compress" className="hover:text-emerald-400 transition">ضغط PDF</a></li>
              <li><a href="#/tool/split" className="hover:text-emerald-400 transition">تقسيم PDF</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500">
          جميع الحقوق محفوظة © {new Date().getFullYear()} بي دي إف برو
        </div>
      </div>
    </footer>
  );
}
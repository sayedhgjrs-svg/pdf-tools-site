import { useEffect, useState } from "react";
import Header from "./components/Header";
import Home from "./pages/Home";
import ToolPage, { SoonPage } from "./pages/ToolPage";
import EditorPage from "./pages/EditorPage";
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

export default function App() {
  const hash = useHashRoute();
  const m = hash.match(/^#\/tool\/([\w-]+)/);
  const id = m?.[1];
  const tool = id ? toolById(id) : undefined;

  useEffect(() => {
    document.title = tool ? `${tool.title} مجانًا - بي دي إف برو` : "بي دي إف برو - أدوات PDF مجانية أونلاين";
  }, [tool]);

  let page;
  if (!tool) page = <Home />;
  else if (tool.soon || (!runners[tool.id] && tool.id !== "edit" && tool.id !== "sign")) page = <SoonPage toolId={tool.id} />;
  else if (tool.id === "edit" || tool.id === "sign") page = <EditorPage key={tool.id} mode={tool.id} />;
  else page = <ToolPage toolId={tool.id} />;

  return (
    <div dir="rtl" className="min-h-screen bg-white">
      <Header route={hash} />
      {page}
    </div>
  );
}

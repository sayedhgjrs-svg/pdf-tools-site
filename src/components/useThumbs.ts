import { useEffect, useState } from "react";
import { openPdfjs, readBuffer, renderPage } from "../lib/pdf";

export interface ThumbState {
  thumbs: (string | null)[];
  total: number;
  error: string | null;
}

/** يولّد صورًا مصغرة لصفحات ملف PDF بشكل تدريجي */
export function useThumbs(file: File | null, max = Infinity, width = 180): ThumbState {
  const [state, setState] = useState<ThumbState>({ thumbs: [], total: 0, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ thumbs: [], total: 0, error: null });
    if (!file) return;
    (async () => {
      try {
        const pdf = await openPdfjs(await readBuffer(file));
        const n = Math.min(pdf.numPages, max);
        if (cancelled) return;
        setState({ thumbs: Array(n).fill(null), total: pdf.numPages, error: null });
        for (let i = 1; i <= n; i++) {
          if (cancelled) return;
          const p = await pdf.getPage(i);
          const base = p.getViewport({ scale: 1 });
          const c = await renderPage(pdf, i, width / base.width);
          const url = c.toDataURL("image/jpeg", 0.7);
          c.width = 0;
          if (cancelled) return;
          setState((s) => {
            const t = s.thumbs.slice();
            t[i - 1] = url;
            return { ...s, thumbs: t };
          });
        }
      } catch (e) {
        if (!cancelled)
          setState({
            thumbs: [],
            total: 0,
            error: "تعذّر قراءة الملف. قد يكون محميًا بكلمة مرور أو تالفًا.",
          });
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, max, width]);

  return state;
}

import { PDFDocument, PDFName, PDFPage, degrees, rgb } from "pdf-lib";
import {
  OutFile, baseName, canvasToBlob, fileToImageBitmapData, hexToRgb01, openPdfLib, openPdfjs,
  parseRanges, pdfBlob, rasterizePdf, readBuffer, renderPage, textToPng,
} from "./pdf";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Field {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "checkbox" | "color";
  def: any;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  showIf?: (v: Record<string, any>) => boolean;
}

export interface PageItem {
  src: number; // رقم الصفحة الأصلية (من 0)
  rot: number;
}

export interface RunCtx {
  files: File[];
  values: Record<string, any>;
  selected: number[]; // صفحات محددة (من 1)
  pageItems: PageItem[];
  progress: (p: number) => void;
}

export interface Runner {
  input: "pdf" | "pdfs" | "images";
  minFiles?: number;
  ui?: "select" | "organize";
  selectHint?: string;
  action: string;
  fields: Field[];
  prefill?: (file: File) => Promise<Record<string, any>>;
  run: (ctx: RunCtx) => Promise<OutFile[]>;
}

const SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  a5: [419.53, 595.28],
  letter: [612, 792],
  legal: [612, 1008],
};
const MM = 2.83465;

const toDigits = (s: string, arabic: boolean) =>
  arabic ? s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]) : s;

async function loadFirst(ctx: RunCtx) {
  const buf = await readBuffer(ctx.files[0]);
  const doc = await openPdfLib(buf);
  return { buf, doc, name: baseName(ctx.files[0].name) };
}

async function save(doc: PDFDocument, name: string, note?: string): Promise<OutFile[]> {
  const bytes = await doc.save({ useObjectStreams: true });
  return [{ name, blob: pdfBlob(bytes), note }];
}

async function copyInto(out: PDFDocument, src: PDFDocument, idx: number[]) {
  const pages = await out.copyPages(src, idx);
  pages.forEach((p) => out.addPage(p));
}

function pagesFromSelection(ctx: RunCtx, total: number): number[] {
  const r = (ctx.values.ranges || "").trim();
  if (r) return parseRanges(r, total);
  return [...ctx.selected].sort((a, b) => a - b);
}

const imgCache = new WeakMap<PDFDocument, Map<string, any>>();
async function stampImage(out: PDFDocument, text: string, size: number, color: string, bold = false) {
  let m = imgCache.get(out);
  if (!m) imgCache.set(out, (m = new Map()));
  const key = `${text}|${size}|${color}|${bold}`;
  if (!m.has(key)) {
    const t = await textToPng(text, size, color, bold);
    const img = await out.embedPng(t.bytes);
    m.set(key, { img, w: t.width, h: t.height });
  }
  return m.get(key) as { img: any; w: number; h: number };
}

async function extractText(buf: ArrayBuffer, onProgress?: (p: number) => void): Promise<string[]> {
  const pdf = await openPdfjs(buf);
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const lines: string[] = [];
    let line = "";
    let lastY: number | null = null;
    for (const it of tc.items as any[]) {
      if (typeof it.str !== "string") continue;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(line);
        line = "";
      }
      line += it.str;
      lastY = y;
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
    onProgress?.(i / pdf.numPages);
  }
  return pages;
}

const posOptions = [
  { value: "bc", label: "أسفل - المنتصف" },
  { value: "br", label: "أسفل - اليمين" },
  { value: "bl", label: "أسفل - اليسار" },
  { value: "tc", label: "أعلى - المنتصف" },
  { value: "tr", label: "أعلى - اليمين" },
  { value: "tl", label: "أعلى - اليسار" },
];

function placeX(pos: string, pw: number, w: number, margin: number) {
  if (pos.endsWith("c")) return (pw - w) / 2;
  if (pos.endsWith("r")) return pw - w - margin;
  return margin;
}

export const runners: Record<string, Runner> = {
  merge: {
    input: "pdfs",
    minFiles: 2,
    action: "دمج الملفات",
    fields: [],
    async run(ctx) {
      const out = await PDFDocument.create();
      for (let i = 0; i < ctx.files.length; i++) {
        const src = await openPdfLib(await readBuffer(ctx.files[i]));
        await copyInto(out, src, src.getPageIndices());
        ctx.progress((i + 1) / ctx.files.length);
      }
      return save(out, "merged.pdf");
    },
  },

  alternate: {
    input: "pdfs",
    minFiles: 2,
    action: "دمج بالتبادل",
    fields: [
      { key: "reverse", label: "اعكس ترتيب صفحات الملف الثاني (للمسح الضوئي للوجه والظهر)", type: "checkbox", def: false },
    ],
    async run(ctx) {
      const docs = await Promise.all(ctx.files.map(async (f) => openPdfLib(await readBuffer(f))));
      const lists = docs.map((d) => d.getPageIndices());
      if (ctx.values.reverse && lists[1]) lists[1].reverse();
      const out = await PDFDocument.create();
      const max = Math.max(...lists.map((l) => l.length));
      for (let i = 0; i < max; i++) {
        for (let d = 0; d < docs.length; d++) {
          if (lists[d][i] !== undefined) await copyInto(out, docs[d], [lists[d][i]]);
        }
      }
      return save(out, "alternate-mixed.pdf");
    },
  },

  organize: {
    input: "pdf",
    ui: "organize",
    action: "حفظ الترتيب الجديد",
    fields: [],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      if (!ctx.pageItems.length) throw new Error("يجب أن يبقى صفحة واحدة على الأقل");
      const out = await PDFDocument.create();
      const pages = await out.copyPages(doc, ctx.pageItems.map((p) => p.src));
      pages.forEach((p, i) => {
        const cur = p.getRotation().angle;
        p.setRotation(degrees((cur + ctx.pageItems[i].rot + 360) % 360));
        out.addPage(p);
      });
      return save(out, `${name}-organized.pdf`);
    },
  },

  extract: {
    input: "pdf",
    ui: "select",
    selectHint: "اضغط على الصفحات التي تريد استخراجها",
    action: "استخراج الصفحات المحددة",
    fields: [
      { key: "ranges", label: "أو اكتب أرقام الصفحات (اختياري)", type: "text", def: "", placeholder: "مثال: 1-3, 5, 8-" },
    ],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      const idx = pagesFromSelection(ctx, doc.getPageCount()).map((n) => n - 1);
      if (!idx.length) throw new Error("اختر صفحة واحدة على الأقل");
      const out = await PDFDocument.create();
      await copyInto(out, doc, idx);
      return save(out, `${name}-extracted.pdf`);
    },
  },

  delete: {
    input: "pdf",
    ui: "select",
    selectHint: "اضغط على الصفحات التي تريد حذفها",
    action: "حذف الصفحات المحددة",
    fields: [
      { key: "ranges", label: "أو اكتب أرقام الصفحات المراد حذفها (اختياري)", type: "text", def: "", placeholder: "مثال: 2, 4-6" },
    ],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      const total = doc.getPageCount();
      const del = new Set(pagesFromSelection(ctx, total));
      if (!del.size) throw new Error("اختر صفحة واحدة على الأقل للحذف");
      const keep = doc.getPageIndices().filter((i) => !del.has(i + 1));
      if (!keep.length) throw new Error("لا يمكن حذف كل الصفحات");
      const out = await PDFDocument.create();
      await copyInto(out, doc, keep);
      return save(out, `${name}-edited.pdf`);
    },
  },

  "split-pages": {
    input: "pdf",
    action: "تقسيم الملف",
    fields: [{ key: "n", label: "عدد الصفحات في كل جزء", type: "number", def: 1, min: 1 }],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      const n = Math.max(1, Math.floor(+ctx.values.n || 1));
      const total = doc.getPageCount();
      const res: OutFile[] = [];
      let part = 1;
      for (let i = 0; i < total; i += n) {
        const out = await PDFDocument.create();
        const idx = Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k);
        await copyInto(out, doc, idx);
        res.push(...(await save(out, `${name}-part${part++}.pdf`)));
        ctx.progress(Math.min(1, (i + n) / total));
      }
      return res;
    },
  },

  "split-ranges": {
    input: "pdf",
    action: "تقسيم الملف",
    fields: [
      { key: "ranges", label: "النطاقات (افصل بينها بفاصلة)", type: "text", def: "", placeholder: "مثال: 1-3, 4-7, 8-", hint: "كل نطاق سيصبح ملف PDF مستقل" },
    ],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      const total = doc.getPageCount();
      const parts = String(ctx.values.ranges).replace(/،/g, ",").split(",").map((s) => s.trim()).filter(Boolean);
      if (!parts.length) throw new Error("اكتب النطاقات أولًا، مثال: 1-3, 4-7");
      const res: OutFile[] = [];
      for (let i = 0; i < parts.length; i++) {
        const idx = parseRanges(parts[i], total).map((n) => n - 1);
        const out = await PDFDocument.create();
        await copyInto(out, doc, idx);
        res.push(...(await save(out, `${name}-${parts[i].replace(/\s/g, "")}.pdf`)));
      }
      return res;
    },
  },

  "split-half": {
    input: "pdf",
    action: "تقسيم من المنتصف",
    fields: [
      {
        key: "mode", label: "طريقة التقسيم", type: "select", def: "doc",
        options: [
          { value: "doc", label: "تقسيم الملف إلى نصفين (النصف الأول / النصف الثاني)" },
          { value: "v", label: "قص كل صفحة إلى نصفين يمين / يسار" },
          { value: "h", label: "قص كل صفحة إلى نصفين أعلى / أسفل" },
        ],
      },
    ],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      const total = doc.getPageCount();
      const mode = ctx.values.mode;
      if (mode === "doc") {
        const half = Math.ceil(total / 2);
        if (total < 2) throw new Error("الملف يحتوي صفحة واحدة فقط");
        const a = await PDFDocument.create();
        const b = await PDFDocument.create();
        await copyInto(a, doc, Array.from({ length: half }, (_, i) => i));
        await copyInto(b, doc, Array.from({ length: total - half }, (_, i) => half + i));
        return [...(await save(a, `${name}-part1.pdf`)), ...(await save(b, `${name}-part2.pdf`))];
      }
      const out = await PDFDocument.create();
      for (let i = 0; i < total; i++) {
        const [p1, p2] = await out.copyPages(doc, [i, i]);
        const { width: w, height: h } = doc.getPage(i).getSize();
        if (mode === "v") {
          p1.setMediaBox(0, 0, w / 2, h); p1.setCropBox(0, 0, w / 2, h);
          p2.setMediaBox(w / 2, 0, w / 2, h); p2.setCropBox(w / 2, 0, w / 2, h);
        } else {
          p1.setMediaBox(0, h / 2, w, h / 2); p1.setCropBox(0, h / 2, w, h / 2);
          p2.setMediaBox(0, 0, w, h / 2); p2.setCropBox(0, 0, w, h / 2);
        }
        out.addPage(p1);
        out.addPage(p2);
      }
      return save(out, `${name}-split.pdf`);
    },
  },

  flatten: {
    input: "pdf",
    action: "تسطيح الملف",
    fields: [],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      try {
        doc.getForm().flatten();
      } catch {
        /* لا توجد حقول */
      }
      return save(doc, `${name}-flattened.pdf`);
    },
  },

  compress: {
    input: "pdf",
    action: "ضغط الملف",
    fields: [
      {
        key: "level", label: "مستوى الضغط", type: "select", def: "medium",
        options: [
          { value: "light", label: "خفيف - يحافظ على النصوص والجودة (ضغط بسيط)" },
          { value: "medium", label: "متوسط - تحويل الصفحات لصور بجودة جيدة" },
          { value: "strong", label: "قوي - أصغر حجم ممكن (جودة أقل)" },
        ],
        hint: "المستوى المتوسط والقوي يحوّلان الصفحات إلى صور، لذا لن يمكن تحديد النص بعد الضغط.",
      },
    ],
    async run(ctx) {
      const file = ctx.files[0];
      const buf = await readBuffer(file);
      const level = ctx.values.level;
      let bytes: Uint8Array;
      if (level === "light") {
        const doc = await openPdfLib(buf);
        doc.setProducer("PDF Pro");
        bytes = await doc.save({ useObjectStreams: true });
      } else {
        bytes = await rasterizePdf(buf, {
          scale: level === "medium" ? 1.5 : 1.0,
          quality: level === "medium" ? 0.7 : 0.45,
          onProgress: ctx.progress,
        });
      }
      const name = `${baseName(file.name)}-compressed.pdf`;
      if (bytes.length >= file.size) {
        return [{ name: `${baseName(file.name)}.pdf`, blob: file, note: "الملف مضغوط بالفعل ولم يمكن تصغيره أكثر، تم إرجاع الملف الأصلي." }];
      }
      return [{ name, blob: pdfBlob(bytes) }];
    },
  },

  pdf2jpg: {
    input: "pdf",
    action: "تحويل إلى صور",
    fields: [
      {
        key: "format", label: "صيغة الصورة", type: "select", def: "jpg",
        options: [{ value: "jpg", label: "JPG" }, { value: "png", label: "PNG" }],
      },
      {
        key: "scale", label: "الدقة", type: "select", def: "2",
        options: [
          { value: "1", label: "عادية (72 DPI)" },
          { value: "2", label: "عالية (144 DPI)" },
          { value: "3", label: "عالية جدًا (216 DPI)" },
        ],
      },
    ],
    async run(ctx) {
      const buf = await readBuffer(ctx.files[0]);
      const name = baseName(ctx.files[0].name);
      const pdf = await openPdfjs(buf);
      const res: OutFile[] = [];
      const png = ctx.values.format === "png";
      for (let i = 1; i <= pdf.numPages; i++) {
        const c = await renderPage(pdf, i, +ctx.values.scale);
        const blob = await canvasToBlob(c, png ? "image/png" : "image/jpeg", 0.92);
        res.push({ name: `${name}-page${i}.${png ? "png" : "jpg"}`, blob });
        c.width = 0;
        ctx.progress(i / pdf.numPages);
      }
      return res;
    },
  },

  pdf2text: {
    input: "pdf",
    action: "استخراج النص",
    fields: [{ key: "sep", label: "إضافة فاصل بين الصفحات", type: "checkbox", def: true }],
    async run(ctx) {
      const pages = await extractText(await readBuffer(ctx.files[0]), ctx.progress);
      const text = pages
        .map((t, i) => (ctx.values.sep ? `--- صفحة ${i + 1} ---\n${t}` : t))
        .join("\n\n");
      if (!text.replace(/[-\s\d صفحة]/g, "").length)
        throw new Error("لم يتم العثور على نص. قد يكون الملف عبارة عن صور ممسوحة ضوئيًا.");
      return [{ name: `${baseName(ctx.files[0].name)}.txt`, blob: new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" }) }];
    },
  },

  pdf2word: {
    input: "pdf",
    action: "تحويل إلى Word",
    fields: [],
    async run(ctx) {
      const pages = await extractText(await readBuffer(ctx.files[0]), ctx.progress);
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const all = pages.join("");
      if (!all.trim()) throw new Error("لم يتم العثور على نص. قد يكون الملف عبارة عن صور ممسوحة ضوئيًا.");
      const rtl = /[\u0590-\u08FF]/.test(all);
      const body = pages
        .map(
          (t, i) =>
            t.split("\n").map((l) => `<p style="margin:0 0 6pt">${esc(l) || "&nbsp;"}</p>`).join("") +
            (i < pages.length - 1 ? '<br clear="all" style="page-break-before:always" />' : "")
        )
        .join("");
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(baseName(ctx.files[0].name))}</title><style>body{font-family:Arial,sans-serif;font-size:12pt}</style></head><body dir="${rtl ? "rtl" : "ltr"}">${body}</body></html>`;
      return [{ name: `${baseName(ctx.files[0].name)}.doc`, blob: new Blob(["\ufeff" + html], { type: "application/msword" }) }];
    },
  },

  jpg2pdf: {
    input: "images",
    action: "إنشاء PDF",
    fields: [
      {
        key: "size", label: "حجم الصفحة", type: "select", def: "fit",
        options: [
          { value: "fit", label: "نفس حجم الصورة" },
          { value: "a4", label: "A4 (عمودي)" },
          { value: "a4l", label: "A4 (أفقي)" },
          { value: "letter", label: "Letter" },
        ],
      },
      { key: "margin", label: "الهامش (مم)", type: "number", def: 0, min: 0, max: 50, showIf: (v) => v.size !== "fit" },
    ],
    async run(ctx) {
      const out = await PDFDocument.create();
      for (let i = 0; i < ctx.files.length; i++) {
        const { bytes, type } = await fileToImageBitmapData(ctx.files[i]);
        const img = type === "png" ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const s = ctx.values.size;
        if (s === "fit") {
          const p = out.addPage([img.width, img.height]);
          p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          const [W, H] = s === "a4l" ? [SIZES.a4[1], SIZES.a4[0]] : SIZES[s];
          const m = (+ctx.values.margin || 0) * MM;
          const k = Math.min((W - 2 * m) / img.width, (H - 2 * m) / img.height, 10);
          const w = img.width * k, h = img.height * k;
          const p = out.addPage([W, H]);
          p.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
        }
        ctx.progress((i + 1) / ctx.files.length);
      }
      return save(out, "images.pdf");
    },
  },

  crop: {
    input: "pdf",
    action: "اقتصاص الصفحات",
    fields: [
      { key: "top", label: "قص من الأعلى (مم)", type: "number", def: 10, min: 0 },
      { key: "bottom", label: "قص من الأسفل (مم)", type: "number", def: 10, min: 0 },
      { key: "left", label: "قص من اليسار (مم)", type: "number", def: 10, min: 0 },
      { key: "right", label: "قص من اليمين (مم)", type: "number", def: 10, min: 0 },
    ],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      const v = ctx.values;
      for (const p of doc.getPages()) {
        const { x, y, width, height } = p.getMediaBox();
        const l = +v.left * MM, r = +v.right * MM, t = +v.top * MM, b = +v.bottom * MM;
        const w = width - l - r, h = height - t - b;
        if (w < 20 || h < 20) throw new Error("قيم القص كبيرة جدًا");
        p.setCropBox(x + l, y + b, w, h);
        p.setMediaBox(x + l, y + b, w, h);
      }
      return save(doc, `${name}-cropped.pdf`);
    },
  },

  metadata: {
    input: "pdf",
    action: "حفظ البيانات",
    fields: [
      { key: "title", label: "العنوان", type: "text", def: "" },
      { key: "author", label: "المؤلف", type: "text", def: "" },
      { key: "subject", label: "الموضوع", type: "text", def: "" },
      { key: "keywords", label: "الكلمات المفتاحية (افصل بينها بفاصلة)", type: "text", def: "" },
      { key: "creator", label: "المنشئ", type: "text", def: "" },
    ],
    async prefill(file) {
      const d = await openPdfLib(await readBuffer(file));
      return {
        title: d.getTitle() || "", author: d.getAuthor() || "", subject: d.getSubject() || "",
        keywords: d.getKeywords() || "", creator: d.getCreator() || "",
      };
    },
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      const v = ctx.values;
      doc.setTitle(v.title || "");
      doc.setAuthor(v.author || "");
      doc.setSubject(v.subject || "");
      doc.setKeywords(v.keywords ? String(v.keywords).split(",").map((s: string) => s.trim()) : []);
      doc.setCreator(v.creator || "");
      return save(doc, `${name}.pdf`);
    },
  },

  flip: {
    input: "pdf",
    action: "قلب الصفحات",
    fields: [
      {
        key: "dir", label: "اتجاه القلب", type: "select", def: "h",
        options: [{ value: "h", label: "أفقي (مرآة يمين/يسار)" }, { value: "v", label: "رأسي (أعلى/أسفل)" }],
      },
    ],
    async run(ctx) {
      const buf = await readBuffer(ctx.files[0]);
      const src = await openPdfLib(buf);
      const out = await PDFDocument.create();
      const emb = await out.embedPdf(src, src.getPageIndices());
      emb.forEach((e, i) => {
        const p = out.addPage([e.width, e.height]);
        if (ctx.values.dir === "h") p.drawPage(e, { x: e.width, y: 0, xScale: -1, yScale: 1 });
        else p.drawPage(e, { x: 0, y: e.height, xScale: 1, yScale: -1 });
        ctx.progress((i + 1) / emb.length);
      });
      return save(out, `${baseName(ctx.files[0].name)}-flipped.pdf`);
    },
  },

  grayscale: {
    input: "pdf",
    action: "تحويل إلى أبيض وأسود",
    fields: [
      {
        key: "q", label: "الجودة", type: "select", def: "good",
        options: [{ value: "fast", label: "عادية (ملف أصغر)" }, { value: "good", label: "جيدة" }, { value: "high", label: "عالية (ملف أكبر)" }],
      },
    ],
    async run(ctx) {
      const q = ctx.values.q;
      const bytes = await rasterizePdf(await readBuffer(ctx.files[0]), {
        gray: true,
        scale: q === "fast" ? 1.2 : q === "good" ? 1.8 : 2.5,
        quality: q === "fast" ? 0.7 : 0.85,
        onProgress: ctx.progress,
      });
      return [{ name: `${baseName(ctx.files[0].name)}-gray.pdf`, blob: pdfBlob(bytes), note: "تم تحويل الصفحات إلى صور رمادية." }];
    },
  },

  watermark: {
    input: "pdf",
    action: "إضافة العلامة المائية",
    fields: [
      { key: "text", label: "نص العلامة المائية", type: "text", def: "سري", placeholder: "اكتب النص هنا" },
      { key: "size", label: "حجم الخط", type: "number", def: 64, min: 8, max: 300 },
      { key: "color", label: "اللون", type: "color", def: "#ff0000" },
      { key: "opacity", label: "الشفافية (%)", type: "number", def: 25, min: 5, max: 100 },
      { key: "angle", label: "زاوية الدوران", type: "number", def: 45, min: -180, max: 180 },
      { key: "tile", label: "تكرار العلامة على كامل الصفحة", type: "checkbox", def: false },
    ],
    async run(ctx) {
      const v = ctx.values;
      if (!String(v.text).trim()) throw new Error("اكتب نص العلامة المائية");
      const { doc, name } = await loadFirst(ctx);
      const s = await stampImage(doc, v.text, +v.size, v.color, true);
      const th = ((+v.angle || 0) * Math.PI) / 180;
      const draw = (p: PDFPage, cx: number, cy: number) => {
        const x = cx - ((s.w / 2) * Math.cos(th) - (s.h / 2) * Math.sin(th));
        const y = cy - ((s.w / 2) * Math.sin(th) + (s.h / 2) * Math.cos(th));
        p.drawImage(s.img, { x, y, width: s.w, height: s.h, rotate: degrees(+v.angle || 0), opacity: (+v.opacity || 25) / 100 });
      };
      for (const p of doc.getPages()) {
        const { width: W, height: H } = p.getSize();
        if (v.tile) {
          const gx = s.w + 60, gy = s.h + 90;
          for (let y = gy / 2; y < H + gy; y += gy)
            for (let x = gx / 2; x < W + gx; x += gx) draw(p, x, y);
        } else draw(p, W / 2, H / 2);
      }
      return save(doc, `${name}-watermarked.pdf`);
    },
  },

  headfooter: {
    input: "pdf",
    action: "إضافة الرأس والتذييل",
    fields: [
      { key: "header", label: "نص الرأس (أعلى الصفحة)", type: "text", def: "", placeholder: "اتركه فارغًا لتجاهله" },
      { key: "footer", label: "نص التذييل (أسفل الصفحة)", type: "text", def: "", placeholder: "استخدم {n} لرقم الصفحة و {total} للعدد الكلي" },
      { key: "align", label: "المحاذاة", type: "select", def: "c", options: [{ value: "c", label: "المنتصف" }, { value: "r", label: "اليمين" }, { value: "l", label: "اليسار" }] },
      { key: "size", label: "حجم الخط", type: "number", def: 11, min: 6, max: 48 },
      { key: "color", label: "اللون", type: "color", def: "#333333" },
      { key: "margin", label: "المسافة من الحافة (مم)", type: "number", def: 10, min: 2, max: 50 },
    ],
    async run(ctx) {
      const v = ctx.values;
      if (!String(v.header).trim() && !String(v.footer).trim()) throw new Error("اكتب نص الرأس أو التذييل");
      const { doc, name } = await loadFirst(ctx);
      const total = doc.getPageCount();
      const m = +v.margin * MM;
      for (let i = 0; i < total; i++) {
        const p = doc.getPage(i);
        const { width: W, height: H } = p.getSize();
        for (const kind of ["header", "footer"] as const) {
          const raw = String(v[kind]).trim();
          if (!raw) continue;
          const txt = raw.replace(/\{n\}/g, String(i + 1)).replace(/\{total\}/g, String(total));
          const s = await stampImage(doc, txt, +v.size, v.color);
          const x = placeX("b" + v.align, W, s.w, m);
          const y = kind === "header" ? H - m - s.h : m;
          p.drawImage(s.img, { x, y, width: s.w, height: s.h });
        }
        ctx.progress((i + 1) / total);
      }
      return save(doc, `${name}-hf.pdf`);
    },
  },

  pagenumbers: {
    input: "pdf",
    action: "إضافة أرقام الصفحات",
    fields: [
      { key: "pos", label: "الموضع", type: "select", def: "bc", options: posOptions },
      {
        key: "fmt", label: "الصيغة", type: "select", def: "n",
        options: [
          { value: "n", label: "1" },
          { value: "of", label: "1 / 10" },
          { value: "page", label: "صفحة 1" },
          { value: "pageof", label: "صفحة 1 من 10" },
        ],
      },
      { key: "start", label: "ابدأ الترقيم من", type: "number", def: 1, min: 0 },
      { key: "from", label: "ابدأ الإضافة من الصفحة", type: "number", def: 1, min: 1 },
      { key: "size", label: "حجم الخط", type: "number", def: 12, min: 6, max: 48 },
      { key: "color", label: "اللون", type: "color", def: "#000000" },
      { key: "arabic", label: "استخدام الأرقام العربية (١ ٢ ٣)", type: "checkbox", def: false },
    ],
    async run(ctx) {
      const v = ctx.values;
      const { doc, name } = await loadFirst(ctx);
      const total = doc.getPageCount();
      const from = Math.max(1, +v.from || 1);
      const m = 28;
      for (let i = from - 1; i < total; i++) {
        const num = (+v.start || 1) + (i - (from - 1));
        const last = (+v.start || 1) + (total - from);
        const ar = !!v.arabic;
        const n = toDigits(String(num), ar), t = toDigits(String(last), ar);
        const txt = v.fmt === "n" ? n : v.fmt === "of" ? `${n} / ${t}` : v.fmt === "page" ? `صفحة ${n}` : `صفحة ${n} من ${t}`;
        const p = doc.getPage(i);
        const { width: W, height: H } = p.getSize();
        const s = await stampImage(doc, txt, +v.size, v.color);
        const y = v.pos.startsWith("t") ? H - m - s.h + 6 : m - 6;
        p.drawImage(s.img, { x: placeX(v.pos, W, s.w, m), y, width: s.w, height: s.h });
        ctx.progress((i + 1) / total);
      }
      return save(doc, `${name}-numbered.pdf`);
    },
  },

  nup: {
    input: "pdf",
    action: "إنشاء الملف",
    fields: [
      {
        key: "layout", label: "عدد الصفحات في الورقة", type: "select", def: "2",
        options: [
          { value: "2", label: "2 صفحة (ورقة أفقية)" },
          { value: "4", label: "4 صفحات (2×2)" },
          { value: "6", label: "6 صفحات (3×2 أفقي)" },
          { value: "9", label: "9 صفحات (3×3)" },
        ],
      },
      { key: "border", label: "رسم إطار حول كل صفحة", type: "checkbox", def: true },
    ],
    async run(ctx) {
      const src = await openPdfLib(await readBuffer(ctx.files[0]));
      const out = await PDFDocument.create();
      const emb = await out.embedPdf(src, src.getPageIndices());
      const L: Record<string, [number, number, boolean]> = { "2": [2, 1, true], "4": [2, 2, false], "6": [3, 2, true], "9": [3, 3, false] };
      const [cols, rows, land] = L[ctx.values.layout];
      const [W, H] = land ? [SIZES.a4[1], SIZES.a4[0]] : SIZES.a4;
      const per = cols * rows, gap = 8;
      const cw = (W - gap * (cols + 1)) / cols, ch = (H - gap * (rows + 1)) / rows;
      let page: PDFPage | null = null;
      emb.forEach((e, i) => {
        const k = i % per;
        if (k === 0) page = out.addPage([W, H]);
        const col = k % cols, row = Math.floor(k / cols);
        const s = Math.min(cw / e.width, ch / e.height);
        const w = e.width * s, h = e.height * s;
        const x = gap + col * (cw + gap) + (cw - w) / 2;
        const y = H - gap - (row + 1) * ch - row * gap + (ch - h) / 2;
        page!.drawPage(e, { x, y, width: w, height: h });
        if (ctx.values.border)
          page!.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5 });
        ctx.progress((i + 1) / emb.length);
      });
      return save(out, `${baseName(ctx.files[0].name)}-nup.pdf`);
    },
  },

  rename: {
    input: "pdf",
    action: "تجهيز الملف",
    fields: [{ key: "name", label: "الاسم الجديد (بدون الامتداد)", type: "text", def: "", placeholder: "اسم الملف الجديد" }],
    async prefill(file) {
      return { name: baseName(file.name) };
    },
    async run(ctx) {
      const n = String(ctx.values.name).trim().replace(/[\\/:*?"<>|]/g, "");
      if (!n) throw new Error("اكتب الاسم الجديد");
      return [{ name: `${n}.pdf`, blob: ctx.files[0] }];
    },
  },

  resize: {
    input: "pdf",
    action: "تغيير الحجم",
    fields: [
      {
        key: "size", label: "الحجم الجديد", type: "select", def: "a4",
        options: [
          { value: "a4", label: "A4" }, { value: "a3", label: "A3" }, { value: "a5", label: "A5" },
          { value: "letter", label: "Letter" }, { value: "legal", label: "Legal" }, { value: "custom", label: "مخصص" },
        ],
      },
      { key: "w", label: "العرض (مم)", type: "number", def: 210, min: 20, showIf: (v) => v.size === "custom" },
      { key: "h", label: "الارتفاع (مم)", type: "number", def: 297, min: 20, showIf: (v) => v.size === "custom" },
      { key: "keep", label: "الحفاظ على اتجاه الصفحة الأصلي (أفقي/عمودي)", type: "checkbox", def: true },
    ],
    async run(ctx) {
      const v = ctx.values;
      const src = await openPdfLib(await readBuffer(ctx.files[0]));
      const out = await PDFDocument.create();
      const emb = await out.embedPdf(src, src.getPageIndices());
      let [W, H] = v.size === "custom" ? [+v.w * MM, +v.h * MM] : SIZES[v.size];
      emb.forEach((e, i) => {
        let pw = W, ph = H;
        if (v.keep && e.width > e.height !== W > H) [pw, ph] = [H, W];
        const s = Math.min(pw / e.width, ph / e.height);
        const w = e.width * s, h = e.height * s;
        const p = out.addPage([pw, ph]);
        p.drawPage(e, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        ctx.progress((i + 1) / emb.length);
      });
      return save(out, `${baseName(ctx.files[0].name)}-resized.pdf`);
    },
  },

  rotate: {
    input: "pdf",
    action: "تدوير الصفحات",
    fields: [
      {
        key: "angle", label: "الزاوية", type: "select", def: "90",
        options: [
          { value: "90", label: "90° مع عقارب الساعة" },
          { value: "180", label: "180°" },
          { value: "270", label: "90° عكس عقارب الساعة" },
        ],
      },
      { key: "ranges", label: "الصفحات المراد تدويرها (اتركه فارغًا لكل الصفحات)", type: "text", def: "", placeholder: "مثال: 1-3, 5" },
    ],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      const total = doc.getPageCount();
      const r = String(ctx.values.ranges).trim();
      const set = new Set(r ? parseRanges(r, total) : doc.getPageIndices().map((i) => i + 1));
      doc.getPages().forEach((p, i) => {
        if (set.has(i + 1)) p.setRotation(degrees((p.getRotation().angle + +ctx.values.angle) % 360));
      });
      return save(doc, `${name}-rotated.pdf`);
    },
  },

  removeannots: {
    input: "pdf",
    action: "إزالة التعليقات",
    fields: [],
    async run(ctx) {
      const { doc, name } = await loadFirst(ctx);
      for (const p of doc.getPages()) p.node.delete(PDFName.of("Annots"));
      return save(doc, `${name}-clean.pdf`);
    },
  },
};

export { hexToRgb01 };

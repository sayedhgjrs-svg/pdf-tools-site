import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = pdfjs.PDFDocumentProxy;

export interface OutFile {
  name: string;
  blob: Blob;
  note?: string;
}

export async function readBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

export async function openPdfjs(data: ArrayBuffer): Promise<PdfDoc> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
  return await task.promise;
}

export async function openPdfLib(data: ArrayBuffer): Promise<PDFDocument> {
  return await PDFDocument.load(data, { ignoreEncryption: true });
}

export async function renderPage(
  pdf: PdfDoc,
  pageNum: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.85
): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("فشل إنشاء الصورة"))), type, quality)
  );
}

export async function canvasToBytes(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.85
): Promise<Uint8Array> {
  const b = await canvasToBlob(canvas, type, quality);
  return new Uint8Array(await b.arrayBuffer());
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadZip(files: OutFile[], zipName = "files.zip") {
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName);
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/** يحوّل نصًا مثل "1-3, 5, 8-" إلى قائمة صفحات (تبدأ من 1) */
export function parseRanges(input: string, total: number): number[] {
  const out: number[] = [];
  const parts = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/،/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) throw new Error("اكتب أرقام الصفحات، مثال: 1-3, 5, 8-");
  for (const p of parts) {
    const m = p.match(/^(\d*)\s*-\s*(\d*)$/);
    if (m) {
      const a = m[1] ? parseInt(m[1]) : 1;
      const b = m[2] ? parseInt(m[2]) : total;
      if (a < 1 || b > total || a > b) throw new Error(`النطاق "${p}" غير صالح (عدد الصفحات ${total})`);
      for (let i = a; i <= b; i++) out.push(i);
    } else if (/^\d+$/.test(p)) {
      const n = parseInt(p);
      if (n < 1 || n > total) throw new Error(`الصفحة ${n} غير موجودة (عدد الصفحات ${total})`);
      out.push(n);
    } else {
      throw new Error(`قيمة غير صالحة: "${p}"`);
    }
  }
  return out;
}

export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export interface TextImage {
  bytes: Uint8Array;
  width: number; // بوحدة النقطة (pt)
  height: number;
}

/** يرسم النص كصورة PNG شفافة - يدعم العربية وكل اللغات */
export async function textToPng(
  text: string,
  size: number,
  color = "#000000",
  bold = false
): Promise<TextImage> {
  try {
    await document.fonts.load(`${bold ? 700 : 500} ${size}px Cairo`, text);
  } catch {
    /* ignore */
  }
  const scale = 3;
  const font = `${bold ? 700 : 500} ${size * scale}px Cairo, Arial, sans-serif`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const rtl = /[\u0590-\u08FF]/.test(text);
  const w = Math.ceil(measure.measureText(text).width) + 8 * scale;
  const h = Math.ceil(size * scale * 1.7);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(w, 2);
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, h / 2 + size * 0.05 * scale);
  const bytes = await canvasToBytes(canvas, "image/png");
  return { bytes, width: canvas.width / scale, height: h / scale };
}

/** يحوّل كل صفحات الـ PDF إلى صور ثم يعيد بناء ملف جديد */
export async function rasterizePdf(
  data: ArrayBuffer,
  opts: {
    scale: number;
    quality: number;
    gray?: boolean;
    flipH?: boolean;
    flipV?: boolean;
    onProgress?: (p: number) => void;
  }
): Promise<Uint8Array> {
  const pdf = await openPdfjs(data);
  const out = await PDFDocument.create();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    let canvas = await renderPage(pdf, i, opts.scale);
    if (opts.gray || opts.flipH || opts.flipV) {
      const c2 = document.createElement("canvas");
      c2.width = canvas.width;
      c2.height = canvas.height;
      const ctx = c2.getContext("2d")!;
      if (opts.gray) ctx.filter = "grayscale(1)";
      ctx.translate(opts.flipH ? c2.width : 0, opts.flipV ? c2.height : 0);
      ctx.scale(opts.flipH ? -1 : 1, opts.flipV ? -1 : 1);
      ctx.drawImage(canvas, 0, 0);
      canvas = c2;
    }
    const bytes = await canvasToBytes(canvas, "image/jpeg", opts.quality);
    const img = await out.embedJpg(bytes);
    const p = out.addPage([base.width, base.height]);
    p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    opts.onProgress?.(i / pdf.numPages);
    canvas.width = 0;
  }
  return await out.save({ useObjectStreams: true });
}

export async function fileToImageBitmapData(file: File): Promise<{ bytes: Uint8Array; type: "png" | "jpg" }> {
  if (file.type === "image/png" || file.type === "image/jpeg") {
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      type: file.type === "image/png" ? "png" : "jpg",
    };
  }
  // تحويل أي صيغة أخرى (webp, gif, bmp...) إلى PNG عبر canvas
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("تعذّر قراءة الصورة " + file.name));
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return { bytes: await canvasToBytes(c, "image/png"), type: "png" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

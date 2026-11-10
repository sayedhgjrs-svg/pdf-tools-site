import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, X, FileText } from "lucide-react";
import { formatSize } from "../lib/pdf";
import { useThumbs } from "./useThumbs";

function PdfThumb({ file }: { file: File }) {
  const { thumbs, error } = useThumbs(file, 1, 200);
  const src = thumbs[0];
  if (src) return <img src={src} alt="" className="h-full w-full object-contain" />;
  return (
    <div className="flex h-full w-full items-center justify-center text-slate-300">
      <FileText size={error ? 28 : 36} className={error ? "text-red-300" : "animate-pulse"} />
    </div>
  );
}

function ImgThumb({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return <img src={url} alt="" className="h-full w-full object-contain" />;
}

interface Props {
  file: File;
  index: number;
  total: number;
  image?: boolean;
  onMove?: (dir: -1 | 1) => void;
  onRemove: () => void;
}

export default function FileCard({ file, index, total, image, onMove, onRemove }: Props) {
  return (
    <div className="group relative w-40 shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:shadow-md">
      <button
        onClick={onRemove}
        className="absolute -top-2 -left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
        title="إزالة"
      >
        <X size={14} />
      </button>
      <div className="h-40 overflow-hidden rounded-lg bg-slate-100">
        {image ? <ImgThumb file={file} /> : <PdfThumb file={file} />}
      </div>
      <div className="mt-2 truncate text-xs font-semibold text-slate-700" title={file.name}>
        {file.name}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{formatSize(file.size)}</span>
        {onMove && total > 1 && (
          <span className="flex gap-1">
            <button
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
              title="تأخير"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              disabled={index === 0}
              onClick={() => onMove(-1)}
              className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
              title="تقديم"
            >
              <ArrowRight size={14} />
            </button>
          </span>
        )}
      </div>
      <div className="absolute top-3 right-3 rounded bg-slate-800/70 px-1.5 text-[10px] text-white">{index + 1}</div>
    </div>
  );
}

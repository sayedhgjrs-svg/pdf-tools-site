import {
  Shuffle, Merge, LayoutGrid, FileOutput, Files, Columns2, Scissors, Pencil, PenTool, Trash2,
  Minimize2, Droplets, Layers, Image, ImageDown, AlignLeft, FileText, Crop, Info, FlipHorizontal,
  Contrast, PanelTop, Grid2x2, Hash, TextCursorInput, Maximize, RotateCw, Eraser, Lock, LockOpen,
  ScanText, FileSpreadsheet, FileCode, FileType, type LucideIcon,
} from "lucide-react";

export type CategoryId = "merge" | "split" | "edit" | "compress" | "from" | "to" | "other" | "security" | "scans";

export interface Category {
  id: CategoryId;
  title: string;
  text: string; // لون النص
  bg: string; // لون الخلفية الفاتح
  dot: string; // لون صلب
}

export const categories: Category[] = [
  { id: "merge", title: "دمج", text: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  { id: "split", title: "تقسيم", text: "text-lime-600", bg: "bg-lime-50", dot: "bg-lime-500" },
  { id: "edit", title: "تعديل وتوقيع", text: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
  { id: "compress", title: "ضغط", text: "text-teal-600", bg: "bg-teal-50", dot: "bg-teal-500" },
  { id: "from", title: "تحويل من PDF", text: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-500" },
  { id: "to", title: "تحويل إلى PDF", text: "text-violet-600", bg: "bg-violet-50", dot: "bg-violet-500" },
  { id: "other", title: "أدوات أخرى", text: "text-pink-600", bg: "bg-pink-50", dot: "bg-pink-500" },
  { id: "security", title: "الحماية", text: "text-cyan-600", bg: "bg-cyan-50", dot: "bg-cyan-500" },
  { id: "scans", title: "المسح الضوئي", text: "text-rose-600", bg: "bg-rose-50", dot: "bg-rose-500" },
];

export const catById = (id: CategoryId) => categories.find((c) => c.id === id)!;

export interface Tool {
  id: string;
  title: string;
  desc: string;
  cat: CategoryId;
  icon: LucideIcon;
  soon?: boolean;
  isNew?: boolean;
  popular?: boolean;
}

export const tools: Tool[] = [
  // دمج
  { id: "merge", title: "دمج ملفات PDF", desc: "ادمج عدة ملفات PDF في ملف واحد بالترتيب الذي تريده.", cat: "merge", icon: Merge, popular: true },
  { id: "alternate", title: "دمج بالتبادل", desc: "اخلط صفحات ملفين بالتبادل (مفيد لدمج الوجه والظهر عند المسح).", cat: "merge", icon: Shuffle },
  { id: "organize", title: "تنظيم الصفحات", desc: "أعد ترتيب الصفحات، دوّرها أو احذفها بالسحب والنقر.", cat: "merge", icon: LayoutGrid, popular: true },

  // تقسيم
  { id: "extract", title: "استخراج صفحات", desc: "اختر صفحات معينة واحفظها في ملف PDF جديد.", cat: "split", icon: FileOutput, popular: true },
  { id: "split-pages", title: "تقسيم كل عدد من الصفحات", desc: "قسّم الملف إلى أجزاء، كل جزء يحتوي عددًا ثابتًا من الصفحات.", cat: "split", icon: Files },
  { id: "split-ranges", title: "تقسيم حسب النطاقات", desc: "اكتب نطاقات مثل 1-3, 4-7 وسيصبح كل نطاق ملفًا مستقلًا.", cat: "split", icon: Scissors },
  { id: "split-half", title: "تقسيم من المنتصف", desc: "قسّم الملف إلى نصفين، أو قسّم كل صفحة إلى نصفين.", cat: "split", icon: Columns2 },

  // تعديل وتوقيع
  { id: "edit", title: "تعديل PDF", desc: "أضف نصوصًا وصورًا وتوقيعًا على صفحات الملف مباشرة.", cat: "edit", icon: Pencil, popular: true },
  { id: "sign", title: "تعبئة وتوقيع", desc: "ارسم توقيعك أو اكتب نصًا وضعه في أي مكان على المستند.", cat: "edit", icon: PenTool, popular: true },
  { id: "delete", title: "حذف صفحات", desc: "اختر الصفحات غير المرغوبة واحذفها من الملف.", cat: "edit", icon: Trash2, popular: true },
  { id: "flatten", title: "تسطيح الملف", desc: "ادمج حقول النماذج في الصفحة لتصبح غير قابلة للتعديل.", cat: "edit", icon: Layers },

  // ضغط
  { id: "compress", title: "ضغط PDF", desc: "قلّل حجم الملف لإرساله أو رفعه بسهولة.", cat: "compress", icon: Minimize2, popular: true },

  // من PDF
  { id: "pdf2jpg", title: "PDF إلى صور", desc: "حوّل كل صفحة إلى صورة JPG أو PNG عالية الجودة.", cat: "from", icon: ImageDown, popular: true },
  { id: "pdf2text", title: "PDF إلى نص", desc: "استخرج كل النصوص من الملف في ملف TXT.", cat: "from", icon: AlignLeft },
  { id: "pdf2word", title: "PDF إلى Word", desc: "استخرج المحتوى النصي إلى مستند Word قابل للتعديل.", cat: "from", icon: FileText },
  { id: "pdf2excel", title: "PDF إلى Excel", desc: "تحويل الجداول إلى Excel.", cat: "from", icon: FileSpreadsheet, soon: true },

  // إلى PDF
  { id: "jpg2pdf", title: "صور إلى PDF", desc: "حوّل صور JPG وPNG وغيرها إلى ملف PDF واحد.", cat: "to", icon: Image, popular: true },
  { id: "html2pdf", title: "HTML إلى PDF", desc: "حوّل صفحات الويب إلى PDF.", cat: "to", icon: FileCode, soon: true },
  { id: "word2pdf", title: "Word إلى PDF", desc: "حوّل مستندات Word إلى PDF.", cat: "to", icon: FileType, soon: true },

  // أخرى
  { id: "crop", title: "اقتصاص الصفحات", desc: "قص الهوامش البيضاء أو أي جزء غير مرغوب من الصفحات.", cat: "other", icon: Crop },
  { id: "metadata", title: "تعديل بيانات الملف", desc: "غيّر العنوان والمؤلف والكلمات المفتاحية للملف.", cat: "other", icon: Info },
  { id: "flip", title: "قلب الصفحات", desc: "اقلب الصفحات أفقيًا أو رأسيًا.", cat: "other", icon: FlipHorizontal, isNew: true },
  { id: "grayscale", title: "تدرج الرمادي", desc: "حوّل الملف إلى أبيض وأسود لتوفير الحبر.", cat: "other", icon: Contrast },
  { id: "watermark", title: "علامة مائية", desc: "أضف نصًا شفافًا (مثل سري أو اسمك) فوق كل الصفحات.", cat: "other", icon: Droplets, popular: true },
  { id: "headfooter", title: "رأس وتذييل الصفحة", desc: "أضف نصًا في أعلى أو أسفل كل صفحة.", cat: "other", icon: PanelTop },
  { id: "nup", title: "عدة صفحات في ورقة", desc: "اطبع 2 أو 4 صفحات في ورقة واحدة (N-up).", cat: "other", icon: Grid2x2 },
  { id: "pagenumbers", title: "ترقيم الصفحات", desc: "أضف أرقام الصفحات بالموضع والتنسيق الذي تريده.", cat: "other", icon: Hash, popular: true },
  { id: "rename", title: "إعادة تسمية", desc: "غيّر اسم الملف قبل تحميله.", cat: "other", icon: TextCursorInput },
  { id: "resize", title: "تغيير حجم الصفحات", desc: "حوّل الصفحات إلى A4 أو Letter أو أي مقاس مخصص.", cat: "other", icon: Maximize },
  { id: "rotate", title: "تدوير الصفحات", desc: "دوّر كل الصفحات أو صفحات محددة بزاوية 90° أو 180° أو 270°.", cat: "other", icon: RotateCw },
  { id: "removeannots", title: "إزالة التعليقات", desc: "احذف التعليقات والروابط والتظليل من الملف.", cat: "other", icon: Eraser, isNew: true },

  // أمان
  { id: "protect", title: "حماية بكلمة مرور", desc: "تشفير الملف بكلمة مرور.", cat: "security", icon: Lock, soon: true },
  { id: "unlock", title: "فك الحماية", desc: "إزالة كلمة المرور من الملف.", cat: "security", icon: LockOpen, soon: true },

  // مسح
  { id: "ocr", title: "التعرف على النص (OCR)", desc: "تحويل المستندات الممسوحة إلى نص قابل للبحث.", cat: "scans", icon: ScanText, soon: true },
];

export const toolById = (id: string) => tools.find((t) => t.id === id);

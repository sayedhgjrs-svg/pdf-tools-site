import type { ReactNode } from "react";

const SITE = "بي دي إف برو";
const EMAIL = "support@earnmoneyhq.com";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 text-right" dir="rtl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b pb-4 border-emerald-200">{title}</h1>
      <div className="space-y-5 text-gray-700 leading-9 text-lg">{children}</div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-emerald-700 mb-3 mt-8">{title}</h2>
      <div className="pr-4 border-r-4 border-emerald-100">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <Page title="سياسة الخصوصية">
      <p>مرحباً بك في <strong>{SITE}</strong>. نحترم خصوصيتك ونلتزم بحماية بياناتك أثناء استخدام أدواتنا.</p>
      <Section title="ملفاتك لا تُرفع لأي مكان">
        <p>جميع عمليات المعالجة تتم داخل متصفحك فقط. لا نرفع ملفات PDF لأي خادم، ولا نحتفظ بها، ولا نطّلع على محتواها أبداً.</p>
      </Section>
      <Section title="البيانات التقنية">
        <p>قد نجمع بيانات مجهولة الهوية (نوع المتصفح، الصفحات المزارة) لتحسين الأداء فقط، ولا ترتبط بهويتك الشخصية.</p>
      </Section>
      <Section title="الإعلانات">
        <p>نستخدم خدمات مثل Google AdSense لعرض إعلانات. يمكنك التحكم في ذلك من إعدادات متصفحك.</p>
      </Section>
      <Section title="التواصل">
        <p>لأي استفسار: <a href={`mailto:${EMAIL}`} className="text-emerald-600 underline font-bold hover:text-emerald-800">{EMAIL}</a></p>
      </Section>
    </Page>
  );
}

export function AboutPage() {
  return (
    <Page title="من نحن">
      <p><strong>{SITE}</strong> موقع عربي مجاني يقدّم أدوات PDF متكاملة تعمل مباشرة داخل المتصفح دون رفع الملفات.</p>
      <Section title="مهمتنا">
        <p>تبسيط التعامل مع ملفات PDF للجميع مجاناً، مع الحفاظ على أعلى معايير الخصوصية.</p>
      </Section>
      <Section title="ما نقدمه">
        <ul className="list-disc pr-6 space-y-2 marker:text-emerald-600">
          <li>دمج وتقسيم وضغط ملفات PDF</li>
          <li>تعديل وتوقيع وحذف الصفحات</li>
          <li>تحويل من وإلى PDF</li>
          <li>كل ذلك بدون تسجيل أو رسوم</li>
        </ul>
      </Section>
    </Page>
  );
}

export function ContactPage() {
  return (
    <Page title="اتصل بنا">
      <p>نرحب بجميع اقتراحاتك واستفساراتك.</p>
      <Section title="البريد الإلكتروني">
        <p><a href={`mailto:${EMAIL}`} className="text-emerald-600 underline text-xl font-bold hover:text-emerald-800">{EMAIL}</a></p>
      </Section>
      <Section title="وقت الرد">
        <p>نرد عادة خلال يومين إلى ثلاثة أيام عمل.</p>
      </Section>
    </Page>
  );
}
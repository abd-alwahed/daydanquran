import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "ما يحفظه دَيْدَن عنك، ولماذا، وكيف تحذفه.",
};

/** Also the privacy policy and data deletion URL for a Meta app. Keep both languages in step. */
const CONTACT_EMAIL = "daydanquran@gmail.com";
const UPDATED = "١٣ أكتوبر ٢٠٢٦";

export default function PrivacyPage() {
  return (
    <section>
      <h1>سياسة الخصوصية</h1>
      <p>آخر تحديث: {UPDATED}</p>
      <p>دَيْدَن مشروع دعوي غير ربحي. لا نبيع أي بيانات، ولا نعرض إعلانات، ولا نستخدم أدوات تتبّع أو تحليلات.</p>

      <h2>الموقع</h2>
      <p>
        لا يحتاج الموقع إلى حساب. ما تسجّله من قراءتك يُحفظ في متصفحك وحده، ولا يُرسل إلينا. التلاوة تُبثّ من خوادم
        Quran.com مباشرة، فيصلها عنوان جهازك كما في أي موقع.
      </p>

      <h2>بوت تيليجرام</h2>
      <p>
        إذا ضغطت «قرأت الورد» في قناة تيليجرام أو ضبطت التذكير عبر البوت، نحفظ: رقم حسابك في تيليجرام، والصفحات التي
        قرأتها وتواريخها، وإعدادات التذكير (المدينة والوقت). نستخدمها فقط لحفظ ختمتك وإرسال التذكير الذي طلبته، وتُخزَّن
        لدى Cloudflare. أرسل ‎/stop‎ للبوت لإيقاف التذكير.
      </p>

      <h2>إنستغرام وفيسبوك</h2>
      <p>
        حسابا دَيْدَن على إنستغرام وفيسبوك للتعريف بالمشروع، وقد ننشر عليهما آلياً عبر واجهات Meta، على حساباتنا نحن فقط.
        لا نطلب منك تسجيل الدخول بفيسبوك أو إنستغرام، ولا نجمع أي بيانات عن من يشاهد منشوراتنا أو يتفاعل معها.
      </p>

      <h2>حذف بياناتك</h2>
      <p>
        راسلنا على <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> من حسابك أو مع اسم مستخدمك في تيليجرام، فنحذف كل
        ما يخصّك خلال ٣٠ يوماً ونؤكد لك ذلك. ولأننا لا نحفظ أي بيانات من فيسبوك أو إنستغرام، فلا شيء منها يحتاج إلى حذف.
      </p>

      <div lang="en" dir="ltr">
        <h2>Privacy policy (English)</h2>
        <p>
          Daydan is a non-profit Quran reading project. We sell no data, show no ads and use no trackers or analytics.
        </p>
        <p>
          <strong>Website:</strong> no account is needed. Your reading progress is stored only in your browser and is never
          sent to us. Recitation audio streams from Quran.com, which receives your IP address as any website would.
        </p>
        <p>
          <strong>Telegram bot:</strong> if you press &ldquo;I read it&rdquo; in our Telegram channel or set a reminder, we store
          your Telegram user id, the pages you read and their dates, and your reminder settings (city and time), on
          Cloudflare. They are used only to keep your progress and send the reminder you asked for. Send /stop to the bot to
          stop reminders.
        </p>
        <p>
          <strong>Instagram and Facebook:</strong> Daydan&rsquo;s Instagram account and Facebook Page introduce the project. We
          may publish to them automatically through Meta&rsquo;s APIs, only to our own accounts. We offer no Facebook or
          Instagram login and collect no data about people who view or interact with our posts.
        </p>
        <p>
          <strong>Data deletion:</strong> email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your Telegram
          username and we will delete everything about you within 30 days and confirm. We hold no Facebook or Instagram user
          data, so there is none to delete.
        </p>
      </div>
    </section>
  );
}

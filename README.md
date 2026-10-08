# دَيْدَن · Daydan

«اجعل القرآن دَيْدَنك»: صفحة من القرآن كل يوم، مع التفسير الميسر والتلاوة.

## البنية

```
apps/
  web/          موقع Next.js (تصدير ثابت) → Cloudflare Pages: daydanquran.pages.dev
  publisher/    Cloudflare Worker: نشر صفحة اليوم على تيليجرام 07:00 بتوقيت مكة
packages/
  core/         حساب صفحة اليوم، الأنواع، الثوابت، تجميع التفسير، الأرقام العربية
  content/      جلب الصفحات من المصادر والتحقق منها → content/build/pages/<n>/
  media/        توليد الصور من القوالب بـ Playwright (المنشور، الستوري، بطاقات التفسير)
content/
  approved.json الصفحات التي راجعها إنسان واعتمدها (الملف الوحيد المحفوظ في git هنا)
handoff/        حزمة المشروع الأصلية: الوثائق، الهوية، القوالب
```

**اتجاه البيانات:** `content` يجلب ويتحقق ← `media` يولّد الصور ← مراجعة بشرية واعتماد في `approved.json` ← `web` يبني الصفحات المعتمدة فقط ← `publisher` ينشر من ملفات الموقع.
الصفحة غير المعتمدة لا تُبنى في الموقع، فلا يستطيع الناشر الوصول إليها.

## التشغيل

يحتاج Node 20 أو أحدث، وpnpm 9.

```bash
pnpm install
pnpm exec playwright install chromium-headless-shell
```

```bash
pnpm test        # كل الاختبارات
pnpm typecheck
pnpm lint
```

### ١. جلب البيانات والتحقق منها
```bash
pnpm content:fetch            # كل الصفحات
pnpm content:fetch 1 5        # مدى للتجربة
```
يتوقف عند أي خطأ، ويكتب التقرير في `content/build/report.json`. ردود الشبكة تُحفظ في `content/cache`.

### ٢. توليد الصور
```bash
pnpm content:render 1 604 --workers 6
```
لكل صفحة: `post.png` (1080×1350) و`story.png` (1080×1920) و`tafsir-NN.png` و`caption.txt` و`cards.json`.

### ٣. المراجعة والاعتماد
راجع صور الصفحة في `content/build/pages/<n>/`، ثم أضف رقمها إلى `content/approved.json`.

### ٤. الموقع
```bash
pnpm web:dev                                   # تطوير محلي (يعرض كل الصفحات المولّدة)
pnpm --filter @daydan/web build:preview        # بناء معاينة لكل الصفحات، لا يمكن نشره
pnpm web:deploy                                # بناء الصفحات المعتمدة فقط ونشرها
```

### ٥. ناشر تيليجرام
```bash
cd apps/publisher
pnpm exec wrangler secret put TELEGRAM_BOT_TOKEN
pnpm exec wrangler secret put ADMIN_CHAT_ID
pnpm deploy
```
في `apps/publisher/wrangler.toml`:
- `TELEGRAM_ENABLED = "1"` يشغّل النشر، و`"0"` يوقفه فوراً.
- `PUBLISH_DRY_RUN = "1"` يرسل الألبوم إلى المدير فقط. جرّبه أسبوعاً قبل الإطلاق.

عند الفشل: ٣ محاولات، ثم تنبيه في محادثة المدير. لا يُنشر اليوم نفسه مرتين.

## يوم الإطلاق
`LAUNCH_DATE` في `packages/core/src/constants.ts`. يوم الإطلاق هو الصفحة ١، ولا يُغيَّر بعد الإطلاق.

## المصادر
- صفحات المصحف: مجمع الملك فهد لطباعة المصحف الشريف
- نص القرآن للتحقق: مشروع تنزيل [tanzil.net](https://tanzil.net) (CC BY 3.0، والنص الكامل للرخصة في `content/build/TANZIL-LICENSE.txt`)
- التفسير الميسر: مجمع الملك فهد لطباعة المصحف الشريف
- التلاوة: الشيخ محمود خليل الحصري (مرتّل)

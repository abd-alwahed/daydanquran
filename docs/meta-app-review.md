# Meta: إعداد النشر الآلي ومراجعة التطبيق (App Review)

الكود جاهز وموقوف: `INSTAGRAM_ENABLED = "0"`، `FACEBOOK_ENABLED = "0"`، `META_VIDEO_ENABLED = "0"`، `META_DRY_RUN = "1"` في `apps/publisher/wrangler.toml`. لا يُنشر شيء على Meta قبل أن تغيّرها أنت.

## ما ينشره الناشر

| الموعد (مكة) | cron (UTC) | ماذا |
|---|---|---|
| 07:05 | `5 4 * * *` | إنستغرام: ألبوم (الصفحة المصممة + بطاقات التفسير). فيسبوك: منشور بالصور نفسها |
| 07:15 | `15 4 * * *` | فيسبوك: فيديو الصفحة كاملة. إنستغرام: ريل أيام السبت والاثنين والأربعاء (`REEL_WEEKDAYS`) |
| 20:00 | `0 17 * * *` | ستوري إنستغرام (`reminder-story.jpg`)، واستئناف أي ريل لم تنتهِ معالجته صباحاً |

- كل الملفات تُقرأ من الموقع، فالصفحة غير المعتمدة لا تُنشر.
- قبل كل نشر على إنستغرام يُسأل Meta عن `content_publishing_limit`؛ لا رقم ثابت في الكود.
- لا نشر مكرر: مفتاح لكل (قناة، تاريخ) في KV. في إنستغرام يُحفظ رقم الحاوية قبل النشر ويُسأل عن حالتها عند الإعادة. في فيسبوك إن انقطع الاتصال أثناء النشر لا يُعاد تلقائياً أبداً: يصلك تنبيه لتتحقق من الصفحة وتحذف المفتاح `published:facebook:<التاريخ>:pending` إن لم يُنشر.
- أي فشل أو تجاوز للحد يصلك على تيليجرام (`ADMIN_CHAT_ID`).
- إنستغرام يقبل JPEG فقط، ويقصّ كل عناصر الألبوم على مقاس الأولى. لذلك له نسخ خاصة: `ig-post.jpg` و`ig-tafsir-NN.jpg` (البطاقة المربعة نفسها، بكسلاً بكسلاً، في وسط ورقة ٤:٥ بلون خلفيتها). يولّدها `pnpm --filter @daydan/media render` تلقائياً، أو للصفحات القديمة: `pnpm --filter @daydan/media render:instagram 1 604`. والناشر يرفض أي ألبوم فيه صورة ليست JPEG أو بغير المقاس.

## ١. الحسابات (مرة واحدة)
- [ ] حساب إنستغرام **احترافي (Business)** مربوط بصفحة فيسبوك دَيْدَن (شرط الستوري عبر الـAPI). انتظر انتهاء التقييد المؤقت أولاً (`handoff/docs/09-open-questions.md`).
- [ ] أنت **مسؤول (admin)** على الصفحة.
- [ ] التحقق بخطوتين مفعّل على الحسابين.

## ٢. تطبيق Meta Developer
- [ ] من developers.facebook.com: Create App ← نوع **Business**. الاسم: دَيْدَن / Daydan.
- [ ] Settings ← Basic:
  - [ ] Privacy Policy URL: `https://daydanquran.pages.dev/privacy/`
  - [ ] User data deletion ← Data deletion instructions URL: `https://daydanquran.pages.dev/privacy/` (فيها قسم «حذف بياناتك»)
  - [ ] Terms of Service URL (اختياري): الرابط نفسه
  - [ ] App icon: `handoff/brand/png/daydan-avatar-1080.png` (يُصغَّر إلى 1024×1024)
  - [ ] Category: Education. Contact email: `daydanquran@gmail.com`
- [ ] أضف المنتجين: **Facebook Login for Business** و **Instagram** (Instagram API with Facebook Login).

## ٣. الصلاحيات المطلوبة (فقط هذه)

| الصلاحية | لماذا نحتاجها |
|---|---|
| `pages_show_list` | الوصول إلى صفحة دَيْدَن واستخراج Page access token |
| `pages_read_engagement` | مطلوبة مع `pages_manage_posts` لقراءة بيانات الصفحة الأساسية |
| `pages_manage_posts` | نشر صور الورد وفيديو الصفحة على صفحة فيسبوك |
| `instagram_basic` | قراءة رقم حساب إنستغرام المربوط بالصفحة |
| `instagram_content_publish` | نشر الألبوم والستوري والريلز، وقراءة `content_publishing_limit` |
| `business_management` | فقط إن كانت الصفحة داخل Business Portfolio (حافظة أعمال) |

لا نطلب أي صلاحية لقراءة التعليقات أو الرسائل أو بيانات المتابعين.

## ٤. هل نحتاج App Review أصلاً؟
التطبيق ينشر على صفحتك وحسابك أنت فقط، وأنت admin على التطبيق. في هذه الحالة يكفي غالباً **Standard Access** دون مراجعة:
- [ ] جرّب أولاً: حوّل التطبيق إلى **Live** (يتطلب رابط الخصوصية أعلاه)، وولّد التوكن (الخطوة ٥)، وشغّل تجربة نشر حقيقية واحدة بعد الإطلاق.
- [ ] إن رفضت Meta النشر بخطأ صلاحيات (مثلاً `(#10)` أو `(#200)` أو «requires advanced access»)، فقدّم طلب **Advanced Access** للصلاحيات أعلاه عبر App Review ← Permissions and Features، مع **Business Verification** (التحقق من النشاط التجاري). قد يستغرق أسابيع.
- [ ] ملاحظة: منشورات تطبيق في وضع Development لا يراها إلا أصحاب الأدوار في التطبيق، فلا تعتمد على وضع Development للنشر العام.

## ٥. التوكن والأرقام
- [ ] الأفضل للخادم: **System User** في Business Settings ← Users ← System users، بدور Admin، وأسند له الصفحة وحساب إنستغرام والتطبيق، ثم Generate token بالصلاحيات أعلاه (لا ينتهي).
- [ ] أو: من Graph API Explorer خذ User token بالصلاحيات، حوّله إلى long-lived (60 يوماً)، ثم `GET /me/accounts` يعطي Page access token لا ينتهي.
- [ ] رقم الصفحة ورقم إنستغرام: `GET /{page-id}?fields=instagram_business_account` في Graph API Explorer.
- [ ] في `apps/publisher/wrangler.toml`: `FACEBOOK_PAGE_ID` و`INSTAGRAM_USER_ID`.
- [ ] السر: `npx wrangler secret put META_ACCESS_TOKEN` (من مجلد `apps/publisher`). لا يُكتب في أي ملف.

## ٦. التشغيل التدريجي
1. [ ] `INSTAGRAM_ENABLED = "1"` و`FACEBOOK_ENABLED = "1"` مع إبقاء `META_DRY_RUN = "1"`، ثم `pnpm publisher:deploy`. يصلك كل صباح تقرير «🧪» بما كان سيُنشر، دون أي اتصال بـMeta.
2. [ ] بعد يومين سليمين: `META_DRY_RUN = "0"` ونشر. أول منشور حقيقي يكون في الإطلاق أو بعده (قبل الإطلاق لا يعمل إلا وضع التجربة).
3. [ ] الريلز وفيديو الصفحة: تبقى `META_VIDEO_ENABLED = "0"` حتى (أ) إذن إعادة نشر تلاوة الحصري (`handoff/docs/09-open-questions.md` #2)، و(ب) توليد `video.mp4` و`reel.mp4` لكل صفحة (لم يُبنَ بعد، انظر أدناه).

## ٧. سيناريو تسجيل الشاشة (Screencast) لطلب المراجعة
فيديو واحد لكل صلاحية أو فيديو جامع، بالإنجليزية (يراه مراجع Meta)، ٢–٤ دقائق، دقة 1080p، مع شرح نصي على الشاشة.

1. **Intro (on screen text):** "Daydan is a non-profit Quran reading project. Every day it publishes one page of the Quran with its tafsir to our own Facebook Page and Instagram account. The app only publishes to accounts we own."
2. **Login and permissions:** open the Facebook Login for Business flow (or Graph API Explorer with this app selected), sign in as the Page admin, and show the consent screen granting `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`. Select the Daydan Page and its Instagram account.
3. **`pages_show_list` / `instagram_basic`:** in Graph API Explorer run `GET /me/accounts` (shows the Daydan Page) and `GET /{page-id}?fields=instagram_business_account` (shows the linked Instagram account).
4. **The publisher:** show the website page of the day (`https://daydanquran.pages.dev/p/<n>/`): these are the images that will be posted. Then in a terminal in `apps/publisher`, run `npx wrangler dev --test-scheduled` and trigger `curl "http://localhost:8787/__scheduled?cron=5+4+*+*+*"` (with `META_DRY_RUN=0` in `.dev.vars`).
5. **`instagram_content_publish`:** show the log line with `content_publishing_limit` checked and the carousel published, then open Instagram and show the new carousel post (page + tafsir cards).
6. **`pages_manage_posts` / `pages_read_engagement`:** open the Facebook Page and show the new photo post with the same images and caption.
7. **Story:** trigger `curl "http://localhost:8787/__scheduled?cron=0+17+*+*+*"` and show the story on Instagram.
8. **Closing (on screen text):** "No user data is read or stored. Privacy policy: https://daydanquran.pages.dev/privacy/"

ملاحظات للطلب:
- [ ] في خانة «How will your app use this permission» لكل صلاحية: انسخ سطر الجدول في القسم ٣ بالإنجليزية: "Publish our own daily Quran page post to our own Facebook Page / Instagram account. No third-party accounts."
- [ ] اشرح أن النشر آلي من خادم (Cloudflare Worker) بلا واجهة مستخدم، وأن الفيديو يعرض كامل المسار.
- [ ] صفحة الخصوصية يجب أن تكون منشورة على الموقع قبل التقديم.

## ما لم يُبنَ في هذه المرحلة
- **توليد الفيديو** (`video.mp4` للصفحة كاملة، و`reel.mp4` ≤90 ثانية بمقاس 9:16): مؤجَّل في نطاق الإطلاق السريع، ومعلّق على ترخيص التلاوة. الناشر جاهز له: يكفي أن تظهر الملفات في `content/build/pages/<n>/` وتُعتمد الصفحة. الريل بطبيعته مقتطف (تلاوة الصفحة أطول من ٩٠ ثانية غالباً)، واختيار المقطع قرار محتوى يحتاج موافقتك.
- **حدود Cloudflare:** الخطة المجانية تسمح بـ٥ مواعيد cron لكل الحساب (نستخدم ٥ الآن) و٥٠ طلباً خارجياً لكل تشغيل؛ لذلك فُصل نشر الصور عن الفيديو. وحد الملف الواحد على Cloudflare Pages ٢٥ ميغابايت، فإن زاد فيديو الصفحة عنه فمكانه R2.

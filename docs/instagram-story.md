# ستوري إنستغرام اليومي

كل يوم الساعة **07:01 بتوقيت مكة** (`1 4 * * *` UTC) ينشر الـWorker صورة `story.png` لصفحة اليوم ستوري على إنستغرام. إنستغرام وفيسبوك قناتا تسويق؛ لا تُنشر عليهما الصفحة وتفسيرها كمنشورات (قرار ٢٠٢٦-١٠-١٣).

الكود جاهز وموقوف: `INSTAGRAM_ENABLED = "0"` و`INSTAGRAM_DRY_RUN = "1"` في `apps/publisher/wrangler.toml`.

## الطريق المعمول به الآن: نصف آلي
منصة مطوّري Meta رفضت حسابنا («لا يمكنك الوصول إلى هذه الخدمة»، ٢٠٢٦-١٠-١٤)، فلا نشر آلي حتى يُرفع المنع أو يملك التطبيقَ شريكٌ موثوق. إلى ذلك الحين:
- **كل يوم ٠٧:٠١ مكة** تصلك صورة ستوري اليوم على تيليجرام (`ADMIN_CHAT_ID`) كملف بحجمها الكامل، مع رابط الصفحة. افتحها ← مشاركة ← إنستغرام أو فيسبوك ← ستوري، وأضف ملصق الرابط. المفتاح: `STORY_KIT_ENABLED`. قبل الإطلاق تصل الصفحة ١ بعلامة «تجربة».
- **زر «شارك الصفحة في الستوري»** في كل صفحة على الموقع: يفتح قائمة المشاركة في الهاتف بالصورة جاهزة، لك وللقرّاء. على الكمبيوتر يُنزّل الصورة.

## كيف يعمل
- **بلا صفحة فيسبوك:** يستخدم «Instagram API with Instagram Login» (`graph.instagram.com`)، فلا يحتاج ربط إنستغرام بفيسبوك.
- **الصورة:** `ig-story.jpg`، وهي `story.png` نفسها محفوظة JPEG (إنستغرام لا يقبل غيره). يولّدها `pnpm --filter @daydan/media render` مع باقي الصور، وللصفحات المولّدة سابقاً: `pnpm --filter @daydan/media render:instagram 1 604`. تُقرأ من الموقع، فالصفحة غير المعتمدة لا تُنشر، ويرفض الناشر أي صورة ليست JPEG بمقاس ٩:١٦.
- **حد النشر:** يُسأل إنستغرام عن `content_publishing_limit` قبل كل نشر؛ لا رقم ثابت في الكود.
- **لا تكرار:** مفتاح `published:instagram-story:<التاريخ>` في KV. ويُحفظ رقم الحاوية قبل النشر، فإن ضاع رد إنستغرام تسأل الإعادة عن حالتها بدل النشر مرة ثانية.
- **التوكن يتجدد وحده:** توكن إنستغرام يعيش ٦٠ يوماً. الـWorker يجدده أسبوعياً ويحفظ الجديد في KV، حتى والستوري موقوف. إن فشل التجديد يصلك تنبيه ويستمر النشر بالتوكن الحالي. إن توقف الـWorker أكثر من ٦٠ يوماً انتهى التوكن، فضع توكناً جديداً (الخطوة ٤)؛ السر الجديد يحل محل المحفوظ تلقائياً.
- **التنبيهات:** أي فشل يصلك على تيليجرام (`ADMIN_CHAT_ID`).

## الإعداد (مرة واحدة)
1. [ ] حساب إنستغرام **احترافي** (Business أو Creator). الربط بفيسبوك غير مطلوب.
2. [ ] developers.facebook.com ← Create App ← نوع **Business**، ثم أضف منتج **Instagram** واختر **API setup with Instagram business login**.
3. [ ] Settings ← Basic: Privacy Policy URL وData deletion instructions URL: `https://daydanquran.pages.dev/privacy/` (بعد دمج طلب صفحة الخصوصية ونشر الموقع). الأيقونة: `handoff/brand/png/daydan-avatar-1080.png`. البريد: `daydanquran@gmail.com`.
4. [ ] في إعداد Instagram API: **Generate access tokens** ← أضف حساب دَيْدَن وسجّل الدخول ووافق على الصلاحيتين، ثم انسخ التوكن.
   - الصلاحيتان: `instagram_business_basic` (معرفة الحساب) و`instagram_business_content_publish` (نشر الستوري وقراءة حد النشر). لا شيء غيرهما.
5. [ ] رقم الحساب: افتح `https://graph.instagram.com/v25.0/me?fields=user_id,username&access_token=<التوكن>` في المتصفح وانسخ `user_id` إلى `INSTAGRAM_USER_ID` في `wrangler.toml`.
6. [ ] من مجلد `apps/publisher`: `npx wrangler secret put INSTAGRAM_ACCESS_TOKEN` والصق التوكن. لا يُكتب في أي ملف.

تحقق من أسماء الشاشات في لوحة Meta عند الإعداد؛ قد تتغير صياغتها.

## التشغيل التدريجي
1. [ ] `INSTAGRAM_ENABLED = "1"` مع إبقاء `INSTAGRAM_DRY_RUN = "1"`، ثم `pnpm publisher:deploy`. يصلك كل صباح تقرير «🧪» برابط الصورة دون أي نشر.
2. [ ] بعد يومين سليمين وبعد الإطلاق: `INSTAGRAM_DRY_RUN = "0"` ونشر. أول ستوري حقيقي يتطلب أيضاً `PUBLISH_DRY_RUN = "0"`.
3. [ ] إن رفض إنستغرام النشر بخطأ صلاحيات: حوّل التطبيق إلى **Live**، وإن بقي الرفض فاطلب **Advanced Access** للصلاحيتين عبر App Review (أدناه).

## إن احتجت App Review
التطبيق ينشر على حسابك أنت فقط، فيكفي غالباً Standard Access. إن طُلبت المراجعة:
- **How will you use it:** "We publish one story a day, an image of that day's Quran page, to our own Instagram account only. No other accounts, no user data."
- **Screencast (English, ٢–٣ دقائق):**
  1. On screen: "Daydan is a non-profit Quran reading project. Every morning it posts that day's page as a story on our own Instagram account."
  2. Business login for Instagram: sign in as Daydan and grant `instagram_business_basic` and `instagram_business_content_publish`.
  3. Show the day's image on the site (`https://daydanquran.pages.dev/p/<n>/ig-story.jpg`).
  4. In `apps/publisher`: `npx wrangler dev --test-scheduled`, then `curl "http://localhost:8787/__scheduled?cron=1+4+*+*+*"` (with `INSTAGRAM_DRY_RUN=0` in `.dev.vars`; works on or after launch day). Show the log: publishing limit checked, story published.
  5. Open Instagram and show the story.
  6. On screen: "No user data is read or stored. Privacy policy: https://daydanquran.pages.dev/privacy/"

## حدود يجب معرفتها
- زر «اقرأ واستمع مع التفسير» في الصورة ليس رابطاً. وملصق الرابط لا يُضاف عبر الـAPI حسب ما تذكره مصادر غير رسمية؛ إن أردت رابطاً قابلاً للضغط فأضفه يدوياً، أو اكتفِ برابط الموقع في نبذة الحساب.
- إنستغرام يضع اسم الحساب أعلى الستوري وخانة الرد أسفله؛ تصميم `StoryDaily.html` يترك هامشاً لذلك.

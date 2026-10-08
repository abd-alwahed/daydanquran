# ٣. البنية التقنية

## المبدأ
عالمان منفصلان:
1. **مصنع المحتوى (offline، مرة واحدة):** جلب → تحقق آلي → توليد الوسائط → مراجعة → تجميد كإصدار `content/v1` على R2.
2. **محرك التوزيع (runtime، يومياً):** يحسب صفحة اليوم وينشر ملفات جاهزة. لا يولّد أي محتوى.

## هيكل الـmonorepo
```
daydan/
  apps/
    web/          Next.js PWA → Cloudflare Pages (daydanquran.pages.dev)
    bot/          Telegram bot webhook → Cloudflare Worker
    publisher/    Cron Worker: daily publish + reminders sweep
  packages/
    core/         schedule (pageForDate), types, constants (604, 6236, TZ)
    content/      fetchers, validators, release builder (content/v1)
    media/        Playwright card renderer, ffmpeg audio merger
    publishers/   telegram.ts, instagram.ts, facebook.ts, whatsapp-manual.ts
    db/           Supabase schema, migrations, typed client
  content/        (gitignored build output; uploaded to R2)
```

## الجدولة
- `apps/publisher` Cron Triggers:
  - `0 4 * * *` (UTC) = 07:00 مكة → نشر صفحة اليوم على كل القنوات.
  - `0 17 * * *` (UTC) = 20:00 مكة → ستوري التذكير العام.
  - `*/15 * * * *` → التذكيرات الشخصية (من حلّ وقته ولم يقرأ).
- كل نشر يمر بجدول `publications` (فريد على `channel, publish_date`).

## نموذج البيانات (Supabase / Postgres)
```sql
create table users (
  id uuid primary key references auth.users(id),
  timezone text not null default 'Asia/Riyadh',
  city text,                         -- لحساب مواقيت الصلاة
  reminder_mode text not null default 'time',  -- 'time' | 'after_prayer' | 'off'
  reminder_time time,                -- عند mode='time'
  reminder_prayer text,              -- fajr|dhuhr|asr|maghrib|isha
  evening_nudge boolean not null default true,
  primary_channel text not null default 'web', -- 'web' | 'telegram'
  ramadan_message boolean not null default true,
  created_at timestamptz default now()
);

create table identities (           -- ربط الحساب بالمنصات
  user_id uuid references users(id) on delete cascade,
  provider text not null,           -- 'telegram' | 'web_push'
  provider_user_id text not null,
  data jsonb,                       -- push subscription, chat_id...
  primary key (provider, provider_user_id)
);

create table reading_log (
  user_id uuid references users(id) on delete cascade,
  local_date date not null,         -- تاريخ المستخدم المحلي
  page smallint not null check (page between 1 and 604),
  source text not null,             -- 'web' | 'telegram' | 'extension'
  created_at timestamptz default now(),
  primary key (user_id, local_date) -- يمنع الاحتساب مرتين
);

create table makeup_log (           -- صفحات "اقضِ ما فاتك"
  user_id uuid references users(id) on delete cascade,
  page smallint not null check (page between 1 and 604),
  khatma smallint not null,
  read_at timestamptz default now(),
  primary key (user_id, khatma, page)
);

create table publications (
  channel text not null,            -- 'telegram' | 'instagram' | 'facebook' | ...
  publish_date date not null,       -- بتوقيت مكة
  page smallint not null,
  status text not null,             -- 'pending' | 'done' | 'failed'
  external_id text,
  attempts smallint default 0,
  last_error text,
  primary key (channel, publish_date)
);

create table settings (key text primary key, value jsonb); -- launch_date, kill switches
```
- الختمة الشخصية = عدد الصفحات المميزة في `reading_log ∪ makeup_log` للختمة الحالية.
- RLS: كل مستخدم يقرأ ويكتب صفوفه فقط.

## التشغيل
- `PUBLISH_DRY_RUN=1` لكل ناشر، و`settings.kill_<channel>=true` لإيقاف قناة فوراً.
- محاولات متزايدة (3) ثم تنبيه في محادثة تيليجرام خاصة بالمدير.
- سجلات منظمة لكل نشر، وصفحة إدارة بسيطة في `apps/web/admin` (محمية) تعرض حالة اليوم وزر "انشر يدوياً" ونص واتساب الجاهز للنسخ.

## التكلفة المتوقعة
ضمن الطبقات المجانية في البداية (Cloudflare Pages/Workers/R2، Supabase Free). حد Cloudflare Pages: 20,000 ملف للموقع و25 MiB للملف، لذلك الوسائط على R2 لا داخل الموقع. التقدير: ~5 GB وسائط إجمالاً (تقدير غير مقاس، يُحسب فعلياً في المرحلة 2).

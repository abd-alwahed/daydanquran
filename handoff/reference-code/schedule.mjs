// دَيْدَن — حساب صفحة اليوم
// الافتراضات:
// - مصحف المدينة: 604 صفحة
// - "اليوم" يُحسب بتوقيت المنطقة المحددة (افتراضياً Asia/Riyadh، توقيت مكة)
// - بعد الصفحة 604 تبدأ ختمة جديدة من الصفحة 1

export const TOTAL_PAGES = 604;
export const DEFAULT_TZ = "Asia/Riyadh";

// يحوّل لحظة زمنية إلى تاريخ محلي "YYYY-MM-DD" في منطقة زمنية معينة
export function localDateString(date, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

// عدد الأيام بين تاريخين محليين (بدون تأثر بالتوقيت الصيفي)
function daysBetween(startYmd, endYmd) {
  const toUtc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(endYmd) - toUtc(startYmd)) / 86_400_000);
}

// startYmd: يوم إطلاق ديمة (الصفحة 1)
export function pageForDate(startYmd, date = new Date(), timeZone = DEFAULT_TZ) {
  const days = daysBetween(startYmd, localDateString(date, timeZone));
  if (days < 0) throw new Error(`التاريخ قبل يوم الإطلاق ${startYmd}`);
  return {
    page: (days % TOTAL_PAGES) + 1,
    khatma: Math.floor(days / TOTAL_PAGES) + 1, // رقم الختمة
    dayNumber: days + 1,
  };
}

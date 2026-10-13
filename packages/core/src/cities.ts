/** Prayer-time calculation conventions supported by adhan-js (CalculationMethod.*). */
export type CalculationMethodName =
  | "UmmAlQura"
  | "Egyptian"
  | "MuslimWorldLeague"
  | "NorthAmerica"
  | "Dubai"
  | "Qatar"
  | "Kuwait"
  | "Turkey"
  | "Singapore"
  | "Karachi"
  | "MoonsightingCommittee";

/** A city a reader can pick for reminders: its clock (time zone) and its prayer times. */
export interface City {
  id: string;
  name: string;
  timeZone: string;
  latitude: number;
  longitude: number;
  /** The convention commonly followed there. */
  method: CalculationMethodName;
}

const city = (
  id: string,
  name: string,
  timeZone: string,
  latitude: number,
  longitude: number,
  method: CalculationMethodName,
): City => ({ id, name, timeZone, latitude, longitude, method });

export const CITIES: readonly City[] = [
  city("riyadh", "الرياض", "Asia/Riyadh", 24.7136, 46.6753, "UmmAlQura"),
  city("makkah", "مكة المكرمة", "Asia/Riyadh", 21.4225, 39.8262, "UmmAlQura"),
  city("madinah", "المدينة المنورة", "Asia/Riyadh", 24.4672, 39.6111, "UmmAlQura"),
  city("jeddah", "جدة", "Asia/Riyadh", 21.4858, 39.1925, "UmmAlQura"),
  city("dammam", "الدمام", "Asia/Riyadh", 26.4207, 50.0888, "UmmAlQura"),
  city("kuwait", "الكويت", "Asia/Kuwait", 29.3759, 47.9774, "Kuwait"),
  city("doha", "الدوحة", "Asia/Qatar", 25.2854, 51.531, "Qatar"),
  city("manama", "المنامة", "Asia/Bahrain", 26.2285, 50.586, "UmmAlQura"),
  city("dubai", "دبي", "Asia/Dubai", 25.2048, 55.2708, "Dubai"),
  city("abudhabi", "أبوظبي", "Asia/Dubai", 24.4539, 54.3773, "Dubai"),
  city("muscat", "مسقط", "Asia/Muscat", 23.588, 58.3829, "MuslimWorldLeague"),
  city("sanaa", "صنعاء", "Asia/Aden", 15.3694, 44.191, "MuslimWorldLeague"),
  city("baghdad", "بغداد", "Asia/Baghdad", 33.3152, 44.3661, "MuslimWorldLeague"),
  city("amman", "عمّان", "Asia/Amman", 31.9454, 35.9284, "MuslimWorldLeague"),
  city("quds", "القدس", "Asia/Hebron", 31.7683, 35.2137, "MuslimWorldLeague"),
  city("damascus", "دمشق", "Asia/Damascus", 33.5138, 36.2765, "MuslimWorldLeague"),
  city("beirut", "بيروت", "Asia/Beirut", 33.8938, 35.5018, "MuslimWorldLeague"),
  city("cairo", "القاهرة", "Africa/Cairo", 30.0444, 31.2357, "Egyptian"),
  city("alexandria", "الإسكندرية", "Africa/Cairo", 31.2001, 29.9187, "Egyptian"),
  city("khartoum", "الخرطوم", "Africa/Khartoum", 15.5007, 32.5599, "Egyptian"),
  city("tripoli", "طرابلس", "Africa/Tripoli", 32.8872, 13.1913, "Egyptian"),
  city("tunis", "تونس", "Africa/Tunis", 36.8065, 10.1815, "MuslimWorldLeague"),
  city("algiers", "الجزائر", "Africa/Algiers", 36.7538, 3.0588, "MuslimWorldLeague"),
  city("casablanca", "الدار البيضاء", "Africa/Casablanca", 33.5731, -7.5898, "MuslimWorldLeague"),
  city("istanbul", "إسطنبول", "Europe/Istanbul", 41.0082, 28.9784, "Turkey"),
  city("karachi", "كراتشي", "Asia/Karachi", 24.8607, 67.0011, "Karachi"),
  city("kualalumpur", "كوالالمبور", "Asia/Kuala_Lumpur", 3.139, 101.6869, "Singapore"),
  city("jakarta", "جاكرتا", "Asia/Jakarta", -6.2088, 106.8456, "Singapore"),
  city("london", "لندن", "Europe/London", 51.5074, -0.1278, "MoonsightingCommittee"),
  city("paris", "باريس", "Europe/Paris", 48.8566, 2.3522, "MuslimWorldLeague"),
  city("berlin", "برلين", "Europe/Berlin", 52.52, 13.405, "MuslimWorldLeague"),
  city("newyork", "نيويورك", "America/New_York", 40.7128, -74.006, "NorthAmerica"),
  city("toronto", "تورنتو", "America/Toronto", 43.6532, -79.3832, "NorthAmerica"),
];

export const findCity = (id: string | null | undefined): City | null => CITIES.find((c) => c.id === id) ?? null;

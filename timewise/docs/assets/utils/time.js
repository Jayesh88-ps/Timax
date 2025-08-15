export function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

export function toLocalISO(date) {
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 19);
}

export function parseDurationToMinutes(text) {
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  // patterns like: 90m, 1h, 1.5h, 1h 30m, 2 hours, 45 minutes
  const hoursMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
  const minsMatch = normalized.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
  let minutes = 0;
  if (hoursMatch) {
    minutes += Math.round(parseFloat(hoursMatch[1]) * 60);
  }
  if (minsMatch) {
    minutes += parseInt(minsMatch[1], 10);
  }
  if (!hoursMatch && !minsMatch) {
    const plainMinutes = normalized.match(/^(\d+)(m|min|)$/);
    if (plainMinutes) minutes = parseInt(plainMinutes[1], 10);
  }
  return minutes > 0 ? minutes : null;
}

export function parseTimeOfDay(text) {
  // returns minutes since 00:00 for time like "4pm", "4:30 pm", "16:05"
  if (!text) return null;
  const s = text.trim().toLowerCase();
  const re = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
  const m = s.match(re);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3];
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function setTimeOnDate(date, minutesSinceMidnight) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutesSinceMidnight, 0, 0);
  return d;
}

export function formatTimeHM(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(m)} ${ampm}`;
}

export function formatDayLabel(date) {
  const opts = { weekday: 'long', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(undefined, opts).format(date);
}

export function clampDateToDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function parseDateKeywords(text, refDate) {
  // returns { date: Date, repeat?: { type: 'weekly', days: number[] } } or null
  const s = text.toLowerCase();
  const daysMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  if (s.includes('today')) return { date: clampDateToDay(refDate) };
  if (s.includes('tomorrow')) return { date: addMinutes(clampDateToDay(refDate), 24 * 60) };
  if (s.includes('weekdays')) return { date: clampDateToDay(refDate), repeat: { type: 'weekly', days: [1,2,3,4,5] } };
  if (s.includes('weekends')) return { date: clampDateToDay(refDate), repeat: { type: 'weekly', days: [0,6] } };
  const dayTokens = Object.keys(daysMap).filter(k => new RegExp(`\\b${k}(?:day)?\\b`).test(s));
  if (dayTokens.length) {
    const days = [...new Set(dayTokens.map(t => daysMap[t]))];
    return { date: clampDateToDay(refDate), repeat: { type: 'weekly', days } };
  }
  // Try simple explicit date like 2025-08-15
  const iso = s.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    return { date: clampDateToDay(d) };
  }
  return null;
}

export function parseTimeRangeFromText(text) {
  // returns { startMinutes, endMinutes } within a day, or null
  const s = text.toLowerCase();
  const range = s.match(/from\s+([0-9: ]+(?:am|pm)?)\s+to\s+([0-9: ]+(?:am|pm)?)/);
  if (range) {
    const a = parseTimeOfDay(range[1]);
    const b = parseTimeOfDay(range[2]);
    if (a != null && b != null && b > a) return { startMinutes: a, endMinutes: b };
  }
  const at = s.match(/at\s+([0-9: ]+(?:am|pm)?)/);
  const forDur = s.match(/for\s+([\d .a-z]+?)(?:\b|$)/);
  if (at) {
    const start = parseTimeOfDay(at[1]);
    const dur = forDur ? parseDurationToMinutes(forDur[1]) : null;
    if (start != null && dur) return { startMinutes: start, endMinutes: start + dur };
  }
  return null;
}

export function nextDateMatchingDayOfWeek(startDate, targetDow) {
  const d = clampDateToDay(startDate);
  const currentDow = d.getDay();
  const delta = (targetDow - currentDow + 7) % 7 || 7;
  return addMinutes(d, delta * 1440);
}

export function humanDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
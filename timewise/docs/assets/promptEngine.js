import { clampDateToDay, parseDateKeywords, parseTimeRangeFromText, parseTimeOfDay, setTimeOnDate, addMinutes, parseDurationToMinutes } from './utils/time.js';

function extractTitle(raw) {
  const s = raw.trim();
  // Remove leading verbs
  const stripped = s.replace(/^(add|schedule|create|plan|move|reschedule|delete|cancel|remove)\s+/i, '');
  const stopWords = [' at ', ' from ', ' to ', ' on ', ' for ', ' by ', ' tomorrow', ' today'];
  let cut = stripped.length;
  for (const w of stopWords) {
    const idx = stripped.toLowerCase().indexOf(w);
    if (idx !== -1) cut = Math.min(cut, idx);
  }
  const title = stripped.slice(0, cut).trim();
  return title || 'Task';
}

function findEventByTitleFuzzy(events, query) {
  const q = query.toLowerCase();
  const scored = events
    .map(e => ({ e, score: e.title.toLowerCase().includes(q) ? q.length / e.title.length : 0 }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.length ? scored[0].e : null;
}

export function interpretPrompt(prompt, state) {
  const text = prompt.trim();
  const ref = new Date();
  const lower = text.toLowerCase();

  // Shift day intent: "shift today by 30m" or "late by 30m"
  if (/\b(shift|late)\b/.test(lower) && /\bby\b/.test(lower)) {
    const durMatch = lower.match(/by\s+([\d .a-z]+)/);
    const minutes = durMatch ? parseDurationToMinutes(durMatch[1]) : null;
    if (minutes) {
      const isToday = /today/.test(lower) || !/tomorrow/.test(lower);
      const date = clampDateToDay(isToday ? ref : addMinutes(clampDateToDay(ref), 1440));
      return { operations: [{ type: 'shiftDay', date: date.toISOString(), deltaMinutes: minutes }] };
    }
  }

  // Delete/cancel
  if (/(delete|cancel|remove)\b/i.test(text)) {
    const title = extractTitle(text);
    return { operations: [{ type: 'deleteByTitle', title }] };
  }

  // Move/reschedule
  if (/(move|reschedule)\b/i.test(text)) {
    const title = extractTitle(text);
    const dateInfo = parseDateKeywords(text, ref);
    const day = dateInfo?.date || clampDateToDay(ref);
    let startMinutes = null;
    let endMinutes = null;
    const range = parseTimeRangeFromText(text);
    if (range) { startMinutes = range.startMinutes; endMinutes = range.endMinutes; }
    else {
      const at = text.toLowerCase().match(/at\s+([0-9: ]+(?:am|pm)?)/);
      const dur = text.toLowerCase().match(/for\s+([\d .a-z]+)/);
      if (at) startMinutes = parseTimeOfDay(at[1]);
      if (dur) {
        const d = parseDurationToMinutes(dur[1]);
        if (d && startMinutes != null) endMinutes = startMinutes + d;
      }
    }
    const event = findEventByTitleFuzzy(state.events, title);
    if (event && startMinutes != null && endMinutes != null) {
      const start = setTimeOnDate(day, startMinutes);
      const end = setTimeOnDate(day, endMinutes);
      return { operations: [{ type: 'moveEvent', id: event.id, start: start.toISOString(), end: end.toISOString() }] };
    }
  }

  // Add/schedule (default)
  const title = extractTitle(text);
  const dateInfo = parseDateKeywords(text, ref) || { date: clampDateToDay(ref) };
  const day = dateInfo.date;
  const range = parseTimeRangeFromText(text);
  let start = null, end = null;
  if (range) {
    start = setTimeOnDate(day, range.startMinutes);
    end = setTimeOnDate(day, range.endMinutes);
  } else {
    const at = text.toLowerCase().match(/at\s+([0-9: ]+(?:am|pm)?)/);
    const dur = text.toLowerCase().match(/for\s+([\d .a-z]+)/);
    const startMin = at ? parseTimeOfDay(at[1]) : null;
    const durMin = dur ? parseDurationToMinutes(dur[1]) : 60;
    const defaultStart = startMin != null ? startMin : 18 * 60; // default 6pm if none provided
    start = setTimeOnDate(day, defaultStart);
    end = addMinutes(start, durMin || 60);
  }
  const baseEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (dateInfo.repeat?.type === 'weekly') {
    // Create 4 upcoming weeks occurrences for simplicity
    const ops = [];
    const baseDay = clampDateToDay(day);
    for (let w = 0; w < 4; w++) {
      for (const dow of dateInfo.repeat.days) {
        const d = new Date(baseDay);
        const currentDow = d.getDay();
        const delta = (dow - currentDow + 7) % 7 + w * 7;
        const occStart = addMinutes(d, delta * 1440 + (new Date(baseEvent.start).getHours() * 60 + new Date(baseEvent.start).getMinutes()));
        const occEnd = addMinutes(occStart, (new Date(baseEvent.end) - new Date(baseEvent.start)) / 60000);
        ops.push({ type: 'addEvent', event: { ...baseEvent, id: `evt_${Date.now()}_${w}${dow}`, start: occStart.toISOString(), end: occEnd.toISOString() } });
      }
    }
    return { operations: ops };
  }

  return { operations: [{ type: 'addEvent', event: baseEvent }] };
}
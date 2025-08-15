const NS = 'timewise';

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

export function loadState() {
  const raw = localStorage.getItem(`${NS}:state`);
  return safeParse(raw, null);
}

export function saveState(state) {
  localStorage.setItem(`${NS}:state`, JSON.stringify(state));
}

export function migrateOrInit() {
  const existing = loadState();
  if (existing) return existing;
  const now = new Date();
  const start = new Date(now);
  start.setHours(17, 0, 0, 0);
  const end = new Date(now);
  end.setHours(18, 0, 0, 0);
  const seed = {
    settings: { notificationLeadMinutes: 10, dayStartHour: 7, dayEndHour: 22, bufferMinutes: 5 },
    events: [
      {
        id: `evt_${Date.now()}`,
        title: 'Welcome — sample study block',
        start: start.toISOString(),
        end: end.toISOString(),
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  };
  saveState(seed);
  return seed;
}
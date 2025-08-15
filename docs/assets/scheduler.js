import { addMinutes } from './utils/time.js';

export class NotificationScheduler {
  constructor(showToast, getLeadMinutes) {
    this.showToast = showToast;
    this.getLeadMinutes = getLeadMinutes;
    this.timeouts = new Map();
  }

  async ensurePermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
    return false;
  }

  clearAll() {
    for (const id of this.timeouts.keys()) {
      clearTimeout(this.timeouts.get(id));
    }
    this.timeouts.clear();
  }

  schedule(events) {
    this.clearAll();
    const now = new Date();
    const lead = this.getLeadMinutes();
    const windowEnd = addMinutes(now, 24 * 60);
    for (const e of events) {
      if (e.status === 'done' || e.status === 'canceled') continue;
      const start = new Date(e.start);
      if (start <= now || start > windowEnd) continue;
      const notifyAt = addMinutes(start, -lead);
      const ms = notifyAt.getTime() - now.getTime();
      const timeout = setTimeout(() => this.notify(e), ms);
      this.timeouts.set(e.id, timeout);
    }
  }

  notify(event) {
    const title = `Upcoming: ${event.title}`;
    const body = `Starts at ${new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else {
      this.showToast(title, body);
    }
  }
}
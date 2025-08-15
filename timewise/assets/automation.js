import { addMinutes } from './utils/time.js';

export class AutomationEngine {
  constructor(getSettings) {
    this.getSettings = getSettings;
  }

  applyAll(events) {
    let adjusted = this.autoInsertBuffers(events);
    adjusted = this.autoShiftConflicts(adjusted);
    return adjusted;
  }

  autoInsertBuffers(events) {
    const buffer = this.getSettings().bufferMinutes || 0;
    if (!buffer) return events.slice();
    const sorted = events.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gap = (new Date(curr.start) - new Date(prev.end)) / 60000;
      if (gap > 0 && gap < buffer) {
        const delta = buffer - gap;
        curr.start = addMinutes(new Date(curr.start), delta).toISOString();
        curr.end = addMinutes(new Date(curr.end), delta).toISOString();
      }
    }
    return sorted;
  }

  autoShiftConflicts(events) {
    const sorted = events.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (new Date(curr.start) < new Date(prev.end)) {
        const delta = Math.ceil((new Date(prev.end) - new Date(curr.start)) / 60000);
        curr.start = addMinutes(new Date(curr.start), delta).toISOString();
        curr.end = addMinutes(new Date(curr.end), delta).toISOString();
      }
    }
    return sorted;
  }
}
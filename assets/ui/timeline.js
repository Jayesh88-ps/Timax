import { clampDateToDay, addMinutes, formatTimeHM } from '../utils/time.js';

export class TimelineView {
  constructor(container, { onChange }) {
    this.container = container;
    this.onChange = onChange;
    this.day = clampDateToDay(new Date());
    this.events = [];
    this.pixelsPerMinute = 1; // 1px = 1 minute
    this.height = 24 * 60 * this.pixelsPerMinute;

    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.height = `${this.height}px`;
    this.container.style.border = '1px solid #1e293b';
    this.container.style.borderRadius = '12px';
    this.container.style.background = 'linear-gradient(#0b1220, #0b1220)';
    this.container.style.overflow = 'hidden';

    const hoursLayer = document.createElement('div');
    hoursLayer.style.position = 'absolute';
    hoursLayer.style.left = '0';
    hoursLayer.style.right = '0';
    hoursLayer.style.top = '0';
    hoursLayer.style.bottom = '0';
    this.container.appendChild(hoursLayer);

    for (let h = 0; h < 24; h++) {
      const row = document.createElement('div');
      row.style.position = 'absolute';
      row.style.left = '0';
      row.style.right = '0';
      row.style.top = `${h * 60 * this.pixelsPerMinute}px`;
      row.style.height = `${60 * this.pixelsPerMinute}px`;
      row.style.borderTop = '1px solid #0f213e';
      if (h % 3 === 0) {
        const label = document.createElement('div');
        label.textContent = `${h.toString().padStart(2, '0')}:00`;
        label.style.position = 'absolute';
        label.style.left = '8px';
        label.style.top = '2px';
        label.style.fontSize = '11px';
        label.style.color = '#7dd3fc';
        row.appendChild(label);
      }
      hoursLayer.appendChild(row);
    }

    const nowLine = document.createElement('div');
    nowLine.style.position = 'absolute';
    nowLine.style.left = '0';
    nowLine.style.right = '0';
    nowLine.style.height = '2px';
    nowLine.style.background = '#ef4444';
    nowLine.style.boxShadow = '0 0 0 1px rgba(239,68,68,0.25)';
    this.container.appendChild(nowLine);

    const updateNow = () => {
      const now = new Date();
      const msSinceMidnight = now - clampDateToDay(now);
      const minutes = Math.floor(msSinceMidnight / 60000);
      nowLine.style.top = `${minutes * this.pixelsPerMinute}px`;
    };
    updateNow();
    this.nowTimer = setInterval(updateNow, 60 * 1000);

    this.eventsLayer = document.createElement('div');
    this.eventsLayer.style.position = 'absolute';
    this.eventsLayer.style.left = '0';
    this.eventsLayer.style.right = '0';
    this.eventsLayer.style.top = '0';
    this.eventsLayer.style.bottom = '0';
    this.container.appendChild(this.eventsLayer);
  }

  setDay(date) {
    this.day = clampDateToDay(date);
    this.render();
  }

  setEvents(events) {
    this.events = events.slice();
    this.render();
  }

  destroy() {
    if (this.nowTimer) clearInterval(this.nowTimer);
  }

  _eventTop(startDate) {
    const ms = startDate - this.day;
    return Math.max(0, Math.min(this.height, Math.floor(ms / 60000) * this.pixelsPerMinute));
  }
  _eventHeight(startDate, endDate) {
    const diffMin = Math.max(5, Math.floor((endDate - startDate) / 60000));
    return Math.max(5, diffMin * this.pixelsPerMinute);
  }

  render() {
    this.eventsLayer.innerHTML = '';
    const sorted = this.events.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    for (const evt of sorted) {
      const start = new Date(evt.start);
      const end = new Date(evt.end);
      const top = this._eventTop(start);
      const height = this._eventHeight(start, end);

      const card = document.createElement('div');
      card.className = 'timeline-card';
      card.style.position = 'absolute';
      card.style.left = '8px';
      card.style.right = '8px';
      card.style.top = `${top}px`;
      card.style.height = `${height}px`;
      card.style.border = '1px solid #1e293b';
      card.style.borderRadius = '10px';
      card.style.background = '#0a1429';
      card.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
      card.style.padding = '8px 10px';
      card.style.display = 'grid';
      card.style.gridTemplateRows = 'auto 1fr auto';

      const title = document.createElement('div');
      title.textContent = evt.title;
      title.style.fontWeight = '700';
      title.style.color = '#e2e8f0';
      title.style.fontSize = '13px';
      card.appendChild(title);

      const time = document.createElement('div');
      time.style.fontSize = '12px';
      time.style.color = '#93c5fd';
      time.textContent = `${formatTimeHM(start)} – ${formatTimeHM(end)}`;
      card.appendChild(time);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '6px';
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn btn-secondary';
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', () => this.onChange({ type: 'markDone', id: evt.id }));
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.onChange({ type: 'editEvent', id: evt.id }));
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-secondary';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => this.onChange({ type: 'deleteEvent', id: evt.id }));
      actions.appendChild(doneBtn);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      card.appendChild(actions);

      // Drag & resize
      const dragHandle = document.createElement('div');
      dragHandle.style.position = 'absolute';
      dragHandle.style.left = '0';
      dragHandle.style.right = '0';
      dragHandle.style.top = '0';
      dragHandle.style.height = '6px';
      dragHandle.style.cursor = 'ns-resize';
      dragHandle.dataset.role = 'resize-start';
      const resizeHandle = document.createElement('div');
      resizeHandle.style.position = 'absolute';
      resizeHandle.style.left = '0';
      resizeHandle.style.right = '0';
      resizeHandle.style.bottom = '0';
      resizeHandle.style.height = '6px';
      resizeHandle.style.cursor = 'ns-resize';
      resizeHandle.dataset.role = 'resize-end';
      const moveHandle = document.createElement('div');
      moveHandle.style.position = 'absolute';
      moveHandle.style.left = '0';
      moveHandle.style.right = '0';
      moveHandle.style.top = '6px';
      moveHandle.style.bottom = '6px';
      moveHandle.style.cursor = 'grab';
      moveHandle.dataset.role = 'move';
      card.appendChild(dragHandle);
      card.appendChild(resizeHandle);
      card.appendChild(moveHandle);

      const onPointerDown = (ev) => {
        ev.preventDefault();
        const role = ev.target?.dataset?.role;
        if (!role) return;
        const startY = ev.clientY;
        const initialTop = top;
        const initialHeight = height;
        const startDate = new Date(evt.start);
        const endDate = new Date(evt.end);

        const onMove = (e2) => {
          const dy = e2.clientY - startY;
          if (role === 'move') {
            const newTop = Math.max(0, Math.min(this.height - initialHeight, initialTop + dy));
            const deltaMin = Math.round((newTop - initialTop) / this.pixelsPerMinute);
            const newStart = addMinutes(startDate, deltaMin);
            const newEnd = addMinutes(endDate, deltaMin);
            card.style.top = `${newTop}px`;
            time.textContent = `${formatTimeHM(newStart)} – ${formatTimeHM(newEnd)}`;
          } else if (role === 'resize-start') {
            const newTop = Math.max(0, Math.min(initialTop + initialHeight - 5, initialTop + dy));
            const newHeight = initialHeight + (initialTop - newTop);
            const deltaMin = Math.round((initialTop - newTop) / this.pixelsPerMinute);
            const newStart = addMinutes(startDate, -deltaMin);
            card.style.top = `${newTop}px`;
            card.style.height = `${newHeight}px`;
            time.textContent = `${formatTimeHM(newStart)} – ${formatTimeHM(endDate)}`;
          } else if (role === 'resize-end') {
            const newHeight = Math.max(5, initialHeight + dy);
            const deltaMin = Math.round((newHeight - initialHeight) / this.pixelsPerMinute);
            const newEnd = addMinutes(endDate, deltaMin);
            card.style.height = `${newHeight}px`;
            time.textContent = `${formatTimeHM(startDate)} – ${formatTimeHM(newEnd)}`;
          }
        };

        const onUp = (e2) => {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          const rectTop = parseInt(card.style.top, 10);
          const rectHeight = parseInt(card.style.height, 10);
          const newStart = addMinutes(this.day, Math.round(rectTop / this.pixelsPerMinute));
          const newEnd = addMinutes(newStart, Math.round(rectHeight / this.pixelsPerMinute));
          this.onChange({ type: 'updateTime', id: evt.id, start: newStart, end: newEnd });
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      };

      card.addEventListener('pointerdown', onPointerDown);
      this.eventsLayer.appendChild(card);
    }
  }
}
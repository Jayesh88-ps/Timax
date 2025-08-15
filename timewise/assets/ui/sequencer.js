import { formatTimeHM, clampDateToDay } from '../utils/time.js';

export class SequencerView {
  constructor(container, { onChange }) {
    this.container = container;
    this.onChange = onChange;
    this.events = [];
    this.day = clampDateToDay(new Date());
    this.startAtMinutes = null;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    this.container.classList.add('sequencer');

    // Controls
    const ctrl = document.createElement('div');
    ctrl.className = 'sequencer-controls';

    const labelStart = document.createElement('label');
    labelStart.textContent = 'Start at';
    labelStart.style.marginRight = '8px';
    const inputStart = document.createElement('input');
    inputStart.type = 'time';
    inputStart.step = '60';
    inputStart.className = 'seq-time-input';
    this.inputStart = inputStart;

    const btnNow = document.createElement('button');
    btnNow.className = 'btn btn-secondary';
    btnNow.textContent = 'Now';
    btnNow.addEventListener('click', () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      inputStart.value = `${hh}:${mm}`;
      this._emitStartAt();
    });

    ctrl.appendChild(labelStart);
    ctrl.appendChild(inputStart);
    ctrl.appendChild(btnNow);

    const hint = document.createElement('div');
    hint.className = 'sequencer-hint';
    hint.textContent = 'Drag to reorder. Pin tasks to fixed times. Adjust durations inline. Auto-fits the rest.';

    this.list = document.createElement('div');
    this.list.className = 'sequencer-list';

    this.container.appendChild(ctrl);
    this.container.appendChild(hint);
    this.container.appendChild(this.list);

    inputStart.addEventListener('change', () => this._emitStartAt());
  }

  _emitStartAt() {
    if (!this.inputStart.value) return;
    const [hh, mm] = this.inputStart.value.split(':');
    const minutes = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    this.onChange({ type: 'setStartAt', minutes });
  }

  setDay(date) {
    this.day = clampDateToDay(date);
  }

  setStartAtMinutes(minutes) {
    this.startAtMinutes = minutes;
    if (minutes != null) {
      const hh = Math.floor(minutes / 60).toString().padStart(2, '0');
      const mm = (minutes % 60).toString().padStart(2, '0');
      this.inputStart.value = `${hh}:${mm}`;
    }
  }

  setEvents(events) {
    this.events = events.slice();
    this.render();
  }

  render() {
    this.list.innerHTML = '';
    // Build draggable list
    for (const e of this.events) {
      const start = new Date(e.start);
      const end = new Date(e.end);
      const durationMin = Math.max(1, Math.round((end - start) / 60000));

      const item = document.createElement('div');
      item.className = 'seq-item';
      item.draggable = !e.pinned;
      item.dataset.id = e.id;

      const drag = document.createElement('div');
      drag.className = 'seq-drag';
      drag.textContent = '⋮⋮';

      const main = document.createElement('div');
      main.className = 'seq-main';

      const title = document.createElement('input');
      title.type = 'text';
      title.className = 'seq-title';
      title.value = e.title;
      title.addEventListener('change', () => this.onChange({ type: 'rename', id: e.id, title: title.value }));

      const time = document.createElement('div');
      time.className = 'seq-time';
      time.textContent = `${formatTimeHM(start)} – ${formatTimeHM(end)} (${durationMin}m)`;

      const controls = document.createElement('div');
      controls.className = 'seq-controls';

      const btnMinus = document.createElement('button');
      btnMinus.className = 'btn btn-secondary';
      btnMinus.textContent = '−5m';
      btnMinus.addEventListener('click', () => this.onChange({ type: 'adjustDuration', id: e.id, deltaMinutes: -5 }));

      const btnPlus = document.createElement('button');
      btnPlus.className = 'btn btn-secondary';
      btnPlus.textContent = '+5m';
      btnPlus.addEventListener('click', () => this.onChange({ type: 'adjustDuration', id: e.id, deltaMinutes: +5 }));

      const pinWrap = document.createElement('label');
      pinWrap.className = 'seq-pin';
      const pin = document.createElement('input');
      pin.type = 'checkbox';
      pin.checked = !!e.pinned;
      pin.addEventListener('change', () => this.onChange({ type: 'togglePin', id: e.id, pinned: pin.checked }));
      const pinTxt = document.createElement('span');
      pinTxt.textContent = 'Pin';
      pinWrap.appendChild(pin);
      pinWrap.appendChild(pinTxt);

      const pinTime = document.createElement('input');
      pinTime.type = 'time';
      pinTime.step = '60';
      pinTime.className = 'seq-time-input';
      const hh = start.getHours().toString().padStart(2, '0');
      const mm = start.getMinutes().toString().padStart(2, '0');
      pinTime.value = `${hh}:${mm}`;
      pinTime.disabled = !pin.checked;
      pin.addEventListener('change', () => { pinTime.disabled = !pin.checked; });
      pinTime.addEventListener('change', () => this.onChange({ type: 'setPinnedTime', id: e.id, time: pinTime.value }));

      const done = document.createElement('button');
      done.className = 'btn btn-secondary';
      done.textContent = 'Done';
      done.addEventListener('click', () => this.onChange({ type: 'markDone', id: e.id }));

      const del = document.createElement('button');
      del.className = 'btn btn-secondary';
      del.textContent = 'Delete';
      del.addEventListener('click', () => this.onChange({ type: 'deleteEvent', id: e.id }));

      controls.appendChild(btnMinus);
      controls.appendChild(btnPlus);
      controls.appendChild(pinWrap);
      controls.appendChild(pinTime);
      controls.appendChild(done);
      controls.appendChild(del);

      main.appendChild(title);
      main.appendChild(time);
      item.appendChild(drag);
      item.appendChild(main);
      item.appendChild(controls);

      // DnD
      item.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', e.id);
        ev.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', (ev) => {
        if (!ev.dataTransfer) return;
        const draggingId = ev.dataTransfer.getData('text/plain');
        if (!draggingId) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', (ev) => {
        const draggingId = ev.dataTransfer.getData('text/plain');
        if (!draggingId) return;
        ev.preventDefault();
        const ids = this.events.map(x => x.id);
        const from = ids.indexOf(draggingId);
        const to = ids.indexOf(e.id);
        if (from === -1 || to === -1 || from === to) return;
        // Only reorder if both are not pinned
        if (this.events[from].pinned || this.events[to].pinned) return;
        const newOrder = ids.slice();
        const [moved] = newOrder.splice(from, 1);
        newOrder.splice(to, 0, moved);
        this.onChange({ type: 'resequence', order: newOrder });
      });

      this.list.appendChild(item);
    }
  }
}
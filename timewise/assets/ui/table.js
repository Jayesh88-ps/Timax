import { formatTimeHM } from '../utils/time.js';

export class TableView {
  constructor(container, { onChange }) {
    this.container = container;
    this.onChange = onChange;
    this.events = [];
    this.sortKey = 'start';
    this.sortAsc = true;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.border = '1px solid #1e293b';
    table.style.borderRadius = '12px';
    table.style.overflow = 'hidden';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const cols = [
      { key: 'title', label: 'Title' },
      { key: 'start', label: 'Start' },
      { key: 'end', label: 'End' },
      { key: 'status', label: 'Status' },
      { key: 'actions', label: '' }
    ];
    cols.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      th.style.textAlign = 'left';
      th.style.padding = '10px';
      th.style.borderBottom = '1px solid #1e293b';
      th.style.fontSize = '12px';
      th.style.color = '#a5b4fc';
      if (col.key !== 'actions') {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => this.sortBy(col.key));
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    this.tbody = document.createElement('tbody');
    table.appendChild(this.tbody);
    this.container.appendChild(table);
  }

  sortBy(key) {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    this.render();
  }

  setEvents(events) {
    this.events = events.slice();
    this.render();
  }

  render() {
    this.tbody.innerHTML = '';
    const sorted = this.events.slice().sort((a, b) => {
      const va = a[this.sortKey];
      const vb = b[this.sortKey];
      const ca = this.sortKey === 'title' || this.sortKey === 'status' ? String(va) : new Date(va).getTime();
      const cb = this.sortKey === 'title' || this.sortKey === 'status' ? String(vb) : new Date(vb).getTime();
      return this.sortAsc ? (ca > cb ? 1 : -1) : (ca < cb ? 1 : -1);
    });

    for (const evt of sorted) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #0f213e';

      const tdTitle = document.createElement('td');
      tdTitle.style.padding = '10px';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = evt.title;
      input.style.width = '100%';
      input.addEventListener('change', () => this.onChange({ type: 'rename', id: evt.id, title: input.value }));
      tdTitle.appendChild(input);
      tr.appendChild(tdTitle);

      const tdStart = document.createElement('td');
      tdStart.style.padding = '10px';
      tdStart.textContent = `${new Date(evt.start).toLocaleDateString()} ${formatTimeHM(new Date(evt.start))}`;
      tr.appendChild(tdStart);

      const tdEnd = document.createElement('td');
      tdEnd.style.padding = '10px';
      tdEnd.textContent = `${new Date(evt.end).toLocaleDateString()} ${formatTimeHM(new Date(evt.end))}`;
      tr.appendChild(tdEnd);

      const tdStatus = document.createElement('td');
      tdStatus.style.padding = '10px';
      const sel = document.createElement('select');
      ['scheduled', 'in-progress', 'done', 'canceled'].forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === evt.status) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => this.onChange({ type: 'setStatus', id: evt.id, status: sel.value }));
      tdStatus.appendChild(sel);
      tr.appendChild(tdStatus);

      const tdActions = document.createElement('td');
      tdActions.style.padding = '10px';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-secondary';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => this.onChange({ type: 'deleteEvent', id: evt.id }));
      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      this.tbody.appendChild(tr);
    }
  }
}
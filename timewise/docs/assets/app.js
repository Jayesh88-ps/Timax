import { migrateOrInit, saveState } from './utils/storage.js';
import { formatDayLabel, clampDateToDay, addMinutes } from './utils/time.js';
import { showToast } from './ui/toast.js';
import { TableView } from './ui/table.js';
import { SequencerView } from './ui/sequencer.js';
import { NotificationScheduler } from './scheduler.js';
import { interpretPrompt } from './promptEngine.js';
import { AutomationEngine } from './automation.js';

let state = migrateOrInit();

// Elements
const todayTitle = document.getElementById('today-title');
const todayList = document.getElementById('today-list');
const notifyBtn = document.getElementById('notify-permission-btn');
const promptForm = document.getElementById('prompt-form');
const promptInput = document.getElementById('prompt-input');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings');
const saveSettingsBtn = document.getElementById('save-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const inputLead = document.getElementById('setting-lead');
const inputDayStart = document.getElementById('setting-day-start');
const inputDayEnd = document.getElementById('setting-day-end');
const inputBuffer = document.getElementById('setting-buffer');
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');
const addQuickBtn = document.getElementById('add-quick-btn');

// Views container
const schedulePanel = document.querySelector('.schedule-panel');
const sequencerContainer = document.createElement('div');
const tableContainer = document.createElement('div');
schedulePanel.appendChild(sequencerContainer);
schedulePanel.appendChild(tableContainer);
sequencerContainer.style.marginTop = '12px';
tableContainer.style.marginTop = '12px';

const sequencer = new SequencerView(sequencerContainer, { onChange: handleSequencerChange });
const table = new TableView(tableContainer, { onChange: handleViewChange });

let sequencerStartAt = null; // minutes since midnight

// Settings init
function applySettingsUI() {
  inputLead.value = state.settings.notificationLeadMinutes;
  inputDayStart.value = state.settings.dayStartHour;
  inputDayEnd.value = state.settings.dayEndHour;
  inputBuffer.value = state.settings.bufferMinutes;
}
applySettingsUI();

function getSettings() { return state.settings; }
const automations = new AutomationEngine(getSettings);

// Notification scheduler
const scheduler = new NotificationScheduler(showToast, () => state.settings.notificationLeadMinutes);

notifyBtn.addEventListener('click', async () => {
  const granted = await scheduler.ensurePermission();
  showToast(granted ? 'Notifications enabled' : 'Notifications blocked', granted ? 'We will remind you before each event.' : 'Use in-app toasts instead.');
});

// Prompt form
promptForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = promptInput.value.trim();
  if (!text) return;
  const plan = interpretPrompt(text, state);
  applyOperations(plan.operations);
  promptInput.value = '';
});

for (const chip of document.querySelectorAll('.chip')) {
  chip.addEventListener('click', () => {
    promptInput.value = chip.dataset.suggest;
    promptForm.dispatchEvent(new Event('submit'));
  });
}

// Quick add
addQuickBtn.addEventListener('click', () => {
  promptInput.value = 'Add study block at 6pm for 45m today';
  promptForm.dispatchEvent(new Event('submit'));
});

// Settings panel
settingsToggle.addEventListener('click', () => settingsPanel.hidden = !settingsPanel.hidden);
closeSettingsBtn.addEventListener('click', () => settingsPanel.hidden = true);
saveSettingsBtn.addEventListener('click', () => {
  state.settings.notificationLeadMinutes = Math.max(0, parseInt(inputLead.value, 10) || 0);
  state.settings.dayStartHour = Math.max(0, Math.min(23, parseInt(inputDayStart.value, 10) || 7));
  state.settings.dayEndHour = Math.max(0, Math.min(23, parseInt(inputDayEnd.value, 10) || 22));
  state.settings.bufferMinutes = Math.max(0, parseInt(inputBuffer.value, 10) || 0);
  persistAndRender('Settings saved');
});

// Import/Export
exportBtn.addEventListener('click', () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timewise-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      if (json?.events && json?.settings) {
        state = json;
        persistAndRender('Imported successfully');
      } else {
        showToast('Import failed', 'Invalid file format');
      }
    } catch {
      showToast('Import failed', 'Could not parse file');
    }
  };
  reader.readAsText(file);
});

function handleSequencerChange(action) {
  if (action.type === 'resequence') {
    const idToEvent = new Map(state.events.map(e => [e.id, e]));
    state.events = action.order.map(id => idToEvent.get(id)).filter(Boolean);
    computeSequencedTimes();
    persistAndRender('Reordered');
  } else if (action.type === 'adjustDuration') {
    const e = state.events.find(x => x.id === action.id);
    if (e) {
      const start = new Date(e.start);
      const end = new Date(e.end);
      const newEnd = addMinutes(end, action.deltaMinutes);
      if (newEnd > start) {
        e.end = newEnd.toISOString();
        computeSequencedTimes();
        persistAndRender('Duration updated');
      }
    }
  } else if (action.type === 'togglePin') {
    const e = state.events.find(x => x.id === action.id);
    if (e) { e.pinned = action.pinned; computeSequencedTimes(); persistAndRender('Pin updated'); }
  } else if (action.type === 'setPinnedTime') {
    const e = state.events.find(x => x.id === action.id);
    if (e) {
      const [hh, mm] = action.time.split(':');
      const day = clampDateToDay(new Date(e.start));
      const start = new Date(day);
      start.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
      const duration = (new Date(e.end) - new Date(e.start)) / 60000;
      e.start = start.toISOString();
      e.end = addMinutes(start, duration).toISOString();
      e.pinned = true;
      computeSequencedTimes();
      persistAndRender('Pinned time set');
    }
  } else if (action.type === 'setStartAt') {
    sequencerStartAt = action.minutes;
    computeSequencedTimes();
    persistAndRender('Start time updated');
  } else if (action.type === 'markDone') {
    const e = state.events.find(x => x.id === action.id);
    if (e) e.status = 'done';
    persistAndRender('Marked as done');
  } else if (action.type === 'deleteEvent') {
    state.events = state.events.filter(x => x.id !== action.id);
    persistAndRender('Deleted');
  } else if (action.type === 'rename') {
    const e = state.events.find(x => x.id === action.id);
    if (e) { e.title = action.title; persistAndRender('Renamed'); }
  }
}

function handleViewChange(action) {
  if (action.type === 'deleteEvent') {
    state.events = state.events.filter(x => x.id !== action.id);
    persistAndRender('Deleted');
  } else if (action.type === 'rename') {
    const e = state.events.find(x => x.id === action.id);
    if (e) { e.title = action.title; persistAndRender('Renamed'); }
  } else if (action.type === 'setStatus') {
    const e = state.events.find(x => x.id === action.id);
    if (e) { e.status = action.status; persistAndRender('Status updated'); }
  }
}

function applyOperations(ops) {
  for (const op of ops) {
    if (op.type === 'addEvent') {
      state.events.push(op.event);
    } else if (op.type === 'moveEvent') {
      const e = state.events.find(x => x.id === op.id);
      if (e) { e.start = op.start; e.end = op.end; }
    } else if (op.type === 'deleteByTitle') {
      state.events = state.events.filter(x => !x.title.toLowerCase().includes(op.title.toLowerCase()));
    } else if (op.type === 'shiftDay') {
      const dayIso = op.date;
      state.events = state.events.map(e => {
        const d = new Date(e.start);
        const isSameDay = d.toISOString().slice(0,10) === new Date(dayIso).toISOString().slice(0,10);
        if (!isSameDay) return e;
        const start = new Date(e.start);
        const end = new Date(e.end);
        start.setMinutes(start.getMinutes() + op.deltaMinutes);
        end.setMinutes(end.getMinutes() + op.deltaMinutes);
        return { ...e, start: start.toISOString(), end: end.toISOString() };
      });
    }
  }
  computeSequencedTimes();
  persistAndRender('Applied prompt');
}

function computeSequencedTimes() {
  const today = clampDateToDay(new Date());
  const todays = state.events.filter(e => new Date(e.start).toDateString() === today.toDateString());

  // Separate pinned and flexible tasks
  const pinned = todays.filter(e => e.pinned);
  const flex = todays.filter(e => !e.pinned);

  // Sort pinned by start
  pinned.sort((a,b) => new Date(a.start) - new Date(b.start));

  // Start baseline: sequencerStartAt or first flexible start or now
  let baseline = sequencerStartAt != null ? sequencerStartAt : (new Date().getHours() * 60 + new Date().getMinutes());
  const buffer = state.settings.bufferMinutes || 0;

  const result = [];
  // Place flex tasks before the first pinned if baseline earlier
  const allPinnedMinutes = pinned.map(e => (new Date(e.start).getHours() * 60 + new Date(e.start).getMinutes()));
  let nextMinute = baseline;

  const placeFlexUntil = (limitMinute) => {
    while (flex.length) {
      const task = flex.shift();
      const duration = Math.max(1, Math.round((new Date(task.end) - new Date(task.start)) / 60000));
      const endMinute = nextMinute + duration;
      if (limitMinute != null && endMinute > limitMinute) {
        // Cannot fit; push back and break
        flex.unshift(task);
        break;
      }
      const startDate = new Date(today);
      startDate.setHours(0,0,0,0);
      startDate.setMinutes(nextMinute);
      const endDate = addMinutes(startDate, duration);
      task.start = startDate.toISOString();
      task.end = endDate.toISOString();
      result.push(task);
      nextMinute = endMinute + buffer;
    }
  };

  // Iterate across the day, placing flex blocks around pinned
  for (const pin of pinned) {
    const pinStartMin = new Date(pin.start).getHours() * 60 + new Date(pin.start).getMinutes();
    placeFlexUntil(pinStartMin);
    result.push(pin);
    nextMinute = Math.max(nextMinute, pinStartMin + Math.round((new Date(pin.end) - new Date(pin.start)) / 60000) + buffer);
  }

  // Place remaining flex after last pinned
  placeFlexUntil(null);

  // Merge back into state.events preserving non-today entries
  const nonToday = state.events.filter(e => new Date(e.start).toDateString() !== today.toDateString());
  state.events = nonToday.concat(result);
}

function render() {
  const today = clampDateToDay(new Date());
  todayTitle.textContent = `Today — ${formatDayLabel(today)}`;
  const todays = state.events.filter(e => new Date(e.start).toDateString() === today.toDateString());
  const adjusted = automations.applyAll(todays);

  // Render event list (compact)
  todayList.innerHTML = '';
  for (const e of adjusted.sort((a,b) => new Date(a.start) - new Date(b.start))) {
    const li = document.createElement('li');
    li.className = 'event-item';
    const t = document.createElement('div');
    t.className = 'event-time';
    const start = new Date(e.start);
    const end = new Date(e.end);
    t.textContent = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const title = document.createElement('div');
    title.className = 'event-title' + (e.status === 'done' ? ' event-done' : '');
    title.textContent = e.title;
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    meta.textContent = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const actions = document.createElement('div');
    actions.className = 'event-actions';
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn btn-secondary';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => handleSequencerChange({ type: 'markDone', id: e.id }));
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-secondary';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => handleSequencerChange({ type: 'deleteEvent', id: e.id }));

    actions.appendChild(doneBtn);
    actions.appendChild(delBtn);

    li.appendChild(t);
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(actions);
    todayList.appendChild(li);
  }

  sequencer.setDay(today);
  sequencer.setStartAtMinutes(sequencerStartAt);
  sequencer.setEvents(adjusted);
  table.setEvents(state.events);

  scheduler.schedule(state.events);
}

function persistAndRender(toastMsg) {
  saveState(state);
  if (toastMsg) showToast(toastMsg);
  render();
}

computeSequencedTimes();
render();
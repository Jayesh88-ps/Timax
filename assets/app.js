import { migrateOrInit, saveState, loadState } from './utils/storage.js';
import { formatDayLabel, clampDateToDay } from './utils/time.js';
import { showToast } from './ui/toast.js';
import { TimelineView } from './ui/timeline.js';
import { TableView } from './ui/table.js';
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

// Views
const schedulePanel = document.querySelector('.schedule-panel');
const timelineContainer = document.createElement('div');
const tableContainer = document.createElement('div');
const viewsSwitcher = document.createElement('div');
viewsSwitcher.style.display = 'flex';
viewsSwitcher.style.gap = '6px';
const btnTimeline = document.createElement('button');
btnTimeline.className = 'btn btn-secondary';
btnTimeline.textContent = 'Timeline';
const btnTable = document.createElement('button');
btnTable.className = 'btn btn-secondary';
btnTable.textContent = 'Table';
viewsSwitcher.appendChild(btnTimeline);
viewsSwitcher.appendChild(btnTable);
schedulePanel.querySelector('.panel-header').appendChild(viewsSwitcher);
schedulePanel.appendChild(timelineContainer);
schedulePanel.appendChild(tableContainer);

tableContainer.style.marginTop = '12px';
timelineContainer.style.marginTop = '12px';

const timeline = new TimelineView(timelineContainer, { onChange: handleViewChange });
const table = new TableView(tableContainer, { onChange: handleViewChange });

let currentView = 'timeline';
function setView(name) {
  currentView = name;
  if (name === 'timeline') {
    timelineContainer.style.display = '';
    tableContainer.style.display = 'none';
  } else {
    timelineContainer.style.display = 'none';
    tableContainer.style.display = '';
  }
}
setView('timeline');
btnTimeline.addEventListener('click', () => setView('timeline'));
btnTable.addEventListener('click', () => setView('table'));

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

function handleViewChange(action) {
  if (action.type === 'markDone') {
    const e = state.events.find(x => x.id === action.id);
    if (e) e.status = 'done';
    persistAndRender('Marked as done');
  } else if (action.type === 'deleteEvent') {
    state.events = state.events.filter(x => x.id !== action.id);
    persistAndRender('Deleted');
  } else if (action.type === 'editEvent') {
    const e = state.events.find(x => x.id === action.id);
    if (!e) return;
    const title = prompt('Rename event', e.title) || e.title;
    e.title = title;
    persistAndRender('Updated');
  } else if (action.type === 'rename') {
    const e = state.events.find(x => x.id === action.id);
    if (e) { e.title = action.title; persistAndRender('Renamed'); }
  } else if (action.type === 'setStatus') {
    const e = state.events.find(x => x.id === action.id);
    if (e) { e.status = action.status; persistAndRender('Status updated'); }
  } else if (action.type === 'updateTime') {
    const e = state.events.find(x => x.id === action.id);
    if (e) {
      e.start = action.start.toISOString();
      e.end = action.end.toISOString();
      persistAndRender('Rescheduled');
    }
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
  persistAndRender('Applied prompt');
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
    doneBtn.addEventListener('click', () => handleViewChange({ type: 'markDone', id: e.id }));
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => handleViewChange({ type: 'editEvent', id: e.id }));
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-secondary';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => handleViewChange({ type: 'deleteEvent', id: e.id }));

    actions.appendChild(doneBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(t);
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(actions);
    todayList.appendChild(li);
  }

  timeline.setDay(today);
  timeline.setEvents(adjusted);
  table.setEvents(state.events);

  scheduler.schedule(state.events);
}

function persistAndRender(toastMsg) {
  saveState(state);
  if (toastMsg) showToast(toastMsg);
  render();
}

render();
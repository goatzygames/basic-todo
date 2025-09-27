/* main.js — Pro To-Do App
   Features:
   - CRUD tasks + subtasks
   - Due dates, priority, tags, recurring (basic)
   - LocalStorage persistence
   - Drag & drop ordering
   - Search, filter, sort
   - Bulk actions, select, archive
   - Import/export JSON
   - Undo (single-step)
   - Dark mode toggle
   - Optional Notifications (permission required)
*/

/* ---------------------------
   Constants & helpers
   --------------------------- */
const STORAGE_KEY = 'todoApp:v1';
const DEFAULT_STATE = { tasks: [], version: 1 };
let state = loadState();
let undoStack = [];
const app = document.getElementById('app');

function uid(prefix = '') {
  // safe unique id
  return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
}
function saveState(pushUndo = true) {
  if (pushUndo) {
    // store deep clone for undo
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 50) undoStack.shift();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed load state', e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d)) return '';
  return d.toLocaleString();
}
function daysBetween(aIso, b = new Date()) {
  const a = new Date(aIso);
  const bD = new Date(b);
  const diff = Math.floor((a - bD) / (1000 * 60 * 60 * 24));
  return diff;
}
function parseTags(text) {
  if (!text) return [];
  return text.split(',').map(s => s.trim()).filter(Boolean);
}

/* ---------------------------
   DOM refs
   --------------------------- */
/* ---------------------------
   DOM refs
   --------------------------- */
const taskForm = document.getElementById('taskForm');
const titleInput = document.getElementById('title');
const notesInput = document.getElementById('notes');
const dueInput = document.getElementById('due');
const priorityInput = document.getElementById('priority');
const tagsInput = document.getElementById('tags');
const recurringInput = document.getElementById('recurring');
const clearFormBtn = document.getElementById('clearForm');
const taskList = document.getElementById('taskList');
const searchInput = document.getElementById('search');
const showCompletedChk = document.getElementById('showCompleted');
const showArchivedChk = document.getElementById('showArchived');
const viewButtons = document.querySelectorAll('.view-btn');
const sortBySelect = document.getElementById('sortBy');
const selectAllBtn = document.getElementById('selectAll');
const clearCompletedBtn = document.getElementById('clearCompleted');
const archiveCompletedBtn = document.getElementById('archiveCompleted');
const deleteSelectedBtn = document.getElementById('deleteSelected');
const undoBtn = document.getElementById('undo');
const exportBtn = document.getElementById('exportJson');
const importInput = document.getElementById('importJson');
const resetBtn = document.getElementById('resetAll');
const statsContent = document.getElementById('statsContent');
const countActive = document.getElementById('countActive');
const countTotal = document.getElementById('countTotal');
const toastEl = document.getElementById('toast');
const toggleThemeBtn = document.getElementById('toggleTheme');
const saveTaskBtn = document.getElementById('saveTask');

// Edit modal
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editId = document.getElementById('editId');
const editTitle = document.getElementById('editTitle');
const editNotes = document.getElementById('editNotes');
const editDue = document.getElementById('editDue');
const editPriority = document.getElementById('editPriority');
const editTags = document.getElementById('editTags');
const editRecurring = document.getElementById('editRecurring');
const deleteTaskBtn = document.getElementById('deleteTask');
const closeModalBtn = document.getElementById('closeModal');

/* ---------------------------
   State init
   --------------------------- */
// Save initially if missing schema
if (!state.tasks) state.tasks = [];
saveState(false);


/* ---------------------------
   Rendering
   --------------------------- */
function render() {
  // Ensure tasks exist
  state.tasks = state.tasks || [];

  // apply search + filter + sort
  const query = (searchInput.value || '').toLowerCase().trim();
  const showCompleted = showCompletedChk.checked;
  const showArchived = showArchivedChk.checked;
  const activeView = document.querySelector('.view-btn.active')?.dataset.view || 'all';
  const sortBy = sortBySelect.value;

  let list = state.tasks.filter(t => {
    if (!showArchived && t.archived) return false;
    if (!showCompleted && t.completed) return false;
    if (activeView === 'today') {
      if (!t.due) return false;
      const d = new Date(t.due);
      const now = new Date();
      if (d.toDateString() !== now.toDateString()) return false;
    } else if (activeView === 'overdue') {
      if (!t.due) return false;
      if (new Date(t.due) >= new Date()) return false;
    } else if (activeView === 'due7') {
      if (!t.due) return false;
      if (daysBetween(t.due) > 7 || daysBetween(t.due) < 0) return false;
    }
    if (!query) return true;
    const inTitle = t.title.toLowerCase().includes(query);
    const inNotes = (t.notes || '').toLowerCase().includes(query);
    const inTags = (t.tags || []).some(tag => tag.toLowerCase().includes(query));
    return inTitle || inNotes || inTags;
  });

  // sort
  if (sortBy === 'due') {
    list.sort((a,b) => (a.due || '') > (b.due || '') ? 1 : -1);
  } else if (sortBy === 'due_desc') {
    list.sort((a,b) => (a.due || '') < (b.due || '') ? 1 : -1);
  } else if (sortBy === 'priority') {
    const rank = { high: 0, medium: 1, low: 2 };
    list.sort((a,b) => (rank[a.priority] || 1) - (rank[b.priority] || 1));
  } else if (sortBy === 'created') {
    list.sort((a,b) => b.createdAt - a.createdAt);
  } else {
    // keep user order: by 'order' or id
    list.sort((a,b) => (a.order || 0) - (b.order || 0));
  }

  // counts
  const total = state.tasks.filter(t => !t.archived).length;
  const active = state.tasks.filter(t => !t.completed && !t.archived).length;
  countActive.textContent = `${active} active`;
  countTotal.textContent = `${total} total`;

  // statistics
  const completed = state.tasks.filter(t => t.completed && !t.archived).length;
  const overdue = state.tasks.filter(t => t.due && new Date(t.due) < new Date() && !t.completed && !t.archived).length;
  statsContent.innerHTML = `
    <div>Active: ${active}</div>
    <div>Completed: ${completed}</div>
    <div>Overdue: ${overdue}</div>
  `;

  // render list
  taskList.innerHTML = '';
  for (const task of list) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.draggable = true;
    li.dataset.id = task.id;

    // left area
    const left = document.createElement('div');
    left.className = 'task-left';

    const chk = document.createElement('button');
    chk.className = 'checkbox';
    chk.title = task.completed ? 'Mark as incomplete' : 'Mark as complete';
    chk.innerHTML = task.completed ? '✓' : '';
    chk.setAttribute('aria-pressed', String(!!task.completed));
    chk.addEventListener('click', () => toggleComplete(task.id));
    left.appendChild(chk);

    const main = document.createElement('div');
    main.style.flex = '1';

    const h = document.createElement('div');
    h.className = 'task-title';
    if (task.completed) h.classList.add('done');
    h.textContent = task.title;
    h.tabIndex = 0;
    h.addEventListener('dblclick', () => openEditModal(task.id));
    h.addEventListener('keypress', (e) => { if (e.key === 'Enter') openEditModal(task.id);});
    main.appendChild(h);

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    // badges
    if (task.priority) {
      const pri = document.createElement('span');
      pri.className = `badge p-${task.priority === 'high' ? 'high' : task.priority === 'medium' ? 'medium' : 'low'}`;
      pri.textContent = task.priority[0].toUpperCase() + task.priority.slice(1);
      meta.appendChild(pri);
    }
    if (task.due) {
      const dueSpan = document.createElement('span');
      const overdueFlag = new Date(task.due) < new Date() && !task.completed;
      dueSpan.className = 'badge';
      dueSpan.style.background = overdueFlag ? '#fee2e2' : '';
      dueSpan.textContent = 'Due: ' + formatDateTime(task.due);
      meta.appendChild(dueSpan);
    }
    if (task.tags && task.tags.length) {
      const tagsSpan = document.createElement('span');
      tagsSpan.className = 'badge';
      tagsSpan.textContent = task.tags.join(', ');
      meta.appendChild(tagsSpan);
    }
    if (task.recurring) {
      const r = document.createElement('span');
      r.className = 'badge';
      r.textContent = `⟳ ${task.recurring}`;
      meta.appendChild(r);
    }

    if (task.notes) {
      const notesDiv = document.createElement('div');
      notesDiv.textContent = task.notes;
      notesDiv.style.marginTop = '6px';
      notesDiv.style.color = 'var(--muted)';
      notesDiv.style.fontSize = '0.9rem';
      meta.appendChild(notesDiv);
    }

    main.appendChild(meta);

    // subtasks
    if (task.subtasks && task.subtasks.length) {
      const subWrap = document.createElement('div');
      subWrap.className = 'subtasks';
      for (const st of task.subtasks) {
        const sdiv = document.createElement('div');
        sdiv.className = 'subtask';
        const sc = document.createElement('input');
        sc.type = 'checkbox';
        sc.checked = !!st.completed;
        sc.addEventListener('change', () => {
          st.completed = sc.checked;
          saveState(true);
        });
        const sn = document.createElement('div');
        sn.textContent = st.title;
        sn.style.marginLeft = '6px';
        sdiv.appendChild(sc);
        sdiv.appendChild(sn);
        subWrap.appendChild(sdiv);
      }
      main.appendChild(subWrap);
    }

    left.appendChild(main);

    // right area
    const right = document.createElement('div');
    right.className = 'task-right';

    const editBtn = document.createElement('button');
    editBtn.className = 'small';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditModal(task.id));
    right.appendChild(editBtn);

    const quickDel = document.createElement('button');
    quickDel.className = 'small';
    quickDel.textContent = '⋮';
    quickDel.title = 'Quick actions';
    quickDel.addEventListener('click', () => toggleMenu(task, quickDel));
    right.appendChild(quickDel);

    // drag handle
    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.textContent = '☰';
    right.appendChild(handle);

    li.appendChild(left);
    li.appendChild(right);

    // drag & drop events
    li.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', task.id);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
    });
    li.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      li.classList.add('dragover');
    });
    li.addEventListener('dragleave', () => {
      li.classList.remove('dragover');
    });
    li.addEventListener('drop', (ev) => {
      ev.preventDefault();
      li.classList.remove('dragover');
      const draggedId = ev.dataTransfer.getData('text/plain');
      if (!draggedId) return;
      reorder(draggedId, task.id);
    });

    taskList.appendChild(li);
  }
}

/* ---------------------------
   CRUD & actions
   --------------------------- */
function addTask(data) {
  const task = {
    id: uid('t-'),
    title: (data.title || '').trim(),
    notes: (data.notes || '').trim(),
    completed: false,
    due: data.due || null,
    priority: data.priority || 'medium',
    tags: data.tags || [],
    subtasks: data.subtasks || [],
    createdAt: Date.now(),
    order: (state.tasks.length ? Math.max(...state.tasks.map(t=>t.order||0)) + 1 : 0),
    recurring: data.recurring || '',
    archived: false,
  };
  state.tasks.push(task);
  saveState(true);
  toast('Task added');
  requestNotificationIfDueSoon(task);
  return task;
}
function updateTask(id, patch = {}) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return null;
  Object.assign(t, patch);
  saveState(true);
  return t;
}
function deleteTask(id) {
  const idx = state.tasks.findIndex(x => x.id === id);
  if (idx === -1) return false;
  state.tasks.splice(idx, 1);
  saveState(true);
  toast('Task deleted');
  return true;
}
function toggleComplete(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  // apply recurring: if completed and recurring set, create next instance
  if (t.completed && t.recurring) {
    createNextRecurring(t);
  }
  saveState(true);
  toast(t.completed ? 'Completed' : 'Marked incomplete');
}
function createNextRecurring(task) {
  if (!task.recurring || !task.due) return;
  const d = new Date(task.due);
  if (task.recurring === 'daily') d.setDate(d.getDate() + 1);
  else if (task.recurring === 'weekly') d.setDate(d.getDate() + 7);
  else if (task.recurring === 'monthly') d.setMonth(d.getMonth() + 1);
  const newTask = {
    id: uid('t-'),
    title: task.title,
    notes: task.notes,
    completed: false,
    due: d.toISOString(),
    priority: task.priority,
    tags: [...(task.tags||[])],
    subtasks: (task.subtasks || []).map(s => ({id: uid('st-'), title: s.title, completed: false})),
    createdAt: Date.now(),
    order: (state.tasks.length ? Math.max(...state.tasks.map(t=>t.order||0)) + 1 : 0),
    recurring: task.recurring,
    archived: false,
  };
  state.tasks.push(newTask);
  toast('Next recurring task scheduled');
}
function toggleMenu(task, anchor) {
  // simple menu via prompt (keeps UI minimal)
  const action = prompt('Quick action: type "tag:NAME" to add tag, "archive", "duplicate" or leave blank');
  if (!action) return;
  if (action.startsWith('tag:')) {
    const t = action.slice(4).trim();
    if (t) {
      task.tags = task.tags || [];
      if (!task.tags.includes(t)) task.tags.push(t);
      saveState(true);
      toast('Tag added');
    }
  } else if (action === 'archive') {
    task.archived = true;
    saveState(true);
    toast('Archived');
  } else if (action === 'duplicate') {
    const copy = JSON.parse(JSON.stringify(task));
    copy.id = uid('t-');
    copy.createdAt = Date.now();
    state.tasks.push(copy);
    saveState(true);
    toast('Duplicated');
  }
}

/* ---------------------------
   Drag reorder
   --------------------------- */
function reorder(draggedId, targetId) {
  const dragged = state.tasks.find(t => t.id === draggedId);
  const target = state.tasks.find(t => t.id === targetId);
  if (!dragged || !target) return;
  // place dragged before target
  const targetOrder = target.order || 0;
  // bump target and others down
  state.tasks.forEach(t => {
    if (t.order >= targetOrder) t.order = (t.order || 0) + 1;
  });
  dragged.order = targetOrder;
  // re-normalize
  state.tasks.sort((a,b)=> (a.order||0) - (b.order||0)).forEach((t,i)=> t.order = i);
  saveState(true);
}

/* ---------------------------
   UI interactions
   --------------------------- */
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const t = titleInput.value.trim();
  if (!t) { titleInput.focus(); return; }
  const data = {
    title: t,
    notes: notesInput.value.trim(),
    due: dueInput.value ? new Date(dueInput.value).toISOString() : null,
    priority: priorityInput.value,
    tags: parseTags(tagsInput.value),
    recurring: recurringInput.value || '',
    subtasks: [], // small UX: add via edit
  };
  addTask(data);
  taskForm.reset();
  titleInput.focus();
});

clearFormBtn.addEventListener('click', () => taskForm.reset());

searchInput.addEventListener('input', () => render());
showCompletedChk.addEventListener('change', () => render());
showArchivedChk.addEventListener('change', () => render());
sortBySelect.addEventListener('change', () => render());

viewButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    viewButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

selectAllBtn.addEventListener('click', () => {
  // toggles selection by marking a temporary 'selected' property
  const allVisibleIds = Array.from(taskList.querySelectorAll('li')).map(li => li.dataset.id);
  const anySelected = allVisibleIds.some(id => {
    const t = state.tasks.find(x=>x.id===id);
    return t && t._selected;
  });
  allVisibleIds.forEach(id => {
    const t = state.tasks.find(x=>x.id===id);
    if (t) t._selected = !anySelected;
  });
  render(); // re-render will drop visual selection but we manage selection via checkboxes if desired
});

clearCompletedBtn.addEventListener('click', () => {
  const completed = state.tasks.filter(t => t.completed && !t.archived);
  if (!completed.length) { toast('No completed tasks'); return; }
  if (!confirm(`Clear ${completed.length} completed tasks?`)) return;
  completed.forEach(t => {
    const idx = state.tasks.findIndex(x => x.id === t.id);
    if (idx > -1) state.tasks.splice(idx,1);
  });
  saveState(true);
  toast('Completed cleared');
});

archiveCompletedBtn.addEventListener('click', () => {
  const completed = state.tasks.filter(t => t.completed && !t.archived);
  if (!completed.length) { toast('No completed tasks'); return; }
  completed.forEach(t => t.archived = true);
  saveState(true);
  toast('Completed archived');
});

deleteSelectedBtn.addEventListener('click', () => {
  const selected = state.tasks.filter(t => t._selected);
  if (!selected.length) { toast('No selected tasks'); return; }
  if (!confirm(`Delete ${selected.length} tasks permanently? This cannot be undone.`)) return;
  selected.forEach(s => {
    const idx = state.tasks.findIndex(x => x.id === s.id);
    if (idx>-1) state.tasks.splice(idx,1);
  });
  saveState(true);
  toast('Deleted selected');
});

undoBtn.addEventListener('click', () => {
  if (!undoStack.length) { toast('Nothing to undo'); return; }
  const last = undoStack.pop();
  try {
    state = JSON.parse(last);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    toast('Undone');
  } catch (e) {
    console.error(e);
    toast('Failed undo');
  }
});

/* ---------------------------
   Edit modal
   --------------------------- */
function openEditModal(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  editId.value = t.id;
  editTitle.value = t.title;
  editNotes.value = t.notes || '';
  editDue.value = t.due ? toDatetimeLocal(t.due) : '';
  editPriority.value = t.priority || 'medium';
  editTags.value = (t.tags || []).join(', ');
  editRecurring.value = t.recurring || '';
  editModal.setAttribute('aria-hidden', 'false');
  editModal.style.display = 'flex';
  editTitle.focus();
}
function closeModal() {
  editModal.setAttribute('aria-hidden', 'true');
  editModal.style.display = 'none';
}
closeModalBtn.addEventListener('click', closeModal);
editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = editId.value;
  const patch = {
    title: editTitle.value.trim(),
    notes: editNotes.value.trim(),
    due: editDue.value ? new Date(editDue.value).toISOString() : null,
    priority: editPriority.value,
    tags: parseTags(editTags.value),
    recurring: editRecurring.value || ''
  };
  updateTask(id, patch);
  closeModal();
});
deleteTaskBtn.addEventListener('click', () => {
  const id = editId.value;
  if (!confirm('Delete this task?')) return;
  deleteTask(id);
  closeModal();
});

/* ---------------------------
   Import / Export / Reset
   --------------------------- */
exportBtn.addEventListener('click', () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'todo-data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Exported JSON');
});

importInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.tasks) { toast('Invalid file'); return; }
      // merge conservatively
      const existingIds = new Set(state.tasks.map(t=>t.id));
      for (const t of imported.tasks) {
        if (!existingIds.has(t.id)) state.tasks.push(t);
      }
      saveState(true);
      toast('Imported');
    } catch (err) {
      console.error(err);
      toast('Import failed');
    }
  };
  reader.readAsText(file);
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset all data? This will delete your tasks.')) return;
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState(true);
  toast('Reset done');
});

/* ---------------------------
   Utilities & niceties
   --------------------------- */

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d)) return '';
  // produce YYYY-MM-DDTHH:MM
  const pad = n => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth()+1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
}

function toast(msg, ms = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------------------------
   Notifications (optional)
   --------------------------- */
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}
async function notify(title, body) {
  const ok = await requestNotificationPermission();
  if (!ok) return;
  new Notification(title, { body });
}
function requestNotificationIfDueSoon(task) {
  if (!task || !task.due) return;
  const diffMin = (new Date(task.due) - new Date()) / (1000 * 60);
  if (diffMin > 0 && diffMin < 60) {
    notify('Upcoming task: ' + task.title, `Due at ${formatDateTime(task.due)}`);
  }
}

/* ---------------------------
   Helper: keyboard shortcuts
   --------------------------- */
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  } else if (e.key === 'Escape') {
    closeModal();
  } else if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    titleInput.focus();
  }
});

/* ---------------------------
   Theme toggle
   --------------------------- */
function setTheme(dark) {
  if (dark) document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  localStorage.setItem('todo:theme', dark ? 'dark' : 'light');
}
toggleThemeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('todo:theme', isDark ? 'dark' : 'light');
});
const savedTheme = localStorage.getItem('todo:theme');
if (savedTheme === 'dark') setTheme(true);

/* ---------------------------
   Initialization
   --------------------------- */
function initializeSampleIfEmpty() {
  if (state.tasks && state.tasks.length) return;
  // add some sample tasks for first run
  const sample = [
    {
      title: 'Welcome — try adding a task',
      notes: 'This app stores data in your browser localStorage. Export if you want a backup.',
      due: null, priority: 'medium', tags: ['welcome'], recurring: '', subtasks: []
    },
    {
      title: 'Pay bills',
      notes: 'Electricity and internet',
      due: new Date(Date.now() + 24*3600*1000).toISOString(),
      priority: 'high', tags: ['finance'], recurring: 'monthly', subtasks: [{id:uid('st-'),title:'Check amounts',completed:false}]
    }
  ];
  sample.forEach(s => addTask(s));
}

initializeSampleIfEmpty();
render();

/* End of file */

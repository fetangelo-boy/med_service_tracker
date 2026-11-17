/* ============================================================
   МедОфис — учебный трекер задач и KPI
   Ванильный JS, без сборки. Данные хранятся в localStorage.

   Структура файла:
   1. Утилиты и константы
   2. Демо-данные и хранилище
   3. Проверка прав (учебная ролевая модель)
   4. Уведомления
   5. Модальные окна и утилиты UI
   6. Рендер экранов
   7. Действия (изменение данных)
   8. Импорт / экспорт
   9. Обработка событий и запуск
   ============================================================ */

'use strict';

/* ---------- 1. Утилиты и константы ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = (prefix = 'id') => prefix + '_' + Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => iso(new Date());
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const periodNow = () => `${pad(new Date().getMonth() + 1)}/${new Date().getFullYear()}`;
const monthsBack = (n) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysUntil = (s) => {
  if (!s) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((parseISO(s) - today) / 86400000);
};
const fmtDate = (s) => s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '—';
const fmtTime = (ts) => new Date(ts).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
});

const ROLE_NAMES = { director: 'Генеральный директор', head: 'Руководитель отдела', employee: 'Сотрудник' };
const COLOR_NAMES = { green: 'Зелёный', amber: 'Жёлтый', red: 'Красный' };
const TYPE_NAMES = { number: 'Число', percent: 'Процент', date: 'Дата', status: 'Статус', comment: 'Комментарий' };
const PRIORITY_NAMES = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
const DEPT_CLASS = (index) => ['d1', 'd2', 'd3'][index % 3];

// Типы уведомлений: подпись и цвет в центре уведомлений.
const NOTIF_TYPES = {
  comment: { label: 'Комментарий', cls: 'blue' },
  assign: { label: 'Назначение', cls: 'blue' },
  status: { label: 'Статус', cls: 'amber' },
  progress: { label: 'Прогресс', cls: 'green' },
  close: { label: 'Закрытие', cls: 'gray' },
  soon: { label: 'Срок', cls: 'amber' },
  overdue: { label: 'Просрочено', cls: 'red' },
  management: { label: 'Руководство', cls: 'red' }
};
const NOTIF_FILTERS = {
  all: 'Все', comment: 'Комментарии', deadline: 'Сроки', management: 'Руководство'
};

const TITLES = {
  dashboard: 'Дашборд', kpi: 'Панель KPI', tasks: 'Задачи', task: 'Карточка задачи',
  calendar: 'Календарь', reports: 'Отчёты', admin: 'Админка', notifications: 'Уведомления'
};

/* ---------- 2. Демо-данные и хранилище ---------- */

const STORAGE_KEY = 'medoffice_tracker_v1';

function makeEntry(value, comment, by, daysAgo = 1) {
  return {
    value,
    comment: comment || '',
    updatedAt: Date.now() - daysAgo * 86400000,
    updatedBy: by,
    history: [{
      at: Date.now() - daysAgo * 86400000,
      by,
      text: `Установлено значение «${value}»`
    }]
  };
}

function makeTask(data) {
  const now = Date.now();
  return Object.assign({
    id: uid('t'),
    title: '',
    description: '',
    deptId: 'd1',
    assigneeId: null,
    participants: [],
    dueDate: null,
    priority: 'medium',
    color: 'green',
    progress: 0,
    needsManagement: false,
    managementComment: '',
    managementRequestedBy: null,
    comments: [],
    history: [{ at: now, by: 'u_director', text: 'Задача создана' }],
    createdBy: 'u_director',
    createdAt: now,
    updatedAt: now,
    closed: false
  }, data);
}

function seedState() {
  const p = periodNow();
  const pPrev = monthsBack(1);

  const departments = [
    { id: 'd1', name: 'Административный отдел' },
    { id: 'd2', name: 'Сестринский отдел' },
    { id: 'd3', name: 'Медицинский/клинический отдел' }
  ];

  const users = [
    { id: 'u_director', name: 'Елена Миронова', role: 'director', deptId: null },
    { id: 'u_head1', name: 'Анна Соколова', role: 'head', deptId: 'd1' },
    { id: 'u_head2', name: 'Игорь Ким', role: 'head', deptId: 'd2' },
    { id: 'u_head3', name: 'Мария Волкова', role: 'head', deptId: 'd3' },
    { id: 'u_emp1', name: 'Ольга Петрова', role: 'employee', deptId: 'd1' },
    { id: 'u_emp2', name: 'Дмитрий Орлов', role: 'employee', deptId: 'd2' },
    { id: 'u_emp3', name: 'Светлана Белова', role: 'employee', deptId: 'd3' }
  ];

  const kpis = [
    {
      id: 'k1', deptId: 'd1', name: 'Записи на приём за месяц', type: 'number', unit: 'шт',
      target: 150, warning: 120, direction: 'higher', ownerId: 'u_emp1',
      entries: {
        [p]: makeEntry(142, 'Без октябрьского пика, идём по плану', 'u_emp1', 2),
        [pPrev]: makeEntry(138, '', 'u_emp1', 32)
      }
    },
    {
      id: 'k2', deptId: 'd1', name: 'Доля подтверждённых записей', type: 'percent', unit: '%',
      target: 90, warning: 75, direction: 'higher', ownerId: 'u_emp1',
      entries: { [p]: makeEntry(86, 'Не подтвердили 14% записей', 'u_emp1', 2) }
    },
    {
      id: 'k3', deptId: 'd1', name: 'Количество неявок и отмен', type: 'number', unit: 'шт',
      target: 8, warning: 14, direction: 'lower', ownerId: 'u_head1',
      entries: { [p]: makeEntry(11, 'Три повторные неявки — обсудить с руководством', 'u_head1', 3) }
    },
    {
      id: 'k4', deptId: 'd2', name: 'Выполненные процедуры/услуги', type: 'number', unit: 'шт',
      target: 420, warning: 350, direction: 'higher', ownerId: 'u_head2',
      entries: { [p]: makeEntry(398, '', 'u_head2', 1) }
    },
    {
      id: 'k5', deptId: 'd2', name: 'Соблюдение сроков подготовки', type: 'percent', unit: '%',
      target: 95, warning: 85, direction: 'higher', ownerId: 'u_emp2',
      entries: { [p]: makeEntry(91, 'Два случая ожидания анализа', 'u_emp2', 1) }
    },
    {
      id: 'k6', deptId: 'd2', name: 'Инциденты и замечания', type: 'number', unit: 'шт',
      target: 2, warning: 5, direction: 'lower', ownerId: 'u_head2',
      entries: { [p]: makeEntry(1, '', 'u_head2', 4) }
    },
    {
      id: 'k7', deptId: 'd3', name: 'Приёмы врачей за месяц', type: 'number', unit: 'шт',
      target: 260, warning: 210, direction: 'higher', ownerId: 'u_head3',
      entries: { [p]: makeEntry(244, '', 'u_head3', 2) }
    },
    {
      id: 'k8', deptId: 'd3', name: 'Доля выполненных назначений', type: 'percent', unit: '%',
      target: 92, warning: 80, direction: 'higher', ownerId: 'u_emp3',
      entries: { [p]: makeEntry(78, 'Задержка по лаборатории', 'u_emp3', 2) }
    },
    {
      id: 'k9', deptId: 'd3', name: 'Просроченные задачи/замечания', type: 'number', unit: 'шт',
      target: 3, warning: 6, direction: 'lower', ownerId: 'u_head3',
      entries: { [p]: makeEntry(5, '', 'u_head3', 3) }
    }
  ];

  const tasks = [
    makeTask({
      id: 't1', title: 'Подготовить график приёмов на декабрь', deptId: 'd1',
      assigneeId: 'u_emp1', participants: ['u_head1'], dueDate: addDays(3),
      priority: 'high', color: 'amber', progress: 60,
      description: 'Собрать график с учётом отпусков и переносов. Согласовать с руководителем отдела.',
      comments: [{ id: uid('c'), by: 'u_emp1', at: Date.now() - 86400000, text: 'Жду подтверждение по двум врачам.' }]
    }),
    makeTask({
      id: 't2', title: 'Сверить журнал неявок и повторных отмен', deptId: 'd1',
      assigneeId: 'u_emp1', participants: [], dueDate: addDays(-4),
      priority: 'high', color: 'red', progress: 40,
      description: 'Проверить журнал за октябрь–ноябрь, подготовить список повторных неявок.',
      needsManagement: true,
      managementRequestedBy: 'u_head1',
      managementComment: 'Просим решить: штрафовать за повторные неявки или только звонить-напоминать?',
      comments: [{ id: uid('c'), by: 'u_head1', at: Date.now() - 2 * 86400000, text: 'Все повторные случаи вынести на планёрку.' }]
    }),
    makeTask({
      id: 't3', title: 'Обновить памятку для пациентов в зоне ожидания', deptId: 'd1',
      assigneeId: 'u_emp1', participants: [], dueDate: addDays(9),
      priority: 'low', color: 'green', progress: 20,
      description: 'Перепечатать памятку с актуальными часами работы.'
    }),
    makeTask({
      id: 't4', title: 'Проверить комплектность процедурных кабинетов', deptId: 'd2',
      assigneeId: 'u_emp2', participants: ['u_head2'], dueDate: addDays(1),
      priority: 'medium', color: 'amber', progress: 75,
      description: 'Пройти чек-лист по двум кабинетам, отметить отсутствующее.',
      comments: [{ id: uid('c'), by: 'u_emp2', at: Date.now() - 86400000, text: 'В кабинете 2 не хватает одноразовых перчаток.' }]
    }),
    makeTask({
      id: 't5', title: 'Сдать отчёт по инцидентам за ноябрь', deptId: 'd2',
      assigneeId: 'u_head2', participants: [], dueDate: addDays(5),
      priority: 'medium', color: 'green', progress: 30,
      description: 'Сводка по замечаниям и инцидентам за месяц.'
    }),
    makeTask({
      id: 't6', title: 'Согласовать замену лаборанта на декабрь', deptId: 'd2',
      assigneeId: 'u_head2', participants: [], dueDate: addDays(-1),
      priority: 'high', color: 'red', progress: 50,
      description: 'Подобрать замену на период отпуска.',
      needsManagement: true,
      managementRequestedBy: 'u_head2',
      managementComment: 'Нужно решение по бюджету на внешнего лаборанта.'
    }),
    makeTask({
      id: 't7', title: 'Закрыть просроченные назначения по трём пациентам', deptId: 'd3',
      assigneeId: 'u_emp3', participants: ['u_head3'], dueDate: addDays(2),
      priority: 'high', color: 'red', progress: 45,
      description: 'Сверить назначения, закрыть выполненные и напомнить врачам по остальным.'
    }),
    makeTask({
      id: 't8', title: 'Подготовить проект графика отпусков врачей', deptId: 'd3',
      assigneeId: 'u_head3', participants: [], dueDate: addDays(12),
      priority: 'low', color: 'green', progress: 10,
      description: 'Собрать заявки и согласовать с административным отделом.'
    }),
    makeTask({
      id: 't9', title: 'Провести мини-инструктаж по новому регламенту', deptId: 'd3',
      assigneeId: 'u_emp3', participants: [], dueDate: addDays(-8),
      priority: 'medium', color: 'amber', progress: 100,
      description: 'Короткий инструктаж для медсестёр по обновлённому регламенту.',
      closed: true
    })
  ];

  return { version: 1, departments, users, kpis, tasks, notifications: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.departments) || !Array.isArray(parsed.tasks)) return null;
    return parsed;
  } catch (err) {
    console.warn('Не удалось прочитать сохранённые данные:', err);
    return null;
  }
}

let state = loadState() || seedState();
let ui = {
  section: 'dashboard',
  currentUserId: 'u_director',
  taskId: null,
  taskFilter: { q: '', dept: 'all', color: 'all', assignee: 'all', closed: false },
  kpiPeriod: periodNow(),
  reportDept: 'd1',
  reportPeriod: periodNow(),
  reportTab: 'dept',
  notifFilter: 'all',
  adminTab: 'depts',
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  importRows: null,
  modal: null
};

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Не удалось сохранить данные:', err);
    toast('Не удалось сохранить данные в браузере');
  }
}

/* ---------- 3. Проверка прав (учебная ролевая модель) ---------- */

function currentUser() {
  return state.users.find((u) => u.id === ui.currentUserId) || state.users[0];
}
const isDirector = () => currentUser().role === 'director';
const isHead = () => currentUser().role === 'head';
const isEmployee = () => currentUser().role === 'employee';
const myDept = () => currentUser().deptId;

function canSeeDept(deptId) {
  return isDirector() || deptId === myDept();
}
function canEditTask(task) {
  if (isDirector()) return true;
  if (isHead()) return task.deptId === myDept();
  return false;
}
function canTouchTask(task) {
  const u = currentUser();
  if (isDirector()) return true;
  if (isHead()) return task.deptId === myDept();
  return task.assigneeId === u.id || (task.participants || []).includes(u.id);
}
function canManageSettings() { return isDirector(); }

function visibleDepartments() {
  return state.departments.filter((d) => canSeeDept(d.id));
}
function visibleTasks() {
  return state.tasks.filter((t) => canSeeDept(t.deptId));
}
function visibleKpis() {
  return state.kpis.filter((k) => canSeeDept(k.deptId));
}
function userName(id) {
  const u = state.users.find((x) => x.id === id);
  return u ? u.name : '—';
}
function deptName(id) {
  const d = state.departments.find((x) => x.id === id);
  return d ? d.name : '—';
}
function deptClass(id) {
  const i = state.departments.findIndex((d) => d.id === id);
  return DEPT_CLASS(i < 0 ? 0 : i);
}

/* ---------- 4. Уведомления ---------- */

/**
 * Создаёт уведомление. taskId и authorId нужны, чтобы пользователь мог
 * перейти прямо к задаче и видеть, кто написал/изменил.
 */
function pushNotification(type, text, userIds, key, taskId, authorId) {
  if (key && state.notifications.some((n) => n.key === key)) return;
  state.notifications.unshift({
    id: uid('n'), type, text,
    userIds: Array.from(new Set(userIds)),
    at: Date.now(), readBy: [], key,
    taskId: taskId || null,
    authorId: authorId || null
  });
  if (state.notifications.length > 150) state.notifications.length = 150;
  save();
}

const directorIds = () => state.users.filter((u) => u.role === 'director').map((u) => u.id);
const deptHeadIds = (deptId) => state.users
  .filter((u) => u.role === 'head' && u.deptId === deptId)
  .map((u) => u.id);

/**
 * Все пользователи, которых касается задача:
 * автор, ответственный, соисполнители, участники переписки,
 * инициатор запроса к руководству и руководитель отдела.
 */
function threadUserIds(task) {
  const ids = [
    task.createdBy,
    task.assigneeId,
    ...(task.participants || []),
    ...(task.comments || []).map((c) => c.by)
  ];
  if (task.managementRequestedBy) ids.push(task.managementRequestedBy);
  ids.push(...deptHeadIds(task.deptId));
  return Array.from(new Set(ids.filter(Boolean)));
}

/** Адресаты события. director — добавить директора, all — всех пользователей. */
function recipientIds(task, options) {
  const opts = options || {};
  const ids = [...threadUserIds(task)];
  if (opts.director) ids.push(...directorIds());
  if (opts.all) ids.push(...state.users.map((u) => u.id));
  return Array.from(new Set(ids));
}

/** Короткая выдержка комментария для уведомления. */
function shortText(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  const limit = max || 140;
  return s.length > limit ? s.slice(0, limit) + '…' : s;
}

function syncAutoNotifications() {
  const today = todayISO();
  state.tasks.forEach((t) => {
    if (t.closed) return;
    const d = daysUntil(t.dueDate);
    const linked = recipientIds(t, { director: true });
    if (d !== null && d < 0) {
      pushNotification('overdue', `Просрочена задача «${t.title}» (срок ${fmtDate(t.dueDate)})`,
        linked, `overdue:${t.id}:${today}`, t.id);
    } else if (d !== null && d <= 3) {
      pushNotification('soon', `Срок по задаче «${t.title}» — ${fmtDate(t.dueDate)}`,
        recipientIds(t), `soon:${t.id}:${today}`, t.id);
    }
    if (t.needsManagement) {
      pushNotification('management', `Требуется решение руководства: «${t.title}»`,
        Array.from(new Set([...directorIds(), ...deptHeadIds(t.deptId), ...(t.managementRequestedBy ? [t.managementRequestedBy] : [])])),
        `mgmt:${t.id}:${today}`, t.id, t.managementRequestedBy);
    }
  });
  save();
}

function myNotifications() {
  const id = currentUser().id;
  return state.notifications.filter((n) => n.userIds.includes(id));
}
function unreadNotifications() {
  const id = currentUser().id;
  return myNotifications().filter((n) => !n.readBy.includes(id));
}

/* ---------- 5. Модальные окна и утилиты UI ---------- */

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

function showModal({ title, body, confirmText = 'Сохранить', onConfirm, wide = false, danger = false }) {
  ui.modal = { onConfirm };
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  $('#modal').classList.toggle('wide', wide);
  $('#modalFoot').innerHTML =
    '<button class="btn" data-action="close-modal">Отмена</button>' +
    `<button class="btn ${danger ? 'danger' : 'primary'}" data-action="modal-confirm">${esc(confirmText)}</button>`;
  $('#modalBackdrop').hidden = false;
  const first = $('#modalBody input, #modalBody select, #modalBody textarea');
  if (first) first.focus();
}

function closeModal() {
  $('#modalBackdrop').hidden = true;
  ui.modal = null;
}

function downloadFile(name, content, mime) {
  const blob = new Blob(['\uFEFF' + content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function kpiStatus(k, period) {
  const e = (k.entries || {})[period || ui.kpiPeriod];
  if (!e || e.value === '' || e.value == null) return 'neutral';
  if (k.type === 'status') return ['green', 'amber', 'red'].includes(e.value) ? e.value : 'neutral';
  if (k.type === 'date' || k.type === 'comment') return 'neutral';
  const v = Number(e.value), target = Number(k.target), warning = Number(k.warning);
  if (!isFinite(v) || !isFinite(target)) return 'neutral';
  if (k.direction === 'lower') {
    if (v <= target) return 'green';
    if (isFinite(warning) && v <= warning) return 'amber';
    return 'red';
  }
  if (v >= target) return 'green';
  if (isFinite(warning) && v >= warning) return 'amber';
  return 'red';
}

function kpiValueText(k, period) {
  const e = (k.entries || {})[period || ui.kpiPeriod];
  if (!e || e.value === '' || e.value == null) return '—';
  let v = e.value;
  if (k.type === 'status') v = { green: 'Зелёный', amber: 'Жёлтый', red: 'Красный' }[v] || v;
  if (k.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) v = fmtDate(v);
  if (k.type === 'percent') v = `${v} %`;
  if (k.type === 'number' && k.unit) v = `${v} ${k.unit}`;
  return v;
}

function statusPill(status, text) {
  const cls = ['green', 'amber', 'red'].includes(status) ? status : 'gray';
  return `<span class="pill ${cls}"><span class="dot ${cls}"></span>${esc(text || COLOR_NAMES[status] || 'Нет данных')}</span>`;
}

function progressBar(value, color) {
  const cls = ['green', 'amber', 'red'].includes(color) ? color : '';
  return `<div class="progress"><div class="progress-track"><div class="progress-fill ${cls}" style="width:${Number(value) || 0}%"></div></div><span class="progress-val">${Number(value) || 0}%</span></div>`;
}

function dueText(task) {
  if (!task.dueDate) return '<span class="muted">не задан</span>';
  const d = daysUntil(task.dueDate);
  if (task.closed) return `<span class="muted">${fmtDate(task.dueDate)}</span>`;
  if (d < 0) return `<span class="overdue">${fmtDate(task.dueDate)} · просрочено</span>`;
  if (d === 0) return '<span class="soon">сегодня</span>';
  if (d <= 3) return `<span class="soon">${fmtDate(task.dueDate)} · через ${d} дн.</span>`;
  return `<span>${fmtDate(task.dueDate)}</span>`;
}

function optionsFrom(list, selected, labelFn) {
  return list.map((item) => {
    const value = typeof item === 'string' ? item : item.id;
    const label = labelFn ? labelFn(item) : value;
    return `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

/* ---------- 6. Рендер экранов ---------- */

function renderNav() {
  const open = visibleTasks().filter((t) => !t.closed).length;
  const items = [
    { id: 'dashboard', icon: '▦', label: 'Дашборд' },
    { id: 'kpi', icon: '◉', label: 'Панель KPI' },
    { id: 'tasks', icon: '☑', label: 'Задачи', count: open },
    { id: 'calendar', icon: '▤', label: 'Календарь' },
    { id: 'reports', icon: '▣', label: 'Отчёты' }
  ];
  if (canManageSettings()) items.push({ id: 'admin', icon: '⚙', label: 'Админка' });
  const unread = unreadNotifications().length;
  items.push({ id: 'notifications', icon: '🔔', label: 'Уведомления', count: unread || null });

  $('#nav').innerHTML = items.map((it) => `
    <button class="nav-item${ui.section === it.id || (ui.section === 'task' && it.id === 'tasks') ? ' active' : ''}"
            data-action="nav" data-section="${it.id}">
      <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
      ${it.count ? `<span class="nav-count">${it.count}</span>` : ''}
    </button>`).join('');
}

function renderUserSwitch() {
  const sel = $('#userSwitch');
  sel.innerHTML = state.users.map((u) => {
    const suffix = u.deptId ? ` · ${deptName(u.deptId)}` : '';
    return `<option value="${esc(u.id)}"${u.id === ui.currentUserId ? ' selected' : ''}>${esc(u.name)} · ${ROLE_NAMES[u.role]}${esc(suffix)}</option>`;
  }).join('');
}

function renderBadge() {
  const n = unreadNotifications().length;
  const badge = $('#notifBadge');
  badge.hidden = n === 0;
  badge.textContent = n > 99 ? '99+' : n;
}

function render() {
  renderNav();
  renderUserSwitch();
  renderBadge();
  $('#pageTitle').textContent = TITLES[ui.section] || 'Дашборд';
  const content = $('#content');
  switch (ui.section) {
    case 'dashboard': content.innerHTML = renderDashboard(); break;
    case 'kpi': content.innerHTML = renderKpi(); break;
    case 'tasks': content.innerHTML = renderTasks(); break;
    case 'task': content.innerHTML = renderTaskCard(); break;
    case 'calendar': content.innerHTML = renderCalendar(); break;
    case 'reports': content.innerHTML = renderReports(); break;
    case 'admin': content.innerHTML = renderAdmin(); break;
    case 'notifications': content.innerHTML = renderNotifications(); break;
    default: content.innerHTML = renderDashboard();
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ----- Дашборд ----- */

function renderDashboard() {
  const tasks = visibleTasks().filter((t) => !t.closed);
  const overdue = tasks.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0).length;
  const mgmt = tasks.filter((t) => t.needsManagement).length;
  const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + (Number(t.progress) || 0), 0) / tasks.length) : 0;
  const user = currentUser();

  const stats = [
    { label: 'Открытые задачи', value: tasks.length, icon: '☑', cls: '', foot: 'без учёта закрытых' },
    { label: 'Просрочено', value: overdue, icon: '!', cls: 'red', foot: 'срок уже прошёл' },
    { label: 'Требуют руководства', value: mgmt, icon: '★', cls: 'amber', foot: 'нужно решение' },
    { label: 'Средний прогресс', value: avg + '%', icon: '↗', cls: 'green', foot: 'по открытым задачам' }
  ].map((s) => `
    <div class="card stat ${s.cls}">
      <div class="stat-top"><span class="stat-label">${s.label}</span><span class="stat-icon">${s.icon}</span></div>
      <div class="stat-value">${s.value}</div><div class="stat-foot">${s.foot}</div>
    </div>`).join('');

  const kpiPanel = visibleDepartments().map((d) => {
    const kpis = visibleKpis().filter((k) => k.deptId === d.id).slice(0, 3);
    const chips = kpis.map((k) => {
      const st = kpiStatus(k);
      return `<button class="chip kpi-chip" data-action="nav" data-section="kpi" title="${esc(k.name)}"
                      style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 9px;margin:0 6px 6px 0;cursor:pointer;font-size:11px">
                <span class="dot ${['green','amber','red'].includes(st) ? st : 'gray'}"></span>
                ${esc(k.name.length > 26 ? k.name.slice(0, 25) + '…' : k.name)} <b>${esc(kpiValueText(k))}</b>
              </button>`;
    }).join('');
    return `<div style="margin-bottom:14px">
      <div class="small" style="font-weight:650;margin-bottom:6px"><span class="dot ${deptClass(d.id)}"></span> ${esc(d.name)}</div>
      <div>${chips || '<span class="muted small">KPI не настроены</span>'}</div>
    </div>`;
  }).join('');

  const upcoming = tasks.slice().sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.dueDate ? -1 : 1;
  }).slice(0, 5);
  const upcomingHtml = upcoming.map((t) => `
    <div class="admin-row" style="cursor:pointer" data-action="open-task" data-id="${esc(t.id)}">
      <span class="dot ${t.color}"></span>
      <div class="grow"><div class="task-title">${esc(t.title)}</div><div class="tiny muted">${esc(deptName(t.deptId))} · ${esc(userName(t.assigneeId))}</div></div>
      <div class="small nowrap">${dueText(t)}</div>
    </div>`).join('') || '<div class="empty">Открытых задач нет</div>';

  const roleHint = isDirector()
    ? 'Вы видите все отделы, все KPI и отчёт генерального директора. Доступны настройки и импорт.'
    : isHead()
      ? `Вы видите отдел «${esc(deptName(myDept()))}». Можно создавать задачи, менять статус и прогресс, готовить отчёт отдела.`
      : 'Вы видите задачи своего отдела. Можно менять прогресс, статус, писать комментарии и запрашивать решение руководства.';

  return `
    <div class="page-head">
      <div><h1>Здравствуйте, ${esc(user.name.split(' ')[0])}</h1>
        <p>${esc(ROLE_NAMES[user.role])} · ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
      <div class="page-actions">
        <button class="btn" data-action="nav" data-section="tasks">Все задачи</button>
        ${canEditTask({ deptId: myDept() }) ? '<button class="btn primary" data-action="new-task">+ Новая задача</button>' : ''}
      </div>
    </div>
    <div class="grid cols-4">${stats}</div>
    <div class="grid main-layout" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>KPI по отделам</h2><span class="card-sub">период ${esc(ui.kpiPeriod)}</span></div>${kpiPanel}</div>
      <div class="card"><div class="card-head"><h2>Ближайшие задачи</h2><button class="btn sm" data-action="nav" data-section="tasks">Открыть список</button></div>${upcomingHtml}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Как пользоваться</h2><span class="card-sub">учебная версия</span></div>
      <div class="small muted">${roleHint}</div>
      <div class="small muted" style="margin-top:6px">Переключатель «Вы вошли как» вверху экрана позволяет посмотреть интерфейс глазами каждой роли. Пароль не требуется — вход выполняется автоматически.</div>
    </div>`;
}

/* ----- KPI ----- */

function renderKpi() {
  const periods = Array.from({ length: 6 }, (_, i) => monthsBack(i));
  const head = `
    <div class="page-head">
      <div><h1>Панель KPI</h1><p>Показатели отделов за выбранный месяц. Отклонение подсвечивается, но не создаёт задачи автоматически.</p></div>
      <div class="page-actions">
        <select id="kpiPeriod" data-action="change-kpi-period" style="border:1px solid var(--line);border-radius:8px;padding:9px 10px;background:#fff">
          ${optionsFrom(periods, ui.kpiPeriod, (p) => 'Период: ' + p)}
        </select>
        ${canManageSettings() ? '<button class="btn" data-action="import-open">Импорт CSV</button><button class="btn primary" data-action="admin-tab" data-tab="kpis">Настроить KPI</button>' : ''}
      </div>
    </div>`;

  const blocks = visibleDepartments().map((d) => {
    const kpis = visibleKpis().filter((k) => k.deptId === d.id);
    const cards = kpis.map((k) => {
      const st = kpiStatus(k);
      const e = (k.entries || {})[ui.kpiPeriod];
      const action = canManageSettings()
        ? `<button class="btn sm" data-action="kpi-entry" data-id="${esc(k.id)}">Ввести</button>`
        : '';
      return `
        <div class="card kpi-card ${st}">
          <div class="kpi-name">${esc(k.name)}</div>
          <div class="kpi-value">${esc(kpiValueText(k))}</div>
          <div class="kpi-target">Цель: ${esc(k.target)} · жёлтый: ${esc(k.warning)} · ${esc(TYPE_NAMES[k.type])}${k.unit && k.type === 'number' ? ' · ' + esc(k.unit) : ''}</div>
          <div class="kpi-comment">${e && e.comment ? '«' + esc(e.comment) + '»' : '&nbsp;'}</div>
          <div class="kpi-foot">
            ${statusPill(st, e ? COLOR_NAMES[st] || 'Нет данных' : 'Нет данных')}
            <span style="display:flex;gap:5px">
              <button class="btn sm" data-action="kpi-history" data-id="${esc(k.id)}">История</button>${action}
            </span>
          </div>
          ${e ? `<div class="tiny muted" style="padding:6px 0 0 8px">Обновил ${esc(userName(e.updatedBy))} · ${esc(fmtTime(e.updatedAt))}</div>` : ''}
        </div>`;
    }).join('');
    return `<div class="dept-block">
      <div class="dept-title"><span class="dot ${deptClass(d.id)}"></span><h2>${esc(d.name)}</h2>
        <span class="pill gray">${kpis.length} KPI</span></div>
      <div class="grid cols-3">${cards || '<div class="empty">KPI не настроены</div>'}</div>
    </div>`;
  }).join('');

  return head + blocks;
}

/* ----- Задачи ----- */

function renderTasks() {
  const f = ui.taskFilter;
  let tasks = visibleTasks();
  if (f.q) {
    const q = f.q.toLowerCase();
    tasks = tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }
  if (f.dept !== 'all') tasks = tasks.filter((t) => t.deptId === f.dept);
  if (f.color !== 'all') tasks = tasks.filter((t) => t.color === f.color);
  if (f.assignee !== 'all') tasks = tasks.filter((t) => t.assigneeId === f.assignee);
  if (!f.closed) tasks = tasks.filter((t) => !t.closed);

  const usersForFilter = state.users.filter((u) => visibleDepartments().some((d) => d.id === u.deptId) || u.role === 'director');

  const rows = tasks.map((t) => {
    const cls = deptClass(t.deptId);
    return `<tr class="task-row">
      <td>
        <span class="row-link" data-action="open-task" data-id="${esc(t.id)}">${esc(t.title)}</span>
        <div class="task-meta">
          <span class="pill ${t.closed ? 'gray' : t.color}"><span class="dot ${t.closed ? 'gray' : t.color}"></span>${t.closed ? 'Закрыта' : COLOR_NAMES[t.color]}</span>
          <span class="pill ${cls}">${esc(deptName(t.deptId))}</span>
          ${t.assigneeId === currentUser().id || (t.participants || []).includes(currentUser().id)
            ? '<span class="pill blue">Моя</span>' : ''}
          <span class="pill ${PRIORITY_NAMES[t.priority] === 'Высокий' ? 'red' : PRIORITY_NAMES[t.priority] === 'Средний' ? 'amber' : 'gray'}">${esc(PRIORITY_NAMES[t.priority])}</span>
          ${t.needsManagement ? '<span class="pill amber">★ Требует руководства</span>' : ''}
        </div>
      </td>
      <td>${esc(userName(t.assigneeId))}</td>
      <td class="nowrap">${dueText(t)}</td>
      <td>${progressBar(t.progress, t.color)}</td>
      <td><button class="btn sm" data-action="open-task" data-id="${esc(t.id)}">Открыть</button></td>
    </tr>`;
  }).join('');

  return `
    <div class="page-head">
      <div><h1>Задачи</h1><p>Цвет и прогресс задаются независимо и сохраняются в истории.</p></div>
      <div class="page-actions">
        <button class="btn" data-action="nav" data-section="calendar">Календарь</button>
        ${canEditTask({ deptId: myDept() }) ? '<button class="btn primary" data-action="new-task">+ Новая задача</button>' : ''}
      </div>
    </div>
    <div class="card">
      <div class="filters">
        <input type="search" id="fq" placeholder="Поиск по названию" value="${esc(f.q)}">
        <select id="fdept"><option value="all">Все отделы</option>${optionsFrom(visibleDepartments(), f.dept, (d) => d.name)}</select>
        <select id="fcolor"><option value="all">Любой цвет</option>${optionsFrom(['green', 'amber', 'red'], f.color, (c) => COLOR_NAMES[c])}</select>
        <select id="fassignee"><option value="all">Все ответственные</option>${optionsFrom(usersForFilter, f.assignee, (u) => u.name)}</select>
        <label class="checkline"><input type="checkbox" id="fclosed"${f.closed ? ' checked' : ''}> Показывать закрытые</label>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>Задача</th><th>Ответственный</th><th>Срок</th><th>Прогресс</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5"><div class="empty">Задач по фильтрам не найдено</div></td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

/* ----- Карточка задачи ----- */

function renderTaskCard() {
  const t = state.tasks.find((x) => x.id === ui.taskId);
  if (!t || !canSeeDept(t.deptId)) {
    ui.section = 'tasks';
    return renderTasks();
  }
  const editable = canEditTask(t);
  const touch = canTouchTask(t);
  const cls = deptClass(t.deptId);

  const comments = (t.comments || []).map((c) => `
    <div class="comment">
      <div class="comment-head"><span class="comment-author">${esc(userName(c.by))}</span><span class="comment-time">${esc(fmtTime(c.at))}</span></div>
      <div class="comment-text">${esc(c.text)}</div>
    </div>`).join('') || '<div class="empty small">Комментариев пока нет</div>';

  const history = (t.history || []).slice().reverse().map((h) => `
    <li><b>${esc(h.text)}</b><span class="muted">${esc(userName(h.by))} · ${esc(fmtTime(h.at))}</span></li>`).join('');

  const flag = t.needsManagement ? `
    <div class="flag-box"><span class="flag-icon">★</span><div>
      <strong>Требуется решение руководства</strong>
      <p>${esc(t.managementComment || 'Комментарий не указан')}</p>
      ${touch ? '<button class="btn sm" style="margin-top:8px" data-action="clear-flag" data-id="' + esc(t.id) + '">Снять флаг</button>' : ''}
    </div></div>` : '';

  const colorSwitch = touch ? `
    <div class="color-switch">
      ${['green', 'amber', 'red'].map((c) => `<button class="color-btn ${c}${t.color === c ? ' sel' : ''}" data-action="set-color" data-id="${esc(t.id)}" data-color="${c}" title="${COLOR_NAMES[c]}"><span class="dot ${c}"></span></button>`).join('')}
    </div>` : statusPill(t.color);

  const progressControl = touch ? `
    <input type="range" min="0" max="100" step="5" value="${Number(t.progress) || 0}" data-action="set-progress" data-id="${esc(t.id)}" id="progressRange">
    <div class="small muted" id="progressLabel">Прогресс: <b>${Number(t.progress) || 0}%</b></div>`
    : progressBar(t.progress, t.color);

  const commentForm = touch ? `
    <div class="field" style="margin-top:14px">
      <label for="newComment">Добавить комментарий</label>
      <textarea id="newComment" placeholder="Ход выполнения, уточнение или вопрос"></textarea>
    </div>
    <button class="btn primary sm" data-action="add-comment" data-id="${esc(t.id)}">Отправить комментарий</button>` : '';

  return `
    <div class="page-head">
      <div>
        <button class="btn sm" data-action="nav" data-section="tasks">← К списку задач</button>
        <h1 style="margin-top:10px">${esc(t.title)}</h1>
        <div class="task-meta" style="margin-top:8px">
          <span class="pill ${cls}">${esc(deptName(t.deptId))}</span>
          ${statusPill(t.closed ? 'gray' : t.color, t.closed ? 'Закрыта' : COLOR_NAMES[t.color])}
          <span class="pill ${PRIORITY_NAMES[t.priority] === 'Высокий' ? 'red' : PRIORITY_NAMES[t.priority] === 'Средний' ? 'amber' : 'gray'}">${esc(PRIORITY_NAMES[t.priority])} приоритет</span>
          ${t.needsManagement ? '<span class="pill amber">★ Руководство</span>' : ''}
        </div>
      </div>
      <div class="page-actions">
        ${editable ? `<button class="btn" data-action="edit-task" data-id="${esc(t.id)}">Редактировать</button>
          <button class="btn ${t.closed ? '' : 'primary'}" data-action="toggle-close" data-id="${esc(t.id)}">${t.closed ? 'Открыть заново' : 'Закрыть задачу'}</button>` : ''}
      </div>
    </div>

    <div class="grid main-layout">
      <div>
        <div class="card">
          <div class="card-head"><h2>Описание</h2></div>
          <div class="small" style="white-space:pre-wrap">${esc(t.description || 'Описание не заполнено')}</div>
          <div class="grid cols-2" style="margin-top:16px">
            <div><div class="tiny muted">Ответственный</div><div style="font-weight:600">${esc(userName(t.assigneeId))}</div></div>
            <div><div class="tiny muted">Участники</div><div style="font-weight:600">${(t.participants || []).map(userName).join(', ') || '—'}</div></div>
            <div><div class="tiny muted">Срок</div><div>${dueText(t)}</div></div>
            <div><div class="tiny muted">Создана</div><div class="small">${esc(userName(t.createdBy))} · ${esc(fmtTime(t.createdAt))}</div></div>
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="card-head"><h2>Комментарии и ход выполнения</h2><span class="card-sub">${(t.comments || []).length} записей</span></div>
          ${comments}${commentForm}
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-head"><h2>Статус и прогресс</h2></div>
          <div class="tiny muted" style="margin-bottom:6px">Цветовой индикатор</div>
          ${colorSwitch}
          <div style="height:14px"></div>
          <div class="tiny muted" style="margin-bottom:6px">Ползунок прогресса</div>
          ${progressControl}
          ${flag}
          ${touch && !t.needsManagement ? `<button class="btn sm" data-action="ask-management" data-id="${esc(t.id)}">★ Запросить решение руководства</button>` : ''}
          ${!touch ? '<div class="tiny muted" style="margin-top:10px">Изменять может только ответственный, руководитель отдела или генеральный директор.</div>' : ''}
        </div>

        <div class="card" style="margin-top:16px">
          <div class="card-head"><h2>История изменений</h2></div>
          <ul class="timeline">${history || '<li class="muted">Изменений нет</li>'}</ul>
        </div>
      </div>
    </div>`;
}

/* ----- Календарь ----- */

function renderCalendar() {
  const year = ui.calendarYear, month = ui.calendarMonth;
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // понедельник — первый день
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const tasks = visibleTasks();
  const today = todayISO();

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="cal-cell other"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${pad(month + 1)}-${pad(day)}`;
    const dayTasks = tasks.filter((t) => t.dueDate === date);
    const chips = dayTasks.slice(0, 2).map((t) => `
      <button class="cal-chip ${t.closed ? '' : t.color}" data-action="open-task" data-id="${esc(t.id)}" title="${esc(t.title)}">
        ${t.needsManagement ? '★ ' : ''}${esc(t.title)}
      </button>`).join('');
    cells.push(`<div class="cal-cell${date === today ? ' today' : ''}">
      <div class="cal-day">${day}${dayTasks.length > 2 ? ' · +' + (dayTasks.length - 2) : ''}</div>${chips}</div>`);
  }

  const monthName = new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return `
    <div class="page-head">
      <div><h1>Календарь сроков</h1><p>Упрощённый вид: задачи показаны в день своего срока.</p></div>
      <div class="page-actions"><button class="btn" data-action="nav" data-section="tasks">Список задач</button></div>
    </div>
    <div class="card">
      <div class="cal-head">
        <button class="btn sm" data-action="cal-prev">← Предыдущий</button>
        <h2 style="margin:0;text-transform:capitalize">${esc(monthName)}</h2>
        <button class="btn sm" data-action="cal-next">Следующий →</button>
      </div>
      <div class="cal-grid">
        ${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells.join('')}
      </div>
    </div>`;
}

/* ----- Отчёты ----- */

function reportTasksTable(tasks) {
  return `<div class="table-wrap"><table><thead><tr>
    <th>Задача</th><th>Отдел</th><th>Ответственный</th><th>Срок</th><th>Статус</th><th>Прогресс</th><th>Комментарии</th>
  </tr></thead><tbody>${tasks.map((t) => `
    <tr>
      <td><b>${esc(t.title)}</b>${t.needsManagement ? '<div class="tiny" style="color:var(--amber)">★ Требует решения руководства: ' + esc(t.managementComment) + '</div>' : ''}</td>
      <td>${esc(deptName(t.deptId))}</td><td>${esc(userName(t.assigneeId))}</td><td>${dueText(t)}</td>
      <td>${statusPill(t.closed ? 'gray' : t.color, t.closed ? 'Закрыта' : COLOR_NAMES[t.color])}</td>
      <td>${progressBar(t.progress, t.color)}</td>
      <td class="small">${(t.comments || []).map((c) => `<div><b>${esc(userName(c.by))}:</b> ${esc(c.text)}</div>`).join('<br>') || '—'}</td>
    </tr>`).join('') || '<tr><td colspan="7"><div class="empty">Задач нет</div></td></tr>'}</tbody></table></div>`;
}

function reportKpiTable(kpis, period) {
  return `<div class="table-wrap"><table><thead><tr>
    <th>KPI</th><th>Отдел</th><th>Тип</th><th>Цель</th><th>Факт</th><th>Состояние</th><th>Комментарий</th>
  </tr></thead><tbody>${kpis.map((k) => {
    const st = kpiStatus(k, period);
    const e = (k.entries || {})[period];
    return `<tr>
      <td><b>${esc(k.name)}</b></td><td>${esc(deptName(k.deptId))}</td><td>${esc(TYPE_NAMES[k.type])}</td>
      <td>${esc(k.target)}</td><td>${esc(kpiValueText(k, period))}</td>
      <td>${statusPill(st, e ? COLOR_NAMES[st] || 'Нет данных' : 'Нет данных')}</td>
      <td class="small">${e && e.comment ? esc(e.comment) : '—'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7"><div class="empty">KPI нет</div></td></tr>'}</tbody></table></div>`;
}

function renderReports() {
  const tabs = `<div class="tabs">
    <button class="tab${ui.reportTab === 'dept' ? ' active' : ''}" data-action="report-tab" data-tab="dept">Отчёт по отделу</button>
    ${isDirector() ? `<button class="tab${ui.reportTab === 'gm' ? ' active' : ''}" data-action="report-tab" data-tab="gm">Сводный отчёт генерального директора</button>` : ''}
  </div>`;

  let body = '';
  if (ui.reportTab === 'gm' && isDirector()) {
    const mgmt = visibleTasks().filter((t) => t.needsManagement);
    const allTasks = visibleTasks();
    const allKpis = visibleKpis();
    body = `
      <div class="report-section"><h3>Раздел 1. Проекты и задачи, требующие участия руководства</h3>${reportTasksTable(mgmt)}</div>
      <div class="report-section"><h3>Раздел 2. Панель KPI по отделам (период ${esc(ui.reportPeriod)})</h3>${reportKpiTable(allKpis, ui.reportPeriod)}</div>
      <div class="report-section"><h3>Раздел 3. Все задачи по отделам и заметки о ходе выполнения</h3>
        ${visibleDepartments().map((d) => {
          const list = allTasks.filter((t) => t.deptId === d.id);
          return `<div style="margin-bottom:18px"><div class="small" style="font-weight:650;margin-bottom:6px"><span class="dot ${deptClass(d.id)}"></span> ${esc(d.name)}</div>${reportTasksTable(list)}</div>`;
        }).join('')}
      </div>`;
  } else {
    const deptTasks = visibleTasks().filter((t) => t.deptId === ui.reportDept);
    const deptKpis = visibleKpis().filter((k) => k.deptId === ui.reportDept);
    body = `
      <div class="filters">
        <select id="reportDept">${optionsFrom(visibleDepartments(), ui.reportDept, (d) => d.name)}</select>
        <select id="reportPeriod">${optionsFrom(Array.from({ length: 6 }, (_, i) => monthsBack(i)), ui.reportPeriod, (p) => 'Период: ' + p)}</select>
      </div>
      <div class="report-section"><h3>Задачи отдела «${esc(deptName(ui.reportDept))}»</h3>${reportTasksTable(deptTasks)}</div>
      <div class="report-section"><h3>KPI отдела за ${esc(ui.reportPeriod)}</h3>${reportKpiTable(deptKpis, ui.reportPeriod)}</div>`;
  }

  return `
    <div class="page-head">
      <div><h1>Отчёты</h1><p>Еженедельный свод по отделу и полный отчёт для генерального директора.</p></div>
      <div class="page-actions">
        <button class="btn" data-action="report-csv">Экспорт CSV</button>
        <button class="btn primary" data-action="report-print">Печать / PDF</button>
      </div>
    </div>
    <div class="card">${tabs}<div class="report-body">${body}</div></div>`;
}

/* ----- Уведомления ----- */

function renderNotifications() {
  const filtered = myNotifications().filter((n) => {
    if (ui.notifFilter === 'all') return true;
    if (ui.notifFilter === 'comment') return n.type === 'comment';
    if (ui.notifFilter === 'deadline') return n.type === 'soon' || n.type === 'overdue';
    return n.type === 'management';
  });

  const items = filtered.map((n) => {
    const read = n.readBy.includes(currentUser().id);
    const info = NOTIF_TYPES[n.type] || { label: 'Событие', cls: 'gray' };
    const from = n.authorId ? `<div class="tiny muted">От: ${esc(userName(n.authorId))}</div>` : '';
    const open = n.taskId && state.tasks.some((t) => t.id === n.taskId)
      ? `<button class="btn sm" data-action="open-notification-task" data-id="${esc(n.taskId)}" data-notif="${esc(n.id)}">Открыть задачу</button>`
      : '';
    return `<div class="admin-row" style="${read ? 'opacity:.62' : ''}">
      <span class="pill ${info.cls}">${esc(info.label)}</span>
      <div class="grow"><div>${esc(n.text)}</div>${from}<div class="tiny muted">${esc(fmtTime(n.at))}</div></div>
      ${open}
      ${read ? '<span class="tiny muted">прочитано</span>' : `<button class="btn sm" data-action="mark-read" data-id="${esc(n.id)}">Прочитать</button>`}
    </div>`;
  }).join('') || '<div class="empty">Уведомлений по этому фильтру нет</div>';

  const tabs = `<div class="tabs">${Object.keys(NOTIF_FILTERS).map((key) => `
    <button class="tab${ui.notifFilter === key ? ' active' : ''}" data-action="notif-filter" data-filter="${key}">${NOTIF_FILTERS[key]}</button>
  `).join('')}</div>`;

  return `
    <div class="page-head">
      <div><h1>Уведомления и сообщения</h1>
        <p>Комментарии, статусы, сроки и запросы руководства — только то, что касается вашей роли и задач.</p></div>
      <div class="page-actions"><button class="btn" data-action="mark-all-read">Отметить все прочитанными</button></div>
    </div>
    <div class="card">${tabs}${items}</div>`;
}

/* ----- Админка ----- */

function renderAdmin() {
  const tabs = `<div class="tabs">
    ${[['depts', 'Отделы'], ['kpis', 'KPI'], ['users', 'Пользователи'], ['import', 'Импорт CSV'], ['data', 'Данные']].map(([id, label]) =>
      `<button class="tab${ui.adminTab === id ? ' active' : ''}" data-action="admin-tab" data-tab="${id}">${label}</button>`).join('')}
  </div>`;

  let body = '';
  if (ui.adminTab === 'depts') {
    body = `
      <div class="card-head"><h2>Названия отделов</h2><span class="card-sub">максимум 3 отдела</span></div>
      ${state.departments.map((d, i) => `
        <div class="admin-row">
          <span class="dot ${DEPT_CLASS(i)}"></span>
          <div class="grow"><input value="${esc(d.name)}" data-dept-name="${esc(d.id)}"></div>
          <button class="btn sm" data-action="dept-save" data-id="${esc(d.id)}">Сохранить</button>
          <button class="btn sm danger" data-action="dept-delete" data-id="${esc(d.id)}">Удалить</button>
        </div>`).join('')}
      <div style="margin-top:14px">
        <button class="btn" data-action="dept-add"${state.departments.length >= 3 ? ' disabled' : ''}>+ Добавить отдел</button>
      </div>`;
  } else if (ui.adminTab === 'kpis') {
    body = state.departments.map((d) => `
      <div class="dept-block">
        <div class="dept-title"><span class="dot ${deptClass(d.id)}"></span><h2>${esc(d.name)}</h2></div>
        ${state.kpis.filter((k) => k.deptId === d.id).map((k) => `
          <div class="admin-row">
            <div class="grow"><b>${esc(k.name)}</b><div class="tiny muted">${esc(TYPE_NAMES[k.type])} · цель ${esc(k.target)} · жёлтый ${esc(k.warning)} · ${k.direction === 'lower' ? 'меньше — лучше' : 'больше — лучше'}</div></div>
            <button class="btn sm" data-action="kpi-edit" data-id="${esc(k.id)}">Изменить</button>
            <button class="btn sm danger" data-action="kpi-delete" data-id="${esc(k.id)}">Удалить</button>
          </div>`).join('') || '<div class="tiny muted">KPI не настроены</div>'}
        <button class="btn sm" style="margin-top:10px" data-action="kpi-add" data-dept="${esc(d.id)}">+ Добавить KPI</button>
      </div>`).join('');
  } else if (ui.adminTab === 'users') {
    body = `
      <div class="card-head"><h2>Демо-пользователи</h2><span class="card-sub">пароль не требуется</span></div>
      ${state.users.map((u) => `
        <div class="admin-row">
          <div class="grow"><input value="${esc(u.name)}" data-user-name="${esc(u.id)}"></div>
          <select data-user-role="${esc(u.id)}">${optionsFrom(['director', 'head', 'employee'], u.role, (r) => ROLE_NAMES[r])}</select>
          <select data-user-dept="${esc(u.id)}"><option value="">—</option>${optionsFrom(state.departments, u.deptId, (d) => d.name)}</select>
          <button class="btn sm" data-action="user-save" data-id="${esc(u.id)}">Сохранить</button>
          <button class="btn sm danger" data-action="user-delete" data-id="${esc(u.id)}">Удалить</button>
        </div>`).join('')}
      <button class="btn" style="margin-top:14px" data-action="user-add">+ Добавить пользователя</button>`;
  } else if (ui.adminTab === 'import') {
    const preview = ui.importRows === null ? '' : (() => {
      const good = ui.importRows.filter((r) => r.status === 'ok').length;
      const bad = ui.importRows.length - good;
      return `<div style="margin-top:16px">
        <div class="small" style="margin-bottom:8px">Готово к загрузке: <b>${good}</b>, с ошибками: <b style="color:var(--red)">${bad}</b></div>
        <div class="table-wrap"><table><thead><tr><th>Строка</th><th>Отдел</th><th>KPI</th><th>Период</th><th>Значение</th><th>Результат</th></tr></thead><tbody>
        ${ui.importRows.map((r) => `<tr><td>${r.rowNo}</td><td>${esc(r.rawDept)}</td><td>${esc(r.rawKpi)}</td><td>${esc(r.period)}</td><td>${esc(r.rawValue)}</td>
          <td>${r.status === 'ok' ? '<span class="pill green">OK</span>' : '<span class="pill red">' + esc(r.errors.join('; ')) + '</span>'}</td></tr>`).join('')}
        </tbody></table></div>
        <button class="btn primary" style="margin-top:12px" data-action="import-confirm">Подтвердить загрузку</button>
      </div>`;
    })();
    body = `
      <div class="card-head"><h2>Импорт KPI из CSV / Excel</h2></div>
      <div class="small muted">Порядок: скачать шаблон → заполнить → загрузить → проверить предпросмотр → подтвердить. Повторная загрузка за тот же отдел + KPI + период обновляет запись, а не создаёт дубль.</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-action="template-download">Скачать шаблон CSV</button>
      </div>
      <div class="dropzone" style="margin-top:14px">
        <div><b>Выберите файл CSV</b></div>
        <div class="small muted">Разделитель — точка с запятой или запятая. Кодировка UTF-8.</div>
        <input type="file" id="importFile" accept=".csv,.txt,text/csv">
      </div>${preview}`;
  } else {
    body = `
      <div class="card-head"><h2>Хранение данных</h2></div>
      <div class="small muted">В учебной версии данные хранятся в localStorage этого браузера. При деплое на сервер хранилище можно заменить на серверное без изменения интерфейса.</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-action="export-json">Выгрузить данные (JSON)</button>
        <button class="btn danger" data-action="reset-data">Сбросить к демо-данным</button>
      </div>`;
  }

  return `<div class="page-head"><div><h1>Админка</h1><p>Отделы, KPI, пользователи и импорт. Доступно генеральному директору.</p></div></div>
    <div class="card">${tabs}${body}</div>`;
}

/* ---------- 7. Действия: задачи ---------- */

function logTask(task, text, by) {
  task.history = task.history || [];
  task.history.push({ at: Date.now(), by: by || currentUser().id, text });
  task.updatedAt = Date.now();
}

function openTaskModal(id) {
  const t = id ? state.tasks.find((x) => x.id === id) : null;
  const editing = !!t;
  const deptId = t ? t.deptId : (visibleDepartments()[0] || {}).id;
  const deptUsers = state.users.filter((u) => u.deptId === deptId || u.role === 'director');
  const body = `
    <div class="field"><label for="tTitle">Название</label><input id="tTitle" name="title" value="${esc(t ? t.title : '')}" required></div>
    <div class="field"><label for="tDesc">Описание</label><textarea id="tDesc" name="description">${esc(t ? t.description : '')}</textarea></div>
    <div class="field-row">
      <div class="field"><label for="tDept">Отдел</label><select id="tDept" name="deptId">${optionsFrom(visibleDepartments(), deptId, (d) => d.name)}</select></div>
      <div class="field"><label for="tAssignee">Ответственный</label><select id="tAssignee" name="assigneeId">${optionsFrom(deptUsers, t ? t.assigneeId : '', (u) => u.name)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="tDue">Срок</label><input id="tDue" name="dueDate" type="date" value="${esc(t ? t.dueDate : '')}"></div>
      <div class="field"><label for="tPriority">Приоритет</label><select id="tPriority" name="priority">${optionsFrom(['low', 'medium', 'high'], t ? t.priority : 'medium', (p) => PRIORITY_NAMES[p])}</select></div>
    </div>
    <div class="field"><label for="tParticipants">Участники (Ctrl+Click для выбора нескольких)</label>
      <select id="tParticipants" name="participants" multiple size="4">${deptUsers.map((u) => `<option value="${esc(u.id)}"${t && (t.participants || []).includes(u.id) ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
    </div>`;

  showModal({
    title: editing ? 'Редактировать задачу' : 'Новая задача',
    body,
    confirmText: editing ? 'Сохранить' : 'Создать',
    onConfirm: () => {
      const title = $('#tTitle').value.trim();
      if (!title) { toast('Введите название задачи'); return; }
      const values = {
        title,
        description: $('#tDesc').value.trim(),
        deptId: $('#tDept').value,
        assigneeId: $('#tAssignee').value || null,
        dueDate: $('#tDue').value || null,
        priority: $('#tPriority').value,
        participants: Array.from($('#tParticipants').selectedOptions).map((o) => o.value)
      };
      if (editing) {
        const previousAssignee = t.assigneeId;
        Object.keys(values).forEach((key) => {
          if (JSON.stringify(t[key]) !== JSON.stringify(values[key])) {
            logTask(t, `Изменено поле «${key}»`);
          }
        });
        Object.assign(t, values);
        if (previousAssignee !== values.assigneeId && values.assigneeId) {
          pushNotification('assign', `Вам назначена задача «${t.title}»`,
            [values.assigneeId], null, t.id, currentUser().id);
        }
        toast('Задача обновлена');
      } else {
        const created = makeTask(values);
        created.createdBy = currentUser().id;
        created.history = [{ at: Date.now(), by: currentUser().id, text: 'Задача создана' }];
        state.tasks.push(created);
        pushNotification('assign', `Вам назначена задача «${created.title}» · ${userName(currentUser().id)}`,
          recipientIds(created).filter((u) => u !== currentUser().id), null, created.id, currentUser().id);
        ui.taskId = created.id;
        ui.section = 'task';
        toast('Задача создана');
      }
      closeModal();
      save();
      syncAutoNotifications();
      render();
    }
  });
}

function setTaskColor(id, color) {
  if (!['green', 'amber', 'red'].includes(color)) return;
  const t = state.tasks.find((x) => x.id === id);
  if (!t || !canTouchTask(t)) return;
  if (t.color !== color) {
    t.color = color;
    logTask(t, `Цвет статуса изменён на «${COLOR_NAMES[color]}»`);
    const author = currentUser().id;
    pushNotification('status', `Статус задачи «${t.title}» изменён на «${COLOR_NAMES[color]}»`,
      recipientIds(t, { director: t.needsManagement }).filter((u) => u !== author), null, t.id, author);
    save();
    render();
  }
}

function setTaskProgress(id, value) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || !canTouchTask(t)) return;
  t.progress = Number(value);
  logTask(t, `Прогресс изменён на ${t.progress}%`);
  const author = currentUser().id;
  pushNotification('progress', `Прогресс задачи «${t.title}»: ${t.progress}%`,
    recipientIds(t, { director: t.needsManagement }).filter((u) => u !== author), null, t.id, author);
  save();
  const label = $('#progressLabel');
  if (label) label.innerHTML = `Прогресс: <b>${t.progress}%</b>`;
  renderNav();
}

function addComment(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || !canTouchTask(t)) return;
  const el = $('#newComment');
  const text = el ? el.value.trim() : '';
  if (!text) { toast('Введите текст комментария'); return; }
  const author = currentUser();
  t.comments = t.comments || [];
  t.comments.push({ id: uid('c'), by: author.id, at: Date.now(), text });
  logTask(t, 'Добавлен комментарий');
  const recipients = recipientIds(t, { director: t.needsManagement }).filter((uidNow) => uidNow !== author.id);
  pushNotification('comment',
    `Комментарий от ${author.name} в задаче «${t.title}»: «${shortText(text)}»`,
    recipients, null, t.id, author.id);
  save();
  render();
  toast(`Комментарий отправлен · уведомлено: ${recipients.length} чел.`);
}

function askManagement(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || !canTouchTask(t)) return;
  showModal({
    title: 'Запросить решение руководства',
    body: `<div class="field"><label for="mgmtComment">Что нужно решить?</label><textarea id="mgmtComment" placeholder="Опишите вопрос или проблему">${esc(t.managementComment || '')}</textarea></div>
           <div class="small muted">Задача будет подсвечена в списках и попадёт в раздел 1 отчёта генерального директора.</div>`,
    confirmText: 'Отправить запрос',
    onConfirm: () => {
      t.needsManagement = true;
      t.managementComment = $('#mgmtComment').value.trim();
      t.managementRequestedBy = currentUser().id;
      logTask(t, 'Запрошено решение руководства');
      pushNotification('management', `Требуется решение руководства: «${t.title}» · ${shortText(t.managementComment)}`,
        Array.from(new Set([...directorIds(), ...deptHeadIds(t.deptId)])), null, t.id, currentUser().id);
      closeModal(); save(); syncAutoNotifications(); render();
      toast('Запрос отправлен');
    }
  });
}

function clearFlag(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || !canTouchTask(t)) return;
  const requester = t.managementRequestedBy;
  t.needsManagement = false;
  t.managementComment = '';
  t.managementRequestedBy = null;
  logTask(t, 'Флаг «Требуется решение руководства» снят');
  const author = currentUser().id;
  const recipients = recipientIds(t, { director: true }).filter((u) => u !== author);
  if (requester && requester !== author) recipients.push(requester);
  pushNotification('management', `Решение по задаче «${t.title}» получено, флаг снят`,
    Array.from(new Set(recipients)), null, t.id, author);
  save(); syncAutoNotifications(); render();
}

function toggleClose(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || !canEditTask(t)) return;
  t.closed = !t.closed;
  if (t.closed) t.progress = 100;
  logTask(t, t.closed ? 'Задача закрыта' : 'Задача открыта заново');
  const author = currentUser().id;
  pushNotification('close', `Задача «${t.title}» ${t.closed ? 'закрыта' : 'открыта заново'}`,
    recipientIds(t, { director: t.needsManagement }).filter((u) => u !== author), null, t.id, author);
  save(); syncAutoNotifications(); render();
  toast(t.closed ? 'Задача закрыта' : 'Задача открыта');
}

/* ---------- 7b. Действия: KPI и админка ---------- */

function openKpiEntry(id) {
  if (!canManageSettings()) return;
  const k = state.kpis.find((x) => x.id === id);
  if (!k) return;
  const e = (k.entries || {})[ui.kpiPeriod] || {};
  let valueField = '';
  if (k.type === 'number' || k.type === 'percent') {
    valueField = `<div class="field"><label for="kv">Значение ${k.unit ? '(' + esc(k.unit) + ')' : ''}</label><input id="kv" type="number" step="any" value="${esc(e.value ?? '')}" required></div>`;
  } else if (k.type === 'date') {
    valueField = `<div class="field"><label for="kv">Дата</label><input id="kv" type="date" value="${esc(e.value ?? '')}" required></div>`;
  } else if (k.type === 'status') {
    valueField = `<div class="field"><label for="kv">Статус</label><select id="kv">${optionsFrom(['green', 'amber', 'red'], e.value || 'green', (v) => COLOR_NAMES[v])}</select></div>`;
  } else {
    valueField = `<div class="field"><label for="kv">Текст</label><textarea id="kv" required>${esc(e.value ?? '')}</textarea></div>`;
  }

  showModal({
    title: `Ввод KPI: ${k.name}`,
    body: `<div class="small muted" style="margin-bottom:12px">Период: ${esc(ui.kpiPeriod)}</div>${valueField}
      <div class="field"><label for="kcomment">Комментарий</label><textarea id="kcomment">${esc(e.comment || '')}</textarea></div>`,
    onConfirm: () => {
      const value = $('#kv').value.trim();
      if (value === '') { toast('Заполните значение'); return; }
      if ((k.type === 'number' || k.type === 'percent') && !isFinite(Number(value))) {
        toast('Введите число'); return;
      }
      k.entries = k.entries || {};
      const old = k.entries[ui.kpiPeriod];
      k.entries[ui.kpiPeriod] = {
        value,
        comment: $('#kcomment').value.trim(),
        updatedAt: Date.now(),
        updatedBy: currentUser().id,
        history: (old && old.history ? old.history : []).concat([{
          at: Date.now(), by: currentUser().id,
          text: old ? `Значение изменено с «${old.value}» на «${value}»` : `Установлено значение «${value}»`
        }])
      };
      closeModal(); save(); render(); toast('Значение KPI сохранено');
    }
  });
}

function openKpiHistory(id) {
  const k = state.kpis.find((x) => x.id === id);
  if (!k) return;
  const e = (k.entries || {})[ui.kpiPeriod];
  const items = e && e.history ? e.history.slice().reverse().map((h) => `
    <li><b>${esc(h.text)}</b><span class="muted">${esc(userName(h.by))} · ${esc(fmtTime(h.at))}</span></li>`).join('') : '';
  showModal({
    title: `История KPI: ${k.name}`,
    body: `<div class="small muted" style="margin-bottom:10px">Период ${esc(ui.kpiPeriod)} · текущее значение: <b>${esc(kpiValueText(k))}</b></div>
      <ul class="timeline">${items || '<li class="muted">Изменений нет</li>'}</ul>`,
    confirmText: 'Понятно',
    onConfirm: () => closeModal()
  });
}

function openKpiSettings(id, deptId) {
  if (!canManageSettings()) return;
  const k = id ? state.kpis.find((x) => x.id === id) : null;
  const body = `
    <div class="field"><label for="kName">Название</label><input id="kName" value="${esc(k ? k.name : '')}" required></div>
    <div class="field-row">
      <div class="field"><label for="kDept">Отдел</label><select id="kDept">${optionsFrom(state.departments, k ? k.deptId : deptId, (d) => d.name)}</select></div>
      <div class="field"><label for="kType">Тип</label><select id="kType">${optionsFrom(['number', 'percent', 'date', 'status', 'comment'], k ? k.type : 'number', (t) => TYPE_NAMES[t])}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="kTarget">Целевое значение (зелёный)</label><input id="kTarget" value="${esc(k ? k.target : '')}"><span class="hint">Для статуса/комментария не используется</span></div>
      <div class="field"><label for="kWarning">Порог «внимание» (жёлтый)</label><input id="kWarning" value="${esc(k ? k.warning : '')}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="kUnit">Единица измерения</label><input id="kUnit" value="${esc(k ? k.unit : '')}" placeholder="шт, %, мин"></div>
      <div class="field"><label for="kDirection">Направление</label><select id="kDirection">
        <option value="higher"${!k || k.direction === 'higher' ? ' selected' : ''}>Больше — лучше</option>
        <option value="lower"${k && k.direction === 'lower' ? ' selected' : ''}>Меньше — лучше</option>
      </select></div>
    </div>
    <div class="field"><label for="kOwner">Ответственный за ввод</label><select id="kOwner"><option value="">—</option>${optionsFrom(state.users, k ? k.ownerId : '', (u) => u.name)}</select></div>
    <div class="small muted">Пороги: при «больше — лучше» значение ≥ цели — зелёный, ≥ жёлтого порога — жёлтый, ниже — красный. При «меньше — лучше» — наоборот.</div>`;

  showModal({
    title: k ? 'Изменить KPI' : 'Новый KPI',
    body,
    onConfirm: () => {
      const name = $('#kName').value.trim();
      if (!name) { toast('Введите название KPI'); return; }
      const values = {
        name, deptId: $('#kDept').value, type: $('#kType').value,
        target: $('#kTarget').value.trim(), warning: $('#kWarning').value.trim(),
        unit: $('#kUnit').value.trim(), direction: $('#kDirection').value,
        ownerId: $('#kOwner').value || null
      };
      if (k) Object.assign(k, values);
      else state.kpis.push(Object.assign({ id: uid('k'), entries: {} }, values));
      closeModal(); save(); render(); toast(k ? 'KPI обновлён' : 'KPI добавлен');
    }
  });
}

function adminTabActions(tab) {
  ui.adminTab = tab;
  if (tab === 'import') ui.section = 'admin';
  render();
}

/* ---------- 7c. Действия: уведомления ---------- */

function markRead(id, silent) {
  const n = state.notifications.find((x) => x.id === id);
  if (!n) return;
  const me = currentUser().id;
  if (!n.readBy.includes(me)) n.readBy.push(me);
  save();
  if (!silent) render();
}
function markAllRead() {
  const me = currentUser().id;
  myNotifications().forEach((n) => { if (!n.readBy.includes(me)) n.readBy.push(me); });
  save(); render();
}

/* ---------- 8. Импорт / экспорт ---------- */

function parseCSV(text, delimiter) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell.trim()); cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

function parseImportedValue(type, raw) {
  if (type === 'number' || type === 'percent') {
    const v = Number(String(raw).replace(',', '.'));
    return isFinite(v) ? v : null;
  }
  if (type === 'date') {
    let m = String(raw).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? raw : null;
  }
  if (type === 'status') {
    const map = { 'зелёный': 'green', 'зеленый': 'green', 'green': 'green', 'жёлтый': 'amber', 'желтый': 'amber', 'amber': 'amber', 'yellow': 'amber', 'красный': 'red', 'red': 'red' };
    return map[String(raw).trim().toLowerCase()] || null;
  }
  return String(raw);
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const firstLine = text.split('\n')[0] || '';
    const delimiter = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';
    const rows = parseCSV(text, delimiter);
    if (rows.length < 2) { toast('Файл пуст или не содержит строк с данными'); return; }
    ui.importRows = rows.slice(1).map((cells, i) => {
      const rowNo = i + 2;
      const [rawDept, rawKpi, period, rawValue, rawType, comment, rawOwner] =
        [cells[0] || '', cells[1] || '', cells[2] || '', cells[3] || '', cells[4] || '', cells[5] || '', cells[6] || ''];
      const errors = [];
      const dept = state.departments.find((d) => d.name.trim().toLowerCase() === rawDept.trim().toLowerCase());
      if (!dept) errors.push('отдел не найден');
      const kpi = dept ? state.kpis.find((k) => k.deptId === dept.id && k.name.trim().toLowerCase() === rawKpi.trim().toLowerCase()) : null;
      if (dept && !kpi) errors.push('KPI не найден');
      if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(period)) errors.push('период должен быть ММ/ГГГГ');
      let value = null;
      if (kpi && rawValue !== '') {
        value = parseImportedValue(kpi.type, rawValue);
        if (value === null) errors.push('неверный формат значения');
      } else if (rawValue === '') errors.push('пустое значение');
      const owner = rawOwner ? state.users.find((u) => u.name.trim().toLowerCase() === rawOwner.trim().toLowerCase()) : null;
      if (rawOwner && !owner) errors.push('ответственный не найден');
      return {
        rowNo, rawDept, rawKpi, period, rawValue,
        status: errors.length ? 'error' : 'ok', errors,
        deptId: dept ? dept.id : null, kpiId: kpi ? kpi.id : null,
        value, comment, ownerId: owner ? owner.id : null
      };
    });
    render();
  };
  reader.onerror = () => toast('Не удалось прочитать файл');
  reader.readAsText(file, 'utf-8');
}

function confirmImport() {
  if (!ui.importRows) return;
  const valid = ui.importRows.filter((r) => r.status === 'ok');
  if (!valid.length) { toast('Нет корректных строк для загрузки'); return; }
  valid.forEach((r) => {
    const k = state.kpis.find((x) => x.id === r.kpiId);
    if (!k) return;
    k.entries = k.entries || {};
    const old = k.entries[r.period];
    k.entries[r.period] = {
      value: r.value,
      comment: r.comment || (old ? old.comment : ''),
      updatedAt: Date.now(),
      updatedBy: currentUser().id,
      history: (old && old.history ? old.history : []).concat([{
        at: Date.now(), by: currentUser().id,
        text: old ? `Импорт: значение обновлено с «${old.value}» на «${r.value}»` : `Импорт: установлено значение «${r.value}»`
      }])
    };
  });
  save();
  ui.importRows = null;
  render();
  toast(`Загружено строк: ${valid.length}`);
}

function downloadTemplate() {
  const p = periodNow();
  const lines = [
    'Отдел;Название KPI;Период;Значение;Тип;Комментарий;Ответственный',
    ...state.departments.slice(0, 1).map((d) => {
      const k = state.kpis.find((x) => x.deptId === d.id);
      return `${d.name};${k ? k.name : 'KPI'};${p};100;${k ? TYPE_NAMES[k.type] : 'Число'};пример;${''}`;
    }),
    'Сестринский отдел;Выполненные процедуры/услуги;' + p + ';400;Число;;'
  ];
  downloadFile('medoffice_kpi_template.csv', lines.join('\r\n'), 'text/csv;charset=utf-8');
}

function exportJson() {
  downloadFile('medoffice_data_' + todayISO() + '.json', JSON.stringify(state, null, 2), 'application/json');
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportReportCsv() {
  const tasks = ui.reportTab === 'gm' && isDirector() ? visibleTasks() : visibleTasks().filter((t) => t.deptId === ui.reportDept);
  const lines = [['Задача', 'Отдел', 'Ответственный', 'Срок', 'Цвет', 'Прогресс', 'Требует руководства', 'Комментарии']];
  tasks.forEach((t) => lines.push([
    t.title, deptName(t.deptId), userName(t.assigneeId), t.dueDate || '',
    COLOR_NAMES[t.color], (t.progress || 0) + '%', t.needsManagement ? 'да' : 'нет',
    (t.comments || []).map((c) => userName(c.by) + ': ' + c.text).join(' | ')
  ]));
  downloadFile('medoffice_report_' + todayISO() + '.csv', lines.map((r) => r.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

/* ---------- 9. Обработка событий и запуск ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  switch (action) {
    case 'nav':
      ui.section = el.dataset.section;
      render();
      closeSidebar();
      break;
    case 'toggle-sidebar':
      $('#sidebar').classList.toggle('open');
      $('#sidebarOverlay').hidden = !$('#sidebar').classList.contains('open');
      break;
    case 'close-sidebar': closeSidebar(); break;
    case 'close-modal': closeModal(); break;
    case 'modal-confirm': if (ui.modal && ui.modal.onConfirm) ui.modal.onConfirm(); break;
    case 'open-task':
      ui.taskId = id; ui.section = 'task'; render(); closeSidebar();
      break;
    case 'new-task': openTaskModal(null); break;
    case 'edit-task': openTaskModal(id); break;
    case 'set-color': setTaskColor(id, el.dataset.color); break;
    case 'add-comment': addComment(id); break;
    case 'ask-management': askManagement(id); break;
    case 'clear-flag': clearFlag(id); break;
    case 'toggle-close': toggleClose(id); break;
    case 'kpi-entry': openKpiEntry(id); break;
    case 'kpi-history': openKpiHistory(id); break;
    case 'kpi-add': openKpiSettings(null, el.dataset.dept); break;
    case 'kpi-edit': openKpiSettings(id); break;
    case 'kpi-delete':
      showModal({
        title: 'Удалить KPI?', body: '<div class="small">История значений этого KPI будет удалена.</div>',
        confirmText: 'Удалить', danger: true,
        onConfirm: () => {
          state.kpis = state.kpis.filter((k) => k.id !== id);
          closeModal(); save(); render(); toast('KPI удалён');
        }
      });
      break;
    case 'admin-tab': adminTabActions(el.dataset.tab); break;
    case 'report-tab': ui.reportTab = el.dataset.tab; render(); break;
    case 'notif-filter': ui.notifFilter = el.dataset.filter; render(); break;
    case 'dept-save': {
      const d = state.departments.find((x) => x.id === id);
      const input = $(`[data-dept-name="${id}"]`);
      if (d && input && input.value.trim()) { d.name = input.value.trim(); save(); render(); toast('Название отдела обновлено'); }
      break;
    }
    case 'dept-delete':
      if (state.departments.length <= 1) { toast('Должен остаться хотя бы один отдел'); return; }
      showModal({
        title: 'Удалить отдел?', body: '<div class="small">Задачи и KPI этого отдела будут удалены.</div>',
        confirmText: 'Удалить', danger: true,
        onConfirm: () => {
          state.departments = state.departments.filter((d) => d.id !== id);
          state.tasks = state.tasks.filter((t) => t.deptId !== id);
          state.kpis = state.kpis.filter((k) => k.deptId !== id);
          closeModal(); save(); render(); toast('Отдел удалён');
        }
      });
      break;
    case 'dept-add': {
      if (state.departments.length >= 3) return;
      showModal({
        title: 'Новый отдел',
        body: '<div class="field"><label for="dName">Название</label><input id="dName" required placeholder="Например, Отдел качества"></div>',
        onConfirm: () => {
          const name = $('#dName').value.trim();
          if (!name) { toast('Введите название'); return; }
          state.departments.push({ id: uid('d'), name });
          closeModal(); save(); render(); toast('Отдел добавлен');
        }
      });
      break;
    }
    case 'user-save': {
      const u = state.users.find((x) => x.id === id);
      if (!u) return;
      u.name = $(`[data-user-name="${id}"]`).value.trim() || u.name;
      u.role = $(`[data-user-role="${id}"]`).value;
      u.deptId = $(`[data-user-dept="${id}"]`).value || null;
      save(); render(); toast('Пользователь обновлён');
      break;
    }
    case 'user-delete':
      if (state.users.length <= 1) { toast('Должен остаться хотя бы один пользователь'); return; }
      showModal({
        title: 'Удалить пользователя?', body: '<div class="small">Задачи останутся, но ответственный станет «—».</div>',
        confirmText: 'Удалить', danger: true,
        onConfirm: () => {
          state.users = state.users.filter((u) => u.id !== id);
          state.tasks.forEach((t) => {
            if (t.assigneeId === id) t.assigneeId = null;
            t.participants = (t.participants || []).filter((p) => p !== id);
          });
          if (ui.currentUserId === id) ui.currentUserId = state.users[0].id;
          closeModal(); save(); render(); toast('Пользователь удалён');
        }
      });
      break;
    case 'user-add':
      showModal({
        title: 'Новый пользователь',
        body: `<div class="field"><label for="uName">Имя</label><input id="uName" required></div>
          <div class="field"><label for="uRole">Роль</label><select id="uRole">${optionsFrom(['director', 'head', 'employee'], 'employee', (r) => ROLE_NAMES[r])}</select></div>
          <div class="field"><label for="uDept">Отдел</label><select id="uDept"><option value="">—</option>${optionsFrom(state.departments, '', (d) => d.name)}</select></div>`,
        onConfirm: () => {
          const name = $('#uName').value.trim();
          if (!name) { toast('Введите имя'); return; }
          state.users.push({ id: uid('u'), name, role: $('#uRole').value, deptId: $('#uDept').value || null });
          closeModal(); save(); render(); toast('Пользователь добавлен');
        }
      });
      break;
    case 'import-open': ui.adminTab = 'import'; ui.section = 'admin'; render(); break;
    case 'template-download': downloadTemplate(); break;
    case 'import-confirm': confirmImport(); break;
    case 'export-json': exportJson(); break;
    case 'reset-data':
      showModal({
        title: 'Сбросить данные?', body: '<div class="small">Текущие задачи, KPI и настройки будут заменены демо-данными.</div>',
        confirmText: 'Сбросить', danger: true,
        onConfirm: () => {
          state = seedState();
          ui.currentUserId = 'u_director';
          ui.taskId = null;
          ui.importRows = null;
          closeModal(); syncAutoNotifications(); render(); toast('Демо-данные восстановлены');
        }
      });
      break;
    case 'export-csv': exportReportCsv(); break;
    case 'report-print': window.print(); break;
    case 'report-csv': exportReportCsv(); break;
    case 'cal-prev':
      ui.calendarMonth--; if (ui.calendarMonth < 0) { ui.calendarMonth = 11; ui.calendarYear--; }
      render(); break;
    case 'cal-next':
      ui.calendarMonth++; if (ui.calendarMonth > 11) { ui.calendarMonth = 0; ui.calendarYear++; }
      render(); break;
    case 'open-notifications': ui.section = 'notifications'; render(); closeSidebar(); break;
    case 'mark-read': markRead(id); break;
    case 'mark-all-read': markAllRead(); break;
    case 'open-notification-task':
      markRead(el.dataset.notif, true);
      ui.taskId = el.dataset.id;
      ui.section = 'task';
      render();
      break;
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const action = el.dataset.action;
  if (el.id === 'userSwitch') {
    ui.currentUserId = el.value;
    ui.taskId = null;
    if (!isDirector() && ui.reportTab === 'gm') ui.reportTab = 'dept';
    if (!isDirector() && ui.section === 'admin') ui.section = 'dashboard';
    render();
    return;
  }
  if (action === 'set-progress') { setTaskProgress(el.dataset.id, el.value); return; }
  if (el.id === 'kpiPeriod') { ui.kpiPeriod = el.value; render(); return; }
  if (el.id === 'fdept') { ui.taskFilter.dept = el.value; render(); return; }
  if (el.id === 'fcolor') { ui.taskFilter.color = el.value; render(); return; }
  if (el.id === 'fassignee') { ui.taskFilter.assignee = el.value; render(); return; }
  if (el.id === 'fclosed') { ui.taskFilter.closed = el.checked; render(); return; }
  if (el.id === 'reportDept') { ui.reportDept = el.value; render(); return; }
  if (el.id === 'reportPeriod') { ui.reportPeriod = el.value; render(); return; }
  if (el.id === 'importFile' && el.files && el.files[0]) { handleImportFile(el.files[0]); return; }
  if (el.id === 'tDept') {
    const deptUsers = state.users.filter((u) => u.deptId === el.value || u.role === 'director');
    const assignee = $('#tAssignee');
    if (assignee) assignee.innerHTML = optionsFrom(deptUsers, '', (u) => u.name);
    const participants = $('#tParticipants');
    if (participants) participants.innerHTML = deptUsers.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'fq') {
    ui.taskFilter.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const next = $('#fq');
    if (next) { next.focus(); next.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#modalBackdrop').hidden) closeModal();
    else closeSidebar();
  }
});

document.addEventListener('click', (e) => {
  if (e.target.id === 'modalBackdrop') closeModal();
});

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebarOverlay').hidden = true;
}

/* Запуск */
syncAutoNotifications();
render();

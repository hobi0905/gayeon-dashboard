/* ══════════════════════════════════════════════════════════════
   가연님 대시보드 · app.js
   localStorage + 암호화된 Supabase 실시간 동기화
   ══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ───────────── tiny helpers ───────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const pad2 = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const parseISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const won = n => Number(n || 0).toLocaleString('ko-KR');
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clampNum = v => { const n = Number(String(v).replace(/[^\d.-]/g, '')); return isFinite(n) ? Math.round(n) : 0; };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const fmtDateShort = s => { const d = parseISO(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const fmtDateKo = s => { const d = parseISO(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK_KO[d.getDay()]})`; };
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/* ───────────── seed ───────────── */
const SEED_EVENTS = [
  ['컴활접수', '2026-11-28', null, null, null, 'study'],
  ['지안수마켓 21시', '2026-11-29', null, '21:00', '22:00', 'personal'],
  ['약속잡기', '2026-12-06', null, null, null, 'personal'],
  ['충북대 편입 원서접수', '2026-12-10', '2026-12-16', null, null, 'study'],
  ['부평상공회의소 컴활2급 필기', '2026-12-12', null, '14:50', '15:50', 'study'],
  ['약 마지막', '2026-12-14', null, null, null, 'health'],
  ['생리예정', '2026-12-18', '2026-12-22', null, null, 'health'],
  ['약 다시 시작', '2026-12-22', null, null, null, 'health'],
  ['AI활용전문가시험', '2026-12-24', null, null, null, 'personal'],
  ['건대고모약속', '2026-12-28', null, '12:00', '13:00', 'personal'],
  ['adsp 이지패스 개정판 확인', '2027-01-02', null, null, null, 'study'],
  ['adsp 접수 & 공부시작', '2027-01-04', null, null, null, 'study'],
  ['고시원 연락 돌리기', '2027-01-04', null, null, null, 'personal'],
  ['고시원 투어', '2027-01-09', null, null, null, 'personal'],
  ['약 마지막', '2027-01-11', null, null, null, 'health'],
  ['임규정 인천대 면접', '2027-01-14', null, null, null, 'study'],
  ['생리예정', '2027-01-15', '2027-01-19', null, null, 'health'],
  ['약 다시 시작', '2027-01-19', null, null, null, 'health'],
  ['이제부터 임규정이랑 놀 수 있음!!', '2027-01-24', null, null, null, 'personal'],
  ['이삿날', '2027-01-28', null, null, null, 'personal'],
  ['❤️서울여행❤️', '2027-01-31', '2027-02-02', null, null, 'trip'],
  ['adsp 시험', '2027-02-06', null, null, null, 'study'],
  ['약 마지막', '2027-02-08', null, null, null, 'health'],
  ['생리예정', '2027-02-12', '2027-02-16', null, null, 'health'],
  ['약 다시 시작', '2027-02-16', null, null, null, 'health'],
  ['농협연장전화', '2027-03-09', null, null, null, 'personal'],
  ['교대원 홈피 확인 (모집요강)', '2027-04-01', null, null, null, 'study'],
  ['숙대 교대원 원서접수일', '2027-04-26', null, null, null, 'study'],
  ['종합소득세 신고', '2027-05-01', null, null, null, 'personal'],
  ['인하대 교대원 원서접수일', '2027-05-03', null, null, null, 'study'],
  ['숙대 교대원 면접일자', '2027-05-29', null, null, null, 'study'],
  ['인하대 면접예정일', '2027-06-07', '2027-06-09', null, null, 'study'],
  ['숙대 교대원 최초합격자 발표', '2027-06-10', null, null, null, 'study'],
  ['인하대 교대원 합격자 발표', '2027-06-24', null, '10:00', '11:00', 'study'],
];

const SEED_EXAMS = [
  ['충북대 편입 원서접수', '2026-12-10', '지원', '12/10~12/16 · 컴퓨터공학과'],
  ['컴활 2급 필기', '2026-12-12', '시험', '14:50 부평상공회의소'],
  ['AI활용전문가시험', '2026-12-24', '시험', ''],
  ['임규정 인천대 면접', '2027-01-14', '면접', ''],
  ['ADsP 시험', '2027-02-06', '시험', '1/4 접수·공부 시작'],
  ['숙대 교대원 원서접수', '2027-04-26', '지원', ''],
  ['인하대 교대원 원서접수', '2027-05-03', '지원', ''],
  ['숙대 교대원 면접', '2027-05-29', '면접', ''],
  ['인하대 면접예정일', '2027-06-07', '면접', '06-07~06-09'],
  ['숙대 교대원 최초합격자 발표', '2027-06-10', '지원', ''],
  ['인하대 교대원 합격자 발표', '2027-06-24', '면접', '10:00'],
];

const DEFAULT_CODE = 'GAEYON-SKY-2026';

function seedState() {
  return {
    v: 3,
    title: 'My Dashboard',
    quote: '“호비랑 서리를 먹여살리기 위한 몸부림”',
    cover: null,
    cat: null,
    study: {
      month: [
        { id: uid(), text: '컴활접수 하기 (11/28)', done: false },
        { id: uid(), text: '충북대 편입 원서 준비물 확인', done: false },
      ],
      week: [{ id: uid(), text: '충북대 모집요강 일정 다시 보기', done: false }],
      today: [],
      exams: SEED_EXAMS.map(([name, date, type, memo]) => ({ id: uid(), name, date, type, memo })),
    },
    finance: { expenses: [], goals: [], invest: [], subs: [], planned: [] },
    wish: { want: [], need: [] },
    memo: { diary: [], habits: [], notes: [] },
    events: SEED_EVENTS.map(([title, date, end, start, endTime, category]) => ({
      id: uid(), title, date, end: end || null, start: start || null, endTime: endTime || null, category,
    })).concat([{
      id: uid(), title: '베스트피씨 알바', repeat: 'weekly', weekdays: [2, 3],
      from: '2026-11-24', until: '2027-06-30', start: '09:00', endTime: '16:00', category: 'work',
    }]),
    todo: [],
    sync: { code: DEFAULT_CODE, enabled: true },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    meta: { pristine: true },
  };
}

/* ───────────── state ───────────── */
const LS_KEY = 'gayeon_dashboard_v3';
let state;
let viewMonth = new Date(); viewMonth.setDate(1);
let finMonth = new Date(); finMonth.setDate(1);
let finSel = todayISO();
let editingExamId = null;
let openModalType = null;
let openModalArg = null;
let coverImageCache = null;

function normalize(s) {
  const base = seedState();
  const out = Object.assign({}, base, s);
  out.study = Object.assign({ month: [], week: [], today: [], exams: [] }, s.study || {});
  out.finance = Object.assign({ expenses: [], goals: [], invest: [], subs: [], planned: [] }, s.finance || {});
  out.wish = Object.assign({ want: [], need: [] }, s.wish || {});
  out.memo = Object.assign({ diary: [], habits: [], notes: [] }, s.memo || {});
  out.events = Array.isArray(s.events) ? s.events : base.events;
  out.todo = Array.isArray(s.todo) ? s.todo : [];
  out.sync = Object.assign({ code: DEFAULT_CODE, enabled: true }, s.sync || {});
  out.meta = Object.assign({ pristine: false }, s.meta || {});
  out.v = 3;
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 3) return normalize(parsed);
    }
    const legacy = localStorage.getItem('gayeon_dashboard_v2');
    if (legacy) { const p = JSON.parse(legacy); if (p) return normalize(p); }
  } catch (e) { console.warn('load failed', e); }
  return seedState();
}

/* ───────────── commit / render ───────────── */
function commit({ soft = false, push = true } = {}) {
  state.updatedAt = Date.now();
  if (state.meta) state.meta.pristine = false;
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { toast('저장 공간이 부족해요. 사진을 줄이거나 내보내기 후 초기화해 주세요.'); }
  if (soft) { renderDday(); renderSyncBadge(); } else { renderAll(); }
  if (push) schedulePush();
}

function renderAll() {
  renderHero();
  renderDday();
  renderTodo();
  renderCalendar();
  renderSyncBadge();
  renderModal();
}

function renderHero() {
  $('#coverImg').src = state.cover || 'assets/cover-sky-cat.jpg';
  $('#catImg').src = state.cat || 'assets/cat-card.jpg';
  const t = $('#pageTitle'); if (document.activeElement !== t) t.textContent = state.title || 'My Dashboard';
  const q = $('#quoteText'); if (document.activeElement !== q) q.textContent = state.quote || '';
  const now = new Date();
  $('#catDate').textContent = `${now.getMonth() + 1}월 ${now.getDate()}일`;
}

/* ───────────── d-day ───────────── */
function upcomingExams() {
  const t = todayISO();
  return state.study.exams.filter(e => e.date && e.date >= t).sort((a, b) => a.date.localeCompare(b.date));
}
function ddayLabel(dateStr) {
  const d = daysBetween(todayISO(), dateStr);
  if (d === 0) return 'D-DAY';
  return d > 0 ? `D-${d}` : `D+${-d}`;
}
function renderDday() {
  const box = $('#ddayCard');
  const list = upcomingExams();
  if (!list.length) {
    box.innerHTML = '<div class="dday-empty">다가오는 시험·지원 일정이 없어요.<br>STUDY에서 추가하면 여기 바로 떠요 🩵</div>';
    return;
  }
  const first = list[0];
  const d = daysBetween(todayISO(), first.date);
  const num = d === 0 ? 'D-DAY' : `D-${d}`;
  const next = list[1];
  box.innerHTML = `
    <div class="dday-main">
      <div class="dday-num">${esc(num)}</div>
      <div class="dday-name">${esc(first.name)}</div>
    </div>
    <div class="dday-meta"><span>${fmtDateKo(first.date)}</span><span class="tag ${esc(first.type)}">${esc(first.type)}</span></div>
    ${next ? `<div class="dday-next">다음 · ${esc(next.name)} <b>${ddayLabel(next.date)}</b></div>` : '<div class="dday-next">이번 달은 이 일정 하나만 남았어요 🤍</div>'}`;
}

/* ───────────── todo ───────────── */
function renderTodo() {
  const list = $('#todoList');
  if (!state.todo.length) {
    list.innerHTML = '<li class="todo-empty">아직 할 일이 없어요. 가볍게 하나 적어볼까요?</li>';
    return;
  }
  list.innerHTML = state.todo.map(t => `
    <li class="todo-item ${t.done ? 'done' : ''}">
      <button class="chk" data-act="todo-toggle" data-id="${t.id}" aria-label="체크">${t.done ? '✓' : ''}</button>
      <span class="t">${esc(t.text)}</span>
      <button class="del" data-act="todo-del" data-id="${t.id}" aria-label="삭제">✕</button>
    </li>`).join('');
}

/* ───────────── calendar ───────────── */
function eventsOn(dateStr) {
  const d = parseISO(dateStr);
  return state.events.filter(e => {
    if (!e) return false;
    if (e.repeat === 'weekly') {
      if (e.from && dateStr < e.from) return false;
      if (e.until && dateStr > e.until) return false;
      return (e.weekdays || []).includes(d.getDay());
    }
    const end = e.end || e.date;
    return e.date && dateStr >= e.date && dateStr <= end;
  });
}
function examsOn(dateStr) {
  return state.study.exams.filter(e => e.date === dateStr);
}
function expensesOn(dateStr) {
  return state.finance.expenses.filter(e => e.date === dateStr);
}
function spentOn(dateStr) {
  return expensesOn(dateStr).reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0);
}
function plannedOn(dateStr) {
  const day = parseISO(dateStr).getDate();
  const out = [];
  state.finance.subs.filter(s => s.active && Number(s.day) === day)
    .forEach(s => out.push({ name: s.name, amount: Number(s.amount) || 0, kind: '정기구독' }));
  state.finance.planned.filter(p => p.date === dateStr)
    .forEach(p => out.push({ name: p.name, amount: Number(p.amount) || 0, kind: '구매예정' }));
  return out;
}
function plannedSum(dateStr) {
  return plannedOn(dateStr).reduce((s, p) => s + p.amount, 0);
}

function monthCells(y, m) {
  const cells = [];
  const startDow = new Date(y, m, 1).getDay();
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth(y, m); d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chipList(dateStr) {
  const exms = examsOn(dateStr);
  const evs = eventsOn(dateStr).filter(e => !exms.some(x =>
    String(e.title).includes(x.name) || String(x.name).includes(String(e.title))));
  const chips = [];
  exms.forEach(x => chips.push({ cls: 'exam', label: x.name }));
  evs.forEach(e => chips.push({ cls: e.category || 'personal', label: e.title }));
  return chips;
}

function renderCalendar() {
  const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
  $('#calTitle').textContent = `${y}년 ${m + 1}월`;
  const tISO = todayISO();
  const grid = $('#calGrid');
  grid.innerHTML = monthCells(y, m).map(d => {
    if (!d) return '<div class="cal-cell out"></div>';
    const ds = isoOf(d);
    const dow = d.getDay();
    const cls = ['cal-cell', dow === 0 ? 'sun' : '', dow === 6 ? 'sat' : '', ds === tISO ? 'today' : ''].join(' ');
    const chips = chipList(ds);
    const shown = chips.slice(0, 2).map(c => `<span class="chip ${esc(c.cls)}">${esc(c.label)}</span>`).join('');
    const more = chips.length > 2 ? `<span class="cal-more">+${chips.length - 2}</span>` : '';
    const sp = spentOn(ds), pl = plannedSum(ds);
    const money = `${sp ? `<span class="cal-spend">₩${won(sp)}</span>` : ''}${pl ? `<span class="cal-plan">＋₩${won(pl)}</span>` : ''}`;
    return `<button class="${cls}" data-act="open-day" data-date="${ds}">
      <span class="dnum">${d.getDate()}</span>
      <span class="cal-chips">${shown}${more}</span>
      <span class="cal-money">${money}</span>
    </button>`;
  }).join('');
}

/* ───────────── modal framework ───────────── */
const MODALS = {
  study: { title: '📖 STUDY', render: renderStudyModal },
  finance: { title: '🪙 가계부', render: renderFinanceModal },
  wishlist: { title: '🎀 Wishlist', render: renderWishModal },
  memo: { title: '🕯️ 메모', render: renderMemoModal },
  settings: { title: '🎨 꾸미기 설정', render: renderSettingsModal },
  day: { title: '', render: renderDayModal },
};

function openModal(type, arg) {
  openModalType = type; openModalArg = arg || null;
  $('#modalRoot').hidden = false;
  document.body.style.overflow = 'hidden';
  renderModal();
  $('#modalBox').scrollTop = 0;
  const body = $('#modalBody'); if (body) body.scrollTop = 0;
}
function closeModal() {
  openModalType = null; openModalArg = null;
  $('#modalRoot').hidden = true;
  document.body.style.overflow = '';
}
function renderModal() {
  if (!openModalType) return;
  const cfg = MODALS[openModalType];
  if (!cfg) return;
  if (openModalType === 'day') $('#modalTitle').textContent = `🗓 ${fmtDateKo(openModalArg)}`;
  else $('#modalTitle').textContent = cfg.title;
  const body = $('#modalBody');
  const scroll = body.scrollTop;
  body.innerHTML = cfg.render(openModalArg);
  body.scrollTop = scroll;
}

/* ───────────── STUDY modal ───────────── */
const GOAL_META = {
  month: { label: '이달의 목표', em: '🌙', ph: '이번 달에 꼭 해내고 싶은 것' },
  week: { label: '이주의 목표', em: '🌿', ph: '이번 주 안에 끝낼 것' },
  today: { label: '오늘의 목표', em: '☀️', ph: '오늘 하루의 작은 목표' },
};

function goalSection(scope) {
  const meta = GOAL_META[scope];
  const items = state.study[scope] || [];
  const done = items.filter(i => i.done).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  return `<section class="sec">
    <div class="sec-head">
      <h3><span class="em">${meta.em}</span>${meta.label}</h3>
      <span class="sec-count">${done}/${items.length}</span>
    </div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    ${items.length ? `<div class="check-list">${items.map(i => `
      <div class="check-row ${i.done ? 'done' : ''}">
        <button class="chk" data-act="goal-toggle" data-scope="${scope}" data-id="${i.id}">${i.done ? '✓' : ''}</button>
        <span class="txt">${esc(i.text)}</span>
        <button class="icon-x" data-act="goal-del" data-scope="${scope}" data-id="${i.id}">✕</button>
      </div>`).join('')}</div>` : `<div class="empty">아직 비어 있어요 · 작게 하나 적어볼까요?</div>`}
    <form class="add-form" data-form="goal" data-scope="${scope}">
      <input class="in grow" name="text" maxlength="80" placeholder="${meta.ph}" autocomplete="off">
      <button class="btn primary" type="submit">추가</button>
    </form>
  </section>`;
}

function renderStudyModal() {
  const exams = [...state.study.exams].sort((a, b) => a.date.localeCompare(b.date));
  return `
    ${goalSection('month')}
    ${goalSection('week')}
    ${goalSection('today')}
    <section class="sec">
      <div class="sec-head">
        <h3><span class="em">🎓</span>이번 달 시험·지원</h3>
        <span class="sec-count">${exams.length}개</span>
        <span class="sec-note">여기 추가하면 홈 D-DAY·캘린더에 자동 반영</span>
      </div>
      <div class="sec-card">
        ${exams.length ? `<div class="row-list">${exams.map(x => {
          const d = daysBetween(todayISO(), x.date);
          return `<div class="drow">
            <span class="tag ${esc(x.type)}">${esc(x.type)}</span>
            <span class="grow"><b>${esc(x.name)}</b> <span class="muted">${fmtDateShort(x.date)}${x.memo ? ' · ' + esc(x.memo) : ''}</span></span>
            <span class="dday-pill ${d < 0 ? 'past' : ''}">${ddayLabel(x.date)}</span>
            <button class="icon-x" data-act="exam-edit" data-id="${x.id}" title="수정">✏️</button>
            <button class="icon-x" data-act="exam-del" data-id="${x.id}" title="삭제">✕</button>
          </div>`;
        }).join('')}</div>` : '<div class="empty">아직 등록된 시험이 없어요</div>'}
        <form class="add-form" data-form="exam">
          <input class="in grow" name="name" placeholder="시험·지원 이름" maxlength="60" autocomplete="off" required>
          <input class="in date" type="date" name="date" required>
          <select class="in" name="type"><option>시험</option><option>지원</option><option>면접</option></select>
          <input class="in grow" name="memo" placeholder="메모 (선택)" maxlength="60">
          <button class="btn primary" type="submit">추가</button>
        </form>
      </div>
    </section>`;
}

/* ───────────── finance modal ───────────── */
function financeStats() {
  const y = finMonth.getFullYear(), m = finMonth.getMonth();
  const prefix = `${y}-${pad2(m + 1)}`;
  const spent = state.finance.expenses.filter(e => (e.date || '').startsWith(prefix))
    .reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0);
  let planned = 0;
  for (let d = 1; d <= daysInMonth(y, m); d++) planned += plannedSum(`${prefix}-${pad2(d)}`);
  return { spent, planned };
}

function financeCalendar() {
  const y = finMonth.getFullYear(), m = finMonth.getMonth();
  const tISO = todayISO();
  const head = `<span class="wd">일</span><span class="wd">월</span><span class="wd">화</span><span class="wd">수</span><span class="wd">목</span><span class="wd">금</span><span class="wd">토</span>`;
  const cells = monthCells(y, m).map(d => {
    if (!d) return '<span></span>';
    const ds = isoOf(d);
    const sp = spentOn(ds), pl = plannedSum(ds);
    const cls = ['fcal-day', ds === tISO ? 'today' : '', ds === finSel ? 'sel' : ''].join(' ');
    return `<button class="${cls}" data-act="fin-day" data-date="${ds}">
      <span class="dn">${d.getDate()}</span>
      ${sp ? `<span class="sp">${won(sp)}</span>` : ''}
      ${pl ? `<span class="pl">+${won(pl)}</span>` : ''}
    </button>`;
  }).join('');
  return `<div class="fcal">${head}${cells}</div>`;
}

function finDayPanel() {
  const ds = finSel || todayISO();
  const exps = expensesOn(ds).sort((a, b) => (a.id > b.id ? 1 : -1));
  const plans = plannedOn(ds);
  const total = spentOn(ds);
  return `<div class="sec-card">
    <div class="sec-head" style="margin:0">
      <h3><span class="em">🧾</span>${fmtDateKo(ds)}</h3>
      <span class="sec-note">지출 ₩${won(total)}${plans.length ? ` · 예정 ₩${won(plannedSum(ds))}` : ''}</span>
    </div>
    ${exps.length ? `<div class="row-list">${exps.map(e => `
      <div class="drow">
        <span class="grow">${esc(e.title)} <span class="muted">${esc(e.cat || '기타')}${e.memo ? ' · ' + esc(e.memo) : ''}</span></span>
        <span class="dday-pill">₩${won(e.amount)}</span>
        <button class="icon-x" data-act="exp-del" data-id="${e.id}">✕</button>
      </div>`).join('')}</div>` : '<div class="empty">이 날 쓴 내역이 없어요</div>'}
    ${plans.length ? `<div class="row-list">${plans.map(p => `
      <div class="drow" style="border-style:dashed">
        <span class="grow">${esc(p.name)} <span class="muted">${esc(p.kind)}</span></span>
        <span class="dday-pill">＋₩${won(p.amount)}</span>
      </div>`).join('')}</div>` : ''}
    <form class="add-form" data-form="expense" data-date="${ds}">
      <input class="in grow" name="title" placeholder="내역 (예: 점심 김밥)" maxlength="50" required>
      <input class="in num" name="amount" inputmode="numeric" placeholder="금액" required>
      <select class="in" name="cat">
        <option>식비</option><option>카페</option><option>교통</option><option>쇼핑</option>
        <option>생활</option><option>병원·약</option><option>공부</option><option>기타</option>
      </select>
      <button class="btn primary" type="submit">추가</button>
    </form>
  </div>`;
}

function renderFinanceModal() {
  const st = financeStats();
  const goals = state.finance.goals;
  const invest = state.finance.invest;
  const subs = state.finance.subs;
  const subsTotal = subs.filter(s => s.active).reduce((a, s) => a + (Number(s.amount) || 0), 0);
  return `
    <div class="stat-row">
      <div class="stat spend"><div class="k">이번 달 총 지출</div><div class="v">₩${won(st.spent)}</div></div>
      <div class="stat plan"><div class="k">앞으로 나갈 예정</div><div class="v">₩${won(st.planned)}</div></div>
      <div class="stat"><div class="k">활성 구독 · 매달</div><div class="v">₩${won(subsTotal)}<small> /월</small></div></div>
    </div>

    <section class="sec">
      <div class="sec-head">
        <h3><span class="em">🗓</span>가계부 캘린더</h3>
        <div class="cal-nav" style="margin-left:auto">
          <button class="mini-btn" data-act="fin-prev">‹</button>
          <button class="mini-btn wide" data-act="fin-today">이번 달</button>
          <button class="mini-btn" data-act="fin-next">›</button>
        </div>
      </div>
      <div class="sec-card">
        <div class="cal-title" style="font-size:13px;color:#8ba3b5;font-family:var(--font-num);margin-bottom:2px">
          ${finMonth.getFullYear()}년 ${finMonth.getMonth() + 1}월 · 파란 숫자=지출, 주황=예정
        </div>
        ${financeCalendar()}
      </div>
      ${finDayPanel()}
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🏦</span>재무목표</h3><span class="sec-count">${goals.length}</span></div>
      ${goals.length ? goals.map(g => {
        const target = Number(g.target) || 0, saved = Number(g.saved) || 0;
        const pct = target > 0 ? Math.min(100, Math.round(saved / target * 100)) : 0;
        const left = g.deadline ? daysBetween(todayISO(), g.deadline) : null;
        return `<div class="goal-card">
          <div class="goal-top">
            <span class="goal-name">${esc(g.name)}</span>
            <span class="goal-amt">₩${won(saved)} / ₩${won(target)}</span>
            <span class="goal-pct">${pct}%</span>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <div class="goal-bot">
            <span>${g.deadline ? `기한 ${fmtDateShort(g.deadline)}${left != null ? ` · ${left >= 0 ? left + '일 남음' : Math.abs(left) + '일 지남'}` : ''}` : '기한 없음'}</span>
            <span>
              <button class="icon-x" data-act="fgoal-edit" data-id="${g.id}">✏️</button>
              <button class="icon-x" data-act="fgoal-del" data-id="${g.id}">✕</button>
            </span>
          </div>
        </div>`;
      }).join('') : '<div class="empty">목표를 세워보면 진행률이 여기에 차곡차곡 쌓여요</div>'}
      <form class="add-form" data-form="fgoal">
        <input class="in grow" name="name" placeholder="목표 이름 (예: 비상금 300만)" maxlength="40" required>
        <input class="in num" name="target" inputmode="numeric" placeholder="목표금액" required>
        <input class="in num" name="saved" inputmode="numeric" placeholder="현재모은금액">
        <input class="in date" type="date" name="deadline">
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">📈</span>투자</h3><span class="sec-count">${invest.length}</span></div>
      ${invest.length ? `<div class="row-list">${invest.map(v => `
        <div class="drow">
          <span class="tag ${v.stance === '매수검토' ? 'soon' : ''}">${esc(v.stance)}</span>
          <span class="grow"><b>${esc(v.name)}</b>${v.memo ? ` <span class="muted">${esc(v.memo)}</span>` : ''}</span>
          <button class="icon-x" data-act="invest-edit" data-id="${v.id}">✏️</button>
          <button class="icon-x" data-act="invest-del" data-id="${v.id}">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">관심 종목·주제를 메모처럼 모아둘 수 있어요</div>'}
      <form class="add-form" data-form="invest">
        <input class="in grow" name="name" placeholder="종목·주제" maxlength="40" required>
        <select class="in" name="stance"><option>관망</option><option>매수검토</option><option>보유</option></select>
        <input class="in grow" name="memo" placeholder="메모" maxlength="80">
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🔁</span>정기구독 관리</h3><span class="sec-count">${subs.filter(s => s.active).length}개 활성</span></div>
      ${subs.length ? `<div class="row-list">${subs.map(s => `
        <div class="drow">
          <button class="switch ${s.active ? 'on' : ''}" data-act="sub-toggle" data-id="${s.id}" aria-label="활성"></button>
          <span class="grow"><b>${esc(s.name)}</b> <span class="muted">매월 ${esc(String(s.day))}일</span></span>
          <span class="dday-pill">₩${won(s.amount)}</span>
          <button class="icon-x" data-act="sub-edit" data-id="${s.id}">✏️</button>
          <button class="icon-x" data-act="sub-del" data-id="${s.id}">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">활성 구독은 결제일마다 캘린더에 예정 금액으로 자동 표시돼요</div>'}
      <form class="add-form" data-form="sub">
        <input class="in grow" name="name" placeholder="서비스명 (예: 유튜브 프리미엄)" maxlength="40" required>
        <input class="in num" name="amount" inputmode="numeric" placeholder="월 금액" required>
        <input class="in num" name="day" inputmode="numeric" placeholder="결제일" required>
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>`;
}

/* ───────────── wishlist modal ───────────── */
function renderWishModal() {
  const want = state.wish.want, need = state.wish.need;
  const wantTotal = want.reduce((s, w) => s + (Number(w.price) || 0), 0);
  const needTotal = need.filter(n => n.status !== '완료').reduce((s, w) => s + (Number(w.price) || 0), 0);
  return `
    <div class="stat-row">
      <div class="stat"><div class="k">사고 싶은 것</div><div class="v">${want.length}<small>개</small></div></div>
      <div class="stat plan"><div class="k">예상 금액</div><div class="v">₩${won(wantTotal)}</div></div>
      <div class="stat spend"><div class="k">사야 하는 것</div><div class="v">₩${won(needTotal)}</div></div>
    </div>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🎀</span>사고 싶은 것</h3><span class="sec-count">${want.length}</span></div>
      ${want.length ? `<div class="row-list">${want.map(w => `
        <div class="drow">
          <span class="grow"><b>${esc(w.name)}</b>${w.memo ? ` <span class="muted">${esc(w.memo)}</span>` : ''}
            ${w.link ? `<a class="muted" href="${esc(w.link)}" target="_blank" rel="noopener" style="text-decoration:underline">링크</a>` : ''}</span>
          <span class="dday-pill">₩${won(w.price)}</span>
          <button class="btn tiny" data-act="want-to-need" data-id="${w.id}">사야하는 것 →</button>
          <button class="icon-x" data-act="want-edit" data-id="${w.id}">✏️</button>
          <button class="icon-x" data-act="want-del" data-id="${w.id}">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">갖고 싶은 걸 편하게 적어두세요 🤍</div>'}
      <form class="add-form" data-form="want">
        <input class="in grow" name="name" placeholder="품목" maxlength="50" required>
        <input class="in num" name="price" inputmode="numeric" placeholder="예상 가격">
        <input class="in grow" name="link" placeholder="링크 (선택)" maxlength="300">
        <input class="in grow" name="memo" placeholder="메모" maxlength="80">
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>

    <section class="sec">
      <div class="sec-head">
        <h3><span class="em">🧺</span>사야 하는 것</h3><span class="sec-count">${need.length}</span>
        <span class="sec-note">구매 예정으로 넘기면 가계부 캘린더에 자동 반영</span>
      </div>
      ${need.length ? `<div class="row-list">${need.map(n => `
        <div class="drow">
          <span class="tag ${n.status === '완료' ? 'done' : n.status === '예정' ? 'soon' : ''}">${esc(n.status || '미구매')}</span>
          <span class="grow"><b>${esc(n.name)}</b>${n.plannedDate ? ` <span class="muted">${fmtDateShort(n.plannedDate)} 구매 예정 · ₩${won(n.plannedAmount)}</span>` : ''}${n.boughtDate ? ` <span class="muted">${fmtDateShort(n.boughtDate)} 구매</span>` : ''}</span>
          <span class="dday-pill">₩${won(n.price)}</span>
          ${n.status === '완료'
            ? `<button class="btn tiny" data-act="need-reopen" data-id="${n.id}">되돌리기</button>`
            : `<button class="btn tiny" data-act="need-plan" data-id="${n.id}">구매 예정으로</button>
               <button class="btn tiny" data-act="need-buy" data-id="${n.id}">구매 완료</button>`}
          <button class="icon-x" data-act="need-edit" data-id="${n.id}">✏️</button>
          <button class="icon-x" data-act="need-del" data-id="${n.id}">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">사야 하는 물건을 모아두면 구매 예정일을 잡아 가계부에 바로 넣을 수 있어요</div>'}
      <form class="add-form" data-form="need">
        <input class="in grow" name="name" placeholder="품목" maxlength="50" required>
        <input class="in num" name="price" inputmode="numeric" placeholder="가격">
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>`;
}

/* ───────────── memo modal ───────────── */
const MOODS = ['🤍', '🥰', '🙂', '😐', '🥲', '😴', '🔥'];

function weekDates(base = new Date()) {
  const d = new Date(base); const dow = d.getDay();
  const monday = new Date(d); monday.setDate(d.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return isoOf(x); });
}

function renderMemoModal() {
  const today = todayISO();
  const todayEntry = state.memo.diary.find(d => d.date === today);
  const diary = [...state.memo.diary].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const habits = state.memo.habits;
  const week = weekDates();
  const notes = [...state.memo.notes].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return `
    <section class="sec">
      <div class="sec-head"><h3><span class="em">🌤</span>한줄일기</h3><span class="sec-count">${state.memo.diary.length}일</span></div>
      <div class="sec-card">
        <div class="mood-row">
          ${MOODS.map(m => `<button class="mood-btn ${todayEntry && todayEntry.mood === m ? 'on' : ''}" data-act="mood" data-mood="${m}">${m}</button>`).join('')}
        </div>
        <form class="add-form" data-form="diary">
          <input class="in grow" name="text" maxlength="140" placeholder="오늘 한 줄 (${fmtDateKo(today)})" value="${todayEntry ? esc(todayEntry.text) : ''}" autocomplete="off">
          <button class="btn primary" type="submit">${todayEntry ? '수정' : '저장'}</button>
        </form>
      </div>
      ${diary.length ? `<div class="row-list">${diary.map(d => `
        <div class="diary-row">
          <span class="sq">${esc(d.mood || '🤍')}</span>
          <span class="grow"><span class="dt">${fmtDateKo(d.date)}</span><br><span class="tx">${esc(d.text)}</span></span>
          <button class="icon-x" data-act="diary-del" data-id="${d.id}">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">오늘의 기분을 이모지로 남겨보세요</div>'}
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🌱</span>습관 · 루틴</h3><span class="sec-count">이번 주</span></div>
      <div class="sec-card">
        ${habits.length ? `<div class="habit-grid">
          <span></span>${week.map(d => `<span class="hd">${WEEK_KO[parseISO(d).getDay()]}</span>`).join('')}
          ${habits.map(h => `<span class="hn" title="${esc(h.name)}"><span>${esc(h.name)}</span><button class="icon-x hx" data-act="habit-del" data-id="${h.id}" aria-label="습관 삭제">✕</button></span>${week.map(d => {
            const on = !!(h.log && h.log[d]);
            const future = d > today;
            return `<button class="h-cell ${on ? 'on' : ''} ${d === today ? 'today' : ''} ${future ? 'future' : ''}" data-act="habit-toggle" data-id="${h.id}" data-date="${d}">${on ? '✓' : ''}</button>`;
          }).join('')}`).join('')}
        </div>` : '<div class="empty">지키고 싶은 루틴을 추가하고 매일 체크해보세요</div>'}
        <form class="add-form" data-form="habit">
          <input class="in grow" name="name" maxlength="30" placeholder="예: 물 2L 마시기" autocomplete="off">
          <button class="btn primary" type="submit">추가</button>
        </form>
      </div>
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">📝</span>메모</h3><span class="sec-count">${notes.length}</span></div>
      ${notes.length ? notes.map(n => `
        <div class="note-card">
          <h4>${esc(n.title || '제목 없음')}</h4>
          <p>${esc(n.body)}</p>
          <div class="nfoot">
            <span>${n.updated ? new Date(n.updated).toLocaleDateString('ko-KR') : ''}</span>
            <button class="icon-x" data-act="note-edit" data-id="${n.id}">✏️</button>
            <button class="icon-x" data-act="note-del" data-id="${n.id}">✕</button>
          </div>
        </div>`).join('') : '<div class="empty">자유롭게 적는 메모 카드가 여기 쌓여요</div>'}
      <form class="add-form" data-form="note">
        <input class="in" name="title" placeholder="제목" maxlength="60">
        <input class="in grow" name="body" placeholder="내용" maxlength="2000">
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>`;
}

/* ───────────── day modal ───────────── */
const CATS = ['study', 'personal', 'health', 'trip', 'work'];
const CAT_LABEL = { study: '학업·시험', personal: '개인일정', health: '건강', trip: '여행', work: '알바' };

function renderDayModal(dateStr) {
  const ds = dateStr;
  const exms = examsOn(ds);
  const evs = eventsOn(ds);
  const exps = expensesOn(ds);
  const plans = plannedOn(ds);
  return `
    <section class="sec">
      <div class="sec-head"><h3><span class="em">📌</span>일정</h3><span class="sec-count">${evs.length + exms.length}</span></div>
      ${evs.length || exms.length ? `<div class="row-list">
        ${exms.map(x => `<div class="drow"><span class="tag ${esc(x.type)}">${esc(x.type)}</span><span class="grow"><b>${esc(x.name)}</b>${x.memo ? ` <span class="muted">${esc(x.memo)}</span>` : ''}</span></div>`).join('')}
        ${evs.map(e => `<div class="drow">
          <span class="tag ${esc(e.category || 'personal')}">${esc(CAT_LABEL[e.category] || '일정')}</span>
          <span class="grow">${e.start ? `<b>${esc(e.start)}</b> ` : ''}${esc(e.title)}${e.repeat === 'weekly' ? ' <span class="muted">(매주)</span>' : ''}</span>
          <button class="icon-x" data-act="event-del" data-id="${e.id}">✕</button>
        </div>`).join('')}
      </div>` : '<div class="empty">이 날은 비어 있어요 · 아래에서 일정을 추가할 수 있어요</div>'}
      <form class="add-form" data-form="event" data-date="${ds}">
        <input class="in grow" name="title" placeholder="일정 이름" maxlength="60" required>
        <input class="in time" type="time" name="start">
        <select class="in" name="category">${CATS.map(c => `<option value="${c}">${CAT_LABEL[c]}</option>`).join('')}</select>
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🪙</span>지출</h3><span class="sec-count">₩${won(spentOn(ds))}</span></div>
      ${exps.length ? `<div class="row-list">${exps.map(e => `
        <div class="drow">
          <span class="grow">${esc(e.title)} <span class="muted">${esc(e.cat || '기타')}${e.memo ? ' · ' + esc(e.memo) : ''}</span></span>
          <span class="dday-pill">₩${won(e.amount)}</span>
          <button class="icon-x" data-act="exp-del" data-id="${e.id}">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">아직 기록이 없어요</div>'}
      ${plans.length ? `<div class="row-list">${plans.map(p => `
        <div class="drow" style="border-style:dashed">
          <span class="grow">${esc(p.name)} <span class="muted">${esc(p.kind)}</span></span>
          <span class="dday-pill">＋₩${won(p.amount)}</span>
        </div>`).join('')}</div>` : ''}
      <form class="add-form" data-form="expense" data-date="${ds}">
        <input class="in grow" name="title" placeholder="내역" maxlength="50" required>
        <input class="in num" name="amount" inputmode="numeric" placeholder="금액" required>
        <select class="in" name="cat">
          <option>식비</option><option>카페</option><option>교통</option><option>쇼핑</option>
          <option>생활</option><option>병원·약</option><option>공부</option><option>기타</option>
        </select>
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>`;
}

/* ───────────── settings modal ───────────── */
function renderSettingsModal() {
  const code = state.sync.code || '';
  return `
    <div class="set-grid">
      <div class="set-card">
        <h4>🖼 상단 커버</h4>
        <img class="thumb" src="${state.cover ? esc(state.cover) : 'assets/cover-sky-cat.jpg'}" alt="cover">
        <div class="add-form">
          <button class="btn" data-act="pick-cover">이미지 올리기</button>
          <button class="btn flat" data-act="reset-cover">기본으로</button>
        </div>
        <div class="hint">사진을 올리면 아이패드 화면에 맞게 자동으로 줄여 저장해요.</div>
      </div>
      <div class="set-card">
        <h4>🐱 고양이 카드</h4>
        <img class="thumb" src="${state.cat ? esc(state.cat) : 'assets/cat-card.jpg'}" alt="cat">
        <div class="add-form">
          <button class="btn" data-act="pick-cat">사진 바꾸기</button>
          <button class="btn flat" data-act="reset-cat">기본으로</button>
        </div>
        <div class="hint">오늘의 고양이 자리에 넣을 사진을 골라주세요.</div>
      </div>
    </div>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">✍️</span>제목 · 인용구</h3></div>
      <div class="sec-card">
        <div class="add-form">
          <input class="in grow" id="setTitle" value="${esc(state.title)}" placeholder="제목" maxlength="40">
          <input class="in grow" id="setQuote" value="${esc(state.quote)}" placeholder="인용구" maxlength="80">
          <button class="btn primary" data-act="save-hero-text">저장</button>
        </div>
        <div class="hint">홈 화면에서 제목과 인용구를 직접 눌러 고쳐도 바로 저장돼요.</div>
      </div>
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">☁️</span>동기화</h3><span class="sec-note">아이패드 ↔ 아이폰 실시간</span></div>
      <div class="sec-card">
        <div class="code-box">
          <span class="code ${state.sync.enabled ? '' : 'blur'}" id="codeView">${esc(code)}</span>
          <button class="btn tiny" data-act="copy-code">복사</button>
        </div>
        <div class="add-form">
          <button class="btn" data-act="sync-now">지금 동기화</button>
          <button class="btn" data-act="join-code">다른 기기 코드 입력</button>
          <button class="btn flat" data-act="new-code">새 코드 만들기</button>
        </div>
        <div class="hint">같은 코드를 넣은 기기끼리 자동으로 맞춰져요. 기본 코드는 앱에 들어 있으니, 나만의 비밀 코드로 바꾸면 더 안전해요. (바꾸면 다른 기기에서도 새 코드를 입력해야 해요.)</div>
        <div class="hint" id="syncDetail">${esc(syncDetailText())}</div>
      </div>
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">💾</span>데이터</h3></div>
      <div class="sec-card">
        <div class="add-form">
          <button class="btn" data-act="export-json">JSON 내보내기</button>
          <button class="btn" data-act="import-json">JSON 불러오기</button>
          <button class="btn flat" data-act="reset-all">전체 초기화</button>
        </div>
        <div class="hint">내보낸 파일은 아이패드 '파일' 앱에 저장돼요. 기기를 바꾸거나 백업할 때 쓰면 좋아요.</div>
      </div>
    </section>`;
}

/* ───────────── sync (Supabase + AES-GCM) ───────────── */
const SB_URL = 'https://dwsvrpxppmicykxuhkhg.supabase.co';
const SB_KEY = 'sb_publishable_Xd0zebf6GG3fA43uC0Cl8w_ZzH4bZyr';
const TE = new TextEncoder(), TD = new TextDecoder();

let sbClient = null, sbChannel = null, pushTimer = null, applyingRemote = false;
let lastSyncAt = 0, syncKind = '', syncMsg = '준비 중…', started = false;

const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
const unb64 = s => { const bin = atob(s); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr; };
const cryptoOk = () => !!(window.crypto && window.crypto.subtle && window.isSecureContext !== false);

async function sha256Hex(str) {
  const h = await crypto.subtle.digest('SHA-256', TE.encode(str));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function deriveKey(code, saltB64) {
  const base = await crypto.subtle.importKey('raw', TE.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: 120000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(obj, code) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, TE.encode(JSON.stringify(obj)));
  return { v: 1, s: salt, iv: b64(iv), ct: b64(ct) };
}
async function unseal(payload, code) {
  const key = await deriveKey(code, payload.s);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.ct));
  return JSON.parse(TD.decode(pt));
}
async function rowIdFor(code) {
  const h = await sha256Hex('gayeon-dashboard::' + code);
  return 'gayeon-dash-' + h.slice(0, 16);
}
function getClient() {
  if (!window.supabase) return null;
  if (!sbClient) sbClient = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  return sbClient;
}
function stripLocal(s) {
  const copy = JSON.parse(JSON.stringify(s));
  delete copy.sync;
  delete copy.meta;
  return copy;
}
function setSync(kind, msg) {
  syncKind = kind; syncMsg = msg;
  renderSyncBadge();
  const d = $('#syncDetail'); if (d) d.textContent = syncDetailText();
}
function syncDetailText() {
  const when = lastSyncAt ? new Date(lastSyncAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '아직 없음';
  return `마지막 동기화: ${when} · ${syncMsg}`;
}
function relTime(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return `${Math.floor(s / 3600)}시간 전`;
}
function renderSyncBadge() {
  const el = $('#syncBadge'); if (!el) return;
  if (!state.sync || !state.sync.code) { el.className = 'sync-badge'; el.textContent = '이 기기에만 저장 중'; return; }
  el.className = 'sync-badge ' + (syncKind || '');
  const icon = syncKind === 'ok' ? '🟢' : syncKind === 'warn' ? '🟡' : '☁️';
  el.textContent = `${icon} ${syncMsg}${lastSyncAt ? ' · ' + relTime(lastSyncAt) : ''}`;
}

async function cloudPush() {
  if (!state.sync || !state.sync.code) return;
  if (!cryptoOk()) { setSync('warn', '보안 연결(https)에서만 동기화돼요'); return; }
  const client = getClient();
  if (!client) { setSync('warn', '동기화 모듈을 불러오는 중'); return; }
  try {
    const rowId = await rowIdFor(state.sync.code);
    const payload = { updatedAt: state.updatedAt, state: stripLocal(state) };
    const data = await seal(payload, state.sync.code);
    const { error } = await client.from('trip_dashboards').upsert(
      { sync_id: rowId, data, updated_at: new Date().toISOString() }, { onConflict: 'sync_id' });
    if (error) throw error;
    lastSyncAt = Date.now();
    setSync('ok', '동기화됨');
  } catch (e) {
    console.warn('push failed', e);
    setSync('warn', navigator.onLine === false ? '오프라인 · 기기에 저장됨' : '동기화 실패 · 기기에 저장됨');
  }
}

async function cloudPull() {
  const client = getClient();
  if (!client) return null;
  const rowId = await rowIdFor(state.sync.code);
  const { data, error } = await client.from('trip_dashboards').select('data,updated_at').eq('sync_id', rowId).maybeSingle();
  if (error) throw error;
  if (!data || !data.data) return null;
  if (!data.data.ct) return null;
  const remote = await unseal(data.data, state.sync.code);
  return remote;
}

function applyRemote(remote) {
  if (!remote || !remote.state) return;
  applyingRemote = true;
  const code = state.sync.code;
  state = normalize(remote.state);
  state.sync = { code, enabled: true };
  state.meta = { pristine: false };
  state.updatedAt = remote.updatedAt || Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  lastSyncAt = Date.now();
  renderAll();
  applyingRemote = false;
}

function schedulePush() {
  if (!started || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { cloudPush(); }, 1200);
}

async function startSync() {
  started = true;
  if (!state.sync || !state.sync.code) { setSync('', '이 기기에만 저장 중'); return; }
  setSync('', '동기화 확인 중…');
  let remote = null;
  try { remote = await cloudPull(); }
  catch (e) { console.warn('pull failed', e); }
  if (remote) {
    if (state.meta && state.meta.pristine) { applyRemote(remote); setSync('ok', '클라우드에서 불러옴'); }
    else if ((remote.updatedAt || 0) > (state.updatedAt || 0)) { applyRemote(remote); setSync('ok', '최신 내용으로 맞춤'); }
    else { await cloudPush(); }
  } else {
    await cloudPush();
  }
  subscribeRealtime();
  setInterval(() => { if (!document.hidden) tickSync(); }, 60000);
}

async function tickSync() {
  if (!state.sync || !state.sync.code || applyingRemote) return;
  try {
    const remote = await cloudPull();
    if (remote && (remote.updatedAt || 0) > (state.updatedAt || 0)) {
      applyRemote(remote);
      setSync('ok', '다른 기기에서 업데이트');
    } else if (!remote) { await cloudPush(); }
  } catch (e) { /* silent */ }
}

function subscribeRealtime() {
  const client = getClient(); if (!client) return;
  if (sbChannel) { try { client.removeChannel(sbChannel); } catch (e) {} sbChannel = null; }
  rowIdFor(state.sync.code).then(rowId => {
    sbChannel = client.channel('gayeon-' + rowId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_dashboards', filter: `sync_id=eq.${rowId}` },
        () => { setTimeout(tickSync, 400); })
      .subscribe();
  }).catch(() => {});
}

/* ───────────── prompt ───────────── */
function askPrompt(opts) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'prompt';
    wrap.innerHTML = `<div class="prompt-box">
      <h4>${esc(opts.title || '')}</h4>
      ${opts.message ? `<p>${esc(opts.message)}</p>` : ''}
      ${(opts.fields || []).map(f => `<label class="pf">
        <span>${esc(f.label || '')}</span>
        ${f.type === 'select'
          ? `<select class="in" name="${esc(f.key)}">${(f.options || []).map(o => `<option ${o === f.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
          : `<input class="in" name="${esc(f.key)}" type="${esc(f.type || 'text')}" value="${esc(f.value == null ? '' : f.value)}" placeholder="${esc(f.placeholder || '')}" ${f.inputmode ? `inputmode="${esc(f.inputmode)}"` : ''}>`}
      </label>`).join('')}
      <div class="row">
        <button class="btn flat" data-x="cancel">취소</button>
        <button class="btn primary" data-x="ok">${esc(opts.confirmText || '확인')}</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const done = val => { wrap.remove(); resolve(val); };
    wrap.addEventListener('click', ev => {
      if (ev.target === wrap) return done(null);
      const b = ev.target.closest('[data-x]');
      if (!b) return;
      if (b.dataset.x === 'cancel') return done(null);
      const out = {};
      (opts.fields || []).forEach(f => { const el = wrap.querySelector(`[name="${f.key}"]`); out[f.key] = el ? el.value : ''; });
      done(out);
    });
    wrap.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const ok = wrap.querySelector('[data-x="ok"]'); if (ok) ok.click(); } });
    const first = wrap.querySelector('input,select'); if (first) setTimeout(() => first.focus(), 60);
  });
}

/* ───────────── toast ───────────── */
let toastTimer = null;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ───────────── forms ───────────── */
/* form.name 같은 이름 충돌을 피하려고 항상 name 속성으로 직접 찾는다 */
const F = (form, name) => form.querySelector(`[name="${name}"]`);
const fv = (form, name) => { const el = F(form, name); return el ? String(el.value || '').trim() : ''; };

const FORMS = {
  goal(form) {
    const scope = form.dataset.scope;
    const text = fv(form, 'text'); if (!text) return;
    state.study[scope].push({ id: uid(), text, done: false });
    form.reset(); commit();
  },
  exam(form) {
    const name = fv(form, 'name'), date = fv(form, 'date'), type = fv(form, 'type') || '시험', memo = fv(form, 'memo');
    if (!name || !date) return toast('이름과 날짜를 채워주세요');
    state.study.exams.push({ id: uid(), name, date, type, memo });
    commit(); toast('시험·지원 일정을 추가했어요 · D-DAY에 반영됐어요');
  },
  expense(form) {
    const title = fv(form, 'title'); const amount = clampNum(fv(form, 'amount'));
    if (!title || !amount) return toast('내역과 금액을 채워주세요');
    state.finance.expenses.push({ id: uid(), date: form.dataset.date, title, amount, cat: fv(form, 'cat') || '기타', memo: '' });
    commit();
  },
  fgoal(form) {
    const name = fv(form, 'name'); if (!name) return;
    state.finance.goals.push({ id: uid(), name, target: clampNum(fv(form, 'target')), saved: clampNum(fv(form, 'saved')), deadline: fv(form, 'deadline') });
    commit();
  },
  invest(form) {
    const name = fv(form, 'name'); if (!name) return;
    state.finance.invest.push({ id: uid(), name, stance: fv(form, 'stance') || '관망', memo: fv(form, 'memo') });
    commit();
  },
  sub(form) {
    const name = fv(form, 'name'); const amount = clampNum(fv(form, 'amount')); let day = clampNum(fv(form, 'day'));
    if (!name || !amount || !day) return toast('서비스명·금액·결제일을 채워주세요');
    if (day < 1) day = 1; if (day > 31) day = 31;
    state.finance.subs.push({ id: uid(), name, amount, day, active: true });
    commit();
  },
  want(form) {
    const name = fv(form, 'name'); if (!name) return;
    state.wish.want.push({ id: uid(), name, price: clampNum(fv(form, 'price')), link: fv(form, 'link'), memo: fv(form, 'memo') });
    commit();
  },
  need(form) {
    const name = fv(form, 'name'); if (!name) return;
    state.wish.need.push({ id: uid(), name, price: clampNum(fv(form, 'price')), status: '미구매' });
    commit();
  },
  diary(form) {
    const text = fv(form, 'text'); if (!text) return;
    const date = todayISO();
    const entry = state.memo.diary.find(d => d.date === date);
    if (entry) { entry.text = text; entry.mood = state._moodDraft || entry.mood || '🤍'; }
    else state.memo.diary.push({ id: uid(), date, mood: state._moodDraft || '🤍', text });
    commit(); toast('한줄일기 저장 🤍');
  },
  habit(form) {
    const name = fv(form, 'name'); if (!name) return;
    state.memo.habits.push({ id: uid(), name, log: {} });
    form.reset(); commit();
  },
  note(form) {
    const title = fv(form, 'title'), body = fv(form, 'body');
    if (!title && !body) return;
    state.memo.notes.push({ id: uid(), title: title || '제목 없음', body, updated: Date.now() });
    commit();
  },
  event(form) {
    const title = fv(form, 'title'); if (!title) return;
    state.events.push({ id: uid(), title, date: form.dataset.date, end: null, start: fv(form, 'start') || null, endTime: null, category: fv(form, 'category') || 'personal' });
    commit();
  },
};

document.addEventListener('submit', ev => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  const fn = FORMS[form.dataset.form];
  if (fn) fn(form);
});

/* ───────────── click actions ───────────── */
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const id = t.dataset.id;

  switch (act) {
    /* modal open/close */
    case 'open-study': openModal('study'); break;
    case 'open-finance': openModal('finance'); break;
    case 'open-wishlist': openModal('wishlist'); break;
    case 'open-memo': openModal('memo'); break;
    case 'open-settings': openModal('settings'); break;
    case 'modal-close': closeModal(); break;
    case 'open-day': openModal('day', t.dataset.date); break;

    /* calendar */
    case 'cal-prev': viewMonth.setMonth(viewMonth.getMonth() - 1); renderCalendar(); break;
    case 'cal-next': viewMonth.setMonth(viewMonth.getMonth() + 1); renderCalendar(); break;
    case 'cal-today': viewMonth = new Date(); viewMonth.setDate(1); renderCalendar(); break;
    case 'fin-prev': finMonth.setMonth(finMonth.getMonth() - 1); renderFinanceModalAndKeep(); break;
    case 'fin-next': finMonth.setMonth(finMonth.getMonth() + 1); renderFinanceModalAndKeep(); break;
    case 'fin-today': finMonth = new Date(); finMonth.setDate(1); renderFinanceModalAndKeep(); break;
    case 'fin-day': finSel = t.dataset.date; renderFinanceModalAndKeep(); break;

    /* todo */
    case 'todo-toggle': {
      const it = state.todo.find(x => x.id === id); if (it) { it.done = !it.done; commit(); } break;
    }
    case 'todo-del': state.todo = state.todo.filter(x => x.id !== id); commit(); break;

    /* study goals */
    case 'goal-toggle': {
      const scope = t.dataset.scope; const it = state.study[scope].find(x => x.id === id);
      if (it) { it.done = !it.done; commit(); } break;
    }
    case 'goal-del': {
      const scope = t.dataset.scope;
      state.study[scope] = state.study[scope].filter(x => x.id !== id); commit(); break;
    }
    case 'exam-del': state.study.exams = state.study.exams.filter(x => x.id !== id); commit(); break;
    case 'exam-edit': {
      const x = state.study.exams.find(e => e.id === id); if (!x) break;
      const r = await askPrompt({
        title: '시험·지원 수정',
        fields: [
          { key: 'name', label: '이름', value: x.name },
          { key: 'date', label: '날짜', type: 'date', value: x.date },
          { key: 'type', label: '구분', type: 'select', options: ['시험', '지원', '면접'], value: x.type },
          { key: 'memo', label: '메모', value: x.memo || '' },
        ],
        confirmText: '저장',
      });
      if (!r) break;
      Object.assign(x, { name: r.name.trim() || x.name, date: r.date || x.date, type: r.type, memo: r.memo.trim() });
      commit(); break;
    }

    /* finance */
    case 'exp-del': state.finance.expenses = state.finance.expenses.filter(x => x.id !== id); commit(); break;
    case 'sub-toggle': { const s = state.finance.subs.find(x => x.id === id); if (s) { s.active = !s.active; commit(); } break; }
    case 'sub-del': state.finance.subs = state.finance.subs.filter(x => x.id !== id); commit(); break;
    case 'sub-edit': {
      const s = state.finance.subs.find(x => x.id === id); if (!s) break;
      const r = await askPrompt({
        title: '정기구독 수정',
        fields: [
          { key: 'name', label: '서비스명', value: s.name },
          { key: 'amount', label: '월 금액', value: s.amount, inputmode: 'numeric' },
          { key: 'day', label: '결제일', value: s.day, inputmode: 'numeric' },
        ], confirmText: '저장',
      });
      if (!r) break;
      Object.assign(s, { name: r.name.trim() || s.name, amount: clampNum(r.amount), day: Math.min(31, Math.max(1, clampNum(r.day) || s.day)) });
      commit(); break;
    }
    case 'fgoal-del': state.finance.goals = state.finance.goals.filter(x => x.id !== id); commit(); break;
    case 'fgoal-edit': {
      const g = state.finance.goals.find(x => x.id === id); if (!g) break;
      const r = await askPrompt({
        title: '재무목표 수정',
        fields: [
          { key: 'name', label: '목표명', value: g.name },
          { key: 'target', label: '목표금액', value: g.target, inputmode: 'numeric' },
          { key: 'saved', label: '현재 모은 금액', value: g.saved, inputmode: 'numeric' },
          { key: 'deadline', label: '기한', type: 'date', value: g.deadline || '' },
        ], confirmText: '저장',
      });
      if (!r) break;
      Object.assign(g, { name: r.name.trim() || g.name, target: clampNum(r.target), saved: clampNum(r.saved), deadline: r.deadline || '' });
      commit(); break;
    }
    case 'invest-del': state.finance.invest = state.finance.invest.filter(x => x.id !== id); commit(); break;
    case 'invest-edit': {
      const v = state.finance.invest.find(x => x.id === id); if (!v) break;
      const r = await askPrompt({
        title: '투자 메모 수정',
        fields: [
          { key: 'name', label: '종목·주제', value: v.name },
          { key: 'stance', label: '판단', type: 'select', options: ['관망', '매수검토', '보유'], value: v.stance },
          { key: 'memo', label: '메모', value: v.memo || '' },
        ], confirmText: '저장',
      });
      if (!r) break;
      Object.assign(v, { name: r.name.trim() || v.name, stance: r.stance, memo: r.memo.trim() });
      commit(); break;
    }

    /* wishlist */
    case 'want-del': state.wish.want = state.wish.want.filter(x => x.id !== id); commit(); break;
    case 'want-edit': {
      const w = state.wish.want.find(x => x.id === id); if (!w) break;
      const r = await askPrompt({
        title: '사고 싶은 것 수정',
        fields: [
          { key: 'name', label: '품목', value: w.name },
          { key: 'price', label: '예상 가격', value: w.price, inputmode: 'numeric' },
          { key: 'link', label: '링크', value: w.link || '' },
          { key: 'memo', label: '메모', value: w.memo || '' },
        ], confirmText: '저장',
      });
      if (!r) break;
      Object.assign(w, { name: r.name.trim() || w.name, price: clampNum(r.price), link: r.link.trim(), memo: r.memo.trim() });
      commit(); break;
    }
    case 'want-to-need': {
      const w = state.wish.want.find(x => x.id === id); if (!w) break;
      state.wish.need.push({ id: uid(), name: w.name, price: Number(w.price) || 0, status: '미구매' });
      state.wish.want = state.wish.want.filter(x => x.id !== id);
      commit(); toast('사야 하는 것에 담았어요');
      break;
    }
    case 'need-del': state.wish.need = state.wish.need.filter(x => x.id !== id); commit(); break;
    case 'need-edit': {
      const n = state.wish.need.find(x => x.id === id); if (!n) break;
      const r = await askPrompt({
        title: '사야 하는 것 수정',
        fields: [
          { key: 'name', label: '품목', value: n.name },
          { key: 'price', label: '가격', value: n.price, inputmode: 'numeric' },
        ], confirmText: '저장',
      });
      if (!r) break;
      Object.assign(n, { name: r.name.trim() || n.name, price: clampNum(r.price) });
      commit(); break;
    }
    case 'need-plan': {
      const n = state.wish.need.find(x => x.id === id); if (!n) break;
      const r = await askPrompt({
        title: '구매 예정으로 넘기기',
        message: '구매 예정일과 금액을 정하면 가계부 캘린더에 예정 지출로 자동 표시돼요.',
        fields: [
          { key: 'date', label: '구매 예정일', type: 'date', value: todayISO() },
          { key: 'amount', label: '금액', value: n.price || '', inputmode: 'numeric' },
        ], confirmText: '넘기기',
      });
      if (!r || !r.date) break;
      const amount = clampNum(r.amount) || Number(n.price) || 0;
      n.status = '예정'; n.plannedDate = r.date; n.plannedAmount = amount;
      state.finance.planned = state.finance.planned.filter(p => p.needId !== n.id);
      state.finance.planned.push({ id: uid(), needId: n.id, name: n.name, date: r.date, amount });
      n.price = n.price || amount;
      commit(); toast('가계부 캘린더에 예정 지출로 넣었어요');
      break;
    }
    case 'need-buy': {
      const n = state.wish.need.find(x => x.id === id); if (!n) break;
      const r = await askPrompt({
        title: '구매 완료',
        message: '구매한 날짜와 금액을 기록하면 가계부에 실제 지출로 들어가요.',
        fields: [
          { key: 'date', label: '구매일', type: 'date', value: n.plannedDate || todayISO() },
          { key: 'amount', label: '금액', value: n.plannedAmount || n.price || '', inputmode: 'numeric' },
        ], confirmText: '완료',
      });
      if (!r || !r.date) break;
      const amount = clampNum(r.amount) || Number(n.price) || 0;
      n.status = '완료'; n.boughtDate = r.date; n.boughtAmount = amount;
      state.finance.planned = state.finance.planned.filter(p => p.needId !== n.id);
      state.finance.expenses.push({ id: uid(), date: r.date, title: n.name, amount, cat: '쇼핑', memo: 'Wishlist 구매' });
      commit(); toast('구매 완료 · 가계부에 지출로 기록했어요');
      break;
    }
    case 'need-reopen': {
      const n = state.wish.need.find(x => x.id === id); if (!n) break;
      n.status = '미구매'; delete n.boughtDate; delete n.boughtAmount;
      commit(); break;
    }

    /* memo */
    case 'mood': {
      state._moodDraft = t.dataset.mood;
      $$('.mood-btn').forEach(b => b.classList.toggle('on', b.dataset.mood === state._moodDraft));
      break;
    }
    case 'diary-del': state.memo.diary = state.memo.diary.filter(x => x.id !== id); commit(); break;
    case 'habit-toggle': {
      const h = state.memo.habits.find(x => x.id === id); if (!h) break;
      h.log = h.log || {};
      const d = t.dataset.date;
      if (h.log[d]) delete h.log[d]; else h.log[d] = true;
      commit(); break;
    }
    case 'habit-del': state.memo.habits = state.memo.habits.filter(x => x.id !== id); commit(); break;
    case 'note-del': state.memo.notes = state.memo.notes.filter(x => x.id !== id); commit(); break;
    case 'note-edit': {
      const n = state.memo.notes.find(x => x.id === id); if (!n) break;
      const r = await askPrompt({
        title: '메모 수정',
        fields: [
          { key: 'title', label: '제목', value: n.title },
          { key: 'body', label: '내용', value: n.body },
        ], confirmText: '저장',
      });
      if (!r) break;
      Object.assign(n, { title: r.title.trim() || n.title, body: r.body.trim(), updated: Date.now() });
      commit(); break;
    }

    /* events */
    case 'event-del': state.events = state.events.filter(x => x.id !== id); commit(); break;

    /* settings */
    case 'pick-cover': $('#coverFile').click(); break;
    case 'pick-cat': $('#catFile').click(); break;
    case 'reset-cover': state.cover = null; commit(); toast('기본 커버로 돌아왔어요'); break;
    case 'reset-cat': state.cat = null; commit(); toast('기본 고양이로 돌아왔어요'); break;
    case 'save-hero-text': {
      state.title = ($('#setTitle').value || 'My Dashboard').trim();
      state.quote = $('#setQuote').value.trim();
      commit(); toast('저장했어요'); break;
    }
    case 'copy-code': {
      try { await navigator.clipboard.writeText(state.sync.code); toast('동기화 코드를 복사했어요'); }
      catch (e) { toast('복사가 막혔어요 · 코드를 길게 눌러 복사해 주세요'); }
      break;
    }
    case 'new-code': {
      const r = await askPrompt({
        title: '새 동기화 코드',
        message: '나만의 코드를 정하면 그 코드를 넣은 기기끼리만 내용이 보여요. 다른 기기에서도 새 코드를 입력해야 이어져요.',
        fields: [{ key: 'code', label: '새 코드', value: state.sync.code, placeholder: '예: MYSKY-0417' }],
        confirmText: '이 코드로 변경',
      });
      if (!r || !r.code.trim()) break;
      state.sync.code = r.code.trim();
      state.sync.enabled = true;
      commit({ push: false });
      started = true;
      await cloudPush();
      subscribeRealtime();
      toast('새 코드로 동기화를 시작했어요');
      break;
    }
    case 'join-code': {
      const r = await askPrompt({
        title: '다른 기기 코드 입력',
        message: '아이패드에 있는 동기화 코드를 넣으면 이 기기로 내용을 그대로 불러와요.',
        fields: [{ key: 'code', label: '동기화 코드', value: '', placeholder: '이전 기기의 코드' }],
        confirmText: '불러오기',
      });
      if (!r || !r.code.trim()) break;
      state.sync.code = r.code.trim();
      state.sync.enabled = true;
      state.meta = { pristine: true };
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
      let remote = null;
      try { remote = await cloudPull(); } catch (e) {}
      if (remote) { applyRemote(remote); toast('다른 기기 내용을 불러왔어요'); }
      else { commit({ push: true }); toast('이 기기 내용을 올렸어요'); }
      subscribeRealtime();
      break;
    }
    case 'sync-now': {
      setSync('', '동기화 중…');
      try {
        const remote = await cloudPull();
        if (remote && (remote.updatedAt || 0) > (state.updatedAt || 0)) { applyRemote(remote); setSync('ok', '최신 내용으로 맞춤'); }
        else { await cloudPush(); }
        toast('동기화했어요');
      } catch (e) { setSync('warn', '지금은 동기화할 수 없어요'); }
      break;
    }
    case 'export-json': {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gayeon-dashboard-${todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      toast('JSON으로 내보냈어요'); break;
    }
    case 'import-json': $('#importFile').click(); break;
    case 'reset-all': {
      const r = await askPrompt({
        title: '전체 초기화',
        message: '이 기기의 대시보드 내용이 모두 지워지고 처음 상태로 돌아가요. 되돌릴 수 없어요.',
        fields: [{ key: 'ok', label: '계속하려면 "초기화"를 입력', placeholder: '초기화' }],
        confirmText: '초기화',
      });
      if (!r || (r.ok || '').trim() !== '초기화') { if (r) toast('입력이 달라서 취소했어요'); break; }
      const code = state.sync.code;
      state = seedState();
      state.sync.code = code;
      state.meta = { pristine: false };
      commit(); toast('초기화했어요'); break;
    }
  }
});

function renderFinanceModalAndKeep() {
  if (openModalType === 'finance') renderModal();
}

/* ───────────── title / quote editing ───────────── */
function bindHeroEditing() {
  const t = $('#pageTitle'), q = $('#quoteText');
  let timer = null;
  const onInput = (el, key) => () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state[key] = el.textContent.trim();
      commit({ soft: true, push: true });
    }, 500);
  };
  t.addEventListener('input', onInput(t, 'title'));
  q.addEventListener('input', onInput(q, 'quote'));
  [t, q].forEach(el => el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); } }));
  t.addEventListener('blur', () => { state.title = t.textContent.trim() || 'My Dashboard'; t.textContent = state.title; commit({ soft: true }); });
  q.addEventListener('blur', () => { state.quote = q.textContent.trim(); commit({ soft: true }); });
}

/* ───────────── images ───────────── */
function resizeImage(file, maxW, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch (e) { reject(e); }
    };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function setupFileInputs() {
  const mk = (id, maxW, key, msg) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.id = id; input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0]; if (!f) return;
      try {
        state[key] = await resizeImage(f, maxW);
        commit(); toast(msg);
      } catch (e) { toast('사진을 읽지 못했어요'); }
      input.value = '';
    });
    return input;
  };
  mk('coverFile', 1600, 'cover', '커버 사진을 바꿨어요');
  mk('catFile', 900, 'cat', '고양이 사진을 바꿨어요');

  const imp = document.createElement('input');
  imp.type = 'file'; imp.accept = 'application/json,.json'; imp.id = 'importFile'; imp.style.display = 'none';
  document.body.appendChild(imp);
  imp.addEventListener('change', () => {
    const f = imp.files && imp.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = JSON.parse(String(fr.result));
        if (!parsed || typeof parsed !== 'object') throw new Error('bad json');
        const code = state.sync.code;
        state = normalize(parsed);
        state.sync = { code, enabled: true };
        state.meta = { pristine: false };
        state.updatedAt = Date.now();
        commit(); toast('불러왔어요');
      } catch (e) { toast('JSON 파일을 읽지 못했어요'); }
      imp.value = '';
    };
    fr.readAsText(f);
  });
}

/* ───────────── clock & weather ───────────── */
function setFlip(el, val) {
  if (!el || el.dataset.v === val) return;
  el.dataset.v = val; el.textContent = val;
  el.classList.remove('flipping'); void el.offsetWidth; el.classList.add('flipping');
}
function tickClock() {
  const d = new Date();
  setFlip($('#flipHour'), pad2(d.getHours()));
  setFlip($('#flipMin'), pad2(d.getMinutes()));
  const s = $('#clockSec'); if (s) s.textContent = pad2(d.getSeconds());
  const w = $('#clockWeek'); if (w) w.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK_KO[d.getDay()]}요일`;
}

const WX = {
  0: ['☀️', '맑음'], 1: ['🌤️', '대체로 맑음'], 2: ['⛅', '구름 조금'], 3: ['☁️', '흐림'],
  45: ['🌫️', '안개'], 48: ['🌫️', '안개'],
  51: ['🌦️', '약한 이슬비'], 53: ['🌦️', '이슬비'], 55: ['🌧️', '이슬비'],
  56: ['🌧️', '어는 이슬비'], 57: ['🌧️', '어는 이슬비'],
  61: ['🌦️', '약한 비'], 63: ['🌧️', '비'], 65: ['🌧️', '강한 비'],
  66: ['🌧️', '어는 비'], 67: ['🌧️', '어는 비'],
  71: ['🌨️', '약한 눈'], 73: ['🌨️', '눈'], 75: ['❄️', '강한 눈'], 77: ['🌨️', '눈알갱이'],
  80: ['🌦️', '소나기'], 81: ['🌧️', '소나기'], 82: ['⛈️', '강한 소나기'],
  85: ['🌨️', '소낙눈'], 86: ['❄️', '소낙눈'],
  95: ['⛈️', '뇌우'], 96: ['⛈️', '뇌우·우박'], 99: ['⛈️', '뇌우·우박'],
};
function paintWeather(j) {
  const cur = j.current || {};
  const daily = j.daily || {};
  const code = cur.weather_code != null ? cur.weather_code : 0;
  const [emoji, label] = WX[code] || ['🌥️', '구름'];
  $('#wxIcon').textContent = emoji;
  $('#wxTemp').textContent = `${Math.round(cur.temperature_2m)}°`;
  $('#wxDesc').textContent = label;
  const hi = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[0]) : null;
  const lo = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[0]) : null;
  const parts = [];
  if (hi != null) parts.push(`최고 ${hi}°`);
  if (lo != null) parts.push(`최저 ${lo}°`);
  if (cur.apparent_temperature != null) parts.push(`체감 ${Math.round(cur.apparent_temperature)}°`);
  if (cur.relative_humidity_2m != null) parts.push(`습도 ${cur.relative_humidity_2m}%`);
  if (cur.wind_speed_10m != null) parts.push(`바람 ${Math.round(cur.wind_speed_10m)}km/h`);
  $('#wxExtra').innerHTML = parts.map(p => `<span>${esc(p)}</span>`).join('');
}
async function loadWeather() {
  const KEY = 'gayeon_wx_v1';
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (cached && Date.now() - cached.t < 30 * 60 * 1000) { paintWeather(cached.d); }
  } catch (e) {}
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=37.4563&longitude=126.7052'
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m'
      + '&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('weather http ' + res.status);
    const j = await res.json();
    localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: j }));
    paintWeather(j);
  } catch (e) {
    const desc = $('#wxDesc');
    if (desc) desc.textContent = '날씨를 불러오지 못했어요';
    const extra = $('#wxExtra');
    if (extra) extra.innerHTML = '<span>인천 기준 · 잠시 뒤 다시 시도할게요</span>';
  }
}

/* ───────────── todo form ───────────── */
function bindTodo() {
  const form = $('#todoForm');
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const input = $('#todoInput');
    const text = input.value.trim(); if (!text) return;
    state.todo.push({ id: uid(), text, done: false });
    input.value = '';
    commit();
  });
}

/* ───────────── boot ───────────── */
function boot() {
  state = loadState();
  if (!Array.isArray(state.habits)) {}
  renderAll();
  bindHeroEditing();
  bindTodo();
  setupFileInputs();
  tickClock();
  setInterval(tickClock, 1000);
  loadWeather();
  setInterval(loadWeather, 30 * 60 * 1000);

  // keyboard shortcuts
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && openModalType) closeModal();
  });

  // sync start (supabase cdn may load after app.js)
  const startWhenReady = () => {
    if (window.supabase) startSync();
    else setTimeout(startWhenReady, 300);
  };
  setTimeout(startWhenReady, 200);
  setTimeout(() => { if (!window.supabase) setSync('warn', '오프라인 · 기기에 저장 중'); }, 5000);

  // 오늘 날짜가 바뀌면 다시 그리기
  let lastDay = todayISO();
  setInterval(() => {
    const d = todayISO();
    if (d !== lastDay) { lastDay = d; renderAll(); loadWeather(); }
  }, 30000);
}

/* 테스트·디버그용 훅 (브라우저 콘솔에서도 확인 가능) */
window.__GD = {
  get state() { return state; },
  seal, unseal, rowIdFor, cloudPush, cloudPull, applyRemote, startSync,
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();

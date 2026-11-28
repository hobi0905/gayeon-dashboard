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
/* 메모 태그 — "12월, 할일" 또는 "#12월 #할일" 어느 쪽으로 써도 알아서 나눈다 */
const parseTags = v => String(v == null ? '' : v).split(/[,，#]/).map(t => t.trim()).filter(Boolean).slice(0, 8);
const tagText = tags => (Array.isArray(tags) ? tags : []).join(', ');
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const fmtDateShort = s => { const d = parseISO(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const fmtDateKo = s => { const d = parseISO(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK_KO[d.getDay()]})`; };
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/* ───────────── form cells ───────────── */
/* 칸 하나 = 위에 작은 라벨 + 아래 입력. 폭은 폼 그리드가 나눠 갖고,
   날짜 칸은 값이 비어 있을 때 '날짜 선택' 같은 안내를 칸 안에 보여준다(iOS는 빈 date가 그냥 흰 네모). */
const F_CELL = (label, control, cls = '') =>
  `<label class="fld${cls ? ' ' + cls : ''}"><span>${label}</span>${control}</label>`;
const F_DATE = (label, attrs, cls = '', ph = '날짜 선택') =>
  `<label class="fld date${cls ? ' ' + cls : ''}"><span>${label}</span>` +
  `<span class="date-shell is-empty" data-ph="${esc(ph)}"><input class="in" type="date" ${attrs}></span></label>`;
const F_OPT = '<small>(선택)</small>';
/* 빈 날짜 칸 안내 문구를 값에 맞춰 켜고 끈다 */
function syncDateShells(root) {
  $$('.date-shell', root || document).forEach(s => {
    const i = s.querySelector('input');
    if (i) s.classList.toggle('is-empty', !i.value);
  });
}

/* ───────────── seed ───────────── */
const SEED_EVENTS = [
  ['컴활접수', '2026-11-28', null, null, null, 'study'],
  ['지안수마켓 21시', '2026-11-29', null, '21:00', '22:00', 'personal'],
  ['약속잡기', '2026-12-06', null, null, null, 'personal'],
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
  ['숙대 교대원 최초합격자 발표', '2027-06-10', null, null, null, 'study'],
  ['인하대 교대원 합격자 발표', '2027-06-24', null, '10:00', '11:00', 'study'],
];

const SEED_EXAMS = [
  ['컴활 2급 필기', '2026-12-12', '시험', '14:50 부평상공회의소'],
  ['AI활용전문가시험', '2026-12-24', '시험', ''],
  ['ADsP 시험', '2027-02-06', '시험', '1/4 접수·공부 시작'],
  ['숙대 교대원 원서접수', '2027-04-26', '지원', ''],
  ['인하대 교대원 원서접수', '2027-05-03', '지원', ''],
  ['숙대 교대원 면접', '2027-05-29', '면접', ''],
  ['숙대 교대원 최초합격자 발표', '2027-06-10', '발표', ''],
  ['인하대 교대원 합격자 발표', '2027-06-24', '발표', '10:00'],
];

const DEFAULT_CODE = 'GAEYON-SKY-2026';
const THEMES = {
  sky: { label: '🩵 파스텔 하늘', short: '파스텔 하늘', cover: 'assets/cover-sky-cat.jpg', cat: 'assets/cat-card.jpg' },
  xmas: { label: '🎄 12월 크리스마스', short: '크리스마스', cover: 'assets/xmas-london.jpg', cat: 'assets/xmas-cat.jpg' },
};
const DEFAULT_THEME = 'xmas';
const themeOf = st => (st && THEMES[st.theme] ? st.theme : DEFAULT_THEME);
const DEFAULT_COVER = THEMES.sky.cover;
const DEFAULT_CAT = THEMES.sky.cat;
const DEFAULT_AVATAR = 'assets/profile-avatar.png';
const XMAS_PRESETS = [
  { src: 'assets/xmas-cat.jpg', thumb: 'assets/xmas-cat-thumb.jpg', label: '눈 고양이' },
  { src: 'assets/xmas-london.jpg', thumb: 'assets/xmas-london-thumb.jpg', label: '런던의 밤' },
  { src: 'assets/xmas-velvet-tree.jpg', thumb: 'assets/xmas-velvet-tree-thumb.jpg', label: '벨벳 트리' },
  { src: 'assets/xmas-vinyl.jpg', thumb: 'assets/xmas-vinyl-thumb.jpg', label: '레드 바이닐' },
  { src: 'assets/xmas-snowman.jpg', thumb: 'assets/xmas-snowman-thumb.jpg', label: '눈사람' },
  { src: 'assets/xmas-park-tree.jpg', thumb: 'assets/xmas-park-tree-thumb.jpg', label: '공원 트리' },
  { src: 'assets/xmas-empire.jpg', thumb: 'assets/xmas-empire-thumb.jpg', label: '엠파이어' },
  { src: 'assets/xmas-night-tree.jpg', thumb: 'assets/xmas-night-tree-thumb.jpg', label: '밤 트리' },
];
const COVER_PRESETS = [
  { src: DEFAULT_COVER, label: '하늘 고양이' },
  { src: 'assets/photo-sea.jpg', label: '바다' },
  { src: 'assets/photo-cd.jpg', label: 'CD 케이스' },
  { src: 'assets/cover-cozy-cat.jpg', label: '코지 캣' },
  ...XMAS_PRESETS,
];
const CAT_PRESETS = [
  { src: DEFAULT_CAT, label: '아침 고양이' },
  { src: 'assets/photo-sea.jpg', label: '바다' },
  { src: 'assets/photo-cd.jpg', label: 'CD 케이스' },
  { src: DEFAULT_COVER, label: '하늘 고양이' },
  ...XMAS_PRESETS,
];
function presetRow(kind, presets, current) {
  const cur = current || presets[0].src;
  return `<div class="preset-row">${presets.map(p => `
    <button class="preset ${cur === p.src ? 'on' : ''}" data-act="${kind === 'cover' ? 'set-cover' : 'set-cat'}" data-src="${esc(p.src)}" title="${esc(p.label)}">
      <img src="${esc(p.thumb || p.src)}" alt="${esc(p.label)}" loading="lazy"><span>${esc(p.label)}</span>
    </button>`).join('')}</div>`;
}

/* 기본 시드에서 빠진 남자친구 편입 일정 — 기존 localStorage·클라우드 값도 앱에서 한 번 정리한다 */
const RETIRED_SEED_EVENTS = ['충북대 편입 원서접수', '인하대 면접예정일', '임규정 인천대 면접'];
const RETIRED_SEED_GOALS = ['충북대 편입 원서 준비물 확인', '충북대 모집요강 일정 다시 보기'];
function purgeRetiredSeeds(s) {
  let changed = false;
  const drop = (arr, key, titles) => (Array.isArray(arr) ? arr.filter(x => {
    const hit = x && titles.includes(String(x[key] || '').trim());
    if (hit) changed = true;
    return !hit;
  }) : arr);
  s.events = drop(s.events, 'title', RETIRED_SEED_EVENTS);
  if (s.study) {
    s.study.exams = drop(s.study.exams, 'name', RETIRED_SEED_EVENTS);
    ['month', 'week', 'today'].forEach(k => { s.study[k] = drop(s.study[k], 'text', RETIRED_SEED_GOALS); });
  }
  return changed;
}

/* 빈 날짜 칸 안내 문구는 iOS 사파리에서만 쓴다 — 다른 브라우저는 자체 placeholder가 있다 */
const IS_IOS = /iP(hone|ad|od)/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (IS_IOS) document.body.classList.add('ios');

/* ───────────── 🏦 햇살론유스 대출 (부채현황) ─────────────
   5건 모두 연 4.0% 고정금리.
   · 거치기간(2026.12~2028.11)에는 은행별 월 이자가 따로 청구된다 (신한 19,000 + IBK 18,000 = 37,000)
   · 거치가 끝난 다음 달부터 원금균등분할상환 (원금 ÷ 개월수 + 남은 원금 × 연 4% ÷ 12)
   · 납부일은 매달 15일 — 금액은 저장하지 않고 그 달을 볼 때마다 계산한다 */
const LOAN_CAT = '대출·이자';
const LOAN_RATE = 0.04;
const LOAN_PAY_DAY = 15;
const LOAN_START_MONTH = '2026-12';   /* 가계부에 납부가 표시되기 시작하는 달 */
const LOAN_DEFER_END = '2028-11';     /* 은행별 거치 이자를 쓰는 마지막 달 */
const isYM = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v == null ? '' : v));
const ymIndex = ym => { const [y, m] = String(ym).split('-').map(Number); return y * 12 + (m - 1); };
const ymAdd = (ym, n) => { const i = ymIndex(ym) + n; return `${Math.floor(i / 12)}-${pad2(i % 12 + 1)}`; };
const fmtDot = v => (/^\d{4}-\d{2}/.test(String(v == null ? '' : v)) ? String(v).slice(0, 10).replace(/-/g, '.') : '—');
function seedLoans() {
  return {
    payDay: LOAN_PAY_DAY,
    startMonth: LOAN_START_MONTH,
    deferEnd: LOAN_DEFER_END,
    /* 거치기간에 은행별로 나가던 월 이자 — 실제 청구 금액 그대로 */
    deferCharges: [
      { id: 'loan-defer-shinhan', name: '햇살론유스 이자 (신한은행)', amount: 19000 },
      { id: 'loan-defer-ibk', name: '햇살론유스 이자 (IBK은행)', amount: 18000 },
    ],
    rounds: [
      { id: 'loan-r1', round: 1, principal: 3000000, rate: LOAN_RATE, startDate: '2024-11-03', deferEnd: '2028-11-03', repayStart: '2028-12', months: 60 },
      { id: 'loan-r2', round: 2, principal: 5000000, rate: LOAN_RATE, startDate: '2024-12-09', deferEnd: '2028-12-09', repayStart: '2029-01', months: 84 },
      { id: 'loan-r3', round: 3, principal: 1000000, rate: LOAN_RATE, startDate: '2025-06-13', deferEnd: '2029-06-13', repayStart: '2029-07', months: 84 },
      { id: 'loan-r4', round: 4, principal: 1700000, rate: LOAN_RATE, startDate: '2025-11-28', deferEnd: '2029-11-28', repayStart: '2029-12', months: 84 },
      { id: 'loan-r5', round: 5, principal: 1300000, rate: LOAN_RATE, startDate: '2026-01-05', deferEnd: '2030-01-05', repayStart: '2030-02', months: 84 },
    ],
  };
}
function normalizeLoanRound(l, i) {
  const r = Object.assign({}, l);
  r.id = r.id || `loan-r${i + 1}`;
  r.round = Number(r.round) || i + 1;
  r.principal = Math.max(0, Math.round(Number(r.principal) || 0));
  r.rate = Number(r.rate) > 0 ? Number(r.rate) : LOAN_RATE;
  r.startDate = dateOnly(r.startDate);
  r.deferEnd = dateOnly(r.deferEnd);
  r.repayStart = isYM(r.repayStart) ? r.repayStart : '';
  r.months = Math.max(0, Math.round(Number(r.months) || 0));
  if (!r.months && r.repayStart && isYM(r.repayEnd)) r.months = ymIndex(r.repayEnd) - ymIndex(r.repayStart) + 1;
  r.repayEnd = (r.repayStart && r.months) ? ymAdd(r.repayStart, r.months - 1) : (isYM(r.repayEnd) ? r.repayEnd : '');
  return r;
}
/* loans가 없는 예전 저장값·클라우드 값은 시드로 채운다. 한 번 비우면(빈 배열) 그대로 존중한다. */
function normalizeLoans(raw) {
  const base = seedLoans();
  if (!raw) return base;
  const src = Array.isArray(raw) ? { rounds: raw } : raw;
  const rounds = Array.isArray(src.rounds) ? src.rounds.filter(Boolean).map(normalizeLoanRound) : [];
  const charges = Array.isArray(src.deferCharges) ? src.deferCharges.filter(Boolean).map((c, i) => ({
    id: c.id || `loan-defer-${i + 1}`,
    name: String(c.name || '햇살론유스 이자'),
    amount: Math.abs(Math.round(Number(c.amount) || 0)),
  })) : base.deferCharges;
  return {
    payDay: Math.min(31, Math.max(1, Math.round(Number(src.payDay) || base.payDay))),
    startMonth: isYM(src.startMonth) ? src.startMonth : base.startMonth,
    deferEnd: isYM(src.deferEnd) ? src.deferEnd : base.deferEnd,
    rate: Number(src.rate) > 0 ? Number(src.rate) : base.rate,
    deferCharges: charges,
    rounds,
  };
}

function seedState() {
  return {
    v: 3,
    title: 'My Dashboard',
    quote: '“호비랑 서리를 먹여살리기 위한 몸부림”',
    theme: DEFAULT_THEME,
    cover: null,
    cat: null,
    avatar: null,
    study: {
      month: [
        { id: uid(), text: '컴활접수 하기 (11/28)', done: false },
      ],
      week: [],
      today: [],
      exams: SEED_EXAMS.map(([name, date, type, memo]) => ({ id: uid(), name, date, type, memo })),
    },
    finance: { expenses: [], goals: [], invest: [], subs: [], planned: [], loans: seedLoans(), customCategories: [] },
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
let pendingSeedCleanup = false;
let viewMonth = new Date(); viewMonth.setDate(1);
let finMonth = new Date(); finMonth.setDate(1);
let finSel = todayISO();
let calxMonth = new Date(); calxMonth.setDate(1);
let calxSel = null;          /* 큰 캘린더에서 고른 날짜 */
let calxReturn = false;      /* 날짜 상세 모달을 닫으면 큰 캘린더로 돌아가기 */
let finDetailReturn = false; /* 가계부 상세를 닫으면 가계부 모달로 돌아가기 */
let editingExamId = null;
let openModalType = null;
let openModalArg = null;
let coverImageCache = null;

function normalize(s) {
  const base = seedState();
  const out = Object.assign({}, base, s);
  out.study = Object.assign({ month: [], week: [], today: [], exams: [] }, s.study || {});
  out.finance = Object.assign({ expenses: [], goals: [], invest: [], subs: [], planned: [], customCategories: [] }, s.finance || {});
  out.finance.loans = normalizeLoans(out.finance.loans);
  /* 사용자 정의 카테고리 — 문자열/객체 어느 쪽으로 저장됐어도 {name, icon, color}로 맞춘다 */
  out.finance.customCategories = ((out.finance.customCategories || []).map(c => (typeof c === 'string' ? { name: c } : c) || {})
    .filter(c => c && String(c.name || '').trim())
    .map(c => ({ name: String(c.name).trim().slice(0, 12), icon: c.icon || '🏷️', color: c.color || '' })));
  /* type이 없던 예전 지출 내역은 그대로 '지출'로 살리고, 옛 카테고리 이름은 새 이름으로 이어 준다 */
  out.finance.expenses = (out.finance.expenses || []).filter(Boolean).map(e => {
    const type = e.type === 'income' ? 'income' : e.type === 'saving' ? 'saving' : 'expense';
    let cat = e.cat == null ? '' : String(e.cat);
    if (type === 'expense' && LEGACY_EXPENSE_CAT[cat]) cat = LEGACY_EXPENSE_CAT[cat];
    return Object.assign({}, e, { type, cat, amount: Math.abs(Number(e.amount) || 0) });
  });
  /* startDate가 없는 기존 정기구독은 등록일(없으면 2026-11-28) 기준 다음 결제일로 자동 보정 */
  out.finance.subs = (out.finance.subs || []).filter(Boolean).map(sub => {
    const s = Object.assign({}, sub, {
      cycle: sub.cycle === 'yearly' ? 'yearly' : 'monthly',
      month: Math.min(12, Math.max(1, Number(sub.month) || 1)),
      day: Math.min(31, Math.max(1, Number(sub.day) || 1)),
      /* 어느 카드로 결제하는지 적어 두는 메모 — 없던 구독은 빈 문자열 */
      memo: typeof sub.memo === 'string' ? sub.memo : '',
    });
    if (!s.startDate) s.startDate = subStartDate(s);
    return s;
  });
  /* 구매예정 항목도 카테고리를 갖는다 (없던 항목은 '구매예정') */
  out.finance.planned = (out.finance.planned || []).filter(Boolean).map(p => Object.assign({}, p, {
    cat: p.cat ? String(p.cat) : '구매예정',
  }));
  out.wish = Object.assign({ want: [], need: [] }, s.wish || {});
  out.memo = Object.assign({ diary: [], habits: [], notes: [] }, s.memo || {});
  /* 메모의 태그는 나중에 붙은 속성 — 예전 메모는 빈 배열로 살린다 */
  out.memo.notes = (out.memo.notes || []).filter(Boolean).map(n => Object.assign({}, n, {
    tags: Array.isArray(n.tags) ? parseTags(n.tags.join(',')) : [],
  }));
  out.events = Array.isArray(s.events) ? s.events : base.events;
  out.todo = Array.isArray(s.todo) ? s.todo : [];
  out.sync = Object.assign({ code: DEFAULT_CODE, enabled: true }, s.sync || {});
  out.meta = Object.assign({ pristine: false }, s.meta || {});
  out.theme = THEMES[s.theme] ? s.theme : DEFAULT_THEME;
  out.v = 3;
  purgeRetiredSeeds(out);
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 3) {
        const purged = purgeRetiredSeeds(parsed);
        const out = normalize(parsed);
        if (purged) {
          pendingSeedCleanup = true;
          try { localStorage.setItem(LS_KEY, JSON.stringify(out)); } catch (e) {}
        }
        return out;
      }
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
  renderHomeGoals();
  renderCalendar();
  renderSyncBadge();
  renderModal();
}

function renderHero() {
  applyTheme();
  $('#coverImg').src = state.cover || themeCover(themeOf(state));
  $('#catImg').src = state.cat || (THEMES[themeOf(state)] || THEMES.sky).cat;
  const av = $('#avatarImg'); if (av) av.src = state.avatar || DEFAULT_AVATAR;
  const t = $('#pageTitle'); if (document.activeElement !== t) t.textContent = state.title || 'My Dashboard';
  const q = $('#quoteText'); if (document.activeElement !== q) q.textContent = state.quote || '';
  const now = new Date();
  $('#catDate').textContent = `${now.getMonth() + 1}월 ${now.getDate()}일`;
}

/* ───────────── theme ───────────── */
const themeCover = t => (THEMES[t] || THEMES.sky).cover;
function applyTheme() {
  const t = themeOf(state);
  if (document.body) document.body.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'xmas' ? '#1f4a3a' : '#e8f3fd');
  const btn = $('#themeToggle');
  if (btn) {
    const next = t === 'xmas' ? 'sky' : 'xmas';
    btn.dataset.next = next;
    btn.title = `테마 바꾸기 · ${THEMES[next].label}`;
    const ico = btn.querySelector('.tt-ico'); if (ico) ico.textContent = next === 'xmas' ? '🎄' : '🩵';
    const lb = btn.querySelector('.tt-label'); if (lb) lb.textContent = THEMES[next].short;
  }
}
function switchTheme(next) {
  const prev = themeOf(state);
  if (!THEMES[next] || next === prev) return;
  /* 기본 사진(테마 기본값)만 테마를 따라 바뀌고, 직접 고른 프리셋·올린 사진은 그대로 둔다 */
  if (!state.cover || state.cover === THEMES[prev].cover) state.cover = null;
  if (!state.cat || state.cat === THEMES[prev].cat) state.cat = null;
  state.theme = next;
  commit();
  toast(next === 'xmas' ? '🎄 크리스마스 테마로 바꿨어요' : '🩵 파스텔 하늘 테마로 돌아왔어요');
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
      <button class="edit" data-act="todo-edit" data-id="${t.id}" aria-label="수정" title="수정">✏️</button>
      <button class="del" data-act="todo-del" data-id="${t.id}" aria-label="삭제">✕</button>
    </li>`).join('');
}

/* ───────────── home · 이달의 목표 (STUDY month 목표와 같은 데이터) ───────────── */
/* 달성한 목표는 목록 제일 아래로 — 홈 카드·STUDY 모달이 같은 정렬을 쓴다 */
const sortGoals = items => [...(items || [])].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));

function goalRowsHtml(scope, cls) {
  return sortGoals(state.study[scope] || []).map(i => `
    <div class="check-row ${i.done ? 'done' : ''}${cls ? ' ' + cls : ''}" data-id="${i.id}">
      <button class="chk" data-act="goal-toggle" data-scope="${scope}" data-id="${i.id}" aria-label="완료">${i.done ? '✓' : ''}</button>
      <span class="txt">${esc(i.text)}</span>
      <button class="icon-x" data-act="goal-edit" data-scope="${scope}" data-id="${i.id}" title="수정">✏️</button>
      <button class="icon-x" data-act="goal-del" data-scope="${scope}" data-id="${i.id}" title="삭제">✕</button>
    </div>`).join('');
}

function renderHomeGoals() {
  const box = $('#homeGoals');
  if (!box) return;
  const items = state.study.month || [];
  const done = items.filter(i => i.done).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  box.innerHTML = `
    ${items.length
      ? `<div class="hg-top">
      <span class="hg-count">${done}/${items.length} 완료</span>
      <span class="hg-pct">${pct}%</span>
    </div>
    <div class="progress hg-progress"><i style="width:${pct}%"></i></div>`
      : ''}
    ${items.length
      ? `<div class="check-list hg-list">${goalRowsHtml('month', 'hg-row')}</div>`
      : '<div class="hg-empty">이번 달에 꼭 해내고 싶은 걸 적어보세요 🩵</div>'}
    <form class="add-form inline hg-form" data-form="goal" data-scope="month">
      <input class="in grow" name="text" maxlength="80" placeholder="이번 달 목표 추가" autocomplete="off">
      <button class="btn primary" type="submit">추가</button>
    </form>`;
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
/* 가계부 내역 종류 — type이 없는 예전 데이터는 전부 '지출'로 본다 */
/* 지출 카테고리 — 토스 가계부 스크린샷의 소비 분류를 그대로 따르고, 쓰던 대출·이자·정기구독도 뒤에 남긴다 */
const EXPENSE_CATS = [
  '식비', '카페·간식', '편의점·마트·잡화', '술·유흥', '쇼핑', '여가',
  '의료·건강·피트니스', '주거·통신', '보험·세금·기타금융', '미용', '교통·자동차', '여행·숙박',
  '교육', '생활', '기부·후원', '이체', '카드대금', '후불결제대금', '대출·이자', '정기구독', '기타',
];
const INCOME_CATS = ['알바·급여', '용돈', '부수입·환급', '기타'];
/* 📈 투자 탭에 아직 항목이 없을 때 저축 카테고리로 고를 수 있는 기본값 */
const SAVING_FALLBACK_CATS = ['재무목표', '주식투자'];
/* 카테고리 타일 아이콘 — 목록·선택 화면·사용자 정의 카테고리에 함께 쓴다 */
const CATEGORY_ICONS = {
  '식비': '🍚', '카페·간식': '☕', '편의점·마트·잡화': '🏪', '술·유흥': '🍺', '쇼핑': '🛒', '여가': '🎡',
  '의료·건강·피트니스': '🏥', '주거·통신': '🏠', '보험·세금·기타금융': '🧾', '미용': '💄',
  '교통·자동차': '🚗', '여행·숙박': '✈️', '교육': '🎓', '생활': '☀️', '기부·후원': '❤️',
  '이체': '🔁', '카드대금': '💳', '후불결제대금': '🕐', '대출·이자': '🏦', '정기구독': '📺',
  '기타': '🏷️', '구매예정': '🛍️', '잔액': '💰',
};
/* 카테고리마다 고정된 색 — 도넛에서 순위가 바뀌어도 같은 카테고리는 같은 색으로 보인다 */
const CATEGORY_COLORS = {
  '식비': '#3182F6', '카페·간식': '#00A66E', '편의점·마트·잡화': '#F5B300', '술·유흥': '#FB7A2B',
  '쇼핑': '#F04452', '여가': '#8B5CF6', '의료·건강·피트니스': '#0FA3A3', '주거·통신': '#2563EB',
  '보험·세금·기타금융': '#64748B', '미용': '#C026D3', '교통·자동차': '#38BDF8', '여행·숙박': '#0D9488',
  '교육': '#B45309', '생활': '#84CC16', '기부·후원': '#EC4899', '이체': '#6366F1',
  '카드대금': '#7E22CE', '후불결제대금': '#94A3B8', '대출·이자': '#475569', '정기구독': '#0891B2',
  '기타': '#A0AEC0', '구매예정': '#B7791F', '잔액': '#38A169',
};
/* 사용자 정의 카테고리·옛 카테고리에 돌려 쓰는 팔레트 — 한 그래프 안에서 색이 겹치지 않게 골라 쓴다 */
const CATEGORY_PALETTE = [
  '#3182F6', '#00A66E', '#F5B300', '#FB7A2B', '#F04452', '#8B5CF6', '#0FA3A3', '#2563EB',
  '#64748B', '#C026D3', '#38BDF8', '#0D9488', '#B45309', '#84CC16', '#EC4899', '#6366F1',
  '#7E22CE', '#E11D48', '#0891B2', '#A16207', '#4D7C0F', '#BE123C', '#4338CA', '#0369A1',
];
/* 새 카테고리를 만들 때 고를 수 있는 아이콘 */
const CATEGORY_ICON_CHOICES = ['🏷️', '🐶', '🎁', '💐', '🎂', '💊', '🏋️', '📚', '🎮', '💼', '🧺', '🚿'];
/* 예전에 저장된 지출 카테고리를 새 이름으로 이어 준다 */
const LEGACY_EXPENSE_CAT = { '카페': '카페·간식', '교통': '교통·자동차', '병원·약': '의료·건강·피트니스', '공부': '교육' };
const isIncome = e => !!(e && e.type === 'income');
const isSaving = e => !!(e && e.type === 'saving');
const amtOf = e => Math.abs(Number(e && e.amount) || 0);
const catOptionHtml = (cats, sel) => cats.map(c => `<option${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join('');
/* 문자열 → 팔레트 자리 (옛/알 수 없는 카테고리도 매번 같은 색) */
function catHashOf(str) {
  let h = 0;
  for (const ch of String(str || '')) h = (h * 31 + ch.codePointAt(0)) % 100000;
  return h;
}
/* 사용자 정의 카테고리 — 문자열로 저장된 옛 형태도 {name, icon, color}로 받아 준다 */
function customCats() {
  const raw = (state && state.finance && state.finance.customCategories) || [];
  return raw.map(c => (typeof c === 'string' ? { name: c } : c) || {})
    .filter(c => c && String(c.name || '').trim())
    .map(c => ({ name: String(c.name).trim(), icon: c.icon || '🏷️', color: c.color || '' }));
}
function customCatNames() { return customCats().map(c => c.name); }
function categoryIcon(cat) {
  const own = customCats().find(c => c.name === cat);
  return (own && own.icon) || CATEGORY_ICONS[cat] || '🏷️';
}
function categoryColor(cat) {
  const own = customCats().find(c => c.name === cat);
  if (own && own.color) return own.color;
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  return CATEGORY_PALETTE[catHashOf(cat) % CATEGORY_PALETTE.length];
}
/* 지출 카테고리 = 기본 목록 + 사용자 정의(기타 바로 앞) */
function expenseCatOptions() {
  const base = EXPENSE_CATS.filter(c => c !== '기타');
  const own = customCatNames().filter(n => !EXPENSE_CATS.includes(n));
  return base.concat(own, ['기타']);
}
/* 저축 카테고리 = 📈 투자 탭의 재무목표·주식투자 항목과 자동 연동 */
function savingCatOptions() {
  const out = [];
  (state.finance.goals || []).forEach(g => { if (g && g.name) out.push(`[목표] ${g.name}`); });
  (state.finance.invest || []).forEach(v => { if (v && v.name) out.push(`[주식] ${v.name}`); });
  return out.length ? out : SAVING_FALLBACK_CATS.slice();
}
/* 종류별 카테고리 목록 — 지출/수입/저축 */
function catOptionsFor(type) {
  if (type === 'income') return INCOME_CATS;
  if (type === 'saving') return savingCatOptions();
  return expenseCatOptions();
}
const TYPE_LABEL = { expense: '지출', income: '수입', saving: '저축' };
/* '지출'/'수입'/'저축' → 저장 키 */
const typeKeyOf = label => (label === '수입' ? 'income' : label === '저축' ? 'saving' : 'expense');
/* ───────────── 카테고리 타일 선택 (토스 가계부 스타일) ─────────────
   실제 값은 품 안의 숨은 select가 들고 있고, 보이는 단추·목록은 그 select를 따라간다. */
function catPickerHtml(name, cats, sel, kind = 'expense') {
  const cur = cats.includes(sel) ? sel : (cats[0] || '기타');
  return `<div class="cat-picker" data-cat-picker data-cat-kind="${esc(kind)}">
      <select class="in money-cat cat-native" name="${esc(name)}" aria-label="카테고리">${catOptionHtml(cats, cur)}</select>
      <button type="button" class="cat-pick-btn" data-cat-open aria-label="카테고리 바꾸기">
        <i class="cat-ico" style="background:${categoryColor(cur)}">${categoryIcon(cur)}</i>
        <span class="cat-name">${esc(cur)}</span>
        <span class="cat-chev">⌄</span>
      </button>
    </div>`;
}
/* 숨은 select 값 → 단추의 아이콘·이름을 맞춘다 */
function syncCatPicker(picker) {
  if (!picker) return;
  const sel = picker.querySelector('select');
  const btn = picker.querySelector('[data-cat-open]');
  if (!sel || !btn) return;
  const cur = sel.value || '';
  const ico = btn.querySelector('.cat-ico');
  const name = btn.querySelector('.cat-name');
  if (ico) { ico.textContent = categoryIcon(cur); ico.style.background = categoryColor(cur); }
  if (name) name.textContent = cur;
}
/* 새 카테고리를 만든 뒤 페이지에 떠 있는 모든 picker의 목록을 맞춘다 (화면을 다시 그리지 않아 입력 중인 품이 살아 있다) */
function refreshCatPickers() {
  $$('[data-cat-picker]').forEach(p => {
    const sel = p.querySelector('select');
    if (!sel) return;
    const kind = p.dataset.catKind || 'expense';
    const cats = catOptionsFor(kind);
    const cur = sel.value;
    sel.innerHTML = catOptionHtml(cats, cats.includes(cur) ? cur : (cats[0] || '기타'));
    syncCatPicker(p);
  });
}
let catSheetEl = null, catSheetPicker = null;
function closeCatSheet() {
  if (catSheetEl) catSheetEl.remove();
  catSheetEl = null; catSheetPicker = null;
}
function catSheetRowHtml(cat, on, kind) {
  const own = kind === 'expense' && customCatNames().includes(cat);
  return `<button type="button" class="cat-row${on ? ' on' : ''}" data-cat="${esc(cat)}">
      <i class="cat-ico" style="background:${categoryColor(cat)}">${categoryIcon(cat)}</i>
      <span class="cat-name">${esc(cat)}</span>
      ${own ? '<span class="cat-badge">내 카테고리</span>' : ''}
      ${on ? '<span class="cat-check">✓</span>' : ''}
    </button>`;
}
function catSheetListHtml(picker, kind) {
  const sel = picker && picker.querySelector('select');
  const cur = sel ? sel.value : '';
  const cats = sel ? Array.from(sel.options).map(o => o.value) : [];
  return cats.map(c => catSheetRowHtml(c, c === cur, kind)).join('')
    + (kind === 'expense' ? `<button type="button" class="cat-row add" data-cat-add>
        <i class="cat-ico add">＋</i><span class="cat-name">새 카테고리 추가</span>
      </button>` : '');
}
function catSheetAddHtml() {
  return `<form class="cat-new" data-cat-new>
      <div class="cat-new-row">
        <input class="in" name="catName" placeholder="예: 반려동물, 경조사" maxlength="12" autocomplete="off" required>
        <button class="btn primary" type="submit">추가</button>
      </div>
      <div class="cat-emoji-row">${CATEGORY_ICON_CHOICES.map((e, i) => `
        <label class="cat-emoji"><input type="radio" name="catIcon" value="${e}"${i === 0 ? ' checked' : ''}><span>${e}</span></label>`).join('')}</div>
      <div class="cat-new-hint">색은 자동으로 정해져요 · 만든 카테고리는 클라우드에도 함께 저장돼요</div>
      <button type="button" class="cat-new-cancel" data-cat-add-cancel>취소</button>
    </form>`;
}
function openCatSheet(picker) {
  closeCatSheet();
  if (!picker) return;
  const kind = picker.dataset.catKind || 'expense';
  const wrap = document.createElement('div');
  wrap.className = 'cat-sheet-wrap';
  const label = kind === 'income' ? '수입' : kind === 'saving' ? '저축' : '지출';
  wrap.innerHTML = `
    <div class="cat-sheet-mask" data-cat-close></div>
    <div class="cat-sheet" role="dialog" aria-modal="true" aria-label="카테고리 선택">
      <div class="cat-sheet-grip"></div>
      <div class="cat-sheet-head"><b>변경할 ${label} 카테고리를 선택해주세요</b><button type="button" class="icon-x" data-cat-close aria-label="닫기">✕</button></div>
      <div class="cat-sheet-list">${catSheetListHtml(picker, kind)}</div>
    </div>`;
  document.body.appendChild(wrap);
  catSheetEl = wrap; catSheetPicker = picker;
  wrap.addEventListener('click', ev => {
    if (ev.target.closest('[data-cat-close]')) return closeCatSheet();
    if (ev.target.closest('[data-cat-add]')) {
      const list = wrap.querySelector('.cat-sheet-list');
      if (list) list.innerHTML = catSheetAddHtml();
      const inp = wrap.querySelector('[name="catName"]');
      if (inp) setTimeout(() => inp.focus(), 30);
      return;
    }
    if (ev.target.closest('[data-cat-add-cancel]')) {
      const list = wrap.querySelector('.cat-sheet-list');
      if (list) list.innerHTML = catSheetListHtml(catSheetPicker, catSheetPicker ? (catSheetPicker.dataset.catKind || 'expense') : 'expense');
      return;
    }
    const row = ev.target.closest('[data-cat]');
    if (row) { pickCatValue(catSheetPicker, row.dataset.cat); closeCatSheet(); }
  });
  wrap.addEventListener('submit', ev => {
    if (!ev.target.closest('[data-cat-new]')) return;
    ev.preventDefault();
    addCustomCategoryFromForm(ev.target);
  });
}
/* 고른 카테고리를 picker에 넣고 화면 단추를 맞춘다 */
function pickCatValue(picker, cat) {
  if (!picker || !cat) return;
  const sel = picker.querySelector('select');
  if (!sel) return;
  if (!Array.from(sel.options).some(o => o.value === cat)) {
    const o = document.createElement('option');
    o.value = cat; o.textContent = cat;
    sel.appendChild(o);
  }
  sel.value = cat;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  syncCatPicker(picker);
}
/* 새 카테고리 저장 — 화면을 통째로 다시 그리지 않아 입력 중이던 금액·날짜가 남는다 */
function addCustomCategoryFromForm(form) {
  const picker = catSheetPicker;
  const raw = (form.querySelector('[name="catName"]') || {}).value || '';
  const name = String(raw).trim().replace(/\s+/g, ' ').slice(0, 12);
  if (!name) { toast('카테고리 이름을 적어 주세요'); return; }
  if (EXPENSE_CATS.includes(name) || customCatNames().includes(name)) {
    toast(`‘${name}’은(는) 이미 있는 카테고리예요`);
    return;
  }
  const iconEl = form.querySelector('[name="catIcon"]:checked');
  const icon = (iconEl && iconEl.value) || '🏷️';
  const used = customCats().map(c => c.color).filter(Boolean);
  const color = CATEGORY_PALETTE.find(p => !used.includes(p)) || CATEGORY_PALETTE[customCats().length % CATEGORY_PALETTE.length];
  state.finance.customCategories = (state.finance.customCategories || []).concat([{ name, icon, color }]);
  commit({ soft: true });
  refreshCatPickers();
  pickCatValue(picker, name);
  closeCatSheet();
  toast(`‘${name}’ 카테고리를 추가했어요`);
}
const moneySign = e => (isIncome(e) ? '＋' : isSaving(e) ? '↗' : '−');
const moneyPillCls = e => (isIncome(e) ? 'income' : isSaving(e) ? 'saving' : 'out');
function entriesOn(dateStr) {
  return state.finance.expenses.filter(e => e.date === dateStr);
}
function expensesOn(dateStr) {
  return entriesOn(dateStr).filter(e => !isIncome(e) && !isSaving(e));
}
function incomesOn(dateStr) {
  return entriesOn(dateStr).filter(e => isIncome(e));
}
function savingsOn(dateStr) {
  return entriesOn(dateStr).filter(e => isSaving(e));
}
function spentOn(dateStr) {
  return expensesOn(dateStr).reduce((s, e) => s + amtOf(e), 0);
}
function incomeOn(dateStr) {
  return incomesOn(dateStr).reduce((s, e) => s + amtOf(e), 0);
}
function savedOn(dateStr) {
  return savingsOn(dateStr).reduce((s, e) => s + amtOf(e), 0);
}
function moneyFormHtml(dateStr) {
  return `<form class="add-form money-form" data-form="expense" data-date="${dateStr}">
      ${F_CELL('내역', '<input class="in" name="title" placeholder="예: 점심 김밥" maxlength="50" autocomplete="off" required>', 'w2')}
      ${F_CELL('금액', '<input class="in num" name="amount" inputmode="numeric" placeholder="0" required>')}
      ${F_CELL('종류', `<select class="in money-type" name="type" aria-label="종류"><option value="expense">지출</option><option value="income">수입</option><option value="saving">저축</option></select>`)}
      <div class="fld cat-fld w2"><span>카테고리</span>${catPickerHtml('cat', expenseCatOptions(), '식비', 'expense')}</div>
      <button class="btn primary" type="submit">추가</button>
    </form>`;
}
function subCycleLabel(s) {
  const day = Number(s.day) || 1;
  return s.cycle === 'yearly' ? `매년 ${Number(s.month) || 1}월 ${day}일` : `매달 ${day}일`;
}
/* 다음 결제일 기준 '12월부터' / '2027년 3월부터' */
function subStartLabel(s) {
  const d = parseISO(s.startDate || todayISO());
  const y = d.getFullYear(), thisYear = new Date().getFullYear();
  return `${y === thisYear ? '' : `${y}년 `}${d.getMonth() + 1}월부터`;
}
/* 그 달에 실제로 있는 날짜로 보정 — 매달 31일 결제처럼 없는 날은 그 달 말일 */
function subDateIn(y, m, day) {
  const last = daysInMonth(y, m - 1);
  const d = Math.min(Math.max(1, Number(day) || 1), last);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
/* 등록일 기준 '가장 가까운 다음 결제일' — 이번 달 결제일이 남아 있으면 이번 달, 지났으면 다음 달 */
function nextSubDate(s, fromISO) {
  const from = fromISO || todayISO();
  const dt = parseISO(from);
  const y = dt.getFullYear(), m = dt.getMonth() + 1;
  if (s && s.cycle === 'yearly') {
    const mm = Math.min(12, Math.max(1, Number(s.month) || 1));
    for (let yy = y; yy <= y + 8; yy++) {
      const iso = subDateIn(yy, mm, s.day);
      if (iso >= from) return iso;
    }
    return subDateIn(y + 8, mm, s.day);
  }
  const thisMonth = subDateIn(y, m, s && s.day);
  if (thisMonth >= from) return thisMonth;
  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return subDateIn(ny, nm, s && s.day);
}
/* createdAt(숫자·문자 모두) → YYYY-MM-DD. 없는 옛 항목은 이번 개편 기준일(2026-11-28)로 본다 */
const SUBS_BASE_DATE = '2026-11-28';
function dateOnly(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') { const d = new Date(v); return isFinite(d.getTime()) ? isoOf(d) : ''; }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isFinite(d.getTime()) ? isoOf(d) : '';
}
function subStartDate(s) {
  return nextSubDate(s, dateOnly(s && s.createdAt) || SUBS_BASE_DATE);
}
/* 이번 달 결제일이 이미 지났으면 다음 달부터 — startDate 이전 날짜에는 뜨지 않는다 */
function subActiveOn(s, dateStr) {
  return !s.startDate || dateStr >= s.startDate;
}
/* 말일 보정 — 매달 31일 결제처럼 그 달에 없는 날짜는 그 달 마지막 날로 */
function subHitsOn(s, y, m, d) {
  const last = daysInMonth(y, m - 1);
  const target = Math.min(Math.max(1, Number(s.day) || 1), last);
  if (d !== target) return false;
  if (s.cycle === 'yearly') return Number(s.month) === m;
  return true;
}
/* ───────────── 🏦 대출 납부 계산 ───────────── */
function loansOf() {
  const L = state && state.finance && state.finance.loans;
  return L && typeof L === 'object' ? L : null;
}
function loanPayDay() {
  return Math.min(31, Math.max(1, Math.round(Number((loansOf() || {}).payDay) || LOAN_PAY_DAY)));
}
function loanMonths(l) { return Math.max(0, Math.round(Number(l && l.months) || 0)); }
function loanRepayEnd(l) {
  if (!l) return '';
  if (isYM(l.repayStart) && loanMonths(l)) return ymAdd(l.repayStart, loanMonths(l) - 1);
  return isYM(l.repayEnd) ? l.repayEnd : '';
}
/* 그 달(YYYY-MM) 회차 한 건의 납부 내역
   · 거치 중 → 이자만 (원금 × 연 4% ÷ 12)
   · 상환 중 → 원금균등분할 (월 원금 = 원금 ÷ 개월수, 나뉘지 않는 나머지는 앞 달부터 1원씩)
   · 만기 뒤 → null(납부 없음) */
function loanChargeAt(l, ym) {
  if (!l || !isYM(ym)) return null;
  const principal = Math.max(0, Math.round(Number(l.principal) || 0));
  const n = loanMonths(l);
  if (!principal || !n || !isYM(l.repayStart)) return null;
  const rate = Number(l.rate) > 0 ? Number(l.rate) : LOAN_RATE;
  const end = loanRepayEnd(l);
  const cur = ymIndex(ym), start = ymIndex(l.repayStart);
  if (end && cur > ymIndex(end)) return null;
  if (cur < start) {
    return { status: 'defer', idx: -1, months: n, principal: 0, interest: Math.round(principal * rate / 12), balance: principal };
  }
  const idx = cur - start;
  const base = Math.floor(principal / n), rest = principal - base * n;
  const paidBefore = base * idx + Math.min(idx, rest);
  const balance = principal - paidBefore;
  return {
    status: 'repay', idx, months: n,
    principal: base + (idx < rest ? 1 : 0),
    interest: Math.round(balance * rate / 12),
    balance,
  };
}
/* 그 달의 대출 납부일 (납부일이 그 달에 없으면 말일) — YYYY-MM */
function loanDateIn(ym) {
  if (!isYM(ym)) return '';
  const [y, m] = String(ym).split('-').map(Number);
  return `${ym}-${pad2(Math.min(loanPayDay(), daysInMonth(y, m - 1)))}`;
}
/* 그 날짜에 가계부에 자동으로 잡히는 대출 항목 */
function loanRowsOn(dateStr) {
  const L = loansOf();
  const s = String(dateStr == null ? '' : dateStr);
  if (!L || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return [];
  const ym = s.slice(0, 7);
  if (s !== loanDateIn(ym)) return [];
  if (L.startMonth && isYM(L.startMonth) && ym < L.startMonth) return [];
  const out = [];
  /* 거치기간 — 은행별로 따로 청구되는 이자 */
  if (!L.deferEnd || !isYM(L.deferEnd) || ym <= L.deferEnd) {
    (L.deferCharges || []).forEach(c => {
      const amount = Math.abs(Math.round(Number(c.amount) || 0));
      if (amount > 0) out.push({ name: String(c.name || '햇살론유스 이자'), amount, kind: '거치기간 이자', cat: LOAN_CAT, loan: true, loanId: c.id });
    });
    return out;
  }
  /* 원금상환 단계 — 회차별로 계산 */
  (L.rounds || []).forEach(l => {
    const c = loanChargeAt(l, ym);
    if (!c) return;
    if (c.status === 'defer') {
      if (c.interest > 0) out.push({
        name: `햇살론유스 ${Number(l.round) || ''}회차 이자`.replace('  ', ' ').trim(),
        amount: c.interest, kind: '거치기간 이자', cat: LOAN_CAT, loan: true, loanId: l.id,
        principal: 0, interest: c.interest,
      });
      return;
    }
    const amount = c.principal + c.interest;
    if (amount <= 0) return;
    out.push({
      name: `햇살론유스 ${Number(l.round) || ''}회차 상환`.replace('  ', ' ').trim(),
      amount, kind: `원금 ${won(c.principal)} + 이자 ${won(c.interest)}`, cat: LOAN_CAT, loan: true, loanId: l.id,
      principal: c.principal, interest: c.interest,
    });
  });
  return out;
}
/* 그 달 대출 납부 합계 */
function loanMonthTotal(ym) {
  return loanRowsOn(loanDateIn(ym)).reduce((s, r) => s + r.amount, 0);
}
/* 그 달 납부를 마친 뒤의 남은 원금 */
function loanRemaining(l, ym) {
  const c = loanChargeAt(l, ym);
  if (c) return Math.max(0, c.balance - c.principal);
  const end = loanRepayEnd(l);
  if (end && isYM(ym) && ym > end) return 0;
  return Math.max(0, Math.round(Number(l && l.principal) || 0));
}
function loanRemainingTotal(ym) {
  const L = loansOf();
  return ((L && L.rounds) || []).reduce((s, l) => s + loanRemaining(l, ym), 0);
}
function loanTotalPrincipal() {
  const L = loansOf();
  return ((L && L.rounds) || []).reduce((s, l) => s + Math.max(0, Math.round(Number(l.principal) || 0)), 0);
}

function plannedOn(dateStr) {
  const dt = parseISO(dateStr);
  const y = dt.getFullYear(), m = dt.getMonth() + 1, day = dt.getDate();
  const out = [];
  state.finance.subs.filter(s => s.active && subHitsOn(s, y, m, day) && subActiveOn(s, dateStr))
    .forEach(s => out.push({
      name: s.name, amount: Number(s.amount) || 0,
      kind: s.cycle === 'yearly' ? '정기구독 · 매년' : '정기구독',
      cat: s.cat || '정기구독',
      memo: s.memo || '',
      subId: s.id,
    }));
  state.finance.planned.filter(p => p.date === dateStr)
    .forEach(p => out.push({ name: p.name, amount: Number(p.amount) || 0, kind: '구매예정', cat: p.cat || '구매예정', memo: p.memo || '' }));
  /* 대출 납부(15일) — 매달 자동 계산 */
  loanRowsOn(dateStr).forEach(r => out.push(r));
  return out;
}
function plannedSum(dateStr) {
  return plannedOn(dateStr).reduce((s, p) => s + p.amount, 0);
}

/* ───────────── 지난달 잔액 이월 ─────────────
   매달 1일에 전달 잔액을 '잔액' 카테고리(수입)로 얹는다. 저장하지 않고 그때그때 계산하며,
   전달에 실제 가계부 내역(지출·수입·저축·구매예정)이 있을 때만 이월해
   아무 내역도 없는 먼 과거 달로 빈 이월이 끝없이 이어지지 않게 한다. */
const CARRY_CAT = '잔액';
const monthPrefix = (y, m) => `${y}-${pad2(m)}`;
function shiftMonth(y, m, delta) {
  const d = new Date(y, m - 1 + delta, 1);
  return [d.getFullYear(), d.getMonth() + 1];
}
function monthPlanned(y, m) {
  let sum = 0;
  const prefix = monthPrefix(y, m);
  for (let d = 1; d <= daysInMonth(y, m - 1); d++) sum += plannedSum(`${prefix}-${pad2(d)}`);
  return sum;
}
function monthFlow(y, m) {
  const prefix = monthPrefix(y, m);
  let income = 0, spent = 0, saved = 0;
  state.finance.expenses.filter(e => e && String(e.date || '').startsWith(prefix)).forEach(e => {
    if (isIncome(e)) income += amtOf(e);
    else if (isSaving(e)) saved += amtOf(e);
    else spent += amtOf(e);
  });
  const planned = monthPlanned(y, m);
  return { income, spent, saved, planned, spendTotal: spent + planned };
}
function monthHasData(y, m) {
  const prefix = monthPrefix(y, m);
  if (state.finance.expenses.some(e => e && String(e.date || '').startsWith(prefix))) return true;
  if ((state.finance.planned || []).some(p => p && String(p.date || '').startsWith(prefix))) return true;
  return false;
}
/* 전달 잔액 = 전달 수입(이월 포함) − 전달 지출(예정 포함) − 전달 저축·투자
   depth는 이상하게 빠른 데이터가 있어도 계산이 끝없이 짙히지 않게 하는 안전장치 */
function carryoverAmount(y, m, depth) {
  if ((depth || 0) > 120) return 0;
  const [py, pm] = shiftMonth(y, m, -1);
  if (!monthHasData(py, pm)) return 0;
  const flow = monthFlow(py, pm);
  return carryoverAmount(py, pm, (depth || 0) + 1) + flow.income - flow.spendTotal - flow.saved;
}
function carryoverOn(dateStr) {
  const s = String(dateStr || '');
  if (!/-\d{2}-01$/.test(s)) return 0;
  const dt = parseISO(s);
  return carryoverAmount(dt.getFullYear(), dt.getMonth() + 1);
}
/* 이 달 1일에 얹히는 잔액 행 — 이월이 없으면 null */
function carryoverItem(y, m) {
  const amount = carryoverAmount(y, m);
  if (!amount) return null;
  return { date: `${monthPrefix(y, m)}-01`, title: '지난달 잔액 이월', cat: CARRY_CAT, amount, carry: true };
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
    const sp = spentOn(ds), inc = incomeOn(ds), pl = plannedSum(ds), sv = savedOn(ds), cy = carryoverOn(ds);
    const money = `${cy ? `<span class="cal-carry">${cy > 0 ? '＋' : '−'}₩${won(Math.abs(cy))}</span>` : ''}${inc ? `<span class="cal-income">＋₩${won(inc)}</span>` : ''}${sp ? `<span class="cal-spend">−₩${won(sp)}</span>` : ''}${sv ? `<span class="cal-save">↗₩${won(sv)}</span>` : ''}${pl ? `<span class="cal-plan">−₩${won(pl)}</span>` : ''}`;
    return `<button class="${cls}" data-act="open-day" data-date="${ds}">
      <span class="dnum">${d.getDate()}</span>
      <span class="cal-chips">${shown}${more}</span>
      <span class="cal-money">${money}</span>
    </button>`;
  }).join('');
}

/* ───────────── 큰 캘린더 모달 ───────────── */
function dayBrief(ds) {
  const exms = examsOn(ds);
  const evs = eventsOn(ds).filter(e => !exms.some(x =>
    String(e.title).includes(x.name) || String(x.name).includes(String(e.title))));
  return { exms, evs, plans: plannedOn(ds), spent: spentOn(ds), income: incomeOn(ds), saved: savedOn(ds), carry: carryoverOn(ds) };
}
function monthAgenda(y, m) {
  const out = [];
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const ds = `${y}-${pad2(m + 1)}-${pad2(d)}`;
    const b = dayBrief(ds);
    if (!b.exms.length && !b.evs.length && !b.plans.length && !b.spent && !b.income && !b.saved && !b.carry) continue;
    out.push({ ds, day: d, ...b });
  }
  return out;
}
function openCalendarModal(dateStr) {
  const base = viewMonth || new Date();
  calxMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  const sel = dateStr || todayISO();
  const d = parseISO(sel);
  calxSel = (d.getFullYear() === calxMonth.getFullYear() && d.getMonth() === calxMonth.getMonth()) ? sel : null;
  openModal('calendar');
}
function calxDayPanel() {
  const ds = calxSel;
  if (!ds) return '<div class="sec-card calx-day calx-blank">날짜를 누르면 그 날 일정이 여기에 보여요 🩵</div>';
  const b = dayBrief(ds);
  const rows = [
    ...(b.carry ? [`<div class="drow"><span class="tag carry">잔액</span><span class="grow">지난달 잔액 이월 <span class="muted">자동 계산</span></span><span class="dday-pill ${b.carry < 0 ? 'out' : 'income'}">${b.carry > 0 ? '＋' : '−'}₩${won(Math.abs(b.carry))}</span></div>`] : []),
    ...b.exms.map(x => `<div class="drow"><span class="tag ${esc(x.type)}">${esc(x.type)}</span><span class="grow"><b>${esc(x.name)}</b>${x.memo ? ` <span class="muted">${esc(x.memo)}</span>` : ''}</span></div>`),
    ...b.evs.map(e => `<div class="drow">${e.start ? `<b class="ag-time">${esc(e.start)}</b>` : ''}<span class="tag ${esc(e.category || 'personal')}">${esc(CAT_LABEL[e.category] || '일정')}</span><span class="grow">${esc(e.title)}</span></div>`),
    ...b.plans.map(p => `<div class="drow" style="border-style:dashed"><span class="grow">${esc(p.name)} <span class="muted">${esc(p.kind)}</span></span><span class="dday-pill plan">−₩${won(p.amount)}</span></div>`),
  ];
  const money = [b.carry ? `잔액 ${b.carry > 0 ? '＋' : '−'}₩${won(Math.abs(b.carry))}` : '', b.income ? `수입 ＋₩${won(b.income)}` : '', b.spent ? `지출 −₩${won(b.spent)}` : '', b.saved ? `저축 ↗₩${won(b.saved)}` : ''].filter(Boolean).join(' · ');
  return `<div class="sec-card calx-day">
    <div class="sec-head" style="margin:0">
      <h3><span class="em">🔎</span>${fmtDateKo(ds)}</h3>
      ${b.exms.length ? `<span class="dday-pill">${ddayLabel(ds)}</span>` : ''}
      ${money ? `<span class="sec-note">${money}</span>` : ''}
    </div>
    ${rows.length ? `<div class="row-list">${rows.join('')}</div>` : '<div class="empty">이 날은 비어 있어요</div>'}
    <div class="calx-day-btns">
      <button class="btn flat" data-act="calx-open-day" data-date="${ds}">이 날 자세히 보기 · 일정 추가</button>
    </div>
  </div>`;
}
function calxDdayBar() {
  const e = upcomingExams()[0];
  if (!e) return '';
  return `<div class="calx-dday">⏳ 다음 D-DAY · <b>${esc(e.name)}</b><span class="calx-dday-n">${ddayLabel(e.date)}</span><span class="muted">${fmtDateKo(e.date)}</span></div>`;
}
function calxAgendaHtml(y, m) {
  const list = monthAgenda(y, m);
  if (!list.length) return '<div class="empty">이 달에는 적어둔 일정이 없어요</div>';
  return list.map(g => `
    <div class="ag-day">
      <button class="ag-date" data-act="calx-day" data-date="${g.ds}">
        <span class="ag-dnum">${g.day}</span>
        <span class="ag-dow">${WEEK_KO[parseISO(g.ds).getDay()]}요일</span>
        ${g.exms.length ? `<span class="ag-dday">${ddayLabel(g.ds)}</span>` : ''}
      </button>
      <div class="ag-rows">
        ${g.exms.map(x => `<div class="ag-row"><span class="tag ${esc(x.type)}">${esc(x.type)}</span><span class="grow">${esc(x.name)}${x.memo ? `<span class="muted"> · ${esc(x.memo)}</span>` : ''}</span></div>`).join('')}
        ${g.evs.map(e => `<div class="ag-row">${e.start ? `<span class="ag-time">${esc(e.start)}</span>` : ''}<span class="dotc ${esc(e.category || 'personal')}"></span><span class="grow">${esc(e.title)}</span>${e.repeat === 'weekly' ? '<span class="muted">매주</span>' : ''}</div>`).join('')}
        ${g.plans.map(p => `<div class="ag-row"><span class="dotc plan"></span><span class="grow">${esc(p.name)} <span class="muted">${esc(p.kind)}</span></span><span class="dday-pill plan">−₩${won(p.amount)}</span></div>`).join('')}
      </div>
      ${(g.spent || g.income || g.saved || g.carry) ? `<div class="ag-money">${g.carry ? `<span class="cal-carry">잔액 ${g.carry > 0 ? '＋' : '−'}₩${won(Math.abs(g.carry))}</span>` : ''}${g.income ? `<span class="cal-income">수입 ＋₩${won(g.income)}</span>` : ''}${g.spent ? `<span class="cal-spend">지출 −₩${won(g.spent)}</span>` : ''}${g.saved ? `<span class="cal-save">저축 ↗₩${won(g.saved)}</span>` : ''}</div>` : ''}
    </div>`).join('');
}
function renderCalendarModal() {
  const y = calxMonth.getFullYear(), m = calxMonth.getMonth();
  const tISO = todayISO();
  const cells = monthCells(y, m).map(d => {
    if (!d) return '<div class="cal-cell calx-cell out"></div>';
    const ds = isoOf(d);
    const dow = d.getDay();
    const cls = ['cal-cell', 'calx-cell', dow === 0 ? 'sun' : '', dow === 6 ? 'sat' : '',
      ds === tISO ? 'today' : '', ds === calxSel ? 'sel' : ''].filter(Boolean).join(' ');
    const chips = chipList(ds);
    const shown = chips.slice(0, 3).map(c => `<span class="chip ${esc(c.cls)}">${esc(c.label)}</span>`).join('');
    const more = chips.length > 3 ? `<span class="cal-more">+${chips.length - 3}</span>` : '';
    const sp = spentOn(ds), inc = incomeOn(ds), pl = plannedSum(ds), sv = savedOn(ds), cy = carryoverOn(ds);
    const money = `${cy ? `<span class="cal-carry">${cy > 0 ? '＋' : '−'}₩${won(Math.abs(cy))}</span>` : ''}${inc ? `<span class="cal-income">＋₩${won(inc)}</span>` : ''}${sp ? `<span class="cal-spend">−₩${won(sp)}</span>` : ''}${sv ? `<span class="cal-save">↗₩${won(sv)}</span>` : ''}${pl ? `<span class="cal-plan">−₩${won(pl)}</span>` : ''}`;
    return `<button class="${cls}" data-act="calx-day" data-date="${ds}" aria-label="${d.getDate()}일 일정 보기">
      <span class="dnum">${d.getDate()}</span>
      <span class="cal-chips">${shown}${more}</span>
      <span class="cal-money">${money}</span>
    </button>`;
  }).join('');
  const agenda = monthAgenda(y, m);
  const items = agenda.reduce((n, g) => n + g.exms.length + g.evs.length + g.plans.length, 0);
  return `<div class="calx">
    <div class="calx-main">
      <div class="calx-head">
        <div class="calx-month" id="calxMonth">${y}년 ${m + 1}월</div>
        <div class="cal-nav">
          <button class="mini-btn" data-act="calx-prev" aria-label="이전 달">‹</button>
          <button class="mini-btn wide" data-act="calx-today">오늘</button>
          <button class="mini-btn" data-act="calx-next" aria-label="다음 달">›</button>
        </div>
      </div>
      ${calxDdayBar()}
      <div class="cal-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
      <div class="cal-grid calx-grid" id="calxGrid">${cells}</div>
      <div class="cal-legend">
        <span><i class="dotc study"></i>학업·시험</span>
        <span><i class="dotc personal"></i>개인일정</span>
        <span><i class="dotc health"></i>건강</span>
        <span><i class="dotc trip"></i>여행</span>
        <span><i class="dotc work"></i>알바</span>
        <span class="legend-money"><i class="dotc income"></i>수입</span>
        <span class="legend-money"><i class="dotc spend"></i>지출</span>
        <span class="legend-money"><i class="dotc saving"></i>저축</span>
        <span class="legend-money"><i class="dotc plan"></i>예정</span>
        <span class="legend-money"><i class="dotc carry"></i>잔액</span>
      </div>
    </div>
    <div class="calx-side">
      ${calxDayPanel()}
      <section class="sec">
        <div class="sec-head">
          <h3><span class="em">📋</span>${m + 1}월 전체 일정</h3>
          <span class="sec-count">${agenda.length}일 · ${items}건</span>
        </div>
        <div class="calx-agenda" id="calxAgenda">${calxAgendaHtml(y, m)}</div>
      </section>
    </div>
  </div>`;
}

/* ───────────── modal framework ───────────── */
const MODALS = {
  calendar: { title: '🗓 캘린더 · 전체 일정', render: renderCalendarModal },
  study: { title: '📖 STUDY', render: renderStudyModal },
  finance: { title: '🪙 가계부', render: renderFinanceModal },
  invest: { title: '📈 투자', render: renderInvestModal },
  'fin-detail': { title: '재무 상세', render: renderFinanceDetailModal },
  wishlist: { title: '🎀 Wishlist', render: renderWishModal },
  memo: { title: '🕯️ 메모', render: renderMemoModal },
  settings: { title: '🎨 꾸미기 설정', render: renderSettingsModal },
  day: { title: '', render: renderDayModal },
  weather: { title: '🌤️ 날씨 · 10일 예보', render: renderWeatherModal },
};

function openModal(type, arg) {
  openModalType = type; openModalArg = arg || null;
  const box = $('#modalBox');
  if (box) box.classList.toggle('wide', type === 'calendar');
  $('#modalRoot').hidden = false;
  document.body.style.overflow = 'hidden';
  renderModal();
  $('#modalBox').scrollTop = 0;
  const body = $('#modalBody'); if (body) body.scrollTop = 0;
}
function closeModal() {
  const back = calxReturn; calxReturn = false;
  const backFin = finDetailReturn; finDetailReturn = false;
  openModalType = null; openModalArg = null;
  $('#modalRoot').hidden = true;
  document.body.style.overflow = '';
  if (back) openModal('calendar');
  else if (backFin) openModal('finance');
}
function renderModal() {
  if (!openModalType) return;
  const cfg = MODALS[openModalType];
  if (!cfg) return;
  if (openModalType === 'day') $('#modalTitle').textContent = `🗓 ${fmtDateKo(openModalArg)}`;
  else if (openModalType === 'fin-detail') {
    const meta = FIN_DETAIL[openModalArg] || FIN_DETAIL.spend;
    $('#modalTitle').textContent = `${meta.em} ${meta.short} 상세`;
  }
  else $('#modalTitle').textContent = cfg.title;
  const body = $('#modalBody');
  const scroll = body.scrollTop;
  body.innerHTML = cfg.render(openModalArg);
  syncDateShells(body);
  body.scrollTop = scroll;
}

/* ───────────── STUDY modal ───────────── */
/* 시험·지원 구분 — 추가·수정·D-DAY·캘린더 모두 이 목록을 쓴다 */
const EXAM_TYPES = ['시험', '지원', '면접', '발표'];
const GOAL_META = {
  month: { label: '이달의 목표', em: '🌙', ph: '이번 달에 꼭 해내고 싶은 것' },
  week: { label: '이주의 목표', em: '🌿', ph: '이번 주 안에 끝낼 것' },
  today: { label: '오늘의 목표', em: '☀️', ph: '오늘 하루의 작은 목표' },
};

function goalSection(scope) {
  const meta = GOAL_META[scope];
  const items = sortGoals(state.study[scope] || []);
  const done = items.filter(i => i.done).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  return `<section class="sec">
    <div class="sec-head">
      <h3><span class="em">${meta.em}</span>${meta.label}</h3>
      <span class="sec-count">${done}/${items.length}</span>
    </div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    ${items.length ? `<div class="check-list">${goalRowsHtml(scope)}</div>` : `<div class="empty">아직 비어 있어요 · 작게 하나 적어볼까요?</div>`}
    <form class="add-form inline" data-form="goal" data-scope="${scope}">
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
          ${F_CELL('시험·지원 이름', '<input class="in" name="name" placeholder="예: ADsP 시험" maxlength="60" autocomplete="off" required>', 'w2')}
          ${F_DATE('날짜', 'name="date" required')}
          ${F_CELL('구분', `<select class="in" name="type">${EXAM_TYPES.map(t => `<option>${esc(t)}</option>`).join('')}</select>`)}
          ${F_CELL(`메모 ${F_OPT}`, '<input class="in" name="memo" placeholder="예: 14:50 부평상공회의소" maxlength="60">', 'w2')}
          <button class="btn primary" type="submit">추가</button>
        </form>
      </div>
    </section>`;
}

/* ───────────── finance modal ───────────── */
/* 정기구독 결제일 선택지 */
const monthOptions = (sel) => Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${Number(sel) === i + 1 ? 'selected' : ''}>${i + 1}월</option>`).join('');
const dayOptions = (sel) => Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${Number(sel) === i + 1 ? 'selected' : ''}>${i + 1}일</option>`).join('');

function financeStats() {
  const y = finMonth.getFullYear(), m = finMonth.getMonth() + 1;
  const flow = monthFlow(y, m);
  const carry = carryoverAmount(y, m);
  const income = flow.income + carry;
  /* 이번 달 대출 납부(15일) — 예정에 포함되어 있지만 따로 보여준다 */
  const loan = loanMonthTotal(monthPrefix(y, m));
  return {
    income, spent: flow.spent, saved: flow.saved, planned: flow.planned, loan,
    spendTotal: flow.spendTotal, carry,
    /* 수입 − 이번 달 지출(예정·대출 포함) − 이번 달 저축·투자 */
    balance: income - flow.spendTotal - flow.saved,
  };
}

function financeCalendar() {
  const y = finMonth.getFullYear(), m = finMonth.getMonth();
  const tISO = todayISO();
  const head = `<span class="wd">일</span><span class="wd">월</span><span class="wd">화</span><span class="wd">수</span><span class="wd">목</span><span class="wd">금</span><span class="wd">토</span>`;
  const cells = monthCells(y, m).map(d => {
    if (!d) return '<span></span>';
    const ds = isoOf(d);
    const sp = spentOn(ds), inc = incomeOn(ds), pl = plannedSum(ds), sv = savedOn(ds), cy = carryoverOn(ds);
    const cls = ['fcal-day', ds === tISO ? 'today' : '', ds === finSel ? 'sel' : ''].join(' ');
    return `<button class="${cls}" data-act="fin-day" data-date="${ds}">
      <span class="dn">${d.getDate()}</span>
      ${cy ? `<span class="cy">${cy > 0 ? '+' : '-'}${won(Math.abs(cy))}</span>` : ''}
      ${inc ? `<span class="inc">+${won(inc)}</span>` : ''}
      ${sp ? `<span class="sp">-${won(sp)}</span>` : ''}
      ${sv ? `<span class="sv">↗${won(sv)}</span>` : ''}
      ${pl ? `<span class="pl">-${won(pl)}</span>` : ''}
    </button>`;
  }).join('');
  return `<div class="fcal">${head}${cells}</div>`;
}

function finDayPanel() {
  const ds = finSel || todayISO();
  const entries = entriesOn(ds).sort((a, b) => (a.id > b.id ? 1 : -1));
  const plans = plannedOn(ds);
  const inc = incomeOn(ds), spent = spentOn(ds), saved = savedOn(ds), carry = carryoverOn(ds);
  const head = [`수입 ₩${won(inc)}`, `지출 ₩${won(spent)}`];
  if (saved) head.push(`저축 ↗₩${won(saved)}`);
  if (plans.length) head.push(`예정 −₩${won(plannedSum(ds))}`);
  if (carry) head.unshift(`잔액 ${carry > 0 ? '＋' : '−'}₩${won(Math.abs(carry))}`);
  return `<div class="sec-card">
    <div class="sec-head" style="margin:0">
      <h3><span class="em">🧾</span>${fmtDateKo(ds)}</h3>
      <span class="sec-note">${head.join(' · ')}</span>
    </div>
    ${carry ? `<div class="row-list"><div class="drow" style="border-style:dashed">
      <span class="tag carry">잔액</span>
      <span class="grow">지난달 잔액 이월 <span class="muted">자동 계산 · 저장 안 됨</span></span>
      <span class="dday-pill ${carry > 0 ? 'income' : 'out'}">${carry > 0 ? '＋' : '−'}₩${won(Math.abs(carry))}</span>
    </div></div>` : ''}
    ${entries.length ? `<div class="row-list">${entries.map(e => `
      <div class="drow">
        ${isIncome(e) ? '<span class="tag income">수입</span>' : isSaving(e) ? '<span class="tag saving">저축</span>' : ''}
        <span class="grow">${esc(e.title)} <span class="muted">${esc(e.cat || '기타')}${e.memo ? ' · ' + esc(e.memo) : ''}</span></span>
        <span class="dday-pill ${moneyPillCls(e)}">${moneySign(e)}₩${won(amtOf(e))}</span>
        <button class="icon-x" data-act="exp-edit" data-id="${e.id}" title="수정">✏️</button>
        <button class="icon-x" data-act="exp-del" data-id="${e.id}" title="삭제">✕</button>
      </div>`).join('')}</div>` : (carry ? '' : '<div class="empty">이 날 쓴 내역이 없어요</div>')}
    ${plans.length ? `<div class="row-list">${plans.map(p => `
      <div class="drow" style="border-style:dashed">
        <span class="grow">${esc(p.name)} <span class="muted">${esc(p.kind)}</span>${p.memo ? `<span class="cat-memo">💳 ${esc(p.memo)}</span>` : ''}</span>
        <span class="dday-pill plan">−₩${won(p.amount)}</span>
      </div>`).join('')}</div>` : ''}
    ${moneyFormHtml(ds)}
  </div>`;
}

function renderFinanceModal() {
  const st = financeStats();
  const subs = state.finance.subs;
  const monthlySubs = subs.filter(s => s.active && s.cycle !== 'yearly').reduce((a, s) => a + (Number(s.amount) || 0), 0);
  const yearlySubs = subs.filter(s => s.active && s.cycle === 'yearly').reduce((a, s) => a + (Number(s.amount) || 0), 0);
  /* 저축 카드에는 이번 달 가장 많이 넣은 저축·투자 항목을 한 줄로 */
  const savingTop = chartParts(financeMonthItems('saving')).rows[0];
  const savingSub = savingTop ? `<div class="stat-sub">${esc(savingTop.cat)}</div>` : '';
  return `
    <div class="stat-row money">
      <button class="stat income stat-btn" data-act="fin-detail" data-kind="income" title="이번 달 수입 상세 · 카테고리 비율">
        <div class="k">이번 달 수입<span class="stat-go">상세 ›</span></div><div class="v">${st.income < 0 ? '−' : '＋'}₩${won(Math.abs(st.income))}</div>
        ${st.carry ? `<div class="stat-sub">전달 잔액 ${st.carry > 0 ? '＋' : '−'}₩${won(Math.abs(st.carry))} 포함</div>` : ''}
      </button>
      <button class="stat spend stat-btn" data-act="fin-detail" data-kind="spend" title="이번 달 지출 상세 · 정기구독·구매예정·대출 포함">
        <div class="k">이번 달 지출<span class="stat-go">상세 ›</span></div><div class="v">−₩${won(st.spendTotal)}</div>
        ${st.planned ? `<div class="stat-sub">${st.loan && st.planned > st.loan ? `예정 ${won(st.planned - st.loan)} · 대출 ${won(st.loan)} 포함` : st.loan ? `대출 ${won(st.loan)} 포함` : `예정 ${won(st.planned)} 포함`}</div>` : ''}
      </button>
      <button class="stat saving stat-btn" data-act="fin-detail" data-kind="saving" title="이번 달 저축·투자 상세 · 카테고리 비율">
        <div class="k">저축<span class="stat-go">상세 ›</span></div><div class="v">↗₩${won(st.saved)}</div>
        ${savingSub}
      </button>
      <div class="stat balance ${st.balance < 0 ? 'neg' : ''}"><div class="k">수입 - 지출 - 투자</div><div class="v">${st.balance < 0 ? '−' : ''}₩${won(Math.abs(st.balance))}</div></div>
    </div>
    <div class="fin-subs-line">🔁 활성 구독 ₩${won(monthlySubs)}<small> /월</small>${yearlySubs ? ` · 연 ₩${won(yearlySubs)}` : ''}</div>

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
        <div class="cal-title" id="finMonthLabel" style="font-size:13px;color:#8ba3b5;font-family:var(--font-num);margin-bottom:2px">
          ${finMonth.getFullYear()}년 ${finMonth.getMonth() + 1}월 · ${themeOf(state) === 'xmas' ? '빨간=지출 · 초록=수입 · 금색=예정 · ↗저축 · 잔액=이월' : '파란=지출 · 초록=수입 · 주황=예정 · ↗저축 · 잔액=이월'}
        </div>
        ${financeCalendar()}
      </div>
      ${finDayPanel()}
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🔁</span>정기구독 관리</h3><span class="sec-count">${subs.filter(s => s.active).length}개 활성</span></div>
      ${subs.length ? `<div class="row-list">${subs.map(s => `
        <div class="drow">
          <button class="switch ${s.active ? 'on' : ''}" data-act="sub-toggle" data-id="${s.id}" aria-label="활성"></button>
          <i class="cat-ico sm" style="background:${categoryColor(s.cat || '정기구독')}" title="${esc(s.cat || '정기구독')}">${categoryIcon(s.cat || '정기구독')}</i>
          <span class="grow"><b>${esc(s.name)}</b> <span class="muted">${esc(subCycleLabel(s))}${s.startDate ? ` · ${subStartLabel(s)}` : ''}</span>${s.memo ? `<span class="cat-memo">💳 ${esc(s.memo)}</span>` : ''}</span>
          <span class="dday-pill">₩${won(s.amount)}${s.cycle === 'yearly' ? '<small> /년</small>' : ''}</span>
          <button class="icon-x" data-act="sub-edit" data-id="${s.id}" title="수정">✏️</button>
          <button class="icon-x" data-act="sub-del" data-id="${s.id}" title="삭제">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">활성 구독은 결제일마다 캘린더에 예정 금액으로 자동 표시돼요</div>'}
      <form class="add-form" data-form="sub">
        ${F_CELL('서비스명', '<input class="in" name="name" placeholder="예: 유튜브 프리미엄" maxlength="40" required>', 'w2')}
        ${F_CELL('금액', '<input class="in num" name="amount" inputmode="numeric" placeholder="0" required>')}
        ${F_CELL('주기', '<select class="in cycle-select" name="cycle"><option value="monthly">매달</option><option value="yearly">매년</option></select>')}
        <div class="fld cat-fld w2"><span>카테고리</span>${catPickerHtml('cat', expenseCatOptions(), '정기구독', 'expense')}</div>
        <label class="fld month"><span>월</span><select class="in sub-month" name="month">${monthOptions(1)}</select></label>
        <label class="fld day"><span>결제일</span><select class="in sub-day" name="day">${dayOptions(1)}</select></label>
        ${F_CELL('결제수단/메모 ' + F_OPT, '<input class="in" name="memo" placeholder="예: 신한 체크, 토스뱅크" maxlength="40" autocomplete="off">', 'full')}
        <button class="btn primary" type="submit">추가</button>
      </form>
      <div class="hint" style="font-size:12px;color:#a2b3c0;line-height:1.6">매달 = 매월 그 날, 매년 = 그 달·그 날. 등록한 날 기준 <b>다음 결제일이 이번 달이면 이번 달부터, 지났으면 다음 달부터</b> 표시되고, 31일처럼 없는 날은 그 달 말일로 맞춰요.</div>
    </section>`;
}

/* ───────────── 🏦 부채현황 (📈 투자 안 · 주식투자 아래) ───────────── */
function loanStatusOf(l, ym) {
  const end = loanRepayEnd(l);
  const c = loanChargeAt(l, ym);
  if (end && ym > end) return { key: 'done', label: '완납', pill: 'past', pct: 100, month: 0, charge: null };
  if (c && c.status === 'repay') {
    return { key: 'repay', label: `상환 ${c.idx + 1}/${c.months}개월`, pill: 'saving', pct: Math.round((c.idx + 1) / c.months * 100), month: c.principal + c.interest, charge: c };
  }
  return { key: 'defer', label: '거치 중', pill: 'plan', pct: 0, month: (c && c.interest) || 0, charge: c };
}
function loanRoundHtml(l, thisYm, bankDefer) {
  const s = loanStatusOf(l, thisYm);
  const n = loanMonths(l);
  return `<div class="loan-card" data-loan="${esc(l.id)}">
    <div class="loan-top">
      <b class="loan-round">${esc(l.round)}회차</b>
      <span class="loan-amt">₩${won(l.principal)}</span>
      <span class="loan-rate">연 ${(Number(l.rate || LOAN_RATE) * 100).toFixed(1)}%</span>
      <span class="dday-pill ${s.pill}">${s.label}</span>
      <span class="loan-acts">
        <button class="icon-x" data-act="loan-edit" data-id="${esc(l.id)}" title="수정">✏️</button>
        <button class="icon-x" data-act="loan-del" data-id="${esc(l.id)}" title="삭제">✕</button>
      </span>
    </div>
    <dl class="loan-meta">
      <div><dt>대출일</dt><dd>${fmtDot(l.startDate)}</dd></div>
      <div><dt>거치 종료</dt><dd>${fmtDot(l.deferEnd)}</dd></div>
      <div><dt>원금상환 시작</dt><dd>${fmtDot(l.repayStart)}</dd></div>
      <div><dt>만기(완납)</dt><dd>${fmtDot(loanRepayEnd(l))}</dd></div>
    </dl>
    <div class="loan-bar">
      <div class="progress"><i style="width:${s.pct}%"></i></div>
      <span>${s.key === 'done' ? '완납' : s.key === 'repay' ? `${s.pct}% · ${n}개월 중` : `거치 중 · ${n}개월 상환 예정`}</span>
    </div>
    ${!bankDefer && s.month ? `<div class="loan-month">이번 달 ₩${won(s.month)} <span class="muted">${s.key === 'repay' ? '원금+이자' : '이자만'}</span></div>` : ''}
  </div>`;
}
function debtSectionHtml() {
  const L = loansOf();
  const rounds = (L && L.rounds) || [];
  const charges = (L && L.deferCharges) || [];
  if (!rounds.length && !charges.length) return '';
  const thisYm = todayISO().slice(0, 7);
  const bankDefer = !!(L.deferEnd && isYM(L.deferEnd) && thisYm <= L.deferEnd);
  const total = loanTotalPrincipal();
  const remaining = loanRemainingTotal(thisYm);
  const payDate = loanDateIn(thisYm);
  const monthRows = loanRowsOn(payDate);
  const monthTotal = monthRows.reduce((s, r) => s + r.amount, 0);
  const nextStart = rounds.map(l => l.repayStart).filter(isYM).sort().find(v => v > thisYm) || '';
  const deferSum = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const sorted = rounds.slice().sort((a, b) => (Number(a.round) || 0) - (Number(b.round) || 0));
  const paySub = !monthRows.length
    ? (L.startMonth && thisYm < L.startMonth ? `${fmtDot(L.startMonth)}부터 시작` : '이번 달 납부 없음')
    : `${fmtDot(payDate)} · ${monthRows.length}건 ${bankDefer ? '거치기간 이자' : '(원금+이자)'}`;
  /* 이번 달(11월)처럼 아직 시작 전이면 ₩0 대신 다음 납부를 보여준다 */
  const upcomingYm = (!monthRows.length && L.startMonth && isYM(L.startMonth) && thisYm < L.startMonth) ? L.startMonth : '';
  const upcomingRows = upcomingYm ? loanRowsOn(loanDateIn(upcomingYm)) : [];
  const upcomingTotal = upcomingRows.reduce((s, r) => s + r.amount, 0);
  const payLabel = upcomingYm ? `다음 납부 (${Number(upcomingYm.slice(5, 7))}월)` : '이번 달 납부';
  const payValue = upcomingYm ? upcomingTotal : monthTotal;
  const payNote = upcomingYm
    ? `${fmtDot(loanDateIn(upcomingYm))} · ${upcomingRows.length}건 거치기간 이자`
    : paySub;
  return `
    <section class="sec">
      <div class="sec-head">
        <h3><span class="em">🏦</span>부채현황</h3>
        <span class="sec-count">${sorted.length}건</span>
        <span class="sec-note">햇살론유스 · 총 원금 ₩${won(total)}</span>
      </div>
      <div class="stat-row debt">
        <div class="stat plan"><div class="k">${payLabel}</div><div class="v">₩${won(payValue)}</div><div class="stat-sub">${payNote}</div></div>
        <div class="stat"><div class="k">남은 원금</div><div class="v">₩${won(remaining)}</div><div class="stat-sub">${fmtDot(thisYm)} 기준 · 총 원금 ₩${won(total)}</div></div>
        <div class="stat income"><div class="k">첫 원금상환</div><div class="v">${nextStart ? fmtDot(nextStart) : '상환 중'}</div><div class="stat-sub">거치 끝나고 다음 달부터</div></div>
      </div>
      <div class="row-list">${sorted.map(l => loanRoundHtml(l, thisYm, bankDefer)).join('')}</div>
      ${charges.length ? `<div class="loan-card loan-defer-card">
        <div class="loan-top">
          <b class="loan-round">거치기간 이자</b>
          <span class="loan-amt">₩${won(deferSum)}<small> /월</small></span>
          <span class="loan-rate">${fmtDot(L.startMonth)} ~ ${fmtDot(L.deferEnd)}</span>
        </div>
        <div class="row-list">${charges.map(c => `<div class="drow">
          <span class="grow">${esc(c.name)}</span>
          <span class="dday-pill plan">₩${won(c.amount)}</span>
          <button class="icon-x" data-act="loan-defer-edit" data-id="${esc(c.id)}" title="수정">✏️</button>
        </div>`).join('')}</div>
      </div>` : ''}
      <div class="hint" style="font-size:12px;color:#a2b3c0;line-height:1.6">매달 <b>${loanPayDay()}일</b> 납부액이 가계부에 자동으로 잡혀요(지출 상세 도넛 ‘대출·이자’). 거치기간에는 은행별 이자만, 거치가 끝난 다음 달부터는 <b>원금균등분할상환</b>으로 원금+이자가 함께 나가요. 금액은 저장하지 않고 열어볼 때마다 계산해요.</div>
    </section>`;
}

/* ───────────── 📈 투자 modal (재무목표 · 주식투자) ───────────── */
function renderInvestModal() {
  const goals = state.finance.goals;
  const invest = state.finance.invest;
  const savedSum = goals.reduce((s, g) => s + (Number(g.saved) || 0), 0);
  const targetSum = goals.reduce((s, g) => s + (Number(g.target) || 0), 0);
  const goalPct = targetSum > 0 ? Math.min(100, Math.round(savedSum / targetSum * 100)) : 0;
  return `
    <div class="stat-row">
      <div class="stat"><div class="k">재무목표</div><div class="v">${goals.length}<small>개</small></div></div>
      <div class="stat plan"><div class="k">모은 금액</div><div class="v">₩${won(savedSum)}</div></div>
      <div class="stat income"><div class="k">목표 달성률</div><div class="v">${goalPct}<small>%</small></div></div>
    </div>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🏦</span>재무목표</h3><span class="sec-count">${goals.length}</span><span class="sec-note">목표 ₩${won(targetSum)}</span></div>
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
        ${F_CELL('목표 이름', '<input class="in" name="name" placeholder="예: 비상금 300만" maxlength="40" required>', 'w2')}
        ${F_CELL('목표 금액', '<input class="in num" name="target" inputmode="numeric" placeholder="0" required>')}
        ${F_CELL(`현재 모은 금액 ${F_OPT}`, '<input class="in num" name="saved" inputmode="numeric" placeholder="0">')}
        ${F_DATE(`기한 ${F_OPT}`, 'name="deadline"')}
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">📈</span>주식투자</h3><span class="sec-count">${invest.length}</span><span class="sec-note">종목·주제 메모</span></div>
      ${invest.length ? `<div class="row-list">${invest.map(v => `
        <div class="drow">
          <span class="tag ${v.stance === '매수검토' ? 'soon' : ''}">${esc(v.stance)}</span>
          <span class="grow"><b>${esc(v.name)}</b>${v.memo ? ` <span class="muted">${esc(v.memo)}</span>` : ''}</span>
          <button class="icon-x" data-act="invest-edit" data-id="${v.id}">✏️</button>
          <button class="icon-x" data-act="invest-del" data-id="${v.id}">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">관심 종목·주제를 메모처럼 모아둘 수 있어요</div>'}
      <form class="add-form" data-form="invest">
        ${F_CELL('종목·주제', '<input class="in" name="name" placeholder="예: 배당주 ETF" maxlength="40" required>', 'w2')}
        ${F_CELL('판단', '<select class="in" name="stance"><option>관망</option><option>매수검토</option><option>보유</option></select>')}
        ${F_CELL(`메모 ${F_OPT}`, '<input class="in" name="memo" placeholder="왜 관심을 갖게 됐는지" maxlength="80">', 'full')}
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>
    ${debtSectionHtml()}`;
}

/* ───────────── 가계부 요약 카드 → 이번 달 상세 + 원형 그래프 ───────────── */
const FIN_DETAIL = {
  income: { label: '이번 달 수입', short: '수입', em: '💚', pill: 'income', sign: '＋' },
  spend: { label: '이번 달 지출', short: '지출', em: '💸', pill: 'out', sign: '−' },
  saving: { label: '이번 달 저축·투자', short: '저축·투자', em: '🏦', pill: 'saving', sign: '↗' },
};
/* 도넛 가운데 글씨는 돈이 커도 넘치지 않게 줄여 쓴다 (정확한 합계는 위 제목줄에) */
function compactWon(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 100000000) return `₩${String(Number((v / 100000000).toFixed(2)))}억`;
  if (v >= 10000) return `₩${Math.round(v / 10000).toLocaleString('ko-KR')}만`;
  return `₩${won(v)}`;
}

/* 그 달의 상세 내역
   · 수입  = 실제 수입 + 1일 '잔액' 이월
   · 지출  = 실제 지출 + 정기구독·구매예정(예정 포함)
   · 저축  = 저축·투자 내역만 */
function financeMonthItems(kind) {
  const y = finMonth.getFullYear(), m = finMonth.getMonth() + 1;
  const prefix = monthPrefix(y, m);
  if (kind === 'spend') {
    const rows = state.finance.expenses
      .filter(e => e && String(e.date || '').startsWith(prefix) && !isIncome(e) && !isSaving(e))
      .map(e => ({ id: e.id, date: e.date, title: e.title, cat: e.cat || '기타', amount: amtOf(e) }));
    for (let d = 1; d <= daysInMonth(y, m - 1); d++) {
      const ds = `${prefix}-${pad2(d)}`;
      plannedOn(ds).forEach(p => rows.push({ date: ds, title: p.name, cat: p.cat || p.kind, amount: Number(p.amount) || 0, planned: true, loan: !!p.loan, memo: p.memo || '' }));
    }
    return rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id || '').localeCompare(String(b.id || '')));
  }
  if (kind === 'saving') {
    return state.finance.expenses
      .filter(e => e && String(e.date || '').startsWith(prefix) && isSaving(e))
      .map(e => ({ id: e.id, date: e.date, title: e.title, cat: e.cat || '기타', amount: amtOf(e) }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  const rows = state.finance.expenses
    .filter(e => e && String(e.date || '').startsWith(prefix) && isIncome(e))
    .map(e => ({ id: e.id, date: e.date, title: e.title, cat: e.cat || '기타', amount: amtOf(e) }));
  const carry = carryoverItem(y, m);
  if (carry) rows.push(carry);
  return rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id || '').localeCompare(String(b.id || '')));
}

/* 카테고리별 합계 → 비중(%) — 반올림한 퍼센트의 합이 정확히 100이 되도록 최대 나머지 방식 */
function chartParts(items) {
  const byCat = new Map();
  (items || []).forEach(i => {
    const amt = Number(i.amount) || 0;
    if (!(amt > 0)) return;
    byCat.set(i.cat, (byCat.get(i.cat) || 0) + amt);
  });
  const rows = [...byCat.entries()].map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (!total) return { total: 0, rows: rows.map(r => Object.assign({}, r, { pct: 0 })) };
  const exact = rows.map(r => r.amount / total * 100);
  const pcts = exact.map(v => Math.floor(v));
  let rest = 100 - pcts.reduce((s, n) => s + n, 0);
  const order = exact.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; k < rest && order.length; k++) pcts[order[k % order.length].i] += 1;
  return { total, rows: rows.map((r, i) => Object.assign({}, r, { pct: pcts[i] })) };
}

/* 도넛 차트 — 카테고리마다 색이 고정되고, 같은 그래프 안에서는 색이 겹치지 않는다 */
function chartColorMap(rows) {
  const used = new Set();
  const map = {};
  (rows || []).forEach(r => {
    let c = categoryColor(r.cat);
    if (used.has(c)) c = CATEGORY_PALETTE.find(p => !used.has(p)) || c;
    used.add(c);
    map[r.cat] = c;
  });
  return map;
}
function donutSvg(rows, total, colorMap) {
  const cm = colorMap || chartColorMap(rows);
  const R = 56, SW = 18, C = 2 * Math.PI * R;
  let acc = 0;
  const segs = rows.map((r, i) => {
    const len = r.pct / 100 * C;
    const gap = rows.length > 1 && len > 6 ? 2.5 : 0;
    const dash = Math.max(0.5, len - gap);
    const seg = `<circle class="dseg" cx="80" cy="80" r="${R}" fill="none" stroke="${cm[r.cat] || categoryColor(r.cat)}" stroke-width="${SW}"`
      + ` data-cat="${esc(r.cat)}" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 80 80)"></circle>`;
    acc += len;
    return seg;
  }).join('');
  return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="카테고리별 비율 그래프">
    <circle class="dring" cx="80" cy="80" r="${R}" fill="none" stroke-width="${SW}"></circle>
    ${segs}
    <text class="donut-cap" x="80" y="70" text-anchor="middle">합계</text>
    <text class="donut-total" x="80" y="90" text-anchor="middle">${compactWon(total)}</text>
  </svg>`;
}

function chartLegendHtml(rows, colorMap) {
  const cm = colorMap || chartColorMap(rows);
  return `<ul class="chart-legend">${rows.map((r, i) => `
    <li>
      <i class="sw" style="background:${cm[r.cat] || categoryColor(r.cat)}"></i>
      <span class="lb">${esc(r.cat)}</span>
      <span class="pc">${r.pct}%</span>
      <span class="am">₩${won(r.amount)}</span>
    </li>`).join('')}</ul>
  <div class="chart-line">${rows.map(r => `${esc(r.cat)} ${r.pct}%`).join(' · ')}</div>`;
}

function renderFinanceDetailModal(kind) {
  const key = FIN_DETAIL[kind] ? kind : 'spend';
  const meta = FIN_DETAIL[key];
  const y = finMonth.getFullYear(), m = finMonth.getMonth() + 1;
  const items = financeMonthItems(key);
  const { total, rows } = chartParts(items);
  const colorMap = chartColorMap(rows);
  /* 합계는 이월(마이너스 포함)·예정까지 그대로 더한 값 — 도넛은 양수 카테고리만 */
  const sum = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const chart = rows.length
    ? `<div class="chart-wrap">${donutSvg(rows, total, colorMap)}<div class="chart-side">${chartLegendHtml(rows, colorMap)}</div></div>`
    : `<div class="chart-empty">${m}월 ${meta.short} 내역이 없어서 보여줄 비율이 없어요 🩵</div>`;
  const notes = [];
  if (items.some(i => i.planned && !i.loan)) notes.push('정기구독·구매예정 포함');
  if (items.some(i => i.loan)) notes.push('대출 상환 포함(15일 자동)');
  if (items.some(i => i.carry)) notes.push('잔액 이월 포함');
  const rowsHtml = items.length
    ? `<div class="fd-list">${items.map(i => {
      const neg = i.carry && Number(i.amount) < 0;
      const sign = i.carry ? (neg ? '−' : '＋') : meta.sign;
      return `
      <div class="fd-row">
        <span class="fd-date">${fmtDateShort(i.date)}</span>
        <span class="fd-title">${esc(i.title)}${i.memo ? `<span class="cat-memo">💳 ${esc(i.memo)}</span>` : ''}</span>
        <span class="fd-cat">${esc(i.cat || '기타')}</span>
        ${i.planned ? `<span class="fd-flag${i.loan ? ' auto' : ''}">${i.loan ? '대출' : '예정'}</span>` : ''}
        <span class="fd-amt ${meta.pill}">${sign}₩${won(Math.abs(Number(i.amount) || 0))}</span>
      </div>`;
    }).join('')}</div>`
    : `<div class="empty">${m}월 ${meta.short} 내역이 아직 없어요</div>`;
  return `
    <section class="sec">
      <div class="sec-head">
        <h3><span class="em">${meta.em}</span>${y}년 ${m}월 ${meta.short}</h3>
        <span class="sec-count">${items.length}건</span>
        <span class="sec-note">합계 ${sum < 0 ? '−' : ''}₩${won(Math.abs(sum))}</span>
      </div>
      <div class="sec-card chart-card">${chart}</div>
    </section>
    <section class="sec">
      <div class="sec-head"><h3><span class="em">🧾</span>상세 내역</h3><span class="sec-count">${items.length}</span><span class="sec-note">${notes.length ? notes.join(' · ') : '수정·삭제는 가계부 캘린더에서'}</span></div>
      ${rowsHtml}
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
        ${F_CELL('품목', '<input class="in" name="name" placeholder="예: 노이즈캔슬링 이어폰" maxlength="50" required>', 'w2')}
        ${F_CELL(`예상 가격 ${F_OPT}`, '<input class="in num" name="price" inputmode="numeric" placeholder="0">')}
        ${F_CELL('메모', '<input class="in" name="memo" placeholder="색상·사이즈" maxlength="80">')}
        ${F_CELL(`링크 ${F_OPT}`, '<input class="in" name="link" placeholder="https://" maxlength="300">', 'w2')}
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
        ${F_CELL('품목', '<input class="in" name="name" placeholder="예: 세탁세제" maxlength="50" required>', 'w2')}
        ${F_CELL(`가격 ${F_OPT}`, '<input class="in num" name="price" inputmode="numeric" placeholder="0">')}
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
        <form class="add-form inline" data-form="diary">
          <input class="in grow" name="text" maxlength="140" placeholder="오늘 한 줄 (${fmtDateKo(today)})" value="${todayEntry ? esc(todayEntry.text) : ''}" autocomplete="off">
          <button class="btn primary" type="submit">${todayEntry ? '수정' : '저장'}</button>
        </form>
      </div>
      ${diary.length ? `<div class="row-list">${diary.map(d => `
        <div class="diary-row">
          <span class="sq">${esc(d.mood || '🤍')}</span>
          <span class="grow"><span class="dt">${fmtDateKo(d.date)}</span><br><span class="tx">${esc(d.text)}</span></span>
          <button class="icon-x" data-act="diary-edit" data-id="${d.id}" title="수정">✏️</button>
          <button class="icon-x" data-act="diary-del" data-id="${d.id}" title="삭제">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">오늘의 기분을 이모지로 남겨보세요</div>'}
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🌱</span>습관 · 루틴</h3><span class="sec-count">이번 주</span></div>
      <div class="sec-card">
        ${habits.length ? `<div class="habit-grid">
          <span></span>${week.map(d => `<span class="hd">${WEEK_KO[parseISO(d).getDay()]}</span>`).join('')}
          ${habits.map(h => `<span class="hn" title="${esc(h.name)}"><span>${esc(h.name)}</span><button class="icon-x he" data-act="habit-edit" data-id="${h.id}" aria-label="습관 수정">✏️</button><button class="icon-x hx" data-act="habit-del" data-id="${h.id}" aria-label="습관 삭제">✕</button></span>${week.map(d => {
            const on = !!(h.log && h.log[d]);
            const future = d > today;
            return `<button class="h-cell ${on ? 'on' : ''} ${d === today ? 'today' : ''} ${future ? 'future' : ''}" data-act="habit-toggle" data-id="${h.id}" data-date="${d}">${on ? '✓' : ''}</button>`;
          }).join('')}`).join('')}
        </div>` : '<div class="empty">지키고 싶은 루틴을 추가하고 매일 체크해보세요</div>'}
        <form class="add-form inline" data-form="habit">
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
          ${(n.tags && n.tags.length) ? `<div class="ntags">${n.tags.map(t => `<span class="ntag">#${esc(t)}</span>`).join('')}</div>` : ''}
          <p>${esc(n.body)}</p>
          <div class="nfoot">
            <span>${n.updated ? new Date(n.updated).toLocaleDateString('ko-KR') : ''}</span>
            <button class="icon-x" data-act="note-edit" data-id="${n.id}">✏️</button>
            <button class="icon-x" data-act="note-del" data-id="${n.id}">✕</button>
          </div>
        </div>`).join('') : '<div class="empty">자유롭게 적는 메모 카드가 여기 쌓여요</div>'}
      <form class="add-form" data-form="note">
        ${F_CELL('제목', '<input class="in" name="title" placeholder="예: 12월에 할 일" maxlength="60">', 'full')}
        ${F_CELL(`태그 ${F_OPT}`, '<input class="in" name="tags" placeholder="쉼표로 구분 · 예: 12월, 할일" maxlength="60">', 'full')}
        ${F_CELL('내용', '<textarea class="in" name="body" rows="3" placeholder="자유롭게 적어두세요" maxlength="2000"></textarea>', 'full')}
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
  const exps = entriesOn(ds);
  const plans = plannedOn(ds);
  const carry = carryoverOn(ds);
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
        ${F_CELL('일정 이름', '<input class="in" name="title" placeholder="예: 치과 예약" maxlength="60" required>', 'full')}
        ${F_CELL(`시간 ${F_OPT}`, '<input class="in time" type="time" name="start">')}
        ${F_CELL('구분', `<select class="in" name="category">${CATS.map(c => `<option value="${c}">${CAT_LABEL[c]}</option>`).join('')}</select>`, 'w2')}
        <button class="btn primary" type="submit">추가</button>
      </form>
    </section>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">🪙</span>수입 · 지출 · 저축</h3><span class="sec-count">${[`수입 ₩${won(incomeOn(ds))}`, `지출 ₩${won(spentOn(ds))}`, carry ? `잔액 ${carry > 0 ? '＋' : '−'}₩${won(Math.abs(carry))}` : '', savedOn(ds) ? `저축 ₩${won(savedOn(ds))}` : ''].filter(Boolean).join(' · ')}</span></div>
      ${carry ? `<div class="row-list"><div class="drow" style="border-style:dashed">
        <span class="tag carry">잔액</span>
        <span class="grow">지난달 잔액 이월 <span class="muted">자동 계산</span></span>
        <span class="dday-pill ${carry > 0 ? 'income' : 'out'}">${carry > 0 ? '＋' : '−'}₩${won(Math.abs(carry))}</span>
      </div></div>` : ''}
      ${exps.length ? `<div class="row-list">${exps.map(e => `
        <div class="drow">
          ${isIncome(e) ? '<span class="tag income">수입</span>' : isSaving(e) ? '<span class="tag saving">저축</span>' : ''}
          <span class="grow">${esc(e.title)} <span class="muted">${esc(e.cat || '기타')}${e.memo ? ' · ' + esc(e.memo) : ''}</span></span>
          <span class="dday-pill ${moneyPillCls(e)}">${moneySign(e)}₩${won(amtOf(e))}</span>
          <button class="icon-x" data-act="exp-edit" data-id="${e.id}" title="수정">✏️</button>
          <button class="icon-x" data-act="exp-del" data-id="${e.id}" title="삭제">✕</button>
        </div>`).join('')}</div>` : '<div class="empty">아직 기록이 없어요</div>'}
      ${plans.length ? `<div class="row-list">${plans.map(p => `
        <div class="drow" style="border-style:dashed">
          <span class="grow">${esc(p.name)} <span class="muted">${esc(p.kind)}</span>${p.memo ? `<span class="cat-memo">💳 ${esc(p.memo)}</span>` : ''}</span>
          <span class="dday-pill plan">−₩${won(p.amount)}</span>
        </div>`).join('')}</div>` : ''}
      ${moneyFormHtml(ds)}
    </section>`;
}

/* ───────────── settings modal ───────────── */
function renderSettingsModal() {
  const code = state.sync.code || '';
  const curTheme = themeOf(state);
  return `
    <section class="sec">
      <div class="sec-head"><h3><span class="em">🎨</span>테마</h3><span class="sec-note">지금 · ${esc(THEMES[curTheme].label)}</span></div>
      <div class="sec-card">
        <div class="theme-row">
          <button class="theme-opt ${curTheme === 'sky' ? 'on' : ''}" data-act="set-theme" data-theme="sky">
            <img src="assets/cover-sky-cat.jpg" alt="파스텔 하늘 테마">
            <b>🩵 파스텔 하늘</b><span>차분한 하늘색 · 화이트</span>
          </button>
          <button class="theme-opt ${curTheme === 'xmas' ? 'on' : ''}" data-act="set-theme" data-theme="xmas">
            <img src="assets/xmas-london-thumb.jpg" alt="크리스마스 테마">
            <b>🎄 12월 크리스마스</b><span>크림 · 딥 그린 · 레드 · 골드</span>
          </button>
        </div>
        <div class="hint">테마를 바꾸면 커버·고양이 카드 기본 사진과 색이 함께 바뀌어요. 상단 빠른 버튼으로도 바로 전환할 수 있어요.</div>
      </div>
    </section>

    <div class="set-grid">
      <div class="set-card">
        <h4>🖼 상단 커버</h4>
        <img class="thumb" src="${esc(state.cover || themeCover(curTheme))}" alt="cover">
        ${presetRow('cover', COVER_PRESETS, state.cover || themeCover(curTheme))}
        <div class="add-form btn-row">
          <button class="btn" data-act="pick-cover">내 사진 올리기</button>
          <button class="btn flat" data-act="reset-cover">기본으로</button>
        </div>
        <div class="hint">감성 사진 중에 고르거나, 내 사진을 올리면 아이패드 화면에 맞게 자동으로 줄여 저장해요.</div>
      </div>
      <div class="set-card">
        <h4>🐱 고양이 카드</h4>
        <img class="thumb arch" src="${esc(state.cat || (THEMES[curTheme] || THEMES.sky).cat)}" alt="cat">
        ${presetRow('cat', CAT_PRESETS, state.cat || (THEMES[curTheme] || THEMES.sky).cat)}
        <div class="add-form btn-row">
          <button class="btn" data-act="pick-cat">사진 바꾸기</button>
          <button class="btn flat" data-act="reset-cat">기본으로</button>
        </div>
        <div class="hint">아치형 카드에 들어갈 사진을 골라주세요.</div>
      </div>
      <div class="set-card">
        <h4>🐾 프로필 사진</h4>
        <div class="avatar-preview">
          <img class="avatar big" id="avatarPreview" src="${esc(state.avatar || DEFAULT_AVATAR)}" alt="프로필">
          <div class="hint">상단 제목 옆에 보이는 동그란 사진이에요. 하치와레 고양이가 기본값!</div>
        </div>
        <div class="add-form btn-row">
          <button class="btn" data-act="pick-avatar">프로필 사진 올리기</button>
          <button class="btn flat" data-act="reset-avatar">기본으로</button>
        </div>
      </div>
    </div>

    <section class="sec">
      <div class="sec-head"><h3><span class="em">✍️</span>제목 · 인용구</h3></div>
      <div class="sec-card">
        <div class="add-form">
          ${F_CELL('제목', `<input class="in" id="setTitle" value="${esc(state.title)}" placeholder="My Dashboard" maxlength="40">`, 'full')}
          ${F_CELL('인용구', `<input class="in" id="setQuote" value="${esc(state.quote)}" placeholder="짧은 문장 하나" maxlength="80">`, 'full')}
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
        <div class="add-form btn-row">
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
        <div class="add-form btn-row">
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
  const purged = purgeRetiredSeeds(remote.state);
  state = normalize(remote.state);
  state.sync = { code, enabled: true };
  state.meta = { pristine: false };
  state.updatedAt = remote.updatedAt || Date.now();
  if (purged) state.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  lastSyncAt = Date.now();
  renderAll();
  applyingRemote = false;
  /* 옛 시드 편입 일정이 남아 있던 클라우드를 깨끗한 내용으로 다시 올린다 */
  if (purged) schedulePush();
}

function schedulePush() {
  if (!started || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { cloudPush(); }, 1200);
}

/* 옛 시드 편입 일정을 지운 기기 내용을 클라우드에도 반영 (첫 pull 이후에만) */
function flushSeedCleanup() {
  if (!pendingSeedCleanup) return;
  pendingSeedCleanup = false;
  commit();
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
  flushSeedCleanup();
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
    const control = f => {
      const attrs = `name="${esc(f.key)}" ${f.inputmode ? `inputmode="${esc(f.inputmode)}"` : ''}`;
      if (f.type === 'category') return catPickerHtml(f.key, f.options || expenseCatOptions(), f.value, f.kind || 'expense');
      if (f.type === 'select') return `<select class="in" ${attrs}>${(f.options || []).map(o => `<option ${o === f.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      if (f.type === 'date') return `<span class="date-shell is-empty" data-ph="날짜 선택"><input class="in" type="date" ${attrs} value="${esc(f.value == null ? '' : f.value)}"></span>`;
      if (f.type === 'textarea') return `<textarea class="in" ${attrs} rows="${Number(f.rows) || 3}" placeholder="${esc(f.placeholder || '')}" maxlength="${Number(f.maxlength) || 2000}">${esc(f.value == null ? '' : f.value)}</textarea>`;
      return `<input class="in" ${attrs} type="${esc(f.type || 'text')}" value="${esc(f.value == null ? '' : f.value)}" placeholder="${esc(f.placeholder || '')}">`;
    };
    /* 날짜·소태그·본문은 폭을 다 잡고, 나머지는 두 칸 그리드에 놓는다 */
    const fieldHtml = f => {
      const wide = f.full || f.type === 'date' || f.type === 'textarea';
      const cls = `pf${f.type === 'date' ? ' date' : ''}${wide ? ' full' : ''}`;
      /* 카테고리 타일은 단추를 품으므로 label 대신 div로 감싼다 (label 클릭이 숨은 select를 건드리지 않도록) */
      if (f.type === 'category') return `<div class="${cls}"><span>${esc(f.label || '')}</span>${control(f)}</div>`;
      return `<label class="${cls}">
        <span>${esc(f.label || '')}</span>
        ${control(f)}
      </label>`;
    };
    wrap.innerHTML = `<div class="prompt-box">
      <h4>${esc(opts.title || '')}</h4>
      ${opts.message ? `<p>${esc(opts.message)}</p>` : ''}
      <div class="pf-grid">${(opts.fields || []).map(fieldHtml).join('')}</div>
      <div class="row">
        <button class="btn flat" data-x="cancel">취소</button>
        <button class="btn primary" data-x="ok">${esc(opts.confirmText || '확인')}</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    syncDateShells(wrap);
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
    /* 다른 칸 값에 따라 목록·안내가 바뀔 때 (예: 지출/수입 → 카테고리) */
    wrap.addEventListener('change', ev => {
      const el = ev.target.closest && ev.target.closest('[name]');
      if (!el || !opts.onChange) return;
      opts.onChange(el.name, el.value, wrap);
    });
    wrap.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      /* 여러 줄 본문에서는 Enter가 줄바꿈이어야 한다 */
      if (ev.target && ev.target.tagName === 'TEXTAREA' && !ev.ctrlKey && !ev.metaKey) return;
      const ok = wrap.querySelector('[data-x="ok"]'); if (ok) ok.click();
    });
    /* 날짜 칸이 먼저 있어도 자동으로 달력이 열리지 않게 날짜가 아닌 칸을 먼저 잡는다 */
    const first = wrap.querySelector('input:not([type="date"]),select,textarea') || wrap.querySelector('input');
    if (first) setTimeout(() => first.focus(), 60);
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
    const sel = fv(form, 'type');
    const type = sel === 'income' ? 'income' : sel === 'saving' ? 'saving' : 'expense';
    const cats = catOptionsFor(type);
    let cat = fv(form, 'cat');
    if (!cats.includes(cat)) cat = type === 'saving' ? (cats[0] || '기타') : '기타';
    state.finance.expenses.push({ id: uid(), date: form.dataset.date, title, amount: Math.abs(amount), cat, type, memo: '' });
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
    const name = fv(form, 'name'); const amount = clampNum(fv(form, 'amount'));
    let day = clampNum(fv(form, 'day'));
    if (!name || !amount || !day) return toast('서비스명·금액·결제일을 채워주세요');
    if (day < 1) day = 1; if (day > 31) day = 31;
    const cycle = fv(form, 'cycle') === 'yearly' ? 'yearly' : 'monthly';
    const month = Math.min(12, Math.max(1, clampNum(fv(form, 'month')) || 1));
    const cat = fv(form, 'cat') || '정기구독';
    const memo = fv(form, 'memo');
    const sub = { id: uid(), name, amount, day, cycle, month, active: true, cat, memo, createdAt: todayISO() };
    /* 등록일 기준 다음 결제일 → 이번 달 결제일이 지났으면 다음 달부터 */
    sub.startDate = nextSubDate(sub, todayISO());
    state.finance.subs.push(sub);
    commit(); toast(`${cycle === 'yearly' ? '매년' : '매달'} 정기구독으로 추가했어요 · ${subStartLabel(sub)} 표시`);
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
    state.memo.notes.push({ id: uid(), title: title || '제목 없음', body, tags: parseTags(fv(form, 'tags')), updated: Date.now() });
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

/* 정기구독 주기 선택 → 매년일 때만 월 선택지 보이기 */
document.addEventListener('change', ev => {
  const sel = ev.target.closest('[data-form="sub"] select[name="cycle"]');
  if (!sel) return;
  const form = sel.closest('[data-form="sub"]');
  if (form) form.classList.toggle('yearly', sel.value === 'yearly');
});

/* 내역 종류(지출/수입/저축) → 알맞은 카테고리 목록으로 바꾸기 */
document.addEventListener('change', ev => {
  const sel = ev.target.closest('[data-form="expense"] select[name="type"]');
  if (!sel) return;
  const form = sel.closest('[data-form="expense"]');
  const picker = form && form.querySelector('[data-cat-picker]');
  const catSel = picker && picker.querySelector('select');
  if (!catSel) return;
  const type = sel.value === 'income' ? 'income' : sel.value === 'saving' ? 'saving' : 'expense';
  catSel.innerHTML = catOptionHtml(catOptionsFor(type));
  picker.dataset.catKind = type;
  syncCatPicker(picker);
  form.classList.toggle('is-income', type === 'income');
  form.classList.toggle('is-saving', type === 'saving');
});

/* 카테고리 타일 단추 → 목록 열기 */
document.addEventListener('click', ev => {
  const btn = ev.target.closest && ev.target.closest('[data-cat-open]');
  if (!btn) return;
  ev.preventDefault();
  const picker = btn.closest('[data-cat-picker]');
  if (picker) openCatSheet(picker);
});

/* 빈 날짜 칸 안내 문구 — 값이 생길거나 지워지면 바로 반영 */
document.addEventListener('input', ev => {
  const s = ev.target.closest && ev.target.closest('.date-shell');
  if (!s) return;
  const i = s.querySelector('input');
  s.classList.toggle('is-empty', !(i && i.value));
}, true);
document.addEventListener('change', ev => {
  const s = ev.target.closest && ev.target.closest('.date-shell');
  if (!s) return;
  const i = s.querySelector('input');
  s.classList.toggle('is-empty', !(i && i.value));
}, true);

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
    case 'open-invest': openModal('invest'); break;
    case 'open-wishlist': openModal('wishlist'); break;
    case 'open-memo': openModal('memo'); break;
    case 'open-settings': openModal('settings'); break;
    case 'open-weather': openWeather(); break;
    case 'wx-relocate': wxRefresh(true); break;
    case 'modal-close': closeModal(); break;
    case 'open-day': openModal('day', t.dataset.date); break;
    case 'open-calendar': openCalendarModal(t.dataset.date || null); break;

    /* 큰 캘린더 모달 */
    case 'calx-prev': calxMonth = new Date(calxMonth.getFullYear(), calxMonth.getMonth() - 1, 1); calxSel = null; renderModal(); break;
    case 'calx-next': calxMonth = new Date(calxMonth.getFullYear(), calxMonth.getMonth() + 1, 1); calxSel = null; renderModal(); break;
    case 'calx-today': calxMonth = new Date(); calxMonth.setDate(1); calxSel = todayISO(); renderModal(); break;
    case 'calx-day': calxSel = t.dataset.date; renderModal(); break;
    case 'calx-open-day': calxReturn = true; openModal('day', t.dataset.date); break;

    /* calendar */
    case 'cal-prev': viewMonth.setMonth(viewMonth.getMonth() - 1); renderCalendar(); break;
    case 'cal-next': viewMonth.setMonth(viewMonth.getMonth() + 1); renderCalendar(); break;
    case 'cal-today': viewMonth = new Date(); viewMonth.setDate(1); renderCalendar(); break;
    case 'fin-prev': finMonth.setMonth(finMonth.getMonth() - 1); renderFinanceModalAndKeep(); break;
    case 'fin-next': finMonth.setMonth(finMonth.getMonth() + 1); renderFinanceModalAndKeep(); break;
    case 'fin-today': finMonth = new Date(); finMonth.setDate(1); renderFinanceModalAndKeep(); break;
    case 'fin-day': finSel = t.dataset.date; renderFinanceModalAndKeep(); break;
    case 'fin-detail': finDetailReturn = true; openModal('fin-detail', t.dataset.kind); break;

    /* todo */
    case 'todo-toggle': {
      const it = state.todo.find(x => x.id === id); if (it) { it.done = !it.done; commit(); } break;
    }
    case 'todo-del': state.todo = state.todo.filter(x => x.id !== id); commit(); break;
    case 'todo-edit': {
      const it = state.todo.find(x => x.id === id); if (!it) break;
      const r = await askPrompt({
        title: 'TO-DO 수정',
        fields: [{ key: 'text', label: '할 일', value: it.text, full: true }],
        confirmText: '저장',
      });
      if (!r) break;
      const text = (r.text || '').trim();
      if (!text) { toast('할 일을 채워주세요'); break; }
      it.text = text; commit(); break;
    }

    /* study goals */
    case 'goal-toggle': {
      const scope = t.dataset.scope; const it = state.study[scope].find(x => x.id === id);
      if (it) { it.done = !it.done; commit(); } break;
    }
    case 'goal-del': {
      const scope = t.dataset.scope;
      state.study[scope] = state.study[scope].filter(x => x.id !== id); commit(); break;
    }
    case 'goal-edit': {
      const scope = t.dataset.scope;
      const it = (state.study[scope] || []).find(x => x.id === id); if (!it) break;
      const r = await askPrompt({
        title: `${GOAL_META[scope].label} 수정`,
        fields: [{ key: 'text', label: '목표', value: it.text, full: true }],
        confirmText: '저장',
      });
      if (!r) break;
      const text = (r.text || '').trim();
      if (!text) { toast('목표를 채워주세요'); break; }
      it.text = text; commit(); break;
    }
    case 'exam-del': state.study.exams = state.study.exams.filter(x => x.id !== id); commit(); break;
    case 'exam-edit': {
      const x = state.study.exams.find(e => e.id === id); if (!x) break;
      const r = await askPrompt({
        title: '시험·지원 수정',
        fields: [
          { key: 'name', label: '이름', value: x.name },
          { key: 'date', label: '날짜', type: 'date', value: x.date },
          { key: 'type', label: '구분', type: 'select', options: EXAM_TYPES, value: x.type },
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
    case 'exp-edit': {
      const e = state.finance.expenses.find(x => x.id === id); if (!e) break;
      const type0 = isIncome(e) ? 'income' : isSaving(e) ? 'saving' : 'expense';
      const cats0 = catOptionsFor(type0);
      const r = await askPrompt({
        title: '내역 수정',
        fields: [
          { key: 'date', label: '날짜', type: 'date', value: e.date },
          { key: 'type', label: '종류', type: 'select', options: ['지출', '수입', '저축'], value: TYPE_LABEL[type0] },
          { key: 'cat', label: '카테고리', type: 'category', kind: type0, options: cats0, value: cats0.includes(e.cat) ? e.cat : cats0[0] },
          { key: 'title', label: '내역', value: e.title, full: true },
          { key: 'amount', label: '금액', value: amtOf(e), inputmode: 'numeric' },
          { key: 'memo', label: '메모 (선택)', value: e.memo || '' },
        ],
        confirmText: '저장',
        /* 지출 ↔ 수입 ↔ 저축을 바꾸면 카테고리 목록이 그 종류에 맞춰 통째로 바뀐다 */
        onChange: (key, val, wrap) => {
          if (key !== 'type') return;
          const picker = wrap.querySelector('[data-cat-picker]');
          const catSel = picker && picker.querySelector('select');
          if (!catSel) return;
          const t = typeKeyOf(val);
          const cats = catOptionsFor(t);
          const cur = catSel.value;
          catSel.innerHTML = catOptionHtml(cats, cats.includes(cur) ? cur : cats[0]);
          picker.dataset.catKind = t;
          syncCatPicker(picker);
          wrap.classList.toggle('is-income', t === 'income');
          wrap.classList.toggle('is-saving', t === 'saving');
        },
      });
      if (!r) break;
      const type = typeKeyOf(r.type);
      const cats = catOptionsFor(type);
      const cat = cats.includes(r.cat) ? r.cat : (type === 'saving' ? (cats[0] || '기타') : '기타');
      const amount = clampNum(r.amount);
      Object.assign(e, {
        date: r.date || e.date,
        type,
        title: (r.title || '').trim() || e.title,
        amount: amount || amtOf(e),
        cat,
        memo: (r.memo || '').trim(),
      });
      commit(); toast('내역을 수정했어요');
      break;
    }
    case 'sub-toggle': { const s = state.finance.subs.find(x => x.id === id); if (s) { s.active = !s.active; commit(); } break; }
    case 'sub-del': state.finance.subs = state.finance.subs.filter(x => x.id !== id); commit(); break;
    case 'sub-edit': {
      const s = state.finance.subs.find(x => x.id === id); if (!s) break;
      const r = await askPrompt({
        title: '정기구독 수정',
        fields: [
          { key: 'name', label: '서비스명', value: s.name },
          { key: 'amount', label: '금액', value: s.amount, inputmode: 'numeric' },
          { key: 'cycle', label: '주기', type: 'select', options: ['매달', '매년'], value: s.cycle === 'yearly' ? '매년' : '매달' },
          { key: 'month', label: '월 (매년일 때)', type: 'select', options: Array.from({ length: 12 }, (_, i) => `${i + 1}월`), value: `${s.month || 1}월` },
          { key: 'day', label: '일', type: 'select', options: Array.from({ length: 31 }, (_, i) => `${i + 1}일`), value: `${s.day || 1}일` },
          { key: 'cat', label: '카테고리', type: 'category', kind: 'expense', options: expenseCatOptions(), value: expenseCatOptions().includes(s.cat) ? s.cat : '정기구독' },
          { key: 'memo', label: '결제수단/메모 (선택)', value: s.memo || '', full: true, placeholder: '예: 신한 체크, 토스뱅크' },
        ], confirmText: '저장',
      });
      if (!r) break;
      const nextCycle = r.cycle === '매년' ? 'yearly' : 'monthly';
      const nextMonth = Math.min(12, Math.max(1, parseInt(r.month, 10) || s.month || 1));
      const nextDay = Math.min(31, Math.max(1, parseInt(r.day, 10) || s.day || 1));
      const scheduleChanged = nextCycle !== s.cycle || nextMonth !== Number(s.month) || nextDay !== Number(s.day);
      Object.assign(s, {
        name: r.name.trim() || s.name,
        amount: clampNum(r.amount),
        cycle: nextCycle,
        month: nextMonth,
        day: nextDay,
        cat: r.cat || s.cat || '정기구독',
        memo: String(r.memo || '').trim(),
      });
      /* 결제일·주기를 바꾸면 오늘 기준 다음 결제일로 다시 잡는다 (금액만 고칠 땐 그대로) */
      if (scheduleChanged) s.startDate = nextSubDate(s, todayISO());
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

    /* 🏦 부채현황 (햇살론유스) */
    case 'loan-del': {
      const L = state.finance.loans;
      L.rounds = (L.rounds || []).filter(x => x.id !== id);
      commit(); toast('대출을 목록에서 지웠어요');
      break;
    }
    case 'loan-edit': {
      const L = state.finance.loans;
      const l = (L.rounds || []).find(x => x.id === id); if (!l) break;
      const r = await askPrompt({
        title: `${l.round}회차 대출 수정`,
        fields: [
          { key: 'principal', label: '원금', value: l.principal, inputmode: 'numeric' },
          { key: 'rate', label: '금리 (%)', value: String(Number(((Number(l.rate) || LOAN_RATE) * 100).toFixed(1))) },
          { key: 'startDate', label: '대출일', type: 'date', value: l.startDate || '' },
          { key: 'deferEnd', label: '거치 종료일', type: 'date', value: l.deferEnd || '' },
          { key: 'repayStart', label: '원금상환 시작 (YYYY-MM)', value: l.repayStart || '' },
          { key: 'months', label: '상환 개월', value: String(loanMonths(l)), inputmode: 'numeric' },
        ],
        confirmText: '저장',
      });
      if (!r) break;
      const principal = clampNum(r.principal);
      const months = Math.max(1, Math.min(600, clampNum(r.months) || loanMonths(l) || 1));
      const repayStart = isYM(String(r.repayStart || '').trim()) ? String(r.repayStart).trim() : l.repayStart;
      const rateNum = Number(String(r.rate || '').replace(/[^\d.]/g, ''));
      Object.assign(l, {
        principal: principal || l.principal,
        rate: (rateNum > 0 ? rateNum : (Number(l.rate) || LOAN_RATE) * 100) / 100,
        startDate: r.startDate || l.startDate,
        deferEnd: r.deferEnd || l.deferEnd,
        repayStart,
        months,
        repayEnd: ymAdd(repayStart, months - 1),
      });
      commit(); toast('대출 정보를 수정했어요 · 납부 금액이 다시 계산됐어요');
      break;
    }
    case 'loan-defer-edit': {
      const L = state.finance.loans;
      const c = (L.deferCharges || []).find(x => x.id === id); if (!c) break;
      const r = await askPrompt({
        title: '거치기간 이자 수정',
        fields: [
          { key: 'name', label: '이름', value: c.name, full: true },
          { key: 'amount', label: '월 이자', value: c.amount, inputmode: 'numeric' },
        ],
        confirmText: '저장',
      });
      if (!r) break;
      c.name = (r.name || '').trim() || c.name;
      c.amount = Math.abs(clampNum(r.amount)) || c.amount;
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
          { key: 'cat', label: '카테고리', type: 'category', kind: 'expense', options: ['구매예정'].concat(expenseCatOptions()), value: n.plannedCat || '구매예정' },
        ], confirmText: '넘기기',
      });
      if (!r || !r.date) break;
      const amount = clampNum(r.amount) || Number(n.price) || 0;
      n.status = '예정'; n.plannedDate = r.date; n.plannedAmount = amount; n.plannedCat = r.cat || '구매예정';
      state.finance.planned = state.finance.planned.filter(p => p.needId !== n.id);
      state.finance.planned.push({ id: uid(), needId: n.id, name: n.name, date: r.date, amount, cat: n.plannedCat });
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
          { key: 'cat', label: '카테고리', type: 'category', kind: 'expense', options: expenseCatOptions(), value: (n.plannedCat && n.plannedCat !== '구매예정') ? n.plannedCat : '쇼핑' },
        ], confirmText: '완료',
      });
      if (!r || !r.date) break;
      const amount = clampNum(r.amount) || Number(n.price) || 0;
      n.status = '완료'; n.boughtDate = r.date; n.boughtAmount = amount;
      state.finance.planned = state.finance.planned.filter(p => p.needId !== n.id);
      state.finance.expenses.push({ id: uid(), date: r.date, title: n.name, amount, cat: r.cat || '쇼핑', type: 'expense', memo: 'Wishlist 구매' });
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
    case 'diary-edit': {
      const d = state.memo.diary.find(x => x.id === id); if (!d) break;
      const r = await askPrompt({
        title: '한줄일기 수정',
        fields: [
          { key: 'date', label: '날짜', type: 'date', value: d.date },
          { key: 'mood', label: '기분', type: 'select', options: MOODS, value: d.mood || '🤍' },
          { key: 'text', label: '내용', type: 'textarea', rows: 3, value: d.text, maxlength: 140 },
        ],
        confirmText: '저장',
      });
      if (!r) break;
      const text = (r.text || '').trim();
      if (!text) { toast('내용을 채워주세요'); break; }
      const date = r.date || d.date;
      /* 하루에 한 줄 — 다른 날짜로 옴기려는 날에 이미 일기가 있으면 덮어쓰지 않고 알려준다 */
      if (state.memo.diary.some(x => x.id !== d.id && x.date === date)) {
        toast('그 날짜에 이미 한줄일기가 있어요 · 다른 날로 골라주세요'); break;
      }
      Object.assign(d, { date, mood: r.mood || '🤍', text });
      commit(); break;
    }
    case 'habit-toggle': {
      const h = state.memo.habits.find(x => x.id === id); if (!h) break;
      h.log = h.log || {};
      const d = t.dataset.date;
      if (h.log[d]) delete h.log[d]; else h.log[d] = true;
      commit(); break;
    }
    case 'habit-del': state.memo.habits = state.memo.habits.filter(x => x.id !== id); commit(); break;
    case 'habit-edit': {
      const h = state.memo.habits.find(x => x.id === id); if (!h) break;
      const r = await askPrompt({
        title: '습관·루틴 수정',
        fields: [{ key: 'name', label: '이름', value: h.name, full: true }],
        confirmText: '저장',
      });
      if (!r) break;
      const name = (r.name || '').trim();
      if (!name) { toast('이름을 채워주세요'); break; }
      /* 이름만 바꾸고 지난 체크 기록(h.log)은 그대로 둔다 */
      h.name = name; commit(); break;
    }
    case 'note-del': state.memo.notes = state.memo.notes.filter(x => x.id !== id); commit(); break;
    case 'note-edit': {
      const n = state.memo.notes.find(x => x.id === id); if (!n) break;
      const r = await askPrompt({
        title: '메모 수정',
        fields: [
          { key: 'title', label: '제목', value: n.title, full: true },
          { key: 'tags', label: '태그 (쉼표로 구분)', value: tagText(n.tags), full: true },
          { key: 'body', label: '내용', type: 'textarea', rows: 5, value: n.body, maxlength: 2000 },
        ], confirmText: '저장',
      });
      if (!r) break;
      const title = (r.title || '').trim();
      Object.assign(n, { title: title || '제목 없음', body: (r.body || '').trim(), tags: parseTags(r.tags), updated: Date.now() });
      commit(); break;
    }

    /* events */
    case 'event-del': state.events = state.events.filter(x => x.id !== id); commit(); break;

    /* settings */
    case 'theme-toggle': switchTheme(t.dataset.next || (themeOf(state) === 'xmas' ? 'sky' : 'xmas')); break;
    case 'set-theme': switchTheme(t.dataset.theme); break;
    case 'set-cover': state.cover = t.dataset.src === themeCover(themeOf(state)) ? null : t.dataset.src; commit(); break;
    case 'set-cat': state.cat = t.dataset.src === (THEMES[themeOf(state)] || THEMES.sky).cat ? null : t.dataset.src; commit(); break;
    case 'pick-cover': $('#coverFile').click(); break;
    case 'pick-cat': $('#catFile').click(); break;
    case 'pick-avatar': $('#avatarFile').click(); break;
    case 'reset-cover': state.cover = null; commit(); toast('기본 커버로 돌아왔어요'); break;
    case 'reset-cat': state.cat = null; commit(); toast('기본 고양이로 돌아왔어요'); break;
    case 'reset-avatar': state.avatar = null; commit(); toast('기본 프로필 사진으로 돌아왔어요'); break;
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
  if (openModalType === 'finance' || openModalType === 'invest') renderModal();
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
  mk('avatarFile', 600, 'avatar', '프로필 사진을 바꿨어요');

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
function setAmpm(el, val) {
  if (!el || el.dataset.v === val) return;
  el.dataset.v = val; el.textContent = val;
}
/* 24시간 → 12시간제: 0→AM 12, 1~11→AM 01~11, 12→PM 12, 13~23→PM 01~11 */
function hour12(h) {
  const n = ((Number(h) % 12) + 12) % 12;
  return n === 0 ? 12 : n;
}
const ampmOf = h => (Number(h) < 12 ? 'AM' : 'PM');
function clockParts(h) {
  const h12 = hour12(h);
  return { h12, hour: pad2(h12), ampm: ampmOf(h) };
}
function renderClock(d) {
  const p = clockParts(d.getHours());
  const min = d.getMinutes();
  setFlip($('#flipHour'), p.hour);
  setAmpm($('#flipAmpm'), p.ampm);
  setFlip($('#flipMin'), pad2(min));
  const s = $('#clockSec'); if (s) s.textContent = pad2(d.getSeconds());
  const w = $('#clockWeek'); if (w) w.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK_KO[d.getDay()]}요일`;
  const row = $('.flip-row');
  if (row) row.setAttribute('aria-label', `${p.ampm === 'AM' ? '오전' : '오후'} ${p.h12}시 ${min}분`);
}
function tickClock() {
  renderClock(new Date());
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
const WX_CACHE_KEY = 'gayeon_wx_v1';
const WX_POS_KEY = 'gayeon_wx_pos_v1';
const INCHEON = { lat: 37.4563, lon: 126.7052, name: '인천' };
const wxState = { pos: null, place: '인천', note: '', data: null, days: [], hours: [], at: 0, status: 'idle', busy: false };

function readWxPos() {
  try {
    const p = JSON.parse(localStorage.getItem(WX_POS_KEY) || 'null');
    if (p && isFinite(p.lat) && isFinite(p.lon)) return p;
  } catch (e) {}
  return null;
}
function saveWxPos(p) { try { localStorage.setItem(WX_POS_KEY, JSON.stringify(p)); } catch (e) {} }
function applyWxPos(pos, note) {
  wxState.pos = pos;
  wxState.place = (pos && pos.name) || '현 위치';
  wxState.note = note || '';
  const el = $('#wxPlace'); if (el) el.textContent = wxState.place;
}
const wxOf = code => WX[code] || ['🌥️', '구름'];
function paintWeather(j) {
  const cur = j.current || {};
  const daily = j.daily || {};
  const [emoji, label] = wxOf(cur.weather_code != null ? cur.weather_code : 0);
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

/* 10일 예보 · 오늘 시간대별 — 현 위치(없으면 인천) 기준 Open-Meteo */
async function fetchWx(pos) {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${pos.lat}&longitude=${pos.lon}`
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m'
    + '&hourly=temperature_2m,weather_code,relative_humidity_2m,precipitation_probability'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset'
    + '&timezone=Asia%2FSeoul&forecast_days=10';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('weather http ' + res.status);
  return res.json();
}
function wxNextHours(j, n = 8) {
  const H = j.hourly || {}, times = H.time || [];
  const now = new Date();
  const stamp = `${isoOf(now)}T${pad2(now.getHours())}:00`;
  let i = times.findIndex(t => t >= stamp);
  if (i < 0) i = 0;
  return times.slice(i, i + n).map((t, k) => ({
    time: t,
    temp: H.temperature_2m ? H.temperature_2m[i + k] : null,
    code: H.weather_code ? H.weather_code[i + k] : 0,
    rain: H.precipitation_probability ? H.precipitation_probability[i + k] : null,
  }));
}
function wxNextDays(j) {
  const D = j.daily || {}, times = D.time || [];
  return times.slice(0, 10).map((t, i) => ({
    date: t,
    code: D.weather_code ? D.weather_code[i] : 0,
    hi: D.temperature_2m_max ? D.temperature_2m_max[i] : null,
    lo: D.temperature_2m_min ? D.temperature_2m_min[i] : null,
    rain: D.precipitation_probability_max ? D.precipitation_probability_max[i] : null,
    wind: D.wind_speed_10m_max ? D.wind_speed_10m_max[i] : null,
    sunrise: D.sunrise ? D.sunrise[i] : null,
    sunset: D.sunset ? D.sunset[i] : null,
  }));
}
function wxDayLabel(ds) {
  const diff = daysBetween(todayISO(), ds);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  const d = parseISO(ds);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEK_KO[d.getDay()]})`;
}

/* 역지오코딩 — 실패해도 예보는 계속 (이름만 '현 위치') */
async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`, { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      const name = j.city || j.locality || j.principalSubdivision || '';
      if (name) return name;
    }
  } catch (e) {}
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ko`, { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json(); const a = j.address || {};
      const name = a.city || a.town || a.county || a.borough || a.suburb || '';
      if (name) return name;
    }
  } catch (e) {}
  return '현 위치';
}
function wxLocate() {
  return new Promise(resolve => {
    const g = typeof navigator !== 'undefined' ? navigator.geolocation : null;
    if (!g || !g.getCurrentPosition) return resolve({ pos: null, note: '이 기기에서는 위치를 못 받아 인천 기준으로 보여드려요' });
    let done = false;
    const finish = v => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => finish({ pos: null, note: '위치를 찾는 데 시간이 걸려 인천 기준으로 보여드려요' }), 9000);
    try {
      g.getCurrentPosition(async p => {
        const lat = p.coords.latitude, lon = p.coords.longitude;
        const name = await reverseGeocode(lat, lon);
        const pos = { lat, lon, name, ts: Date.now(), src: 'geo' };
        saveWxPos(pos);
        finish({ pos, note: '' });
      }, err => {
        const code = err && err.code;
        finish({ pos: null, note: code === 1 ? '위치 권한이 없어 인천 기준이에요' : '위치를 못 찾아 인천 기준으로 보여드려요' });
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 });
    } catch (e) { finish({ pos: null, note: '위치를 못 받아 인천 기준으로 보여드려요' }); }
  });
}

async function wxRefresh(useGeo) {
  if (wxState.busy) return;
  wxState.busy = true; wxState.status = 'loading';
  if (openModalType === 'weather') renderModal();
  try {
    if (useGeo) {
      const r = await wxLocate();
      if (r && r.pos) applyWxPos(r.pos, '');
      else applyWxPos(wxState.pos && wxState.pos.src === 'geo' ? wxState.pos : Object.assign({}, INCHEON), (r && r.note) || '위치 권한이 없어 인천 기준이에요');
    }
    const pos = wxState.pos || Object.assign({}, INCHEON);
    const j = await fetchWx(pos);
    wxState.data = j;
    wxState.hours = wxNextHours(j, 8);
    wxState.days = wxNextDays(j);
    wxState.at = Date.now();
    wxState.status = 'ready';
    try { localStorage.setItem(WX_CACHE_KEY, JSON.stringify({ t: Date.now(), d: j, pos, place: wxState.place })); } catch (e) {}
    paintWeather(j);
  } catch (e) {
    wxState.status = 'error';
    if (!wxState.data) {
      const desc = $('#wxDesc');
      if (desc) desc.textContent = '날씨를 불러오지 못했어요';
      const extra = $('#wxExtra');
      if (extra && wxState.pos) extra.innerHTML = `<span>${esc(wxState.place)} 기준 · 잠시 뒤 다시 시도할게요</span>`;
    }
  } finally {
    wxState.busy = false;
    if (openModalType === 'weather') renderModal();
  }
}

function openWeather() {
  const saved = readWxPos();
  if (!wxState.pos) applyWxPos(saved || Object.assign({}, INCHEON), saved ? '' : '');
  openModal('weather');
  wxRefresh(true);
}
async function loadWeather(opts = {}) {
  try {
    const cached = JSON.parse(localStorage.getItem(WX_CACHE_KEY) || 'null');
    if (cached && cached.d && Date.now() - cached.t < 30 * 60 * 1000) {
      if (cached.pos) applyWxPos(cached.pos, '');
      paintWeather(cached.d);
      wxState.data = cached.d; wxState.at = cached.t;
      wxState.hours = wxNextHours(cached.d, 8);
      wxState.days = wxNextDays(cached.d);
    }
  } catch (e) {}
  let pos = readWxPos();
  /* 이미 위치를 허용해 둔 기기라면 묻지 않고 조용히 현 위치 사용 */
  if (!pos && opts.silentLocate) {
    try {
      const perm = navigator.permissions && await navigator.permissions.query({ name: 'geolocation' });
      if (perm && perm.state === 'granted') {
        const r = await wxLocate();
        if (r && r.pos) pos = r.pos;
      }
    } catch (e) {}
  }
  if (!pos) pos = Object.assign({}, INCHEON);
  applyWxPos(pos, '');
  try {
    const j = await fetchWx(pos);
    wxState.data = j;
    wxState.hours = wxNextHours(j, 8);
    wxState.days = wxNextDays(j);
    wxState.at = Date.now();
    wxState.status = 'ready';
    localStorage.setItem(WX_CACHE_KEY, JSON.stringify({ t: Date.now(), d: j, pos, place: wxState.place }));
    paintWeather(j);
    if (openModalType === 'weather') renderModal();
  } catch (e) {
    wxState.status = 'error';
    const desc = $('#wxDesc');
    if (desc) desc.textContent = '날씨를 불러오지 못했어요';
    const extra = $('#wxExtra');
    if (extra) extra.innerHTML = `<span>${esc(wxState.place)} 기준 · 잠시 뒤 다시 시도할게요</span>`;
  }
}

/* ───────────── weather modal ───────────── */
function renderWeatherModal() {
  const s = wxState;
  const stamp = s.at ? new Date(s.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
  const top = `<div class="wxm-bar">
    <div class="wxm-where">
      <span class="wxm-place">📍 ${esc(s.place)}</span>
      ${s.note ? `<span class="wxm-note">${esc(s.note)}</span>` : ''}
      ${stamp ? `<span class="wxm-stamp">${esc(stamp)} 기준</span>` : ''}
    </div>
    <button class="btn tiny flat wxm-reload" data-act="wx-relocate"${s.busy ? ' disabled' : ''}>${s.busy ? '불러오는 중…' : '📍 현 위치 다시 불러오기'}</button>
  </div>`;

  if (!s.data) {
    const msg = s.status === 'error'
      ? `${esc(s.place)} 날씨를 불러오지 못했어요 · 잠시 뒤 다시 시도해 주세요`
      : '날씨를 불러오는 중이에요…';
    return top + `<section class="sec"><div class="wxm-loading">${msg}</div></section>`;
  }

  const cur = s.data.current || {};
  const [em, label] = wxOf(cur.weather_code != null ? cur.weather_code : 0);
  const d0 = s.days[0] || {};
  const rainNow = d0.rain != null ? d0.rain : (s.hours.length ? s.hours[0].rain : null);
  const stat = (k, v) => `<div class="wxm-stat"><span>${k}</span><b>${v}</b></div>`;
  const hhmm = t => (t && t.length >= 16 ? t.slice(11, 16) : '');

  const today = `<section class="sec">
    <div class="sec-head"><h3><span class="em">🌤️</span>오늘</h3><span class="sec-note">${esc(wxDayLabel(d0.date || todayISO()))} · ${esc(label)}</span></div>
    <div class="wxm-today">
      <div class="wxm-now">
        <div class="wxm-big-emoji">${em}</div>
        <div>
          <div class="wxm-now-temp">${Math.round(cur.temperature_2m)}°</div>
          <div class="wxm-now-desc">${esc(label)}</div>
        </div>
      </div>
      <div class="wxm-stats">
        ${stat('체감', cur.apparent_temperature != null ? `${Math.round(cur.apparent_temperature)}°` : '-')}
        ${stat('습도', cur.relative_humidity_2m != null ? `${cur.relative_humidity_2m}%` : '-')}
        ${stat('바람', cur.wind_speed_10m != null ? `${Math.round(cur.wind_speed_10m)}km/h` : '-')}
        ${stat('강수확률', rainNow != null ? `${Math.round(rainNow)}%` : '-')}
        ${stat('최고/최저', `${d0.hi != null ? Math.round(d0.hi) : '-'}° / ${d0.lo != null ? Math.round(d0.lo) : '-'}°`)}
        ${stat('일출/일몰', `${hhmm(d0.sunrise) || '-'} / ${hhmm(d0.sunset) || '-'}`)}
      </div>
    </div>
  </section>`;

  const hours = s.hours.length ? `<section class="sec">
    <div class="sec-head"><h3><span class="em">🕒</span>오늘 시간대별</h3><span class="sec-note">앞으로 ${s.hours.length}시간</span></div>
    <div class="wxm-hours">${s.hours.map((h, k) => {
      const [he] = wxOf(h.code);
      const hr = h.time.slice(11, 13);
      return `<div class="wxm-hour${k === 0 ? ' now' : ''}">
        <span class="t">${k === 0 ? '지금' : `${Number(hr)}시`}</span>
        <span class="e">${he}</span>
        <span class="d">${Math.round(h.temp)}°</span>
        ${h.rain != null && h.rain >= 20 ? `<span class="r">💧${Math.round(h.rain)}%</span>` : ''}
      </div>`;
    }).join('')}</div>
  </section>` : '';

  const los = s.days.map(d => Number(d.lo)).filter(n => isFinite(n));
  const his = s.days.map(d => Number(d.hi)).filter(n => isFinite(n));
  const tMin = los.length ? Math.min(...los) : 0;
  const tMax = his.length ? Math.max(...his) : 1;
  const span = Math.max(1, tMax - tMin);
  const days = `<section class="sec">
    <div class="sec-head"><h3><span class="em">📅</span>10일 예보</h3><span class="sec-count">${s.days.length}일</span><span class="sec-note">최저 ↔ 최고</span></div>
    <div class="wxm-days">${s.days.map((d, i) => {
      const [de, dl] = wxOf(d.code);
      let left = Math.round((d.lo - tMin) / span * 100);
      let width = Math.max(9, Math.round((d.hi - d.lo) / span * 100));
      if (left + width > 100) left = 100 - width;
      return `<div class="wxm-day${i === 0 ? ' today' : ''}">
        <span class="wd">${esc(wxDayLabel(d.date))}</span>
        <span class="ic">${de}</span>
        <span class="lb">${esc(dl)}${d.rain != null && d.rain >= 20 ? `<span class="r">💧${Math.round(d.rain)}%</span>` : ''}</span>
        <span class="bar"><i style="left:${left}%;width:${width}%"></i></span>
        <span class="lo">${d.lo != null ? Math.round(d.lo) : '-'}°</span>
        <span class="hi">${d.hi != null ? Math.round(d.hi) : '-'}°</span>
      </div>`;
    }).join('')}</div>
    <div class="wxm-foot">Open-Meteo 예보 · 현 위치 기준</div>
  </section>`;

  return top + today + hours + days;
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
  loadWeather({ silentLocate: true });
  setInterval(() => loadWeather({ silentLocate: true }), 30 * 60 * 1000);

  // keyboard shortcuts
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && openModalType) closeModal();
  });
  /* 날씨 카드는 버튼처럼 Enter·Space로도 열린다 */
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const card = ev.target && ev.target.closest && ev.target.closest('[data-act="open-weather"]');
    if (!card) return;
    ev.preventDefault();
    openWeather();
  });

  // sync start (supabase cdn may load after app.js)
  const startWhenReady = () => {
    if (window.supabase) startSync();
    else setTimeout(startWhenReady, 300);
  };
  setTimeout(startWhenReady, 200);
  setTimeout(() => { if (!window.supabase) setSync('warn', '오프라인 · 기기에 저장 중'); }, 5000);
  /* 동기화 모듈을 못 불러와도 기기에만이라도 정리 내용을 저장 */
  setTimeout(() => { if (!started) flushSeedCleanup(); }, 5000);

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
  plannedOn, subCycleLabel, normalize, financeStats, spentOn, incomeOn, entriesOn,
  financeMonthItems, chartParts, donutSvg,
  nextSubDate, subStartDate, savingCatOptions, catOptionsFor, savedOn, carryoverAmount, carryoverOn,
  expenseCatOptions, customCats, categoryColor, categoryIcon, chartColorMap, openCatSheet,
  CATEGORY_COLORS, CATEGORY_PALETTE, LEGACY_EXPENSE_CAT,
  monthFlow, renderAll,
  loanRowsOn, loanChargeAt, loanMonthTotal, loanDateIn, loanRemaining, loanRemainingTotal,
  loanTotalPrincipal, loanRepayEnd, loanStatusOf, debtSectionHtml, normalizeLoans,
  EXPENSE_CATS, INCOME_CATS,
  hour12, ampmOf, clockParts, renderClock,
  openCalendarModal, renderCalendarModal, monthAgenda,
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();

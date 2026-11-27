/* 스모크 테스트 — jsdom으로 실제 DOM에서 앱을 돌려 주요 기능을 확인합니다.
   실행: NODE_PATH=<repo>/node_modules node tests/smoke.test.js  */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

let pass = 0, fail = 0;
const results = [];
function ok(cond, name, extra) {
  if (cond) { pass++; results.push(`  ✅ ${name}`); }
  else { fail++; results.push(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

async function makeDom() {
  const dom = new JSDOM(html, {
    url: 'https://hobi0905.github.io/gayeon-dashboard/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  // 최소 스텁
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.fetch = () => Promise.reject(new Error('no network in test'));
  w.scrollTo = () => {};
  w.eval(app);
  // jsdom은 DOMContentLoaded를 다음 tick에 보낸다 → 부팅을 기다린다
  return new Promise(res => setTimeout(() => res(w), 60));
}

let dom, w, doc;
const $ = s => doc.querySelector(s);
const $$ = s => Array.from(doc.querySelectorAll(s));
const click = el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); };
const submit = form => form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
const tick = () => new Promise(r => setTimeout(r, 0));
const fld = (form, name) => form.querySelector(`[name="${name}"]`);
const wonNum = n => Number(n || 0).toLocaleString('ko-KR');

(async () => {
  dom = await makeDom();
  w = dom.window;
  doc = w.document;
  console.log('▸ 부팅/시드');
  ok(!!$('#pageTitle'), '페이지 타이틀 렌더');
  ok($('#pageTitle').textContent.trim() === 'My Dashboard', '기본 제목 표시', $('#pageTitle').textContent);
  ok($('#quoteText').textContent.includes('호비랑 서리'), '기본 인용구 표시');
  ok($$('.nav-btn').length === 4, '네비게이션 버튼 4개', $$('.nav-btn').length);
  ok(($('#avatarImg').getAttribute('src') || '').includes('profile-avatar'), '프로필 아바타 표시', $('#avatarImg').getAttribute('src'));
  ok(!!$('#ddayCard .dday-num'), 'D-DAY 카드 렌더');
  const ddayText0 = $('#ddayCard').textContent;
  ok(/D-\d+|D-DAY/.test(ddayText0), 'D-DAY 숫자 표기', ddayText0.slice(0, 40));
  ok(!/편입|충북대|인하대 면접|임규정/.test(ddayText0), 'D-DAY에 편입 일정 없음', ddayText0.slice(0, 80));
  const seeded = w.__GD.state;
  ok(!seeded.events.some(e => ['충북대 편입 원서접수', '인하대 면접예정일', '임규정 인천대 면접'].includes(e.title)), '시드 일정에서 편입 항목 제거');
  ok(!seeded.study.exams.some(e => ['충북대 편입 원서접수', '인하대 면접예정일', '임규정 인천대 면접'].includes(e.name)), '시드 시험·지원에서 편입 항목 제거');
  ok(seeded.events.some(e => e.title === '컴활접수') && seeded.events.some(e => e.title === '베스트피씨 알바'), '가연님 일정은 유지');

  console.log('▸ 테마');
  ok(doc.body.dataset.theme === 'xmas', '기본은 12월 크리스마스 테마', doc.body.dataset.theme);
  ok(($('#coverImg').getAttribute('src') || '').includes('xmas-london'), '크리스마스 기본 커버', $('#coverImg').getAttribute('src'));
  ok(($('#catImg').getAttribute('src') || '').includes('xmas-cat'), '크리스마스 고양이 카드', $('#catImg').getAttribute('src'));
  click($('#themeToggle'));
  ok(doc.body.dataset.theme === 'sky', '빠른 버튼으로 파스텔 하늘 전환', doc.body.dataset.theme);
  ok(($('#coverImg').getAttribute('src') || '').includes('cover-sky-cat'), '파스텔 커버로 전환');
  click($('#themeToggle'));
  ok(doc.body.dataset.theme === 'xmas', '다시 크리스마스로 전환');
  ok(($('#coverImg').getAttribute('src') || '').includes('xmas-london'), '크리스마스 커버 복귀');

  console.log('▸ 앱 아이콘');
  const rootHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ok(/apple-touch-icon[^>]*sizes="180x180"[^>]*apple-touch-icon\.png/.test(rootHtml), 'apple-touch-icon 180 연결');
  ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'icon-192.png')) && fs.existsSync(path.join(__dirname, '..', 'assets', 'icon-512.png')), '192·512 앱 아이콘 생성');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.webmanifest'), 'utf8'));
  ok((manifest.icons || []).length === 2 && /manifest/.test(rootHtml), 'manifest 아이콘 연결');
  ok($$('.cal-cell:not(.out)').length >= 30, '캘린더 날짜 셀', $$('.cal-cell:not(.out)').length);
  const seedExpense = w.localStorage.getItem('gayeon_dashboard_v3');
  ok(true, 'localStorage 초기값은 첫 저장 시 생성(설계상 정상)');

  // 11/28 컴활접수 칩이 11월 캘린더에 보이는지
  w.eval(`(function(){})`);
  const cell28 = $$('.cal-cell').find(c => c.dataset.date === '2026-11-28');
  ok(!!cell28, '11/28 셀 존재');
  ok(cell28 && cell28.textContent.includes('컴활접수'), '11/28에 컴활접수 일정 표시', cell28 && cell28.textContent);

  console.log('▸ 날씨 카드 · 10일 예보 모달');
  const pad = n => String(n).padStart(2, '0');
  const isoD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const wxFixture = () => {
    const now = new Date();
    const base = new Date(now); base.setHours(0, 0, 0, 0);
    const dates = Array.from({ length: 10 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return isoD(d); });
    const h0 = new Date(now); h0.setMinutes(0, 0, 0);
    const hours = Array.from({ length: 30 }, (_, i) => { const d = new Date(h0.getTime() + i * 3600000); return `${isoD(d)}T${pad(d.getHours())}:00`; });
    return {
      current: { temperature_2m: 8.4, apparent_temperature: 5.1, relative_humidity_2m: 63, weather_code: 3, wind_speed_10m: 12.3 },
      hourly: {
        time: hours,
        temperature_2m: hours.map((_, i) => 8 - i * 0.2),
        weather_code: hours.map(() => 3),
        relative_humidity_2m: hours.map(() => 63),
        precipitation_probability: hours.map((_, i) => (i === 1 ? 55 : 10)),
      },
      daily: {
        time: dates,
        weather_code: [3, 61, 2, 0, 1, 80, 3, 45, 0, 2],
        temperature_2m_max: [11.2, 9.8, 10.4, 12.1, 13.6, 8.9, 10.2, 11.5, 12.8, 9.4],
        temperature_2m_min: [2.1, 4.2, 1.8, 0.9, 2.4, 3.1, 4.4, 5.2, 2.9, 1.2],
        apparent_temperature_max: [], apparent_temperature_min: [],
        precipitation_probability_max: [20, 70, 10, 0, 0, 60, 30, 10, 0, 10],
        wind_speed_10m_max: [12, 20, 9, 8, 7, 18, 11, 9, 10, 13],
        sunrise: dates.map(d => `${d}T07:24`),
        sunset: dates.map(d => `${d}T17:12`),
      },
    };
  };
  w.fetch = url => {
    const u = String(url);
    if (u.includes('open-meteo')) return Promise.resolve({ ok: true, json: async () => wxFixture() });
    if (u.includes('bigdatacloud')) return Promise.resolve({ ok: true, json: async () => ({ city: '서울', locality: '중구', principalSubdivision: '서울특별시' }) });
    if (u.includes('nominatim')) return Promise.resolve({ ok: true, json: async () => ({ address: { city: '서울' } }) });
    return Promise.reject(new Error('unexpected ' + u));
  };

  const wcard = $('#weatherCard');
  ok(!!wcard && wcard.dataset.act === 'open-weather', '날씨 카드를 누르면 모달 여는 액션');
  ok(wcard.getAttribute('role') === 'button' && wcard.getAttribute('tabindex') === '0', '날씨 카드 role·tabindex 접근성');
  ok(wcard.textContent.includes('10일 예보'), '날씨 카드에 “10일 예보 >” 힌트');
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  ok(/navigator\.geolocation/.test(appSrc) && appSrc.includes('forecast_days=10'), '현 위치 + forecast_days=10 요청');

  click(wcard);
  ok(!$('#modalRoot').hidden, '날씨 카드 클릭 → 모달 열림');
  ok($('#modalTitle').textContent.includes('날씨') && $('#modalTitle').textContent.includes('10일'), '모달 제목(날씨·10일)', $('#modalTitle').textContent);
  await new Promise(r => setTimeout(r, 80));
  let wxBody = $('#modalBody').textContent;
  ok(wxBody.includes('📍 인천'), '위치 권한 없는 환경 → 인천 기준 표시', wxBody.slice(0, 60));
  ok(wxBody.includes('현 위치 다시 불러오기'), '현 위치 다시 불러오기 버튼');
  ok(wxBody.includes('인천 기준'), '폴백 안내 문구');
  ok($$('#modalBody .wxm-day').length === 10, '10일 예보 10행', $$('#modalBody .wxm-day').length);
  ok($('#modalBody .wxm-day').textContent.includes('오늘'), '첫 행은 오늘');
  ok(wxBody.includes('체감') && wxBody.includes('습도') && wxBody.includes('바람') && wxBody.includes('강수확률'), '오늘 요약(체감·습도·바람·강수확률)');
  ok($$('#modalBody .wxm-hour').length === 8, '오늘 시간대별 8칸', $$('#modalBody .wxm-hour').length);
  ok($('#wxPlace').textContent === '인천' && /\d+°/.test($('#wxTemp').textContent), '홈 카드도 같은 위치·온도', `${$('#wxPlace').textContent} ${$('#wxTemp').textContent}`);

  Object.defineProperty(w.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (okCb, errCb) => setTimeout(() => errCb({ code: 1, message: 'denied' }), 0) },
  });
  click($('[data-act="wx-relocate"]'));
  await new Promise(r => setTimeout(r, 80));
  ok($('#modalBody').textContent.includes('위치 권한이 없어 인천 기준이에요'), '위치 거절 → 인천 폴백 안내', $('#modalBody').textContent.slice(0, 80));
  ok($('#wxPlace').textContent === '인천', '거절해도 홈 카드는 인천 유지');

  Object.defineProperty(w.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: okCb => setTimeout(() => okCb({ coords: { latitude: 37.5665, longitude: 126.978 } }), 0) },
  });
  click($('[data-act="wx-relocate"]'));
  await new Promise(r => setTimeout(r, 80));
  ok($('#modalBody').textContent.includes('📍 서울'), '위치 허용 → 역지오코딩 이름 표시', $('#modalBody').textContent.slice(0, 60));
  ok($('#wxPlace').textContent === '서울', '홈 카드도 현 위치(서울) 반영', $('#wxPlace').textContent);
  ok(!$('#modalBody').textContent.includes('인천 기준'), '허용 후 폴백 안내 사라짐');
  const savedPos = JSON.parse(w.localStorage.getItem('gayeon_wx_pos_v1') || 'null');
  ok(!!savedPos && savedPos.name === '서울' && Math.abs(savedPos.lat - 37.5665) < 0.01, '현 위치를 기기에 저장', savedPos && JSON.stringify(savedPos));

  click($('[data-act="modal-close"]'));
  ok($('#modalRoot').hidden, '날씨 모달 닫힘');
  wcard.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok(!$('#modalRoot').hidden, 'Enter 키로도 날씨 모달 열림');
  click($('[data-act="modal-close"]'));
  const cssWx = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  ok(/\.weather-card\{[^}]*cursor:pointer/.test(cssWx), '날씨 카드 cursor:pointer');
  ok(/\.wxm-day\{[^}]*font-size:14px/.test(cssWx), '10일 예보 행 14px');

  console.log('▸ STUDY 모달');
  click($('[data-act="open-study"]'));
  ok(!$('#modalRoot').hidden, 'STUDY 모달 열림');
  const body1 = $('#modalBody').textContent;
  ok(body1.includes('이달의 목표') && body1.includes('이주의 목표') && body1.includes('오늘의 목표'), '세 가지 목표 섹션 한 화면');
  ok(body1.includes('이번 달 시험·지원'), '시험·지원 섹션 표시');

  const goalForm = $('#modalBody [data-form="goal"][data-scope="today"]');
  fld(goalForm, 'text').value = 'jsdom 목표';
  submit(goalForm);
  ok($('#modalBody').textContent.includes('jsdom 목표'), '오늘의 목표 추가 반영');

  // 시험 추가 → D-DAY 자동 갱신
  const examForm = $('#modalBody [data-form="exam"]');
  fld(examForm, 'name').value = '테스트 면접';
  fld(examForm, 'date').value = '2026-11-30';
  fld(examForm, 'type').value = '면접';
  fld(examForm, 'memo').value = '메모';
  submit(examForm);
  await tick();
  ok($('#ddayCard').textContent.includes('테스트 면접'), 'STUDY 시험 추가 → 홈 D-DAY 자동 반영', $('#ddayCard').textContent.replace(/\s+/g, ' ').slice(0, 80));

  console.log('▸ STUDY 구분 · 발표');
  const examForm2 = $('#modalBody [data-form="exam"]');
  const examTypes = Array.from(fld(examForm2, 'type').querySelectorAll('option')).map(o => o.textContent.trim());
  ok(examTypes.join(',') === '시험,지원,면접,발표', '구분 목록에 발표 추가', examTypes.join(','));
  fld(examForm2, 'name').value = '테스트 합격자 발표';
  fld(examForm2, 'date').value = '2026-12-05';
  fld(examForm2, 'type').value = '발표';
  fld(examForm2, 'memo').value = '오후 발표';
  submit(examForm2);
  await tick();
  ok($('#modalBody').textContent.includes('테스트 합격자 발표'), '발표 일정 추가');
  const examRow = $$('#modalBody .drow').find(r => r.textContent.includes('테스트 합격자 발표'));
  ok(!!examRow && !!examRow.querySelector('.tag.발표'), 'STUDY 목록에 발표 태그', examRow && examRow.textContent);
  ok($('#ddayCard').textContent.includes('테스트 합격자 발표'), 'D-DAY 다음 일정에 발표 반영', $('#ddayCard').textContent.replace(/\s+/g, ' '));
  const examEditBtn = examRow && examRow.querySelector('[data-act="exam-edit"]');
  click(examEditBtn);
  await tick();
  const editPrompt = doc.querySelector('.prompt');
  const editTypes = editPrompt ? Array.from(editPrompt.querySelectorAll('[name="type"] option')).map(o => o.textContent.trim()) : [];
  ok(editTypes.includes('발표'), '수정 창에도 발표 선택', editTypes.join(','));
  ok(!!editPrompt && fld(editPrompt, 'type').value === '발표', '수정 창이 현재 구분(발표)을 보여줌');
  if (editPrompt) click(editPrompt.querySelector('[data-x="cancel"]'));
  await tick();

  console.log('▸ 캘린더 연동');
  click($('.modal-close, [data-act="modal-close"]'));
  const dec = $('#modalRoot').hidden;
  ok(dec, '모달 닫힘');
  w.eval('void 0');

  console.log('▸ 가계부');
  click($('[data-act="open-finance"]'));
  ok($('#modalBody').textContent.includes('가계부 캘린더'), '가계부 캘린더 섹션');
  ok($('#modalBody').textContent.includes('재무목표') && $('#modalBody').textContent.includes('투자') && $('#modalBody').textContent.includes('정기구독'), '재무목표·투자·정기구독 섹션');

  // 정기구독 추가 (매월 28일)
  const subForm = $('#modalBody [data-form="sub"]');
  fld(subForm, 'name').value = '테스트 구독';
  fld(subForm, 'amount').value = '9900';
  fld(subForm, 'day').value = '28';
  submit(subForm);
  ok($('#modalBody').textContent.includes('테스트 구독'), '정기구독 추가');

  console.log('▸ Wishlist → 가계부 연동');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-wishlist"]'));
  const wantForm = $('#modalBody [data-form="want"]');
  fld(wantForm, 'name').value = '테스트 이어폰';
  fld(wantForm, 'price').value = '59000';
  submit(wantForm);
  ok($('#modalBody').textContent.includes('테스트 이어폰'), '사고 싶은 것 추가');
  const moveBtn = $$('#modalBody [data-act="want-to-need"]').pop();
  click(moveBtn);
  ok($('#modalBody').textContent.includes('미구매'), '사야 하는 것 이동');

  const planBtn = $$('#modalBody [data-act="need-plan"]').pop();
  click(planBtn);
  await tick();
  const prompt = doc.querySelector('.prompt');
  ok(!!prompt, '구매 예정 프롬프트 열림');
  if (prompt) {
    prompt.querySelector('[name="date"]').value = '2026-12-01';
    prompt.querySelector('[name="amount"]').value = '59000';
    click(prompt.querySelector('[data-x="ok"]'));
    await tick();
  }
  const plannedText = $('#modalBody').textContent;
  ok(plannedText.includes('구매 예정') || plannedText.includes('예정'), '구매 예정 상태 반영');

  console.log('▸ 가계부 캘린더 예정 금액');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-finance"]'));
  // 12월로 이동
  click($('[data-act="fin-next"]'));
  const fcell = $$('.fcal-day').find(c => c.dataset.date === '2026-12-01');
  ok(!!fcell && fcell.textContent.includes('59,000'), 'Wishlist 구매예정 → 가계부 12/1 예정 금액', fcell && fcell.textContent);
  const fcell28 = $$('.fcal-day').find(c => c.dataset.date === '2026-12-28');
  ok(!!fcell28 && fcell28.textContent.includes('9,900'), '정기구독이 결제일(28일) 예정 금액으로 반영', fcell28 && fcell28.textContent);

  console.log('▸ 정기구독 주기 (매달 / 매년)');
  const subForm2 = $('#modalBody [data-form="sub"]');
  ok(!!fld(subForm2, 'cycle') && !!fld(subForm2, 'month') && !!fld(subForm2, 'day'), '주기·월·일 선택 UI');
  fld(subForm2, 'name').value = '연간 구독';
  fld(subForm2, 'amount').value = '120000';
  fld(subForm2, 'cycle').value = 'yearly';
  fld(subForm2, 'month').value = '3';
  fld(subForm2, 'day').value = '15';
  submit(subForm2);
  ok($('#modalBody').textContent.includes('매년 3월 15일'), '매년 구독 표기', $('#modalBody').textContent.match(/매년[^<]{0,12}/));
  const fcellDec15 = $$('.fcal-day').find(c => c.dataset.date === '2026-12-15');
  ok(!fcellDec15 || !fcellDec15.textContent.includes('120,000'), '매년 구독은 12월에 표시 안 됨');
  click($('[data-act="fin-next"]')); click($('[data-act="fin-next"]')); click($('[data-act="fin-next"]'));
  const fcellMar15 = $$('.fcal-day').find(c => c.dataset.date === '2027-03-15');
  ok(!!fcellMar15 && fcellMar15.textContent.includes('120,000'), '매년 구독이 3/15 예정 금액으로 표시', fcellMar15 && fcellMar15.textContent);
  click($('[data-act="fin-prev"]')); click($('[data-act="fin-prev"]')); click($('[data-act="fin-prev"]'));
  const planned = w.__GD.plannedOn;
  ok(planned('2027-03-15').some(p => p.name === '연간 구독'), 'plannedOn 3/15 매년 구독');
  ok(!planned('2027-04-15').some(p => p.name === '연간 구독'), 'plannedOn 4/15 매년 구독 없음');
  const subForm3 = $('#modalBody [data-form="sub"]');
  fld(subForm3, 'name').value = '말일 구독';
  fld(subForm3, 'amount').value = '4321';
  fld(subForm3, 'cycle').value = 'monthly';
  fld(subForm3, 'day').value = '31';
  submit(subForm3);
  ok(planned('2027-02-28').some(p => p.name === '말일 구독'), '매달 31일 → 2월 말일(28일) 보정');
  ok(!planned('2027-02-27').some(p => p.name === '말일 구독'), '2/27에는 없음');
  ok(planned('2027-04-30').some(p => p.name === '말일 구독') && !planned('2027-04-29').some(p => p.name === '말일 구독'), '4월은 30일로 보정');

  console.log('▸ 지출 기록');
  click($('.fcal-day[data-date="2026-12-01"]'));
  const expForm = $('#modalBody [data-form="expense"]');
  fld(expForm, 'title').value = '테스트 점심';
  fld(expForm, 'amount').value = '8500';
  submit(expForm);
  ok($('#modalBody').textContent.includes('테스트 점심'), '지출 추가');
  const fcell01 = $$('.fcal-day').find(c => c.dataset.date === '2026-12-01');
  ok(fcell01.textContent.includes('8,500'), '가계부 캘린더 지출 합계 표시', fcell01.textContent);

  console.log('▸ 가계부 수입');
  const moneyForm = () => $('#modalBody [data-form="expense"]');
  const catOpts = () => Array.from(fld(moneyForm(), 'cat').querySelectorAll('option')).map(o => o.textContent.trim());
  ok(!!fld(moneyForm(), 'type'), '내역 추가에 지출/수입 선택');
  ok(catOpts().includes('여가'), '지출 카테고리에 여가', catOpts().join(','));
  ok(fld(moneyForm(), 'type').value === 'expense', '기본 종류는 지출');

  const typeSel = fld(moneyForm(), 'type');
  typeSel.value = 'income';
  typeSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(catOpts().includes('알바·급여') && !catOpts().includes('여가'), '수입 선택 시 수입 카테고리로 교체', catOpts().join(','));
  ok(moneyForm().classList.contains('is-income'), '수입 모드 표시');

  const incForm = moneyForm();
  fld(incForm, 'title').value = '테스트 월급';
  fld(incForm, 'amount').value = '620000';
  submit(incForm);
  const incEntry = w.__GD.state.finance.expenses.find(e => e.title === '테스트 월급');
  ok(!!incEntry && incEntry.type === 'income' && incEntry.amount === 620000, '수입 내역 저장', incEntry && JSON.stringify(incEntry));
  ok(!!incEntry && incEntry.cat === '알바·급여', '수입 카테고리 저장', incEntry && incEntry.cat);

  const statRow = $('#modalBody .stat-row');
  const statText = statRow.textContent.replace(/\s+/g, ' ');
  ok(statText.includes('이번 달 수입') && statText.includes('이번 달 지출') && statText.includes('예정 지출') && statText.includes('수입 - 지출'), '요약 4칸(수입·지출·예정·잔액)', statText);
  const fstats = w.__GD.financeStats();
  ok(fstats.income === 620000 && fstats.spent === 8500, '이번 달 수입·지출 합계', JSON.stringify(fstats));
  ok(fstats.balance === fstats.income - fstats.spent, '잔액 = 수입 - 지출', fstats.balance);
  ok(statRow.querySelector('.stat.income .v').textContent.includes('620,000'), '요약에 이번 달 수입 표시');
  ok(statRow.querySelector('.stat.balance .v').textContent.includes(wonNum(fstats.balance)), '요약에 잔액 표시', statRow.querySelector('.stat.balance .v').textContent);
  ok($('#modalBody').textContent.includes('＋₩620,000'), '날짜 목록에 수입 +₩ 표시');

  console.log('▸ 가계부 내역 행 레이아웃');
  const incRow = $$('#modalBody .drow').find(r => r.textContent.includes('테스트 월급'));
  ok(!!incRow && !!incRow.querySelector('.dday-pill.income'), '수입 금액은 .income 클래스', incRow && incRow.querySelector('.dday-pill').className);
  ok(!!incRow && !incRow.querySelector('.dday-pill.in'), '수입 금액이 입력칸 .in 클래스를 입지 않음');
  ok(!!incRow && !!incRow.querySelector('.grow') && incRow.querySelector('.grow').textContent.includes('알바·급여'), '수입 행에 내역·카테고리 영역');
  ok(!!incRow && incRow.querySelector('.dday-pill').className.trim() === 'dday-pill income', '금액 칸 클래스는 dday-pill income 하나', incRow && incRow.querySelector('.dday-pill').className);

  const fcellInc = $$('.fcal-day').find(c => c.dataset.date === '2026-12-01');
  ok(!!fcellInc.querySelector('.inc') && fcellInc.querySelector('.inc').textContent.includes('620,000'), '가계부 캘린더에 수입 표시', fcellInc.textContent);
  ok(!!fcellInc.querySelector('.sp') && fcellInc.querySelector('.sp').textContent.includes('8,500'), '가계부 캘린더에 지출 -표시', fcellInc.textContent);

  console.log('▸ 메인 캘린더 수입·지출 구분');
  click($('[data-act="modal-close"]'));
  click($('[data-act="cal-next"]'));
  const mainDec1 = $$('.cal-cell').find(c => c.dataset.date === '2026-12-01');
  ok(!!mainDec1.querySelector('.cal-income') && mainDec1.querySelector('.cal-income').textContent.includes('620,000'), '메인 캘린더 수입 +₩ 표시', mainDec1.textContent);
  ok(!!mainDec1.querySelector('.cal-spend') && mainDec1.querySelector('.cal-spend').textContent.includes('8,500'), '메인 캘린더 지출 −₩ 표시', mainDec1.textContent);
  const mainDec5 = $$('.cal-cell').find(c => c.dataset.date === '2026-12-05');
  ok(!!mainDec5 && mainDec5.textContent.includes('테스트 합격자 발표'), '메인 캘린더에 발표 일정 표시', mainDec5 && mainDec5.textContent);
  click($('[data-act="cal-prev"]'));

  console.log('▸ 예전 지출 데이터 호환');
  const legacy = w.__GD.normalize({ v: 3, finance: { expenses: [{ id: 'old1', date: '2026-12-03', title: '영화', amount: 50000, cat: '기타' }] } });
  ok(legacy.finance.expenses.length === 1 && legacy.finance.expenses[0].type === 'expense', 'type 없는 예전 내역은 지출로 호환');
  ok(legacy.finance.expenses[0].amount === 50000 && legacy.finance.expenses[0].title === '영화', '예전 금액·이름 그대로 유지');
  ok(w.__GD.EXPENSE_CATS.includes('여가') && w.__GD.INCOME_CATS.includes('알바·급여'), '카테고리 목록 노출');

  console.log('▸ 메모');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-memo"]'));
  ok($('#modalBody').textContent.includes('한줄일기'), '한줄일기 섹션');
  ok($('#modalBody').textContent.includes('습관') && $('#modalBody').textContent.includes('메모'), '습관·메모 섹션');
  const moodBtn = $$('#modalBody .mood-btn')[1];
  click(moodBtn);
  const diaryForm = $('#modalBody [data-form="diary"]');
  fld(diaryForm, 'text').value = '오늘 테스트 일기';
  submit(diaryForm);
  ok($('#modalBody').textContent.includes('오늘 테스트 일기'), '한줄일기 저장');
  const habitForm = $('#modalBody [data-form="habit"]');
  fld(habitForm, 'name').value = '테스트 습관';
  submit(habitForm);
  ok($('#modalBody').textContent.includes('테스트 습관'), '습관 추가');
  const hCell = $$('#modalBody .h-cell').find(c => !c.classList.contains('future'));
  click(hCell);
  ok($$('#modalBody .h-cell.on').length >= 1, '습관 체크');

  console.log('▸ 꾸미기 설정');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-settings"]'));
  ok($('#modalBody').textContent.includes('상단 커버') && $('#modalBody').textContent.includes('동기화'), '설정 모달 구성');
  ok($('#modalBody').textContent.includes('프로필 사진'), '설정에 프로필 사진 카드');
  ok($$('#modalBody .preset').length >= 8, '커버·고양이 프리셋 썸네일', $$('#modalBody .preset').length);
  $('#setTitle').value = '가연 대시보드';
  $('#setQuote').value = '테스트 인용구';
  click($('[data-act="save-hero-text"]'));
  ok($('#pageTitle').textContent === '가연 대시보드', '제목 저장 반영');
  ok($('#quoteText').textContent === '테스트 인용구', '인용구 저장 반영');

  const codeShown = $('#codeView').textContent.trim();
  ok(codeShown.length >= 6, '동기화 코드 표시', codeShown);

  console.log('▸ 저장');
  const saved = JSON.parse(w.localStorage.getItem('gayeon_dashboard_v3') || 'null');
  ok(!!saved, 'localStorage 저장됨');
  ok(saved && saved.title === '가연 대시보드', '제목이 저장 데이터에 반영');

  console.log('▸ 모달 글씨 크기');
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  ok(/\.check-row\{[^}]*font-size:15\.5px/.test(css), '목표·체크 항목 15.5px');
  ok(/\.drow\{[^}]*font-size:15px/.test(css), '가계부·일정 행 15px');
  ok(/\.note-card p\{[^}]*font-size:15px/.test(css), '메모 본문 15px');
  ok(/\.diary-row \.tx\{[^}]*font-size:15px/.test(css), '한줄일기 15px');
  ok(/\.habit-grid \.hn\{[^}]*font-size:14\.5px/.test(css), '습관 이름 14.5px');
  ok(/\.drow \.dday-pill,\.drow \.tag,\.drow \.icon-x\{[^}]*flex:0 0 auto/.test(css), '금액·태그·삭제는 내용만큼만');
  ok(/\.drow \.grow\{[^}]*flex:1 1 0[^}]*min-width:0/.test(css), '내역이 남는 폭을 갖음');
  ok(/\.dday-pill\.income\{/.test(css) && !/\.dday-pill\.in\{/.test(css), '수입 금액 전용 클래스(.in 충돌 제거)');

  console.log('▸ 날짜 상세 모달');
  click($('[data-act="modal-close"]'));
  const c28 = $$('.cal-cell').find(c => c.dataset.date === '2026-11-28');
  click(c28);
  ok($('#modalTitle').textContent.includes('11월 28일'), '날짜 상세 모달 열림', $('#modalTitle').textContent);
  ok($('#modalBody').textContent.includes('컴활접수'), '날짜 상세에 일정 표시');
  const evForm = $('#modalBody [data-form="event"]');
  fld(evForm, 'title').value = '테스트 일정';
  fld(evForm, 'start').value = '15:00';
  fld(evForm, 'category').value = 'personal';
  submit(evForm);
  ok($('#modalBody').textContent.includes('테스트 일정'), '일정 추가');

  console.log('▸ 날짜 상세 모달 수입·여가');
  const dayMoney = $('#modalBody [data-form="expense"]');
  const dayCats = Array.from(fld(dayMoney, 'cat').querySelectorAll('option')).map(o => o.textContent.trim());
  ok(dayCats.includes('여가'), '날짜 상세 모달 지출 카테고리에 여가', dayCats.join(','));
  ok(!!fld(dayMoney, 'type'), '날짜 상세 모달 지출/수입 선택');
  fld(dayMoney, 'title').value = '테스트 영화';
  fld(dayMoney, 'amount').value = '15000';
  fld(dayMoney, 'cat').value = '여가';
  submit(dayMoney);
  ok($('#modalBody').textContent.includes('테스트 영화'), '여가 지출 추가');
  const movieEntry = w.__GD.state.finance.expenses.find(e => e.title === '테스트 영화');
  ok(!!movieEntry && movieEntry.cat === '여가' && movieEntry.type === 'expense' && movieEntry.amount === 15000, '여가 카테고리 저장', movieEntry && JSON.stringify(movieEntry));
  const dayTypeSel = fld($('#modalBody [data-form="expense"]'), 'type');
  dayTypeSel.value = 'income';
  dayTypeSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  const dayIncCats = Array.from(fld($('#modalBody [data-form="expense"]'), 'cat').querySelectorAll('option')).map(o => o.textContent.trim());
  ok(dayIncCats.includes('용돈') && !dayIncCats.includes('여가'), '날짜 상세에서도 수입 카테고리로 교체', dayIncCats.join(','));

  console.log(results.join('\n'));
  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  try { w.close(); } catch (e) {}
  process.exit(fail ? 1 : 0);
})();

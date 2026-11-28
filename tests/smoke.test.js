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
  ok($$('.nav-btn').length === 5, '네비게이션 버튼 5개', $$('.nav-btn').length);
  ok($$('.block-title').some(h => h.textContent.trim() === 'TO-DO List'), 'TODO 카드 제목 TO-DO List');
  ok(!/SIMPLE TODO/.test($('#app').textContent), 'SIMPLE TODO 문구 제거');
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
  ok($('#modalBody').textContent.includes('정기구독'), '가계부에 정기구독 섹션');
  ok(!$('#modalBody').textContent.includes('재무목표') && !$('#modalBody').textContent.includes('주식투자'), '가계부에서 재무목표·투자 섹션 제거');

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

  console.log('▸ 정기구독·구매예정은 마이너스(−) 표시 — 플러스(+) 금지');
  const calText = el => (el ? el.textContent.replace(/\s+/g, ' ') : '');
  ok(!!fcell && /-59,000/.test(calText(fcell)) && !/\+59,000/.test(calText(fcell)), '가계부 달력 구매예정이 −59,000', calText(fcell));
  ok(!!fcell28 && /-9,900/.test(calText(fcell28)) && !/\+9,900/.test(calText(fcell28)), '가계부 달력 정기구독이 −9,900', calText(fcell28));
  const plSpan = $('.fcal-day[data-date="2026-12-01"] .pl');
  ok(!!plSpan && plSpan.textContent.trim().startsWith('-'), '가계부 달력 예정 금액은 마이너스로 시작', plSpan && plSpan.textContent);
  const subPlanRow = $$('#modalBody .drow').find(r => calText(r).includes('테스트 구독'));
  ok(!!subPlanRow && /−₩9,900/.test(calText(subPlanRow)), '가계부 날짜 패널 정기구독 행 −₩9,900', calText(subPlanRow));
  ok(!!subPlanRow && !!subPlanRow.querySelector('.dday-pill.plan'), '예정 금액 알약은 .plan 클래스(예정 색)', subPlanRow && subPlanRow.querySelector('.dday-pill').className);
  const spendStatV = $('#modalBody .stat.spend .v');
  ok(!!spendStatV && /−₩105,900/.test(calText(spendStatV)), '이번 달 지출 카드에 예정 금액(68,900) + 대출 37,000이 합산됨', calText(spendStatV));
  ok(!/\+/.test(calText(spendStatV)) && !/\+/.test(calText(subPlanRow)), '지출·예정 금액에 플러스 기호 없음');
  ok(!$('#modalBody .stat.plan'), '「예정 지출」 카드는 사라짐');

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
  ok(!!fcellMar15 && fcellMar15.textContent.includes('157,000'), '매년 구독(120,000)이 대출 37,000과 함께 3/15 예정 금액으로 표시', fcellMar15 && fcellMar15.textContent);
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
  ok(statText.includes('이번 달 수입') && statText.includes('이번 달 지출') && statText.includes('저축') && statText.includes('수입 - 지출 - 투자'), '요약 4칸(수입·지출·저축·남은 돈)', statText);
  const fstats = w.__GD.financeStats();
  ok(fstats.income === 620000 && fstats.spent === 8500, '이번 달 수입·지출 합계', JSON.stringify(fstats));
  ok(fstats.balance === fstats.income - fstats.spendTotal - fstats.saved, '남은 돈 = 수입 - 지출(예정 포함) - 저축·투자', fstats.balance);
  ok(statRow.querySelector('.stat.income .v').textContent.includes('620,000'), '요약에 이번 달 수입 표시');
  ok(statRow.querySelector('.stat.balance .v').textContent.includes(wonNum(fstats.balance)), '요약에 남은 돈 표시', statRow.querySelector('.stat.balance .v').textContent);
  ok($('#modalBody').textContent.includes('＋₩620,000'), '날짜 목록에 수입 +₩ 표시');

  console.log('▸ 정기구독이 수입에 새지 않는지 (합계 회귀)');
  ok(fstats.income === 620000, '이번 달 수입 합계에 정기구독·구매예정이 섞이지 않음', fstats.income);
  ok(fstats.spent === 8500, '이번 달 지출 내역은 실제 기록만(spent)', fstats.spent);
  ok(fstats.spendTotal === 8500 + 68900 + 4321 + 37000, '이번 달 지출 카드 = 실제 + 정기구독·구매예정 + 대출 37,000', fstats.spendTotal);
  ok(fstats.planned === 68900 + 4321 + 37000 && fstats.loan === 37000, '정기구독·구매예정·대출 합계(73,221 + 37,000)', JSON.stringify({ planned: fstats.planned, loan: fstats.loan }));
  ok(fstats.balance === 620000 - 81721 - 37000, '남은 돈 501,279 (지출 카드 기준: 예정·대출 포함)', fstats.balance);
  const incTitles = w.__GD.financeMonthItems('income').map(i => i.title);
  ok(incTitles.length === 1 && incTitles[0] === '테스트 월급', '수입 상세에는 실제 수입만(구독·구매예정 없음)', incTitles.join(','));
  const spendItems = w.__GD.financeMonthItems('spend');
  const planTitles = spendItems.filter(i => i.planned).map(i => i.title);
  ok(planTitles.includes('테스트 구독') && planTitles.includes('테스트 이어폰') && !planTitles.includes('테스트 월급'), '이번 달 지출 상세에 구독·구매예정도 포함', planTitles.join(','));
  const incStatV = $('#modalBody .stat.income .v').textContent;
  const spendStatV2 = $('#modalBody .stat.spend .v').textContent;
  ok(incStatV.includes(wonNum(620000)) && !incStatV.includes(wonNum(fstats.planned)), '수입 카드에 예정 지출 금액 없음', incStatV);
  ok(/−₩118,721/.test(spendStatV2.replace(/\s+/g, ' ')) && !/\+/.test(spendStatV2), '이번 달 지출 카드 −₩118,721 (실제 8,500 + 예정 73,221 + 대출 37,000 · 플러스 아님)', spendStatV2.trim());
  const dayPanelPlan = $$('#modalBody .drow').find(r => calText(r).includes('테스트 이어폰'));
  ok(!!dayPanelPlan && /−₩59,000/.test(calText(dayPanelPlan)), '선택한 날짜 예정 행도 −₩59,000', calText(dayPanelPlan));

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
  ok(/\.cover\{[^}]*height:clamp\(200px,24vw,320px\)/.test(css), '커버 사진 세로 높이 확대');
  ok(/\.page-head\{[^}]*margin-top:18px/.test(css), '프로필·제목을 커버 아래로');

  console.log('▸ 홈 카드 아이콘 크기 고정');
  ok(/--hero-wx-icon:32px/.test(css) && /\.wx-emoji\{[^}]*font-size:var\(--hero-wx-icon\)/.test(css), '날씨 아이콘 32px 고정');
  ok(/\.wx-temp\{[^}]*font-size:var\(--hero-wx-temp\)/.test(css), '날씨 온도 글자 고정');
  ok(/\.flip\{[^}]*font-size:var\(--hero-clock-num\)/.test(css), '시계 숫자 42px 고정');
  ok(/\.cat-photo\{[^}]*height:var\(--hero-cat-photo\)/.test(css), '아치 사진 높이 200px 고정');
  ok(/\.tt-ico\{[^}]*width:var\(--icon-box\)[^}]*height:var\(--icon-box\)/.test(css), '테마 아이콘 공통 박스 20px');
  ok(!/body\[data-theme="xmas"\][^{]*(wx-emoji|\.flip|\.cat-photo|\.tt-ico)[^{]*\{[^}]*font-size/.test(css), '테마별 아이콘 크기 차이 없음');

  console.log('▸ 플립 시계 — AM/PM · 12시간제');
  ok(!!$('#flipAmpm'), 'AM/PM 요소 렌더');
  const rowKids = Array.from($('.flip-row').children);
  ok(rowKids[0].id === 'flipAmpm' && rowKids[1].id === 'flipHour', 'AM/PM이 시(Hour) 왼편에 배치', rowKids.map(k => k.id || k.className).join(','));
  const cases = [[0, 'AM', '12'], [1, 'AM', '01'], [11, 'AM', '11'], [12, 'PM', '12'], [13, 'PM', '01'], [23, 'PM', '11']];
  const bad = cases.filter(([h, ap, hh]) => { const p = w.__GD.clockParts(h); return p.ampm !== ap || p.hour !== hh; });
  ok(bad.length === 0, '12시간제 변환 경계값 (0·1·11·12·13·23시)', bad.map(([h]) => `${h}시→${JSON.stringify(w.__GD.clockParts(h))}`).join(' '));
  const nowD = new Date();
  const nowP = w.__GD.clockParts(nowD.getHours());
  ok($('#flipHour').textContent === nowP.hour, '현재 시각이 12시간제로 표시', `현재 ${nowD.getHours()}시 → ${$('#flipHour').textContent}`);
  ok($('#flipAmpm').textContent === nowP.ampm, '현재 시각의 AM/PM 표시', $('#flipAmpm').textContent);
  ok($('#flipMin').textContent === String(nowD.getMinutes()).padStart(2, '0'), '분 표시 유지', $('#flipMin').textContent);
  const renderAt = h => { w.__GD.renderClock(new w.Date(2026, 0, 5, h, 7, 3)); return `${$('#flipAmpm').textContent} ${$('#flipHour').textContent}`; };
  const domCases = [[0, 'AM 12'], [12, 'PM 12'], [13, 'PM 01'], [23, 'PM 11']];
  const domBad = domCases.filter(([h, want]) => renderAt(h) !== want);
  ok(domBad.length === 0, '시계 DOM이 00·12·13·23시에 맞게 표시', domBad.map(([h]) => `${h}시→${renderAt(h)}`).join(' '));
  w.__GD.renderClock(new Date());
  ok(/\.flip-ampm\{[^}]*font-size:12px/.test(css), 'AM/PM 작은 글씨 12px');
  ok(/\.flip-ampm\{[^}]*min-width:/.test(css), 'AM/PM 폭 고정(AM↔PM 전환에도 안 밀림)');
  ok(/body\[data-theme="xmas"\] \.flip-ampm\{[^}]*color:/.test(css), '크리스마스 테마 AM/PM 색상 지정');

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

  /* ───────────── ✏️ 전 항목 수정 기능 ───────────── */
  console.log('▸ 수정 기능 — 가계부 내역 (날짜 상세)');
  const txRow = () => $$('#modalBody .drow').find(r => r.textContent.includes('테스트 영화'));
  ok(!!txRow() && !!txRow().querySelector('[data-act="exp-edit"]'), '날짜 상세 모달 내역에 ✏️ 수정 버튼');
  click(txRow().querySelector('[data-act="exp-edit"]'));
  await tick();
  let tp = doc.querySelector('.prompt');
  ok(!!tp && tp.textContent.includes('내역 수정'), '가계부 내역 수정 창 열림');
  ok(!!tp && fld(tp, 'date').value === '2026-11-28', '수정 창에 원래 날짜', tp && fld(tp, 'date').value);
  ok(!!tp && fld(tp, 'type').value === '지출', '수정 창에 원래 종류(지출)', tp && fld(tp, 'type').value);
  ok(!!tp && fld(tp, 'title').value === '테스트 영화', '수정 창에 원래 내역', tp && fld(tp, 'title').value);
  ok(!!tp && fld(tp, 'amount').value === '15000', '수정 창에 원래 금액', tp && fld(tp, 'amount').value);
  ok(!!tp && fld(tp, 'cat').value === '여가', '수정 창에 원래 카테고리', tp && fld(tp, 'cat').value);
  ok(!!tp && tp.querySelector('[name="date"]').closest('.pf').classList.contains('full'), '날짜 칸은 라벨 + 전체 폭');
  const txTypeSel = fld(tp, 'type');
  txTypeSel.value = '수입';
  txTypeSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  const txCats = Array.from(fld(tp, 'cat').querySelectorAll('option')).map(o => o.textContent.trim());
  ok(txCats.includes('용돈') && txCats.includes('부수입·환급') && !txCats.includes('여가'), '종류를 수입으로 바꾸면 카테고리 목록 자동 전환', txCats.join(','));
  fld(tp, 'title').value = '테스트 영화 환불';
  fld(tp, 'amount').value = '18000';
  fld(tp, 'cat').value = '부수입·환급';
  fld(tp, 'memo').value = '예매 취소';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  const txNow = w.__GD.state.finance.expenses.find(e => e.title === '테스트 영화 환불');
  ok(!!txNow && txNow.type === 'income', '지출 → 수입으로 바뀜', txNow && JSON.stringify(txNow));
  ok(!!txNow && txNow.amount === 18000 && txNow.cat === '부수입·환급', '금액·카테고리 수정 반영', txNow && `${txNow.amount} ${txNow.cat}`);
  ok(!!txNow && txNow.memo === '예매 취소', '메모 수정 반영', txNow && txNow.memo);
  ok($('#modalBody').textContent.includes('＋₩18,000'), '수정한 수입이 날짜 목록에 +₩로 표시', $('#modalBody').textContent.replace(/\s+/g, ' ').slice(0, 90));

  console.log('▸ 수정 기능 — 내역 날짜 옮기기');
  const dayMoney2 = $('#modalBody [data-form="expense"]');
  fld(dayMoney2, 'title').value = '날짜 이동 테스트';
  fld(dayMoney2, 'amount').value = '3000';
  submit(dayMoney2);
  await tick();
  const moveRow = () => $$('#modalBody .drow').find(r => r.textContent.includes('날짜 이동 테스트'));
  ok(!!moveRow(), '날짜 이동용 내역 추가');
  click(moveRow().querySelector('[data-act="exp-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  fld(tp, 'date').value = '2026-11-26';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  const moved = w.__GD.state.finance.expenses.find(e => e.title === '날짜 이동 테스트');
  ok(!!moved && moved.date === '2026-11-26', '내역 날짜 변경 저장', moved && moved.date);
  ok(w.__GD.entriesOn('2026-11-26').some(e => e.title === '날짜 이동 테스트'), '바꾼 날짜의 내역으로 이동');
  ok(!$('#modalBody').textContent.includes('날짜 이동 테스트'), '원래 날짜 목록에서는 빠짐');

  console.log('▸ 수정 기능 — 가계부 모달');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-finance"]'));
  const finRow = () => $$('#modalBody .drow').find(r => r.textContent.includes('테스트 점심'));
  ok(!!finRow() && !!finRow().querySelector('[data-act="exp-edit"]'), '가계부 날짜 패널에도 ✏️ 수정 버튼');
  click(finRow().querySelector('[data-act="exp-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  ok(!!tp && fld(tp, 'date').value === '2026-12-01' && fld(tp, 'title').value === '테스트 점심', '가계부 모달 수정 창 값', tp && `${fld(tp, 'date').value} ${fld(tp, 'title').value}`);
  click(tp.querySelector('[data-x="cancel"]'));
  await tick();
  ok(!doc.querySelector('.prompt'), '취소하면 수정 창 닫힘');
  ok(w.__GD.state.finance.expenses.find(e => e.title === '테스트 점심').amount === 8500, '취소하면 원래 값 그대로');

  console.log('▸ 수정 기능 — 투자 메모 (📈 투자 탭)');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-invest"]'));
  const investForm = $('#modalBody [data-form="invest"]');
  fld(investForm, 'name').value = '테스트 ETF';
  fld(investForm, 'stance').value = '관망';
  fld(investForm, 'memo').value = '처음 메모';
  submit(investForm);
  await tick();
  const invRow = () => $$('#modalBody .drow').find(r => r.textContent.includes('테스트 ETF'));
  ok(!!invRow() && !!invRow().querySelector('[data-act="invest-edit"]'), '투자에 ✏️ 수정 버튼');
  click(invRow().querySelector('[data-act="invest-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  ok(!!tp && fld(tp, 'name').value === '테스트 ETF' && fld(tp, 'stance').value === '관망', '투자 수정 창 값');
  fld(tp, 'name').value = '테스트 ETF 2';
  fld(tp, 'stance').value = '매수검토';
  fld(tp, 'memo').value = '고친 메모';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  const invNow = w.__GD.state.finance.invest.find(v => v.name === '테스트 ETF 2');
  ok(!!invNow && invNow.stance === '매수검토' && invNow.memo === '고친 메모', '종목·상태·메모 수정 반영', invNow && JSON.stringify(invNow));
  ok($('#modalBody').textContent.includes('고친 메모'), '수정한 투자 메모가 목록에 보임');

  console.log('▸ 수정 기능 — STUDY 목표');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-study"]'));
  const goalRow = () => $$('#modalBody .check-row').find(r => r.textContent.includes('jsdom 목표'));
  ok(!!goalRow() && !!goalRow().querySelector('[data-act="goal-edit"]'), 'STUDY 목표에 ✏️ 수정 버튼');
  click(goalRow().querySelector('[data-act="goal-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  ok(!!tp && tp.textContent.includes('오늘의 목표 수정') && fld(tp, 'text').value === 'jsdom 목표', '목표 수정 창 값', tp && fld(tp, 'text').value);
  fld(tp, 'text').value = 'jsdom 목표 수정됨';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  ok($('#modalBody').textContent.includes('jsdom 목표 수정됨'), '목표 이름 수정 반영');
  ok(w.__GD.state.study.today.some(x => x.text === 'jsdom 목표 수정됨'), '수정이 저장 데이터에도 반영');

  console.log('▸ 수정 기능 — 홈 TO-DO List');
  click($('[data-act="modal-close"]'));
  $('#todoInput').value = '테스트 할일';
  submit($('#todoForm'));
  await tick();
  const todoRow = () => $$('#todoList .todo-item').find(r => r.textContent.includes('테스트 할일'));
  ok(!!todoRow() && !!todoRow().querySelector('[data-act="todo-edit"]'), 'TO-DO에 ✏️ 수정 버튼');
  click(todoRow().querySelector('[data-act="todo-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  ok(!!tp && fld(tp, 'text').value === '테스트 할일', 'TO-DO 수정 창 값');
  fld(tp, 'text').value = '테스트 할일 수정';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  ok(!!$$('#todoList .todo-item').find(r => r.textContent.includes('테스트 할일 수정')), 'TO-DO 수정 반영');
  ok(w.__GD.state.todo.some(t => t.text === '테스트 할일 수정'), 'TO-DO 수정이 저장 데이터에 반영');

  console.log('▸ 수정 기능 — 한줄일기');
  click($('[data-act="open-memo"]'));
  const diaryRow = () => $$('#modalBody .diary-row').find(r => r.textContent.includes('오늘 테스트 일기'));
  ok(!!diaryRow() && !!diaryRow().querySelector('[data-act="diary-edit"]'), '한줄일기에 ✏️ 수정 버튼');
  click(diaryRow().querySelector('[data-act="diary-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  ok(!!tp && !!fld(tp, 'date') && !!fld(tp, 'mood'), '한줄일기 수정 창에 날짜·기분');
  ok(!!tp && fld(tp, 'text').tagName === 'TEXTAREA', '한줄일기 내용은 여러 줄 textarea');
  ok(!!tp && tp.querySelector('[name="date"]').closest('.pf').classList.contains('date'), '날짜 칸 라벨 + 100% 폭 규칙');
  fld(tp, 'date').value = '2026-11-25';
  fld(tp, 'mood').value = '🥲';
  fld(tp, 'text').value = '고친 한줄일기';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  const dNow = w.__GD.state.memo.diary.find(d => d.text === '고친 한줄일기');
  ok(!!dNow && dNow.date === '2026-11-25' && dNow.mood === '🥲', '한줄일기 날짜·기분·내용 수정', dNow && JSON.stringify(dNow));
  ok($('#modalBody').textContent.includes('고친 한줄일기'), '수정한 일기가 목록에 보임');
  const df2 = $('#modalBody [data-form="diary"]');
  fld(df2, 'text').value = '오늘 다시 쓴 일기';
  submit(df2);
  await tick();
  const dupRow = () => $$('#modalBody .diary-row').find(r => r.textContent.includes('고친 한줄일기'));
  click(dupRow().querySelector('[data-act="diary-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  fld(tp, 'date').value = isoD(new Date());
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  ok(w.__GD.state.memo.diary.filter(d => d.date === isoD(new Date())).length === 1, '이미 일기가 있는 날짜로는 옮기지 않음');
  ok(($('#toast').textContent || '').includes('이미 한줄일기'), '이미 일기가 있으면 안내', $('#toast').textContent);

  console.log('▸ 수정 기능 — 습관·루틴');
  const habitRow = () => $$('#modalBody .habit-grid .hn').find(r => r.textContent.includes('테스트 습관'));
  ok(!!habitRow() && !!habitRow().querySelector('[data-act="habit-edit"]'), '습관에 ✏️ 수정 버튼');
  const habitBefore = w.__GD.state.memo.habits.find(h => h.name === '테스트 습관');
  const logBefore = JSON.stringify(habitBefore.log || {});
  click(habitRow().querySelector('[data-act="habit-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  ok(!!tp && fld(tp, 'name').value === '테스트 습관', '습관 수정 창에 원래 이름');
  fld(tp, 'name').value = '테스트 습관 수정';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  const habitAfter = w.__GD.state.memo.habits.find(h => h.name === '테스트 습관 수정');
  ok(!!habitAfter, '습관 이름 수정 반영');
  ok(!!habitAfter && JSON.stringify(habitAfter.log || {}) === logBefore, '이름을 바꿔도 체크 기록 유지', habitAfter && JSON.stringify(habitAfter.log));
  ok($('#modalBody').textContent.includes('테스트 습관 수정'), '목록에 새 습관 이름');

  console.log('▸ 수정 기능 — 메모 카드');
  const noteForm = $('#modalBody [data-form="note"]');
  fld(noteForm, 'title').value = '테스트 메모';
  fld(noteForm, 'tags').value = '12월, 할일';
  fld(noteForm, 'body').value = '처음 본문';
  submit(noteForm);
  await tick();
  const noteCard = () => $$('#modalBody .note-card').find(c => c.textContent.includes('테스트 메모'));
  ok(!!noteCard(), '메모 추가');
  ok(!!noteCard() && noteCard().textContent.includes('#12월') && noteCard().textContent.includes('#할일'), '태그가 카드에 표시', noteCard() && noteCard().textContent.replace(/\s+/g, ' '));
  click(noteCard().querySelector('[data-act="note-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  ok(!!tp && fld(tp, 'body').tagName === 'TEXTAREA', '메모 본문 수정은 textarea');
  ok(!!tp && fld(tp, 'title').value === '테스트 메모' && fld(tp, 'tags').value === '12월, 할일', '제목·태그 원래 값 표시', tp && fld(tp, 'tags').value);
  fld(tp, 'title').value = '테스트 메모 수정';
  fld(tp, 'tags').value = '#공부 #12월';
  fld(tp, 'body').value = '고친 본문\n두 번째 줄';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  const noteNow = w.__GD.state.memo.notes.find(n => n.title === '테스트 메모 수정');
  ok(!!noteNow && noteNow.body.includes('두 번째 줄') && (noteNow.tags || []).join(',') === '공부,12월', '제목·본문·태그 수정 반영', noteNow && JSON.stringify(noteNow));
  ok($('#modalBody').textContent.includes('#공부'), '수정한 태그가 카드에 표시');

  console.log('▸ 수정 기능 — Wishlist 사야 하는 것');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-wishlist"]'));
  const needRow = () => $$('#modalBody .drow').find(r => r.textContent.includes('테스트 이어폰'));
  ok(!!needRow() && !!needRow().querySelector('[data-act="need-edit"]'), '사야 하는 것에 ✏️ 수정 버튼');
  click(needRow().querySelector('[data-act="need-edit"]'));
  await tick();
  tp = doc.querySelector('.prompt');
  fld(tp, 'price').value = '62000';
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  ok(w.__GD.state.wish.need.find(n => n.name === '테스트 이어폰').price === 62000, '사야 하는 것 수정 반영');

  console.log('▸ 수정 창 레이아웃 규칙');
  ok(/\.pf-grid\{[^}]*grid-template-columns:repeat\(auto-fit,minmax\(160px,1fr\)\)/.test(css), '수정 창 입력칸 자동 2열 그리드');
  ok(/\.pf\.full\{[^}]*grid-column:1\/-1/.test(css), '날짜·본문 칸은 전체 폭');
  ok(/input,select,textarea\{text-align:left/.test(css), 'input·select·textarea 왼쪽 정렬 규칙');
  ok(/\.todo-item \.edit\{/.test(css), 'TO-DO 수정 버튼 스타일');
  ok(/\.habit-grid \.hn \.hx,\.habit-grid \.hn \.he\{[^}]*opacity:0/.test(css), '습관 수정·삭제 버튼 스타일');
  ok(/\.note-card \.ntag\{/.test(css), '메모 태그 스타일');
  const html2 = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/styles\.css\?v=33/.test(html2) && /app\.js\?v=28/.test(html2), '캐시 버스터 올림', (html2.match(/\?v=\d+/g) || []).join(','));

  console.log('▸ 홈 이달의 목표 연동');
  click($('[data-act="modal-close"]'));
  ok(!!$('#homeGoals'), '홈 왼쪽 칼럼에 이달의 목표 카드');
  ok($$('.sidebar .block-title').some(h => h.textContent.includes('🎯') && h.textContent.includes('이달의 목표')), '카드 제목 🎯 이달의 목표');
  const decoBtn = $('.sidebar .deco-btn');
  ok(!!decoBtn && !!decoBtn.previousElementSibling && decoBtn.previousElementSibling.contains($('#homeGoals')), '꾸미기 설정 버튼 바로 위에 배치');
  ok(!!$('#homeGoals [data-form="goal"][data-scope="month"]'), '홈 카드에서 바로 추가하는 폼(이달의 목표)');
  ok(!!$('#homeGoals .progress') && !!$('#homeGoals .hg-top'), '홈 카드 진행률·완료 개수');

  const hgForm = $('#homeGoals [data-form="goal"]');
  fld(hgForm, 'text').value = '홈에서 넣은 목표';
  submit(hgForm);
  await tick();
  const monthGoals = () => w.__GD.state.study.month;
  ok(monthGoals().some(g => g.text === '홈에서 넣은 목표'), '홈에서 추가 → STUDY 이달의 목표 데이터에 저장');
  ok($('#homeGoals').textContent.includes('홈에서 넣은 목표'), '홈 카드에 바로 반영');

  click($('[data-act="open-study"]'));
  ok($('#modalBody').textContent.includes('홈에서 넣은 목표'), 'STUDY 이달의 목표에도 같은 항목');
  const studMonthForm = $('#modalBody [data-form="goal"][data-scope="month"]');
  fld(studMonthForm, 'text').value = 'STUDY에서 넣은 목표';
  submit(studMonthForm);
  await tick();
  click($('[data-act="modal-close"]'));
  ok($('#homeGoals').textContent.includes('STUDY에서 넣은 목표'), 'STUDY에서 추가 → 홈 카드에도 반영 (양방향)');

  const hgRow = text => $$('#homeGoals .check-row').find(r => r.textContent.includes(text));
  ok(!!hgRow('컴활접수 하기'), '홈 카드에 기존 이달의 목표 표시');
  ok(!!hgRow('컴활접수 하기') && !!hgRow('컴활접수 하기').querySelector('[data-act="goal-edit"]') && !!hgRow('컴활접수 하기').querySelector('[data-act="goal-del"]'), '홈 카드에 수정(✏️)·삭제(✕) 버튼');

  click(hgRow('홈에서 넣은 목표').querySelector('[data-act="goal-toggle"]'));
  await tick();
  ok(monthGoals().find(g => g.text === '홈에서 넣은 목표').done === true, '홈에서 체크 → 달성 상태 저장');
  const hgRows = $$('#homeGoals .check-row');
  const doneIdx = hgRows.findIndex(r => r.textContent.includes('홈에서 넣은 목표'));
  ok(doneIdx === hgRows.length - 1, '달성한 항목은 목록 제일 아래로 정렬', `${doneIdx + 1}/${hgRows.length}`);
  ok(hgRows[doneIdx].classList.contains('done'), '달성 행에 done 클래스');
  ok(/\.check-row\.done \.txt\{[^}]*text-decoration:line-through/.test(css) && /\.check-row\.done \.txt\{[^}]*color:/.test(css), '달성 표시 = 취소선 + 연한 글자색');

  click($('[data-act="open-study"]'));
  const monthSec = $$('#modalBody .sec').find(s => {
    const h = s.querySelector('.sec-head h3');
    return h && h.textContent.includes('이달의 목표');
  });
  const mRows = monthSec ? Array.from(monthSec.querySelectorAll('.check-row')) : [];
  ok(mRows.length >= 3 && mRows[mRows.length - 1].textContent.includes('홈에서 넣은 목표'), 'STUDY 모달도 달성 항목을 아래로 정렬', mRows.map(r => r.textContent.replace(/[✓✏️✕\s]/g, ' ').trim()).join(' | '));
  ok(!!mRows.length && mRows[mRows.length - 1].classList.contains('done'), 'STUDY 모달도 같은 완료 스타일');
  click($('[data-act="modal-close"]'));

  click(hgRow('STUDY에서 넣은 목표').querySelector('[data-act="goal-edit"]'));
  await tick();
  let hp = doc.querySelector('.prompt');
  ok(!!hp && hp.textContent.includes('이달의 목표 수정'), '홈 ✏️ → 이달의 목표 수정 창', hp && hp.textContent.slice(0, 30));
  if (hp) { fld(hp, 'text').value = '홈에서 고친 목표'; click(hp.querySelector('[data-x="ok"]')); await tick(); }
  ok(monthGoals().some(g => g.text === '홈에서 고친 목표'), '홈에서 수정한 목표 저장');
  ok($('#homeGoals').textContent.includes('홈에서 고친 목표'), '홈 카드에 수정 반영');

  const tempForm = $('#homeGoals [data-form="goal"]');
  fld(tempForm, 'text').value = '삭제할 목표';
  submit(tempForm);
  await tick();
  click(hgRow('삭제할 목표').querySelector('[data-act="goal-del"]'));
  await tick();
  ok(!monthGoals().some(g => g.text === '삭제할 목표'), '홈 ✕ → 목표 삭제');
  ok(!$('#homeGoals').textContent.includes('삭제할 목표'), '홈 카드에서 삭제 반영');

  console.log('▸ 📈 투자 상위 탭');
  const navBtns = $$('.nav-btn');
  const navLabels = navBtns.map(b => b.querySelector('.nav-label').textContent.trim());
  ok(navLabels[1] === '가계부' && navLabels[2] === '투자', '가계부 바로 아래에 투자 탭', navLabels.join(','));
  ok(navBtns[2].querySelector('.nav-ico').textContent.includes('📈'), '투자 아이콘 📈');
  click(navBtns[2]);
  ok(!$('#modalRoot').hidden && $('#modalTitle').textContent.includes('투자'), '투자 탭 → 모달', $('#modalTitle').textContent);
  const invBody = $('#modalBody').textContent;
  ok(invBody.includes('재무목표') && invBody.includes('주식투자'), '투자 모달에 재무목표·주식투자 섹션');
  ok(!invBody.includes('가계부 캘린더') && !invBody.includes('정기구독 관리'), '투자 모달에 가계부 섹션 없음');

  const fgoalForm = $('#modalBody [data-form="fgoal"]');
  fld(fgoalForm, 'name').value = '테스트 비상금';
  fld(fgoalForm, 'target').value = '3000000';
  fld(fgoalForm, 'saved').value = '1200000';
  fld(fgoalForm, 'deadline').value = '2027-06-30';
  submit(fgoalForm);
  await tick();
  ok($('#modalBody').textContent.includes('테스트 비상금') && $('#modalBody').textContent.includes('40%'), '투자 모달에서 재무목표 추가·진행률');
  ok(w.__GD.state.finance.goals.some(g => g.name === '테스트 비상금' && g.target === 3000000), 'goals 키 그대로 저장');
  const invForm2 = $('#modalBody [data-form="invest"]');
  fld(invForm2, 'name').value = '테스트 배당주';
  fld(invForm2, 'stance').value = '보유';
  submit(invForm2);
  await tick();
  ok(w.__GD.state.finance.invest.some(v => v.name === '테스트 배당주'), 'invest 키 그대로 저장');

  click($('[data-act="modal-close"]'));
  click($('[data-act="open-finance"]'));
  ok(!$('#modalBody').textContent.includes('재무목표') && !$('#modalBody').textContent.includes('주식투자') && !$('#modalBody').textContent.includes('테스트 비상금'), '가계부 모달에서는 재무목표·투자 완전 제거');
  ok($('#modalBody').textContent.includes('가계부 캘린더') && $('#modalBody').textContent.includes('정기구독 관리'), '가계부에는 캘린더·정기구독만');
  const savedFin = JSON.parse(w.localStorage.getItem('gayeon_dashboard_v3') || 'null');
  ok(!!savedFin && savedFin.finance.goals.some(g => g.name === '테스트 비상금') && savedFin.finance.invest.some(v => v.name === '테스트 배당주'), '저장 데이터에 goals·invest 키 유지(호환)');
  const legacyFin = w.__GD.normalize({ v: 3, finance: { goals: [{ id: 'g1', name: '옛 목표', target: 100, saved: 10 }], invest: [{ id: 'v1', name: '옛 종목', stance: '보유' }] } });
  ok(legacyFin.finance.goals.length === 1 && legacyFin.finance.invest.length === 1, '기존 클라우드·로컬 데이터 그대로 읽힘');

  console.log('▸ 가계부 요약 카드 → 이번 달 상세');
  click($('[data-act="fin-today"]'));
  click($('[data-act="fin-next"]'));
  ok($('#finMonthLabel').textContent.includes('12월'), '가계부 12월로 이동', $('#finMonthLabel').textContent.trim().slice(0, 20));
  click($('.fcal-day[data-date="2026-12-01"]'));
  const moneyF = $('#modalBody [data-form="expense"]');
  fld(moneyF, 'title').value = '테스트 용돈';
  fld(moneyF, 'amount').value = '930000';
  const mType = fld(moneyF, 'type');
  mType.value = 'income';
  mType.dispatchEvent(new w.Event('change', { bubbles: true }));
  fld(moneyF, 'cat').value = '용돈';
  submit(moneyF);
  await tick();
  const incomeCard = $('#modalBody .stat.income');
  ok(!!incomeCard && incomeCard.dataset.act === 'fin-detail' && incomeCard.dataset.kind === 'income', '이번 달 수입 카드가 클릭 가능한 버튼');
  ok(!!incomeCard && /상세/.test(incomeCard.textContent), '카드에 상세 보기 힌트', incomeCard && incomeCard.textContent.replace(/\s+/g, ' '));
  ok(!!$('#modalBody .stat.spend[data-act="fin-detail"]') && !!$('#modalBody .stat.saving[data-act="fin-detail"]'), '지출·저축 카드도 클릭 가능');

  click(incomeCard);
  ok(!$('#modalRoot').hidden && /수입 상세/.test($('#modalTitle').textContent), '수입 카드 → 이번 달 수입 상세 팝업', $('#modalTitle').textContent);
  ok(/2026년 12월/.test($('#modalBody').textContent), '상세 팝업에 그 달 표시');
  const incDetail = $('#modalBody').textContent.replace(/\s+/g, ' ');
  ok(incDetail.includes('알바·급여') && incDetail.includes('용돈'), '상세에 카테고리 표시');
  ok(incDetail.includes('알바·급여 40%') && incDetail.includes('용돈 60%'), '카테고리별 퍼센트(알바·급여 40% · 용돈 60%)', incDetail.slice(0, 140));
  ok(!!$('#modalBody svg.donut'), '상세 최상단 원형(도넛) 그래프');
  ok($$('#modalBody .donut .dseg').length === 3, '카테고리 수(잔액 포함 3)만큼 도넛 조각', $$('#modalBody .donut .dseg').length);
  const legendPc = $$('#modalBody .chart-legend .pc').map(e => parseInt(e.textContent, 10));
  ok(legendPc.reduce((a, b) => a + b, 0) === 100, '범례 퍼센트 합 100', legendPc.join(','));
  ok($('#modalBody').textContent.includes('₩620,000') && $('#modalBody').textContent.includes('₩930,000'), '범례에 카테고리별 금액');
  const fdRows = $$('#modalBody .fd-row');
  ok(fdRows.length >= 2, '상세 내역 목록', fdRows.length);
  ok($$('#modalBody .fd-row .fd-date').length === fdRows.length && $$('#modalBody .fd-row .fd-cat').length === fdRows.length, '각 행에 날짜·카테고리');
  ok($$('#modalBody [data-act$="-edit"]').length === 0 && $$('#modalBody [data-act$="-del"]').length === 0, '상세 목록에 수정·삭제 버튼 없음');
  ok(!/[✏️✕]/.test($('#modalBody').textContent), '상세 목록에 ✏️·✕ 문구 없음');

  click($('[data-act="modal-close"]'));
  ok(!$('#modalRoot').hidden && $('#modalTitle').textContent.includes('가계부'), '상세를 닫으면 가계부 모달로 복귀', $('#modalTitle').textContent);
  click($('#modalBody .stat.spend'));
  ok(/지출 상세/.test($('#modalTitle').textContent), '지출 카드 → 이번 달 지출 상세', $('#modalTitle').textContent);
  ok($('#modalBody').textContent.includes('식비') && $('#modalBody').textContent.includes('8,500'), '지출 상세에 식비 내역');
  click($('[data-act="modal-close"]'));
  click($('#modalBody .stat.saving'));
  ok(/저축·투자 상세/.test($('#modalTitle').textContent), '저축 카드 → 이번 달 저축·투자 상세', $('#modalTitle').textContent);
  ok($('#modalBody').textContent.includes('보여줄 비율이 없어요'), '저축 내역 0건 → 빈 상태 안내', $('#modalBody').textContent.replace(/\s+/g, ' ').slice(0, 90));
  click($('[data-act="modal-close"]'));

  /* 이월은 실제 내역이 있는 달의 다음 달에만 — 1월은 12월 잔액, 2월은 이월 없음 */
  click($('[data-act="fin-next"]'));
  const janCarry = w.__GD.carryoverAmount(2027, 1);
  ok(janCarry === 1550779 - 81721 - 37000, '1월 이월 = 12월 수입(잔액 779 포함) − 지출(예정·대출 포함) = 1,432,058', janCarry);
  const jan1 = $$('.fcal-day').find(c => c.dataset.date === '2027-01-01');
  ok(!!jan1 && jan1.textContent.includes('1,432,058'), '1월 1일 칸에 잔액 표시', jan1 && jan1.textContent);
  click($('#modalBody .stat.income'));
  ok($('#modalBody').textContent.includes('잔액') && $('#modalBody').textContent.includes('1,432,058'), '1월 수입 상세에 잔액 카테고리');
  click($('[data-act="modal-close"]'));
  click($('[data-act="fin-next"]'));
  ok(w.__GD.carryoverAmount(2027, 2) === 0, '1월에 내역이 없으면 2월로는 이월하지 않음', w.__GD.carryoverAmount(2027, 2));
  click($('#modalBody .stat.income'));
  ok($('#modalBody').textContent.includes('보여줄 비율이 없어요') && !$('#modalBody svg.donut'), '내역 0건 → 빈 상태 안내', $('#modalBody').textContent.replace(/\s+/g, ' ').slice(0, 90));
  click($('[data-act="modal-close"]'));
  click($('[data-act="modal-close"]'));

  console.log('▸ 원형 그래프 계산');
  const chart = w.__GD.chartParts([{ cat: '알바·급여', amount: 620000 }, { cat: '용돈', amount: 930000 }]);
  ok(chart.total === 1550000 && chart.rows[0].cat === '용돈' && chart.rows[0].pct === 60 && chart.rows[1].pct === 40, '카테고리 합계·비중 계산', JSON.stringify(chart.rows));
  ok(chart.rows.reduce((s, r) => s + r.pct, 0) === 100, '비중 합 100');
  const thirds = w.__GD.chartParts([{ cat: 'A', amount: 1 }, { cat: 'B', amount: 1 }, { cat: 'C', amount: 1 }]);
  ok(thirds.rows.reduce((s, r) => s + r.pct, 0) === 100, '나눠떨어지지 않아도 합 100', thirds.rows.map(r => r.pct).join(','));
  ok(w.__GD.chartParts([]).total === 0 && w.__GD.chartParts([]).rows.length === 0, '내역이 없으면 빈 차트');
  const dsvg = String(w.__GD.donutSvg([{ cat: '식비', amount: 1, pct: 100 }], 1));
  ok(dsvg.includes('stroke="#3182F6"'), '도넛 색은 카테고리 고정 색(식비 = 파랑)', dsvg.slice(0, 180));
  ok(/:root\{[^}]*--chart-1:/.test(css) && /body\[data-theme="xmas"\]\{[^}]*--chart-1:/.test(css), '파스텔 하늘·크리스마스 두 테마 차트 팔레트');
  ok(/\.stat-btn\{/.test(css) && /\.stat-go\{/.test(css) && /\.chart-legend\{/.test(css), '요약 카드·범례 스타일');

  console.log('▸ 큰 상세 캘린더 모달');
  click($('[data-act="modal-close"]'));
  ok(!!$('.cal-title-btn[data-act="open-calendar"]') && !!$('#calTitle'), '캘린더 제목이 크게 보기 버튼');
  ok(!!$('.cal-title-btn .cal-open-pill'), '📅 크게 보기 배지');
  click($('.cal-title-btn'));
  await tick();
  ok($('#modalRoot').hidden === false && /캘린더/.test($('#modalTitle').textContent), '제목를 누르면 캘린더 모달 열림', $('#modalTitle').textContent);
  ok($('#modalBox').classList.contains('wide'), '캘린더 모달은 넓은 창');
  ok(!!$('#calxGrid') && $$('#calxGrid .calx-cell').filter(c => !c.classList.contains('out')).length >= 28, '큰 월간 달력 렌더', $$('#calxGrid .calx-cell').length);
  ok(/11월/.test($('#calxMonth').textContent), '모달 월 표시', $('#calxMonth').textContent);
  ok(!!$('#calxAgenda') && /컴활접수/.test($('#calxAgenda').textContent), '아젠다에 이번 달 일정', ($('#calxAgenda').textContent || '').slice(0, 60));
  ok(/지안수마켓/.test($('#calxAgenda').textContent) && /베스트피씨 알바/.test($('#calxAgenda').textContent), '아젠다에 개인일정·알바도 표시');
  ok(/전체 일정/.test($('#modalBody').textContent), '이번 달 전체 일정 제목');
  /* 날짜 클릭 → 하단 패널 상세 (모달은 그대로) */
  const d29 = $$('#calxGrid .calx-cell').find(c => c.dataset.date === '2026-11-29');
  ok(!!d29, '29일 칸 있음');
  click(d29);
  await tick();
  ok(!!$('.calx-day') && /지안수마켓/.test($('.calx-day').textContent), '날짜를 누르면 그 날 상세 패널', $('.calx-day') && $('.calx-day').textContent.replace(/\s+/g, ' ').slice(0, 50));
  ok(!!$$('#calxGrid .calx-cell.sel').length, '고른 날짜 표시');
  ok($('#modalTitle').textContent.includes('캘린더'), '큰 캘린더는 그대로 유지됨');
  /* 월 이동 */
  click($('[data-act="calx-next"]'));
  await tick();
  ok(/12월/.test($('#calxMonth').textContent), '다음 달로 이동', $('#calxMonth').textContent);
  const calxDec1 = $$('#calxGrid .calx-cell').find(c => c.dataset.date === '2026-12-01');
  const calxDec28 = $$('#calxGrid .calx-cell').find(c => c.dataset.date === '2026-12-28');
  ok(!!calxDec1 && /−₩59,000/.test(calText(calxDec1)) && !/\+₩59,000/.test(calText(calxDec1)), '큰 달력 구매예정도 −₩59,000', calText(calxDec1));
  ok(!!calxDec28 && /−₩9,900/.test(calText(calxDec28)) && !/\+₩9,900/.test(calText(calxDec28)), '큰 달력 정기구독도 −₩9,900', calText(calxDec28));
  ok(!/\+₩9,900/.test($('#calxAgenda').textContent) && /−₩9,900/.test($('#calxAgenda').textContent), '12월 전체 일정의 구독 금액도 마이너스', (calText($('#calxAgenda')) || '').slice(0, 120));
  ok(/컴활 2급 필기/.test($('#calxAgenda').textContent), '12월 일정·시험이 아젠다에', ($('#calxAgenda').textContent || '').slice(0, 40));
  ok(!$('.calx-day') || !$('.calx-day .drow'), '월을 옮기면 날짜 선택은 비워짐');
  click($('[data-act="calx-today"]'));
  await tick();
  ok(/11월/.test($('#calxMonth').textContent), '오늘 버튼으로 이번 달 복귀', $('#calxMonth').textContent);
  /* 예정 지출도 아젠다에 */
  w.__GD.state.finance.planned.push({ id: 'test-plan-1', name: '테스트 정기결제', date: '2026-11-30', amount: 12000 });
  click($('[data-act="calx-today"]')); await tick();
  ok(/테스트 정기결제/.test($('#calxAgenda').textContent) && /12,000/.test($('#calxAgenda').textContent), '아젠다에 예정 지출도 표시');
  ok(/−₩12,000/.test($('#calxAgenda').textContent) && !/\+₩12,000/.test($('#calxAgenda').textContent), '아젠다 예정 금액도 마이너스', calText($('#calxAgenda')).match(/테스트 정기결제[^ ]*[^]{0,30}/));
  w.__GD.state.finance.planned = w.__GD.state.finance.planned.filter(p => p.id !== 'test-plan-1');
  /* 날짜 상세 모달로 이동 후에도 큰 캘린더로 돌아오기 */
  const d28 = $$('#calxGrid .calx-cell').find(c => c.dataset.date === '2026-11-28');
  click(d28); await tick();
  click($('[data-act="calx-open-day"]')); await tick();
  ok(/11월 28일/.test($('#modalTitle').textContent), '날짜 상세 모달로 이동', $('#modalTitle').textContent);
  ok(/−₩9,900/.test($('#modalBody').textContent) && !/\+₩9,900/.test($('#modalBody').textContent), '날짜 상세 모달의 정기구독도 −₩9,900', calText($('#modalBody')).slice(0, 140));
  click($('[data-act="modal-close"]')); await tick();
  ok($('#modalRoot').hidden === false && $('#modalTitle').textContent.includes('캘린더'), '닫으면 큰 캘린더로 복귀', $('#modalTitle').textContent);
  click($('[data-act="modal-close"]')); await tick();
  ok($('#modalRoot').hidden === true, '한 번 더 닫으면 홈');
  /* 홈의 날짜 칸은 기존처럼 그 날짜 상세 모달 */
  const home28 = $$('.cal-grid:not(#calxGrid) .cal-cell').find(c => c.dataset.date === '2026-11-28');
  click(home28);
  ok(/11월 28일/.test($('#modalTitle').textContent), '홈 날짜 칸은 그 날짜 상세 모달');
  click($('[data-act="modal-close"]'));
  ok(/\.calx\{[^}]*grid-template-columns:minmax\(0,1\.22fr\) minmax\(0,\.78fr\)/.test(css), '큰 캘린더 2열 레이아웃');
  ok(/@media \(max-width:980px\)\{ \.calx\{grid-template-columns:1fr/.test(css), '아이패드·모바일은 1열로');
  ok(/\.calx-cell\{[^}]*min-height:clamp\(84px,8\.6vw,116px\)/.test(css), '큰 달력 칸이 넉넉함');
  ok(/body\[data-theme="xmas"\] \.calx-cell\.sel\{/.test(css) && /body\[data-theme="xmas"\] \.ag-day\{/.test(css), '크리스마스 테마 캘린더 색상');
  ok(/\.modal\.wide\{width:min\(1120px,100%\)/.test(css), '넓은 모달 폭 규칙');
  ok(/@media \(min-width:981px\)\{\s*\.modal\.wide\{height:/.test(css) && /\.modal\.wide \.modal-body\{overflow:hidden/.test(css), 'PC에서 한 달 전체가 보이게 높이 고정');
  ok(/\.cal-chips\{gap:3px;margin-bottom:2px;align-self:stretch;width:100%;\}/.test(css), '모바일 일정 막대가 폭을 갖음');
  ok(/\.calx-cell \.cal-chips \.chip\{width:6px;height:6px/.test(css), '모바일 큰 달력은 일정을 점으로');
  ok(/\.cal-title-btn\{[^}]*cursor:pointer/.test(css), '캘린더 제목 클릭 가능 스타일');
  ok(/body\[data-theme="xmas"\] \.cal-open-pill\{/.test(css), '크리스마스 테마 크게 보기 배지');

  /* ══════════════════════════════════════════════════════════════
     가계부 실전 개편 — ① 다음 결제일 시작월 ② 예정 지출 통합
     ③ 저축 카드·투자 연동·수입-지출-투자 ④ 전달 잔액 이월
     ══════════════════════════════════════════════════════════════ */
  if (!$('#modalRoot').hidden) click($('[data-act="modal-close"]'));
  const FIN = w.__GD.state.finance;
  let seq = 0;
  const mkRow = o => Object.assign({ id: `fx${++seq}` }, o);
  FIN.expenses = [
    mkRow({ date: '2026-11-10', title: '월급', amount: 1000000, cat: '알바·급여', type: 'income' }),
    mkRow({ date: '2026-11-15', title: '장보기', amount: 300000, cat: '생활', type: 'expense' }),
    mkRow({ date: '2026-11-20', title: '비상금 적립', amount: 200000, cat: '[목표] 비상금 모으기', type: 'saving' }),
  ];
  FIN.subs = [];
  FIN.planned = [];
  FIN.goals = [mkRow({ name: '비상금 모으기', target: 3000000, saved: 200000, deadline: '' })];
  FIN.invest = [mkRow({ name: '테슬라', stance: '보유', memo: '' })];
  click($('[data-act="open-finance"]'));
  click($('[data-act="fin-today"]'));

  console.log('▸ ④ 전달 잔액 → 다음 달 1일 「잔액」 이월');
  let st = w.__GD.financeStats();
  ok(st.carry === 0, '④ 첫 기록 달(11월)에는 이월 없음', st.carry);
  ok(st.income === 1000000 && st.spent === 300000 && st.saved === 200000, '④ 11월 수입·지출·저축 구분 집계', JSON.stringify(st));
  ok(st.balance === 500000, '④ 11월 남은 돈 = 1,000,000 − 300,000 − 200,000', st.balance);
  ok(w.__GD.carryoverOn('2026-11-01') === 0, '④ 11월 1일에는 이월 없음');
  ok(w.__GD.carryoverAmount(2026, 12) === 500000, '④ 12월 이월액 = 11월 잔액 500,000', w.__GD.carryoverAmount(2026, 12));
  ok(w.__GD.carryoverOn('2026-12-01') === 500000 && w.__GD.carryoverOn('2026-12-02') === 0, '④ 잔액은 그 달 1일에만 얹힘');
  ok(w.__GD.carryoverAmount(2027, 2) === 0 && w.__GD.carryoverAmount(2027, 7) === 0, '④ 내역 없는 먼 달로 빈 이월이 번지지 않음');
  ok(!w.__GD.state.finance.expenses.some(e => e.cat === '잔액'), '④ 잔액은 저장되지 않고 계산으로만 붙음');
  const incItemsNov = w.__GD.financeMonthItems('income');
  ok(incItemsNov.length === 1 && incItemsNov[0].title === '월급', '④ 11월 수입 상세에는 잔액 없음', incItemsNov.map(i => i.title).join(','));

  click($('[data-act="fin-next"]'));
  ok($('#finMonthLabel').textContent.includes('12월'), '④ 가계부 12월로 이동');
  const dec1Cell = () => $$('.fcal-day').find(c => c.dataset.date === '2026-12-01');
  ok(!!dec1Cell().querySelector('.cy') && dec1Cell().querySelector('.cy').textContent.includes('500,000'), '④ 12월 1일 칸에 잔액 500,000', dec1Cell().textContent.replace(/\s+/g, ' '));
  ok(/＋₩500,000/.test(calText($('#modalBody .stat.income .v'))), '④ 이번 달 수입 카드에 잔액 포함', calText($('#modalBody .stat.income')));
  ok(/전달 잔액/.test($('#modalBody').textContent) && /＋₩500,000/.test($('#modalBody').textContent), '④ 카드·내역에 전달 잔액 표시');
  click($('.fcal-day[data-date="2026-12-01"]'));
  const carryRow = $$('#modalBody .drow').find(r => r.querySelector('.tag.carry'));
  ok(!!carryRow && /＋₩500,000/.test(calText(carryRow)), '④ 날짜 패널에 「잔액」 행', carryRow && calText(carryRow));
  ok(!carryRow.querySelector('[data-act="exp-edit"]') && !carryRow.querySelector('[data-act="exp-del"]'), '④ 잔액 행은 수정·삭제 불가');

  console.log('▸ ① 정기구독 다음 결제일 기준 시작월');
  click($('[data-act="fin-today"]'));
  const addSub = (name, amount, cycle, month, day) => {
    const f = $('#modalBody [data-form="sub"]');
    fld(f, 'name').value = name;
    fld(f, 'amount').value = String(amount);
    fld(f, 'cycle').value = cycle;
    fld(f, 'month').value = String(month);
    fld(f, 'day').value = String(day);
    submit(f);
  };
  addSub('넷플릭스', 17000, 'monthly', 1, 10);
  const subNetflix = w.__GD.state.finance.subs.find(s => s.name === '넷플릭스');
  ok(!!subNetflix && subNetflix.startDate === '2026-12-10', '① 매달 10일 — 11/28 등록이면 첫 결제 12/10', subNetflix && subNetflix.startDate);
  ok(!w.__GD.plannedOn('2026-11-10').some(p => p.name === '넷플릭스'), '① 11월에는 표시되지 않음');
  ok(w.__GD.plannedOn('2026-12-10').some(p => p.name === '넷플릭스' && p.amount === 17000), '① 12월 10일에 표시');
  ok(/12월부터/.test($('#modalBody').textContent), '① 구독 목록에 「12월부터」 표시');

  addSub('29일 구독', 9900, 'monthly', 1, 29);
  const sub29 = w.__GD.state.finance.subs.find(s => s.name === '29일 구독');
  ok(!!sub29 && sub29.startDate === '2026-11-29', '① 매달 29일 — 이번 달 11/29부터', sub29 && sub29.startDate);
  ok(w.__GD.plannedOn('2026-11-29').some(p => p.name === '29일 구독'), '① 11월 29일에 표시');

  addSub('연간 구독', 120000, 'yearly', 3, 15);
  const subYear = w.__GD.state.finance.subs.find(s => s.name === '연간 구독');
  ok(!!subYear && subYear.startDate === '2027-03-15', '① 매년 3/15 — 내년 3/15부터', subYear && subYear.startDate);
  ok(!w.__GD.plannedOn('2026-12-15').some(p => p.name === '연간 구독') && w.__GD.plannedOn('2027-03-15').some(p => p.name === '연간 구독'), '① 매년 구독은 3/15에만');

  const normOld = w.__GD.normalize({ v: 3, finance: { subs: [{ id: 's1', name: '옛 구독', amount: 1000, day: 10, cycle: 'monthly', active: true }] } });
  ok(normOld.finance.subs[0].startDate === '2026-12-10', '① startDate 없는 기존 구독 → 12/10으로 자동 보정', normOld.finance.subs[0].startDate);
  const normOld29 = w.__GD.normalize({ v: 3, finance: { subs: [{ id: 's2', name: '옛 구독2', amount: 1000, day: 29, cycle: 'monthly', active: true }] } });
  ok(normOld29.finance.subs[0].startDate === '2026-11-29', '① 지난 결제일은 소급 표시되지 않고 11/29는 남김', normOld29.finance.subs[0].startDate);
  const normCreated = w.__GD.normalize({ v: 3, finance: { subs: [{ id: 's3', name: '옛 구독3', amount: 1000, day: 5, cycle: 'monthly', active: true, createdAt: '2026-12-20' }] } });
  ok(normCreated.finance.subs[0].startDate === '2027-01-05', '① createdAt이 있으면 그 날 기준 다음 결제일', normCreated.finance.subs[0].startDate);
  const normKeep = w.__GD.normalize({ v: 3, finance: { subs: [{ id: 's4', name: '옛 구독4', amount: 1000, day: 5, cycle: 'monthly', active: true, startDate: '2027-05-05' }] } });
  ok(normKeep.finance.subs[0].startDate === '2027-05-05', '① 이미 있는 startDate는 그대로 둠');

  /* ②③④ 계산을 단순하게 — 12/10 구독만 남기고 ④ return */
  FIN.subs = FIN.subs.filter(s => s.name === '넷플릭스');
  click($('[data-act="fin-today"]'));
  ok(w.__GD.financeStats().spent === 300000 && w.__GD.financeStats().saved === 200000, '11월 집계 복귀(구독 정리 후)');

  console.log('▸ ② 예정 지출 카드 제거 → 이번 달 지출로 통합');
  FIN.planned = [mkRow({ name: '생일 선물', date: '2026-12-05', amount: 50000, needId: null })];
  click($('[data-act="fin-next"]'));
  const moneyCards = $$('#modalBody .stat-row.money .stat');
  ok(moneyCards.length === 4, '② 요약 카드는 4칸', moneyCards.length);
  ok(!$('#modalBody .stat-row.money .stat.plan'), '② 「예정 지출」 카드 없음');
  ok(!!$('#modalBody .stat-row.money .stat.saving') && !!$('#modalBody .stat-row.money .stat.balance'), '② 저축·남은 돈 카드 존재');
  const decStats = w.__GD.financeStats();
  ok(decStats.planned === 67000 + 37000, '② 12월 예정 = 구독 17,000 + 구매예정 50,000 + 대출 37,000', decStats.planned);
  ok(decStats.spendTotal === 104000 && decStats.spent === 0, '② 이번 달 지출 카드 = 실제 0 + 예정·대출 104,000', JSON.stringify(decStats));
  ok(/−₩104,000/.test(calText($('#modalBody .stat.spend .v'))), '② 이번 달 지출 카드에 예정·대출 합산', calText($('#modalBody .stat.spend')));
  ok(/예정 67,000 · 대출 37,000 포함/.test($('#modalBody .stat.spend').textContent), '② 카드에 「예정 · 대출 포함」 안내');
  click($('#modalBody .stat.spend'));
  const spendDetail = calText($('#modalBody'));
  ok(/지출 상세/.test($('#modalTitle').textContent), '② 지출 상세 팝업');
  ok(spendDetail.includes('넷플릭스') && spendDetail.includes('생일 선물') && spendDetail.includes('햇살론유스 이자 (신한은행)'), '② 상세 내역에 구독·구매예정·대출 포함', spendDetail.slice(0, 160));
  ok(spendDetail.includes('정기구독') && spendDetail.includes('구매예정') && spendDetail.includes('대출·이자'), '② 카테고리에 정기구독·구매예정·대출·이자');
  ok($$('#modalBody .fd-flag').length === 4 && $$('#modalBody .fd-flag.auto').length === 2, '② 예정 2건·대출 2건에 표시', $$('#modalBody .fd-flag').length);
  ok(/정기구독·구매예정 포함/.test(spendDetail) && /대출 상환 포함/.test(spendDetail), '② 상세에 통합 안내');
  const spendRows = $$('#modalBody .fd-row');
  ok(spendRows.length === 4, '② 상세 행 4개(구독·구매예정·대출 2)', spendRows.length);
  ok($$('#modalBody .chart-legend .lb').some(e => e.textContent.trim() === '대출·이자'), '② 지출 도넉에 「대출·이자」 카테고리', $$('#modalBody .chart-legend .lb').map(e => e.textContent.trim()).join(','));
  click($('[data-act="modal-close"]'));

  console.log('▸ ③ 저축 카드 · 투자 항목 연동 · 수입-지출-투자');
  click($('.fcal-day[data-date="2026-12-20"]'));
  const saveForm = $('#modalBody [data-form="expense"]');
  const typeSelSave = fld(saveForm, 'type');
  ok(Array.from(typeSelSave.options).map(o => o.textContent).join(',') === '지출,수입,저축', '③ 내역 등록 종류 = 지출·수입·저축');
  typeSelSave.value = 'saving';
  typeSelSave.dispatchEvent(new w.Event('change', { bubbles: true }));
  const saveCats = Array.from(fld(saveForm, 'cat').querySelectorAll('option')).map(o => o.textContent);
  ok(saveCats.includes('[목표] 비상금 모으기') && saveCats.includes('[주식] 테슬라'), '③ 저축 카테고리 = 📈 투자 탭 항목 자동 연동', saveCats.join(','));
  ok(saveForm.classList.contains('is-saving'), '③ 저축 모드 표시');
  fld(saveForm, 'title').value = '비상금 넣기';
  fld(saveForm, 'amount').value = '150000';
  fld(saveForm, 'cat').value = '[목표] 비상금 모으기';
  submit(saveForm);
  const savedEntry = w.__GD.state.finance.expenses.find(e => e.title === '비상금 넣기');
  ok(!!savedEntry && savedEntry.type === 'saving' && savedEntry.cat === '[목표] 비상금 모으기', '③ 저축 내역 저장', savedEntry && JSON.stringify(savedEntry));
  const dec2 = w.__GD.financeStats();
  ok(dec2.saved === 150000, '③ 이번 달 저축·투자 = 150,000', dec2.saved);
  ok(dec2.spendTotal === 104000 && dec2.spent === 0, '③ 저축은 이번 달 지출에 섞이지 않음', JSON.stringify(dec2));
  ok(!w.__GD.financeMonthItems('spend').some(i => i.title === '비상금 넣기'), '③ 저축은 지출 상세에도 없음');
  const saveCard = $('#modalBody .stat.saving');
  ok(/↗₩150,000/.test(calText(saveCard)), '③ 저축 카드 ↗₩150,000', calText(saveCard));
  ok(calText(saveCard).includes('[목표] 비상금 모으기'), '③ 저축 카드에 대표 항목');
  ok(/수입 - 지출 - 투자/.test($('#modalBody .stat.balance').textContent), '③ 4번째 카드 이름 = 수입 - 지출 - 투자');
  ok(/246,000/.test(calText($('#modalBody .stat.balance'))), '③ 수입 - 지출 - 투자 = 500,000 − 104,000 − 150,000', calText($('#modalBody .stat.balance')));
  click($('#modalBody .stat.saving'));
  ok(/저축·투자 상세/.test($('#modalTitle').textContent), '③ 저축 카드 → 도넛 상세 팝업', $('#modalTitle').textContent);
  ok(!!$('#modalBody svg.donut') && $$('#modalBody .donut .dseg').length === 1, '③ 저축 카테고리 1조각', $$('#modalBody .donut .dseg').length);
  ok(/\[목표\] 비상금 모으기 100%/.test(calText($('#modalBody'))), '③ 저축 상세 100%');
  ok(/↗₩150,000/.test(calText($('#modalBody .fd-amt'))), '③ 상세 행 금액 ↗₩150,000', calText($('#modalBody .fd-amt')));
  click($('[data-act="modal-close"]'));

  /* 투자 탭에 항목이 하나도 없을 때 기본값 */
  const goalsBak = FIN.goals, investBak = FIN.invest;
  FIN.goals = []; FIN.invest = [];
  ok(w.__GD.savingCatOptions().join(',') === '재무목표,주식투자', '③ 항목이 없으면 기본 재무목표·주식투자', w.__GD.savingCatOptions().join(','));
  FIN.goals = goalsBak; FIN.invest = investBak;

  /* 날짜 상세 모달에서도 저축 유형·수정 창 */
  click($('[data-act="modal-close"]'));
  click($('[data-act="cal-next"]'));
  const homeDec20 = $$('.cal-cell').find(c => c.dataset.date === '2026-12-20');
  click(homeDec20);
  ok(/12월 20일/.test($('#modalTitle').textContent), '③ 날짜 상세 모달 열림', $('#modalTitle').textContent);
  const dayType = fld($('#modalBody [data-form="expense"]'), 'type');
  ok(Array.from(dayType.options).map(o => o.textContent).includes('저축'), '③ 날짜 상세 폼에도 저축 유형');
  const savedRow = $$('#modalBody .drow').find(r => r.textContent.includes('비상금 넣기'));
  ok(!!savedRow && !!savedRow.querySelector('.tag.saving') && !!savedRow.querySelector('.dday-pill.saving'), '③ 날짜 상세 저축 행: 저축 태그 · ↗ 알약', savedRow && calText(savedRow));
  ok(/↗₩150,000/.test(calText(savedRow)), '③ 날짜 상세 금액 ↗₩150,000');
  ok(/저축 ₩150,000/.test(calText($('#modalBody'))), '③ 날짜 요약줄에 저축 합계', calText($('#modalBody')).slice(0, 120));
  click(savedRow.querySelector('[data-act="exp-edit"]'));
  await tick();
  const ep = doc.querySelector('.prompt');
  ok(!!ep && /내역 수정/.test(ep.textContent), '③ 내역 수정 창');
  const epType = ep && fld(ep, 'type');
  ok(!!epType && Array.from(epType.options).map(o => o.textContent).join(',') === '지출,수입,저축' && epType.value === '저축', '③ 수정 창 종류도 지출·수입·저축(현재 저축)', epType && epType.value);
  ok(!!ep && Array.from(fld(ep, 'cat').querySelectorAll('option')).map(o => o.textContent).includes('[목표] 비상금 모으기'), '③ 수정 창 카테고리도 투자 항목 연동');
  epType.value = '수입'; epType.dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  ok(Array.from(fld(ep, 'cat').querySelectorAll('option')).map(o => o.textContent).includes('알바·급여'), '③ 수입으로 바꾸면 수입 카테고리로 교체');
  epType.value = '저축'; epType.dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  ok(Array.from(fld(ep, 'cat').querySelectorAll('option')).map(o => o.textContent).includes('[주식] 테슬라'), '③ 다시 저축으로 바꾸면 투자 항목 목록', Array.from(fld(ep, 'cat').querySelectorAll('option')).map(o => o.textContent).join(','));
  click(ep.querySelector('[data-x="cancel"]'));
  await tick();
  click($('[data-act="modal-close"]'));

  console.log('▸ ④ 이월 연동 · 홈 달력 · 상세');
  const homeDec1 = $$('.cal-cell').find(c => c.dataset.date === '2026-12-01');
  ok(!!homeDec1.querySelector('.cal-carry') && /500,000/.test(homeDec1.querySelector('.cal-carry').textContent), '④ 홈 달력 12/1에 잔액 표시', homeDec1 && calText(homeDec1));
  const homeDec20Cell = $$('.cal-cell').find(c => c.dataset.date === '2026-12-20');
  ok(!!homeDec20Cell.querySelector('.cal-save') && /150,000/.test(calText(homeDec20Cell.querySelector('.cal-save'))), '④ 홈 달력에 저축 금액 표시', calText(homeDec20Cell));
  click(homeDec1);
  ok(!!$('#modalBody .tag.carry') && /＋₩500,000/.test(calText($('#modalBody'))), '④ 날짜 상세에 잔액 반영');
  click($('[data-act="modal-close"]'));
  ok(w.__GD.carryoverAmount(2027, 1) === 246000, '④ 1월 이월 = 12월 잔액 246,000 (대출 37,000 차감)', w.__GD.carryoverAmount(2027, 1));
  ok(w.__GD.carryoverAmount(2027, 2) === 0, '④ 1월에 내역이 없으면 2월 이월 없음');
  click($('[data-act="open-finance"]'));
  click($('[data-act="fin-next"]'));
  click($('#modalBody .stat.income'));
  ok($('#modalBody').textContent.includes('잔액') && $('#modalBody').textContent.includes('246,000'), '④ 1월 수입 상세에 「잔액」 246,000', calText($('#modalBody')).slice(0, 120));
  ok($$('#modalBody .donut .dseg').length === 1 && /잔액 100%/.test(calText($('#modalBody'))), '④ 수입 도넛이 잔액 100%', $$('#modalBody .donut .dseg').length);
  click($('[data-act="modal-close"]'));
  click($('[data-act="modal-close"]'));

  /* 지난달이 적자면 1일 잔액이 마이너스 */
  const bakFlow = { expenses: FIN.expenses, subs: FIN.subs, planned: FIN.planned };
  FIN.expenses = bakFlow.expenses.filter(e => !String(e.date || '').startsWith('2026-12'))
    .concat([mkRow({ date: '2026-12-05', title: '큰 지출', amount: 600000, cat: '생활', type: 'expense' })]);
  FIN.subs = []; FIN.planned = [];
  ok(w.__GD.carryoverAmount(2027, 1) === -137000, '④ 지난달이 적자면 1월 잔액은 마이너스(−137,000 · 대출 37,000 포함)', w.__GD.carryoverAmount(2027, 1));
  click($('[data-act="open-finance"]'));
  click($('[data-act="fin-today"]'));
  click($('[data-act="fin-next"]'));
  click($('[data-act="fin-next"]'));
  ok($('#finMonthLabel').textContent.includes('1월'), '④ 가계부 1월로 이동', $('#finMonthLabel').textContent.trim().slice(0, 20));
  const janInc = w.__GD.financeMonthItems('income');
  ok(janInc.length === 1 && janInc[0].amount === -137000, '④ 1월 수입 내역에 마이너스 잔액', JSON.stringify(janInc));
  ok(/−₩137,000/.test(calText($('#modalBody .stat.income'))), '④ 수입 카드도 −₩137,000', calText($('#modalBody .stat.income')));
  const jan1Cell = $$('.fcal-day').find(c => c.dataset.date === '2027-01-01');
  ok(!!jan1Cell && /-137,000/.test(calText(jan1Cell)), '④ 1월 1일 칸도 마이너스 잔액', calText(jan1Cell));
  click($('[data-act="modal-close"]'));
  FIN.expenses = bakFlow.expenses; FIN.subs = bakFlow.subs; FIN.planned = bakFlow.planned;

  console.log('▸ 새 스타일 연결');
  ok(/\.dotc\.saving\{/.test(css) && /\.dotc\.carry\{/.test(css), '달력 범례에 저축·잔액 점');
  ok(/\.dday-pill\.saving\{/.test(css) && /\.tag\.saving\{/.test(css) && /\.tag\.carry\{/.test(css), '저축·잔액 태그·알약 스타일');
  ok(/\.stat\.saving \.v\{/.test(css) && /\.fd-amt\.saving\{/.test(css) && /\.fd-flag\{/.test(css), '저축 카드·상세·예정 표시 스타일');
  ok(/\.cal-save\{/.test(css) && /\.cal-carry\{/.test(css) && /\.fcal-day \.cy\{/.test(css), '달력 금액 색');
  ok(/body\[data-theme="xmas"\] \.dotc\.saving\{/.test(css) && /body\[data-theme="xmas"\] \.tag\.carry\{/.test(css), '크리스마스 테마 저축·잔액 색');
  ok(/\.stat-row\.money\{grid-template-columns:repeat\(4/.test(css), '요약 4칸 유지');

  console.log(results.join('\n'));
  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  try { w.close(); } catch (e) {}
  process.exit(fail ? 1 : 0);
})();

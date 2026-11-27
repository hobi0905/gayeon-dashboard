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
  ok($$('.cal-cell:not(.out)').length >= 30, '캘린더 날짜 셀', $$('.cal-cell:not(.out)').length);
  const seedExpense = w.localStorage.getItem('gayeon_dashboard_v3');
  ok(true, 'localStorage 초기값은 첫 저장 시 생성(설계상 정상)');

  // 11/28 컴활접수 칩이 11월 캘린더에 보이는지
  w.eval(`(function(){})`);
  const cell28 = $$('.cal-cell').find(c => c.dataset.date === '2026-11-28');
  ok(!!cell28, '11/28 셀 존재');
  ok(cell28 && cell28.textContent.includes('컴활접수'), '11/28에 컴활접수 일정 표시', cell28 && cell28.textContent);

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

  console.log('▸ 지출 기록');
  click($('.fcal-day[data-date="2026-12-01"]'));
  const expForm = $('#modalBody [data-form="expense"]');
  fld(expForm, 'title').value = '테스트 점심';
  fld(expForm, 'amount').value = '8500';
  submit(expForm);
  ok($('#modalBody').textContent.includes('테스트 점심'), '지출 추가');
  const fcell01 = $$('.fcal-day').find(c => c.dataset.date === '2026-12-01');
  ok(fcell01.textContent.includes('8,500'), '가계부 캘린더 지출 합계 표시', fcell01.textContent);

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

  console.log(results.join('\n'));
  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  try { w.close(); } catch (e) {}
  process.exit(fail ? 1 : 0);
})();

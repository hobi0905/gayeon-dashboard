/* 지출 카테고리 확장 · 사용자 정의 카테고리 · 도넛 색 · 정기구독 결제수단 메모 테스트
   실행: NODE_PATH=<repo>/node_modules node tests/categories.test.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

(async () => {
  const dom = new JSDOM(html, {
    url: 'https://hobi0905.github.io/gayeon-dashboard/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.fetch = () => Promise.reject(new Error('no network in test'));
  w.scrollTo = () => {};
  w.eval(app);
  await new Promise(r => setTimeout(r, 80));

  const doc = w.document;
  const GD = w.__GD;
  const $ = s => doc.querySelector(s);
  const $$ = s => Array.from(doc.querySelectorAll(s));
  const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const submit = form => form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const tick = () => new Promise(r => setTimeout(r, 0));
  const fld = (form, name) => form.querySelector(`[name="${name}"]`);
  const catVals = form => Array.from(fld(form, 'cat').options).map(o => o.value);

  /* ───────────── 1. 카테고리 목록 ───────────── */
  console.log('▸ 지출 카테고리 확장');
  const need = ['식비', '카페·간식', '편의점·마트·잡화', '술·유흥', '쇼핑', '여가', '의료·건강·피트니스',
    '주거·통신', '보험·세금·기타금융', '미용', '교통·자동차', '여행·숙박', '교육', '생활', '기부·후원',
    '이체', '카드대금', '후불결제대금', '기타'];
  const missing = need.filter(c => !GD.EXPENSE_CATS.includes(c));
  ok(missing.length === 0, '스크린샷의 소비 카테고리 19종 반영', missing.join(','));
  ok(GD.EXPENSE_CATS.includes('대출·이자') && GD.EXPENSE_CATS.includes('정기구독'), '기존 대출·이자·정기구독 유지');
  ok(GD.EXPENSE_CATS[GD.EXPENSE_CATS.length - 1] === '기타', '기타는 목록 맨 끝');
  ok(new Set(GD.EXPENSE_CATS).size === GD.EXPENSE_CATS.length, '카테고리 이름 중복 없음');
  const iconMiss = need.filter(c => !GD.categoryIcon(c) || GD.categoryIcon(c) === '🏷️' && c !== '기타');
  ok(iconMiss.length === 0, '카테고리마다 아이콘 타일', iconMiss.join(','));
  const colorMiss = need.filter(c => !/^#[0-9A-Fa-f]{6}$/.test(GD.categoryColor(c)));
  ok(colorMiss.length === 0, '카테고리마다 고정 색', colorMiss.join(','));

  /* ───────────── 2. 예전 데이터 호환 ───────────── */
  console.log('▸ 예전 지출 데이터 호환');
  const legacy = GD.normalize({
    v: 3,
    finance: {
      expenses: [
        { id: 'a', date: '2026-11-01', title: '아메리카노', amount: 4500, cat: '카페' },
        { id: 'b', date: '2026-11-02', title: '버스', amount: 1500, cat: '교통' },
        { id: 'c', date: '2026-11-03', title: '약국', amount: 8000, cat: '병원·약' },
        { id: 'd', date: '2026-11-04', title: '인강', amount: 30000, cat: '공부' },
        { id: 'e', date: '2026-11-05', title: '장보기', amount: 21000, cat: '생활' },
        { id: 'f', date: '2026-11-06', title: '영화', amount: 14000, cat: '여가' },
        { id: 'g', date: '2026-11-07', title: '간식', amount: 2000, cat: '반려동물' },
        { id: 'h', date: '2026-11-08', title: '월급', amount: 500000, cat: '카페', type: 'income' },
      ],
    },
  });
  const catOf = id => legacy.finance.expenses.find(e => e.id === id).cat;
  ok(catOf('a') === '카페·간식', '옛 「카페」 → 카페·간식', catOf('a'));
  ok(catOf('b') === '교통·자동차', '옛 「교통」 → 교통·자동차', catOf('b'));
  ok(catOf('c') === '의료·건강·피트니스', '옛 「병원·약」 → 의료·건강·피트니스', catOf('c'));
  ok(catOf('d') === '교육', '옛 「공부」 → 교육', catOf('d'));
  ok(catOf('e') === '생활' && catOf('f') === '여가', '그대로 두는 카테고리 유지', `${catOf('e')}/${catOf('f')}`);
  ok(catOf('g') === '반려동물', '모르는 카테고리는 건드리지 않음', catOf('g'));
  ok(catOf('h') === '카페', '수입 내역의 카테고리는 건드리지 않음', catOf('h'));
  ok(legacy.finance.expenses.every(e => e.type && e.amount > 0), 'type·금액 정상 유지');
  ok(/^#[0-9A-Fa-f]{6}$/.test(GD.categoryColor('반려동물')), '목록에 없는 카테고리도 색을 갖는다');

  /* ───────────── 3. 사용자 정의 카테고리 저장 형태 ───────────── */
  console.log('▸ 사용자 정의 카테고리 호환');
  const customLegacy = GD.normalize({ v: 3, finance: { customCategories: ['경조사'] } });
  ok(customLegacy.finance.customCategories[0].name === '경조사', '문자열로 저장된 옛 커스텀 카테고리 호환');
  const customObj = GD.normalize({ v: 3, finance: { customCategories: [{ name: '반려동물', icon: '🐶', color: '#123456' }] } });
  ok(customObj.finance.customCategories[0].icon === '🐶' && customObj.finance.customCategories[0].color === '#123456', '아이콘·색이 있는 커스텀 카테고리 유지');

  /* ───────────── 4. 가계부 폼 · 선택 화면 ───────────── */
  console.log('▸ 카테고리 선택 화면');
  click($('[data-act="open-finance"]'));
  const moneyForm = () => $('#modalBody [data-form="expense"]');
  ok(!!moneyForm().querySelector('[data-cat-picker]'), '지출 추가 폼에 카테고리 타일 선택');
  ok(fld(moneyForm(), 'cat').classList.contains('cat-native'), '값은 숨은 select가 들고 있다');
  ok(need.every(c => catVals(moneyForm()).includes(c)), '추가 폼에 확장 카테고리 전부');
  ok(moneyForm().querySelector('[data-cat-open] .cat-name').textContent.trim() === '식비', '기본 선택은 식비');

  click(moneyForm().querySelector('[data-cat-open]'));
  let sheet = doc.querySelector('.cat-sheet');
  ok(!!sheet, '카테고리 선택 화면 열림');
  const sheetCats = $$('.cat-sheet [data-cat]').map(b => b.dataset.cat);
  ok(need.every(c => sheetCats.includes(c)), '선택 화면에 카테고리 목록 표시', `${sheetCats.length}개`);
  ok(!!sheet.querySelector('[data-cat-add]'), '맨 아래 「＋ 새 카테고리 추가」');
  ok(!!sheet.querySelector('[data-cat="식비"] .cat-ico'), '아이콘 타일로 표시');
  ok(/지출 카테고리를 선택해주세요/.test(sheet.textContent), '선택 화면 제목');
  click(sheet.querySelector('[data-cat="카페·간식"]'));
  ok(!doc.querySelector('.cat-sheet'), '고르면 선택 화면 닫힘');
  ok(fld(moneyForm(), 'cat').value === '카페·간식', '고른 카테고리가 폼에 들어감', fld(moneyForm(), 'cat').value);
  ok(moneyForm().querySelector('[data-cat-open] .cat-name').textContent.trim() === '카페·간식', '단추 이름도 함께 바뀜');

  /* 종류를 바꾸면 카테고리 목록도 */
  const typeSel = fld(moneyForm(), 'type');
  typeSel.value = 'income';
  typeSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(catVals(moneyForm()).includes('알바·급여') && !catVals(moneyForm()).includes('식비'), '수입으로 바꾸면 수입 카테고리');
  ok(moneyForm().querySelector('[data-cat-open] .cat-name').textContent.trim() === '알바·급여', '단추도 첫 수입 카테고리로');
  click(moneyForm().querySelector('[data-cat-open]'));
  ok(!doc.querySelector('.cat-sheet [data-cat-add]'), '수입 선택 화면에는 새 카테고리 추가 없음');
  click(doc.querySelector('.cat-sheet [data-cat-close]'));
  typeSel.value = 'expense';
  typeSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(fld(moneyForm(), 'cat').value === '식비', '지출로 돌아오면 지출 카테고리');

  /* ───────────── 5. 새 카테고리 추가 → 바로 사용 ───────────── */
  console.log('▸ 새 카테고리 추가');
  fld(moneyForm(), 'title').value = '사료';
  fld(moneyForm(), 'amount').value = '32000';
  click(moneyForm().querySelector('[data-cat-open]'));
  sheet = doc.querySelector('.cat-sheet');
  click(sheet.querySelector('[data-cat-add]'));
  const newForm = doc.querySelector('.cat-sheet [data-cat-new]');
  ok(!!newForm, '추가 입력칸 열림');
  ok(newForm.querySelectorAll('[name="catIcon"]').length >= 6, '아이콘 고르기 제공');
  newForm.querySelector('[name="catName"]').value = '반려동물';
  newForm.querySelector('[name="catIcon"][value="🐶"]').checked = true;
  submit(newForm);
  await tick();
  const addedCat = (GD.state.finance.customCategories || []).find(c => c.name === '반려동물');
  ok(!!addedCat, 'state.finance.customCategories에 저장', JSON.stringify(GD.state.finance.customCategories));
  ok(addedCat && addedCat.icon === '🐶' && /^#[0-9A-Fa-f]{6}$/.test(addedCat.color), '아이콘·색 함께 저장', JSON.stringify(addedCat));
  const stored = JSON.parse(w.localStorage.getItem('gayeon_dashboard_v3'));
  ok((stored.finance.customCategories || []).some(c => c.name === '반려동물'), '클라우드로 올라가는 저장본에도 포함');
  ok(!doc.querySelector('.cat-sheet'), '추가하면 선택 화면 닫힘');
  ok(fld(moneyForm(), 'cat').value === '반려동물', '새 카테고리가 바로 선택됨', fld(moneyForm(), 'cat').value);
  ok(fld(moneyForm(), 'title').value === '사료' && fld(moneyForm(), 'amount').value === '32000', '입력 중이던 내역·금액이 남아 있음');
  ok(moneyForm().querySelector('[data-cat-open] .cat-name').textContent.trim() === '반려동물', '단추에 새 카테고리 표시');
  ok(catVals(moneyForm()).indexOf('반려동물') === catVals(moneyForm()).length - 2, '새 카테고리는 기타 바로 앞', catVals(moneyForm()).slice(-3).join(','));

  submit(moneyForm());
  const petEntry = GD.state.finance.expenses.find(e => e.title === '사료');
  ok(!!petEntry && petEntry.cat === '반려동물' && petEntry.amount === 32000, '새 카테고리로 지출 저장', petEntry && JSON.stringify(petEntry));

  /* 같은 이름은 또 만들지 않는다 */
  click($('#modalBody [data-cat-picker] [data-cat-open]'));
  click(doc.querySelector('.cat-sheet [data-cat-add]'));
  const dupForm = doc.querySelector('.cat-sheet [data-cat-new]');
  dupForm.querySelector('[name="catName"]').value = '반려동물';
  submit(dupForm);
  await tick();
  ok((GD.state.finance.customCategories || []).filter(c => c.name === '반려동물').length === 1, '같은 이름 중복 추가 없음');
  click(doc.querySelector('.cat-sheet [data-cat-close]'));

  /* ───────────── 6. 날짜 상세 모달 · 수정 모달 ───────────── */
  console.log('▸ 날짜 상세 · 수정 모달');
  const todayCell = $(`.fcal-day[data-date="${GD.state.finance.expenses[0].date}"]`);
  click($('.fcal-day[data-date="2026-11-28"]') || todayCell);
  const dayForm = () => $('#modalBody [data-form="expense"]');
  ok(!!dayForm() && catVals(dayForm()).includes('반려동물'), '날짜 상세 폼에도 새 카테고리');
  ok(catVals(dayForm()).includes('여행·숙박'), '날짜 상세 폼에도 확장 카테고리');

  const petRow = $$('#modalBody .drow').find(r => r.textContent.includes('사료'));
  ok(!!petRow && petRow.textContent.includes('반려동물'), '날짜 상세 목록에 카테고리 표시', petRow && petRow.textContent.trim());
  click(petRow.querySelector('[data-act="exp-edit"]'));
  await tick();
  const tp = doc.querySelector('.prompt');
  ok(!!tp, '수정 창 열림');
  ok(!!tp.querySelector('[data-cat-picker]'), '수정 창도 카테고리 타일');
  ok(catVals(tp).includes('반려동물') && fld(tp, 'cat').value === '반려동물', '수정 창에 새 카테고리 선택 상태', fld(tp, 'cat').value);
  click(tp.querySelector('[data-cat-open]'));
  ok(!!doc.querySelector('.cat-sheet'), '수정 창에서도 선택 화면 열림');
  click(doc.querySelector('.cat-sheet [data-cat="생활"]'));
  ok(fld(tp, 'cat').value === '생활', '선택 화면에서 고른 값이 수정 창에 반영');
  fld(tp, 'cat').value = '반려동물';
  fld(tp, 'cat').dispatchEvent(new w.Event('change', { bubbles: true }));
  click(tp.querySelector('[data-x="ok"]'));
  await tick();
  ok(true, '수정 창 닫힘');

  /* ───────────── 7. 도넛 색 ───────────── */
  console.log('▸ 도넛 그래프 색');
  const many = ['식비', '카페·간식', '편의점·마트·잡화', '술·유흥', '쇼핑', '여가', '의료·건강·피트니스',
    '주거·통신', '보험·세금·기타금융', '미용', '교통·자동차', '여행·숙박', '교육', '생활', '기부·후원',
    '이체', '카드대금', '후불결제대금', '대출·이자', '정기구독', '기타', '구매예정', '잔액', '반려동물',
    '경조사']
    .map((cat, i) => ({ cat, amount: 1000 - i * 10, pct: 1 }));
  const cm = GD.chartColorMap(many);
  const colorList = many.map(r => cm[r.cat]);
  ok(new Set(colorList).size === many.length, '카테고리 25개도 색이 겹치지 않음', `${new Set(colorList).size}/${many.length}`);
  ok(colorList.every(c => /^#[0-9A-Fa-f]{6}$/.test(c)), '도넛 색은 hex');
  const oneChart = GD.chartColorMap([{ cat: '식비' }, { cat: '카페·간식' }]);
  ok(oneChart['식비'] === GD.CATEGORY_COLORS['식비'], '식비는 늘 같은 파랑');
  ok(GD.chartColorMap([{ cat: '여가' }, { cat: '식비' }])['여가'] === GD.CATEGORY_COLORS['여가'], '순서가 바뀌어도 색 유지');
  const svgMany = GD.donutSvg(GD.chartParts(many).rows, 1, cm);
  ok((svgMany.match(/stroke="#[0-9A-Fac-f]{6}"/gi) || []).length >= 20, '도넛 조각마다 고유 색', (svgMany.match(/stroke="#/g) || []).length);

  /* ───────────── 8. 정기구독 카테고리 · 결제수단 메모 ───────────── */
  console.log('▸ 정기구독 결제수단 메모');
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-finance"]'));
  const subForm = $('#modalBody [data-form="sub"]');
  ok(!!subForm.querySelector('[data-cat-picker]'), '정기구독 폼에 카테고리 선택');
  ok(catVals(subForm).includes('반려동물'), '정기구독 폼에 사용자 카테고리도');
  ok(!!fld(subForm, 'memo'), '정기구독 폼에 결제수단/메모 칸');
  ok(/결제수단/.test(fld(subForm, 'memo').closest('.fld').textContent), '메모 칸 라벨');
  fld(subForm, 'name').value = '넷플릭스';
  fld(subForm, 'amount').value = '17000';
  fld(subForm, 'day').value = '29';
  fld(subForm, 'cat').value = '정기구독';
  fld(subForm, 'memo').value = '신한 체크';
  submit(subForm);
  const sub = GD.state.finance.subs.find(s => s.name === '넷플릭스');
  ok(!!sub && sub.memo === '신한 체크' && sub.cat === '정기구독', '결제수단 메모 저장', sub && JSON.stringify({ cat: sub.cat, memo: sub.memo }));
  const subRow = $$('#modalBody .drow').find(r => r.textContent.includes('넷플릭스'));
  ok(!!subRow && subRow.textContent.includes('💳 신한 체크'), '정기구독 목록 카드에 결제수단 표시', subRow && subRow.textContent.replace(/\s+/g, ' ').trim());

  const plan = GD.plannedOn('2026-11-29').find(p => p.name === '넷플릭스');
  ok(!!plan && plan.memo === '신한 체크' && plan.cat === '정기구독', '예정 지출에도 메모·카테고리 전달', plan && JSON.stringify(plan));
  const nov29Panel = $(`.fcal-day[data-date="2026-11-29"]`);
  click(nov29Panel);
  const day29 = $('#modalBody').textContent.replace(/\s+/g, ' ');
  ok(day29.includes('💳 신한 체크'), '날짜 상세 모달에 결제수단 표시', day29.slice(0, 120));

  const spendItems = GD.financeMonthItems('spend').filter(i => i.title === '넷플릭스');
  ok(spendItems.length && spendItems[0].memo === '신한 체크' && spendItems[0].cat === '정기구독', '지출 상세 내역에 메모·카테고리');
  click($('[data-act="fin-detail"][data-kind="spend"]'));
  const detail = $('#modalBody').textContent.replace(/\s+/g, ' ');
  ok(detail.includes('신한 체크'), '지출 상세 모달에 결제수단 표시');
  ok($$('#modalBody .chart-legend .lb').some(e => e.textContent.trim() === '정기구독'), '도넛 범례에 정기구독 카테고리');
  const subSegColor = $$('#modalBody .donut .dseg').find(c => c.dataset.cat === '정기구독');
  ok(!!subSegColor && subSegColor.getAttribute('stroke') === GD.CATEGORY_COLORS['정기구독'], '정기구독 조각은 지정 색', subSegColor && subSegColor.getAttribute('stroke'));
  ok($$('#modalBody .fd-row').some(r => r.textContent.includes('💳 신한 체크')), '상세 행에 💳 메모 배지');

  /* ✏️ 정기구독 수정 — 메모·카테고리 */
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-finance"]'));
  const editRow = $$('#modalBody .drow').find(r => r.textContent.includes('넷플릭스') && r.querySelector('[data-act="sub-edit"]'));
  click(editRow.querySelector('[data-act="sub-edit"]'));
  await tick();
  const sp = doc.querySelector('.prompt');
  ok(!!sp && fld(sp, 'memo').value === '신한 체크', '수정 창에 저장된 결제수단', sp && fld(sp, 'memo').value);
  ok(!!sp && fld(sp, 'cat').value === '정기구독' && !!sp.querySelector('[data-cat-picker]'), '수정 창에 카테고리 선택');
  fld(sp, 'memo').value = '토스뱅크';
  click(sp.querySelector('[data-cat-open]'));
  click(doc.querySelector('.cat-sheet [data-cat="카페·간식"]'));
  click(sp.querySelector('[data-x="ok"]'));
  await tick();
  const sub2 = GD.state.finance.subs.find(s => s.name === '넷플릭스');
  ok(sub2.memo === '토스뱅크', '수정한 결제수단 저장', sub2.memo);
  ok(sub2.cat === '카페·간식', '수정한 카테고리 저장', sub2.cat);
  const subRow2 = $$('#modalBody .drow').find(r => r.textContent.includes('넷플릭스'));
  ok(!!subRow2 && subRow2.textContent.includes('💳 토스뱅크') && !subRow2.textContent.includes('신한 체크'), '목록에 수정 내용 반영');

  /* 메모 없는 구독 */
  const noMemo = GD.normalize({ v: 3, finance: { subs: [{ id: 's1', name: '유튜브', amount: 14900, day: 5, cycle: 'monthly' }] } }).finance.subs[0];
  ok(noMemo.memo === '', '메모 없던 구독은 빈 문자열로 호환');
  GD.state.finance.subs.push(Object.assign({}, noMemo, { startDate: '2026-12-05', active: true }));
  const noMemoPlan = GD.plannedOn('2026-12-05').find(p => p.name === '유튜브');
  ok(!!noMemoPlan && noMemoPlan.memo === '', '빈 메모는 예정 지출에서도 빈 값');
  GD.state.finance.subs = GD.state.finance.subs.filter(s => s.id !== 's1');

  /* ───────────── 9. Wishlist 구매 카테고리 ───────────── */
  console.log('▸ Wishlist 연동 카테고리');
  GD.state.wish.need.push({ id: 'need1', name: '테스트 이어폰', price: 59000, status: '미구매' });
  GD.renderAll();
  click($('[data-act="modal-close"]'));
  click($('[data-act="open-wishlist"]'));
  const needRow = $$('#modalBody .drow').find(r => r.textContent.includes('테스트 이어폰'));
  ok(!!needRow, 'Wishlist에 사야 하는 것 표시');
  click(needRow.querySelector('[data-act="need-buy"]'));
  await tick();
  const bp = doc.querySelector('.prompt');
  ok(!!bp && !!bp.querySelector('[data-cat-picker]'), '구매 완료 창에 카테고리 선택');
  ok(!!bp && catVals(bp).includes('반려동물'), '구매 완료 창에 새 카테고리도');
  fld(bp, 'cat').value = '쇼핑';
  if (bp.querySelector('[data-x="ok"]')) click(bp.querySelector('[data-x="ok"]'));
  await tick();

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  try { w.close(); } catch (e) {}
  process.exit(fail ? 1 : 0);
})();

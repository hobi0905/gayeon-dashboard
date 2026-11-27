/* 🏦 햇살론유스 대출 납부 자동 계산 테스트
   거치기간 은행별 이자 → 원금균등분할상환 전환, 가계부(15일·이번 달 지출·도넛·잔액 이월) 반영,
   📈 투자 모달의 🏦 부채현황 표시·수정·삭제를 확인합니다.
   실행: NODE_PATH=<repo>/node_modules node tests/loans.test.js  */
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
  else { fail++; results.push(`  ❌ ${name}${extra !== undefined ? ' — ' + extra : ''}`); }
}

(async () => {
  const dom = new JSDOM(html, {
    url: 'https://hobi0905.github.io/gayeon-dashboard/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.fetch = () => Promise.reject(new Error('no network in test'));
  w.scrollTo = () => {};
  w.eval(app);
  await new Promise(r => setTimeout(r, 80));

  const doc = w.document;
  const $ = s => doc.querySelector(s);
  const $$ = s => Array.from(doc.querySelectorAll(s));
  const click = el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); };
  const tick = () => new Promise(r => setTimeout(r, 0));
  const fld = (form, name) => form.querySelector(`[name="${name}"]`);
  const calText = el => (el ? el.textContent.replace(/\s+/g, ' ') : '');
  const G = w.__GD;
  const loans = () => G.state.finance.loans;
  const total = ym => G.loanMonthTotal(ym);
  const rowsOn = ym => G.loanRowsOn(G.loanDateIn(ym));
  const byRound = (ym, round) => rowsOn(ym).find(r => r.name.includes(`${round}회차`));

  console.log('▸ 시드 · 대출 5건');
  ok(loans() && Array.isArray(loans().rounds) && loans().rounds.length === 5, 'finance.loans.rounds 5건', loans() && loans().rounds && loans().rounds.length);
  ok(G.loanTotalPrincipal() === 12000000, '총 원금 1,200만 원', G.loanTotalPrincipal());
  ok(loans().payDay === 15 && loans().startMonth === '2026-12' && loans().deferEnd === '2028-11', '납부일 15일 · 2026.12 시작 · 거치 ~2028.11', JSON.stringify({ d: loans().payDay, s: loans().startMonth, e: loans().deferEnd }));
  ok(loans().deferCharges.reduce((s, c) => s + c.amount, 0) === 37000, '거치기간 은행별 이자 합계 37,000', JSON.stringify(loans().deferCharges));
  const r1 = loans().rounds[0];
  ok(r1.principal === 3000000 && r1.startDate === '2024-11-03' && r1.repayStart === '2028-12' && r1.months === 60, '1회차 = 300만 · 2024.11.03 실행 · 2028.12부터 60개월', JSON.stringify(r1));
  ok(G.loanRepayEnd(r1) === '2033-11' && G.loanRepayEnd(loans().rounds[4]) === '2037-01', '만기 계산(1회차 2033.11 · 5회차 2037.01)', [G.loanRepayEnd(r1), G.loanRepayEnd(loans().rounds[4])].join(' / '));

  console.log('▸ 거치기간 — 매달 15일 신한 19,000 + IBK 18,000');
  ok(total('2026-12') === 37000, '2026-12 월 합계 37,000', total('2026-12'));
  ok(total('2026-11') === 0, '2026-11(시작 전)에는 없음', total('2026-11'));
  ok(total('2028-11') === 37000, '거치 마지막 달 2028-11도 37,000', total('2028-11'));
  const dec15 = G.plannedOn('2026-12-15');
  ok(dec15.length === 2, '12/15 예정 항목 2건', dec15.map(p => p.name).join(','));
  ok(dec15.some(p => p.name === '햇살론유스 이자 (신한은행)' && p.amount === 19000), '신한은행 이자 19,000', JSON.stringify(dec15));
  ok(dec15.some(p => p.name === '햇살론유스 이자 (IBK은행)' && p.amount === 18000), 'IBK은행 이자 18,000', JSON.stringify(dec15));
  ok(dec15.every(p => p.cat === '대출·이자' && p.loan === true), '카테고리 = 대출·이자(자동)', JSON.stringify(dec15.map(p => p.cat)));
  ok(G.plannedOn('2026-12-14').length === 0 && G.plannedOn('2026-12-16').length === 0, '15일이 아니면 붙지 않음');

  console.log('▸ 2028-12 — 1회차 본상환 전환');
  const dec28 = byRound('2028-12', 1);
  ok(!!dec28 && dec28.amount === 60000, '1회차 첫 상환 = 원금 50,000 + 이자 10,000', dec28 && dec28.amount);
  ok(!!dec28 && dec28.principal === 50000 && dec28.interest === 10000, '1회차 원금·이자 분리 계산', dec28 && `${dec28.principal}/${dec28.interest}`);
  const dec28defer = [2, 3, 4, 5].map(n => byRound('2028-12', n));
  ok(dec28defer.every(r => r && r.kind === '거치기간 이자'), '2~5회차는 아직 거치기간 이자', dec28defer.map(r => r && r.kind).join(','));
  ok(dec28defer.map(r => r.amount).join(',') === '16667,3333,5667,4333', '거치 회차 이자 = 원금 × 4% ÷ 12', dec28defer.map(r => r.amount).join(','));
  ok(total('2028-12') === 90000, '2028-12 월 합계 90,000', total('2028-12'));

  console.log('▸ 2030-02 — 5건 모두 원금상환 중');
  const all30 = [1, 2, 3, 4, 5].map(n => byRound('2030-02', n));
  ok(all30.every(r => r && r.kind !== '거치기간 이자'), '5건 모두 원금+이자 상환', all30.map(r => r && r.name).join(' / '));
  ok(all30.map(r => r.amount).join(',') === '57667,73611,14961,25771,19810', '회차별 납부액', all30.map(r => r.amount).join(','));
  ok(total('2030-02') === 191820, '2030-02 월 합계 191,820', total('2030-02'));
  ok(all30.map(r => r.interest).join(',') === '7667,14087,3056,5532,4333', '이자 = 남은 원금 × 4% ÷ 12 (반올림)', all30.map(r => r.interest).join(','));
  ok(all30.map(r => r.principal).join(',') === '50000,59524,11905,20239,15477', '월 원금 = 원금 ÷ 개월수 (나머지는 앞 달부터)', all30.map(r => r.principal).join(','));

  console.log('▸ 만기 · 완납');
  ok(total('2037-01') === 15528, '2037-01 5회차 마지막 납부 15,528', total('2037-01'));
  ok(total('2037-02') === 0 && rowsOn('2037-02').length === 0, '완납 뒤(2037-02)는 0원', total('2037-02'));
  ok(total('2033-12') > 0 && !byRound('2033-12', 1), '1회차는 만기(2033-11) 뒤로 사라짐', total('2033-12'));

  console.log('▸ 원금균등분할 불변식');
  let sumBad = [];
  loans().rounds.forEach(l => {
    let p = 0, n = 0, ym = l.repayStart;
    for (let k = 0; k < 200; k++) {
      const c = G.loanChargeAt(l, ym);
      if (!c) break;
      if (c.status === 'repay') { p += c.principal; n++; }
      const [yy, mm] = ym.split('-').map(Number);
      const d = new Date(yy, mm, 1);
      ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    if (p !== l.principal || n !== l.months) sumBad.push(`${l.round}:${p}/${l.principal},${n}`);
  });
  ok(sumBad.length === 0, '회차별 원금 합계 = 원금, 개월수 일치', sumBad.join(' '));
  ok(G.loanRemaining(loans().rounds[0], '2026-11') === 3000000 && G.loanRemaining(loans().rounds[0], '2033-12') === 0, '남은 원금: 거치 중엔 그대로 · 완납 뒤 0');

  console.log('▸ 가계부 반영 — 15일 · 이번 달 지출 · 도넛 · 잔액 이월');
  const FIN = G.state.finance;
  FIN.expenses = [{ id: 'lw1', date: '2026-12-01', title: '월급', amount: 1000000, cat: '알바·급여', type: 'income' }];
  FIN.subs = []; FIN.planned = [];
  click($('[data-act="open-finance"]'));
  click($('[data-act="fin-today"]'));
  click($('[data-act="fin-next"]'));
  ok($('#finMonthLabel').textContent.includes('12월'), '가계부 2026년 12월로 이동', $('#finMonthLabel') && $('#finMonthLabel').textContent.trim().slice(0, 16));
  const st = G.financeStats();
  ok(st.loan === 37000 && st.planned === 37000, '이번 달 지출에 대출 37,000 반영', JSON.stringify({ loan: st.loan, planned: st.planned }));
  ok(st.spent === 0 && st.spendTotal === 37000, '실제 지출 0 + 대출 37,000 = 지출 카드 37,000', JSON.stringify(st));
  ok(st.income === 1000000 && st.balance === 963000, '남은 돈 = 1,000,000 − 37,000', JSON.stringify({ income: st.income, balance: st.balance }));
  ok(/−₩37,000/.test(calText($('#modalBody .stat.spend .v'))), '이번 달 지출 카드 −₩37,000', calText($('#modalBody .stat.spend')));
  ok(/대출 37,000 포함/.test(calText($('#modalBody .stat.spend'))), '카드에 「대출 포함」 안내', calText($('#modalBody .stat.spend')));
  ok(!calText($('#modalBody')).includes('부채현황'), '가계부 모달에는 부채현황을 두지 않음(투자 탭으로 분리)');
  const cell15 = $$('.fcal-day').find(c => c.dataset.date === '2026-12-15');
  ok(!!cell15 && /-37,000/.test(calText(cell15)), '가계부 달력 12/15에 −37,000', calText(cell15));
  click(cell15);
  const dayRows = $$('#modalBody .drow').filter(r => r.textContent.includes('햇살론유스'));
  ok(dayRows.length === 2, '12/15 날짜 상세에 대출 2건', dayRows.length);
  ok(dayRows.every(r => /−₩(19,000|18,000)/.test(calText(r))), '날짜 상세 금액 −₩19,000 / −₩18,000', dayRows.map(r => calText(r)).join(' | '));
  ok(calText($('#modalBody')).includes('예정 −₩37,000'), '날짜 요약줄에 예정 −₩37,000', calText($('#modalBody')).slice(0, 120));
  const spendItems = G.financeMonthItems('spend');
  ok(spendItems.length === 2 && spendItems.every(i => i.cat === '대출·이자' && i.loan && i.planned), '지출 상세 2건 · 카테고리 대출·이자', JSON.stringify(spendItems));
  click($('#modalBody .stat.spend'));
  ok(/지출 상세/.test($('#modalTitle').textContent), '지출 카드 → 상세 팝업', $('#modalTitle').textContent);
  ok($$('#modalBody .chart-legend .lb').some(e => e.textContent.trim() === '대출·이자'), '도넛 범례에 대출·이자', $$('#modalBody .chart-legend .lb').map(e => e.textContent.trim()).join(','));
  ok(/대출·이자 100%/.test(calText($('#modalBody'))), '도넛 비중 대출·이자 100%', calText($('#modalBody')).slice(0, 140));
  ok($$('#modalBody .fd-flag.auto').length === 2 && /대출 상환 포함\(15일 자동\)/.test(calText($('#modalBody'))), '상세에 「대출」 표시 + 안내', calText($('#modalBody')).slice(0, 160));
  click($('[data-act="modal-close"]'));
  ok(G.carryoverAmount(2027, 1) === 963000, '12월 잔액 963,000이 1월 1일로 이월', G.carryoverAmount(2027, 1));
  ok(G.carryoverOn('2027-01-01') === 963000, '1월 1일 잔액 행 값', G.carryoverOn('2027-01-01'));
  click($('[data-act="fin-next"]'));
  const jan1 = $$('.fcal-day').find(c => c.dataset.date === '2027-01-01');
  ok(!!jan1 && calText(jan1).includes('963,000'), '가계부 1월 1일 칸에 잔액 963,000', calText(jan1));
  click($('[data-act="modal-close"]'));

  /* 홈 달력 15일 */
  click($('[data-act="cal-next"]'));
  const home15 = $$('.cal-grid:not(#calxGrid) .cal-cell').find(c => c.dataset.date === '2026-12-15');
  ok(!!home15 && /−₩37,000/.test(calText(home15)), '홈 달력 12/15에 대출 예정 −₩37,000', calText(home15));
  click($('[data-act="cal-prev"]'));

  console.log('▸ 📈 투자 모달 · 🏦 부채현황');
  const invBtn = $$('.nav-btn').find(b => b.querySelector('.nav-label').textContent.trim() === '투자');
  click(invBtn);
  const inv = calText($('#modalBody'));
  ok($('#modalTitle').textContent.includes('투자'), '투자 탭 → 모달', $('#modalTitle').textContent);
  ok(inv.includes('부채현황') && inv.includes('🏦'), '부채현황 섹션', inv.slice(0, 80));
  ok(inv.includes('총 원금 ₩12,000,000'), '총 부채 원금 1,200만 원', inv.match(/총 원금[^ ]* [₩0-9,]+/) || '');
  ok(/(이번 달|다음) 납부/.test(inv) && inv.includes('₩37,000'), '이번 달(또는 다음) 납부액 37,000', inv.match(/(이번 달|다음) 납부[^가-힣]*/) || '');
  ok(inv.includes('₩12,000,000') && inv.includes('남은 원금'), '남은 원금 표시', '');
  ok(inv.includes('첫 원금상환') && inv.includes('2028.12'), '첫 원금상환 2028.12', '');
  const cards = $$('#modalBody .loan-card[data-loan]');
  ok(cards.length === 5, '회차 카드 5개', cards.length);
  const card1 = calText(cards[0]);
  ok(card1.includes('1회차') && card1.includes('₩3,000,000') && card1.includes('연 4.0%'), '1회차 원금·금리', card1.slice(0, 60));
  ok(card1.includes('2024.11.03'), '1회차 대출일 2024.11.03', card1.slice(0, 120));
  ok(card1.includes('2028.12') && card1.includes('2033.11'), '1회차 원금상환 시작·만기', card1.slice(0, 160));
  ok(card1.includes('거치 중'), '1회차 상태 = 거치 중', card1.slice(0, 80));
  ok(calText(cards[4]).includes('2030.02') && calText(cards[4]).includes('2037.01'), '5회차 원금상환 시작 2030.02 · 만기 2037.01', calText(cards[4]).slice(0, 160));
  const deferCard = calText($('#modalBody .loan-defer-card'));
  ok(deferCard.includes('거치기간 이자') && deferCard.includes('₩37,000'), '거치기간 이자 월 37,000 카드', deferCard.slice(0, 80));
  ok(deferCard.includes('신한은행') && deferCard.includes('19,000') && deferCard.includes('IBK은행') && deferCard.includes('18,000'), '은행별 거치 이자 19,000/18,000', deferCard);
  ok(inv.includes('15일') && inv.includes('원금균등분할상환'), '납부일·상환 방식 안내', '');
  ok(!inv.includes('가계부 캘린더'), '투자 모달에 가계부 캘린더 없음');

  console.log('▸ 부채현황 수정 · 삭제');
  click(cards[0].querySelector('[data-act="loan-edit"]'));
  await tick();
  const pr = doc.querySelector('.prompt');
  ok(!!pr && /1회차 대출 수정/.test(pr.textContent), '1회차 수정 창', pr && pr.textContent.slice(0, 30));
  ok(!!pr && fld(pr, 'principal').value === '3000000' && fld(pr, 'repayStart').value === '2028-12', '현재 값이 채워짐', pr && [fld(pr, 'principal').value, fld(pr, 'repayStart').value].join('/'));
  fld(pr, 'principal').value = '3600000';
  click(pr.querySelector('[data-x="ok"]'));
  await tick();
  ok(loans().rounds[0].principal === 3600000, '원금 수정 저장', loans().rounds[0].principal);
  ok(total('2028-12') === 102000, '수정 후 2028-12 재계산 = 72,000(1회차) + 30,000', total('2028-12'));
  ok(calText($('#modalBody')).includes('₩3,600,000'), '카드에 수정된 원금', calText($('#modalBody')).slice(0, 80));
  /* 되돌리기 */
  const c1 = $$('#modalBody .loan-card[data-loan]')[0];
  click(c1.querySelector('[data-act="loan-edit"]'));
  await tick();
  const pr2 = doc.querySelector('.prompt');
  fld(pr2, 'principal').value = '3000000';
  click(pr2.querySelector('[data-x="ok"]'));
  await tick();
  ok(loans().rounds[0].principal === 3000000 && total('2028-12') === 90000, '되돌리면 다시 90,000', total('2028-12'));

  click($('#modalBody .loan-defer-card [data-act="loan-defer-edit"]'));
  await tick();
  const pr3 = doc.querySelector('.prompt');
  ok(!!pr3 && /거치기간 이자 수정/.test(pr3.textContent), '거치 이자 수정 창');
  fld(pr3, 'amount').value = '20000';
  click(pr3.querySelector('[data-x="ok"]'));
  await tick();
  ok(total('2026-12') === 38000, '거치 이자 수정 → 2026-12 38,000', total('2026-12'));
  click($('#modalBody .loan-defer-card [data-act="loan-defer-edit"]'));
  await tick();
  const pr4 = doc.querySelector('.prompt');
  fld(pr4, 'amount').value = '19000';
  click(pr4.querySelector('[data-x="ok"]'));
  await tick();
  ok(total('2026-12') === 37000, '되돌리면 37,000', total('2026-12'));

  const cards2 = $$('#modalBody .loan-card[data-loan]');
  click(cards2[4].querySelector('[data-act="loan-del"]'));
  await tick();
  ok(loans().rounds.length === 4 && !loans().rounds.some(l => l.round === 5), '5회차 삭제', loans().rounds.length);
  ok(total('2037-01') === 0, '삭제한 회차 납부 사라짐', total('2037-01'));

  console.log('▸ 저장값 호환 (loans 없던 기존 데이터)');
  const old = G.normalize({ v: 3, finance: { expenses: [{ id: 'e1', date: '2026-11-10', title: '커피', amount: 4000, cat: '카페', type: 'expense' }] } });
  ok(old.finance.loans.rounds.length === 5 && old.finance.expenses.length === 1, 'loans 없던 저장값 → 시드 5건 추가 · 기존 내역 유지', JSON.stringify({ n: old.finance.loans.rounds.length, e: old.finance.expenses.length }));
  const cleared = G.normalize({ v: 3, finance: { loans: { rounds: [], deferCharges: [] } } });
  ok(cleared.finance.loans.rounds.length === 0 && cleared.finance.loans.deferCharges.length === 0, '직접 비운 대출은 다시 채우지 않음', JSON.stringify(cleared.finance.loans));
  const partial = G.normalize({ v: 3, finance: { loans: { rounds: [{ id: 'x', round: 1, principal: 1000000, repayStart: '2030-01', repayEnd: '2030-12', startDate: '2029-01-01' }] } } });
  ok(partial.finance.loans.rounds[0].months === 12 && partial.finance.loans.rounds[0].repayEnd === '2030-12', '개월수 없던 회차는 상환 기간으로 보정', JSON.stringify(partial.finance.loans.rounds[0]));

  console.log(results.join('\n'));
  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  try { w.close(); } catch (e) {}
  process.exit(fail ? 1 : 0);
})();

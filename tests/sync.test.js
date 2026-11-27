/* 동기화 암호화 테스트: 코드 기반 AES-GCM 봉인/해제, 행 ID 결정성
   실행: NODE_PATH=<repo>/node_modules node tests/sync.test.js */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (x ? ' — ' + x : '')); } };

(async () => {
  const dom = new JSDOM(html, { url: 'https://hobi0905.github.io/gayeon-dashboard/', runScripts: 'outside-only' });
  const w = dom.window;
  Object.defineProperty(w, 'crypto', { value: crypto.webcrypto, configurable: true });
  Object.defineProperty(w, 'isSecureContext', { value: true, configurable: true });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.fetch = () => Promise.reject(new Error('offline'));
  w.eval(app);
  await new Promise(r => setTimeout(r, 80));

  const GD = w.__GD;
  ok(!!GD, '디버그 훅 노출');

  const sample = { hello: '안녕 🩵', n: 42, nested: { arr: [1, 2, 3] } };
  const sealed = await GD.seal(sample, 'GAEYON-SKY-2026');
  ok(sealed && sealed.ct && sealed.s && sealed.iv, '봉인 결과에 salt·iv·ct 포함');
  ok(JSON.stringify(sealed).indexOf('안녕') === -1, '평문이 payload에 남지 않음');
  const opened = await GD.unseal(sealed, 'GAEYON-SKY-2026');
  ok(JSON.stringify(opened) === JSON.stringify(sample), '같은 코드로 복호화 성공');

  let threw = false;
  try { await GD.unseal(sealed, 'WRONG-CODE'); } catch (e) { threw = true; }
  ok(threw, '다른 코드로는 복호화 실패');

  const id1 = await GD.rowIdFor('GAEYON-SKY-2026');
  const id2 = await GD.rowIdFor('GAEYON-SKY-2026');
  const id3 = await GD.rowIdFor('OTHER-CODE');
  ok(id1 === id2, '같은 코드 → 같은 행 ID');
  ok(id1 !== id3, '다른 코드 → 다른 행 ID');
  ok(/^gayeon-dash-[0-9a-f]{16}$/.test(id1), '행 ID 형식', id1);

  const s1 = await GD.seal({ a: 1 }, 'CODE');
  const s2 = await GD.seal({ a: 1 }, 'CODE');
  ok(s1.ct !== s2.ct && s1.s !== s2.s, '매번 새 salt·iv (같은 내용도 다른 암호문)');

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  try { w.close(); } catch (e) {}
  process.exit(fail ? 1 : 0);
})();

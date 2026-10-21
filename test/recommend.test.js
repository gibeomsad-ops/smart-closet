import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsl, pairRules, colorName } from '../lib/color.js';
import { recommend, ruleForTemperature } from '../lib/recommend.js';

const names = (a, b) => pairRules(a, b).map((r) => r.name);

test('HEX → HSL', () => {
  const { h, s, l } = hexToHsl('#FF0000');
  assert.deepEqual([Math.round(h), Math.round(s), Math.round(l)], [0, 100, 50]);
});

test('색조합 규칙', () => {
  assert.deepEqual(names('#1F2A44', '#FFFFFF'), ['무채색 포함']);
  assert.deepEqual(names('#1F2A44', '#7A90C4'), ['톤온톤']);
  assert.deepEqual(names('#1F2A44', '#24304A'), []); // 같은 색상·비슷한 명도
  assert.deepEqual(names('#C62828', '#E07A1F'), ['유사색']);
  assert.deepEqual(names('#1F2A44', '#D8C3A5'), ['보색 포인트']);
  assert.deepEqual(names('#FF0000', '#00FFFF'), ['강한 보색 충돌']);
});

test('색 이름', () => {
  assert.equal(colorName('#1F2A44'), '네이비');
  assert.equal(colorName('#FFFFFF'), '화이트');
});

test('기온별 두께 규칙', () => {
  assert.deepEqual(ruleForTemperature(25).thickness, ['thin']);
  assert.equal(ruleForTemperature(20).outer, 'optional');
  assert.deepEqual(ruleForTemperature(12).thickness, ['medium']);
  assert.deepEqual(ruleForTemperature(7).thickness, ['medium', 'thick']);
  assert.deepEqual(ruleForTemperature(-3).thickness, ['thick']);
});

test('추천: 기온에 맞는 옷만, 점수순 상위 3개', () => {
  const c = (id, category, color_hex, thickness) => ({ id, category, color_hex, thickness, name: `#${id}` });
  const clothes = [
    c(1, 'top', '#FFFFFF', 'medium'), c(2, 'top', '#FF0000', 'medium'), c(3, 'top', '#1F2A44', 'thin'),
    c(4, 'bottom', '#00FFFF', 'medium'), c(5, 'bottom', '#1F2A44', 'medium'),
    c(6, 'outer', '#808080', 'medium'), c(7, 'shoes', '#111111', null),
  ];
  const { combos, warnings } = recommend(clothes, 12);
  assert.equal(combos.length, 3);
  // 신발은 두께와 상관없이 포함된다.
  assert.ok(combos.every((x) => x.outer?.id === 6 && x.top.id !== 3 && x.shoes?.id === 7));
  assert.ok(combos[0].score >= combos[1].score && combos[1].score >= combos[2].score);
  assert.equal(warnings.length, 0);

  const hot = recommend(clothes, 28);
  assert.equal(hot.combos.length, 0); // 얇은 하의가 없음
});

test('랜덤 코디: 규칙과 무관하게 종류별 1개, 상의·하의 없으면 null', async () => {
  const { randomOutfit, comboKey } = await import('../lib/recommend.js');
  const c = (id, category, thickness) => ({ id, category, thickness, color_hex: '#FF0000', name: `#${id}` });
  // 28°C에는 절대 추천되지 않을 두꺼운 옷들
  const clothes = [c(1, 'top', 'thick'), c(2, 'top', 'thick'), c(3, 'bottom', 'thick'), c(4, 'outer', 'thick'), c(5, 'shoes', null)];
  const r = randomOutfit(clothes);
  assert.equal(r.top.category, 'top');
  assert.equal(r.bottom.id, 3);
  assert.equal(r.outer.id, 4);
  assert.equal(r.shoes.id, 5);
  assert.equal(randomOutfit([c(1, 'top', 'thin')]), null);
  assert.equal(randomOutfit([c(1, 'top', 'thin'), c(3, 'bottom', 'thin')]).outer, null);

  // 고른 결과가 고르게 섞이는지 (상의 2개 중 둘 다 나와야 함)
  const seen = new Set(Array.from({ length: 50 }, () => randomOutfit(clothes).top.id));
  assert.deepEqual([...seen].sort(), [1, 2]);

  // exclude와 다른 조합을 고른다
  const first = randomOutfit(clothes, { rand: () => 0 });
  let n = 0;
  const seq = () => (n++ < 4 ? 0 : 0.99);
  const second = randomOutfit(clothes, { exclude: comboKey(first), rand: seq });
  assert.notEqual(comboKey(second), comboKey(first));
});

test('랜덤 코디 유지: 조합 키로 같은 코디를 다시 만들고, 옷이 없어지면 null', async () => {
  const { comboFromKey, comboKey } = await import('../lib/recommend.js');
  const c = (id, category) => ({ id, category, thickness: 'thin', color_hex: '#000000', name: `#${id}` });
  const clothes = [c(1, 'top'), c(2, 'bottom'), c(3, 'outer'), c(4, 'shoes')];
  const kept = comboFromKey('1|2||4', clothes);
  assert.equal(comboKey(kept), '1|2||4');
  assert.equal(kept.outer, null);
  assert.equal(comboFromKey('1|2|3|9', clothes), null); // 지운 신발
  assert.equal(comboFromKey('2|1||', clothes), null);   // 종류가 맞지 않음
  assert.equal(comboFromKey(undefined, clothes), null);
});

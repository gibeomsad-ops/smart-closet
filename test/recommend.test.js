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

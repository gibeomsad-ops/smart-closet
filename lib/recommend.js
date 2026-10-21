import { scoreItems } from './color.js';

// 기온별 두께 규칙. outer: none(제외) | optional(선택) | required(필요)
export function ruleForTemperature(temperature) {
  const t = Math.round(temperature);
  if (t >= 23) return { thickness: ['thin'], outer: 'none', label: '23°C 이상 · 얇은 옷' };
  if (t >= 17) return { thickness: ['thin', 'medium'], outer: 'optional', label: '17~22°C · 얇음/보통, 아우터 선택' };
  if (t >= 10) return { thickness: ['medium'], outer: 'required', label: '10~16°C · 보통, 아우터 필요' };
  if (t >= 5) return { thickness: ['medium', 'thick'], outer: 'required', label: '5~9°C · 보통/두꺼움, 아우터 필요' };
  return { thickness: ['thick'], outer: 'required', label: '4°C 이하 · 두꺼움, 아우터 필요' };
}

export function recommend(clothes, temperature, limit = 3) {
  const rule = ruleForTemperature(temperature);
  const fits = (c) => rule.thickness.includes(c.thickness);
  const pick = (category) => clothes.filter((c) => c.category === category && fits(c));

  const tops = pick('top');
  const bottoms = pick('bottom');
  const outers = pick('outer');
  // 신발은 두께가 없으므로 기온과 상관없이 모두 후보로 쓴다.
  const shoes = clothes.filter((c) => c.category === 'shoes');
  const warnings = [];

  if (!tops.length) warnings.push('기온에 맞는 상의가 없습니다.');
  if (!bottoms.length) warnings.push('기온에 맞는 하의가 없습니다.');
  if (!tops.length || !bottoms.length) return { rule, warnings, combos: [] };

  let outerOptions;
  if (rule.outer === 'none') outerOptions = [null];
  else if (rule.outer === 'optional') outerOptions = [null, ...outers];
  else if (outers.length) outerOptions = outers;
  else {
    warnings.push('아우터가 필요한 기온이지만 맞는 아우터가 없어 아우터 없이 추천합니다.');
    outerOptions = [null];
  }
  // 신발은 등록된 신발이 있을 때만 조합에 포함한다.
  const shoeOptions = shoes.length ? shoes : [null];

  const combos = [];
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const outer of outerOptions) {
        for (const shoe of shoeOptions) {
          const items = [top, bottom, outer, shoe].filter(Boolean);
          const { score, reasons } = scoreItems(items);
          combos.push({ top, bottom, outer, shoes: shoe, score, reasons });
        }
      }
    }
  }

  combos.sort((a, b) => b.score - a.score);
  return { rule, warnings, combos: combos.slice(0, limit) };
}

// 랜덤 코디: 기온·두께·색조합 규칙을 전혀 보지 않고 옷장 전체에서 종류별로 하나씩 무작위로 고른다.
// 상의·하의는 필수, 아우터·신발은 옷장에 있을 때만 넣는다.
// exclude(조합 키)와 같은 조합이 나오면 몇 번 다시 뽑는다. (다시 뽑기를 눌렀는데 그대로면 어색하므로)
export const comboKey = (c) => [c.top, c.bottom, c.outer, c.shoes].map((it) => (it ? String(it.id) : '')).join('|');

// 조합 키("상의|하의|아우터|신발" id)로 지금 옷장에서 같은 랜덤 코디를 다시 만든다.
// 옷이 지워졌거나 종류가 바뀌었으면 null. (화면을 옮겨 다녀도 랜덤 코디가 바뀌지 않게 하기 위함)
export function comboFromKey(key, clothes) {
  if (typeof key !== 'string') return null;
  const [topId, bottomId, outerId, shoesId] = key.split('|');
  const byId = new Map(clothes.map((c) => [String(c.id), c]));
  const get = (id, category) => {
    if (!id) return null;
    const item = byId.get(id);
    return item?.category === category ? item : undefined;
  };
  const combo = { top: get(topId, 'top'), bottom: get(bottomId, 'bottom'), outer: get(outerId, 'outer'), shoes: get(shoesId, 'shoes'), random: true };
  if (!combo.top || !combo.bottom || combo.outer === undefined || combo.shoes === undefined) return null;
  return combo;
}

export function randomOutfit(clothes, { exclude = null, rand = Math.random } = {}) {
  const byCategory = (category) => clothes.filter((c) => c.category === category);
  const tops = byCategory('top');
  const bottoms = byCategory('bottom');
  if (!tops.length || !bottoms.length) return null;
  const outers = byCategory('outer');
  const shoes = byCategory('shoes');
  const pick = (list) => (list.length ? list[Math.floor(rand() * list.length)] : null);

  let combo;
  for (let attempt = 0; attempt < 8; attempt++) {
    combo = { top: pick(tops), bottom: pick(bottoms), outer: pick(outers), shoes: pick(shoes), random: true };
    if (comboKey(combo) !== exclude) break;
  }
  return combo;
}

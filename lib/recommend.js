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
  const shoes = pick('shoes');
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
  // 신발은 기온에 맞는 신발이 있을 때만 조합에 포함한다.
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

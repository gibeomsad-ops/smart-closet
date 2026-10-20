// HEX ↔ HSL 변환, 색 이름 추정, 색조합 점수 계산 (서버와 브라우저에서 함께 사용)

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// h: 0~360, s: 0~100, l: 0~100
export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

// 색상환에서 두 색상의 각도 차이 (0~180)
export function hueDiff(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

const NAMED_COLORS = [
  ['블랙', '#111111'], ['차콜', '#36454F'], ['그레이', '#808080'],
  ['라이트그레이', '#D3D3D3'], ['화이트', '#FFFFFF'], ['아이보리', '#F5F0E1'],
  ['베이지', '#D8C3A5'], ['카멜', '#C19A6B'], ['브라운', '#6F4E37'],
  ['카키', '#5F6B3A'], ['올리브', '#808000'], ['네이비', '#1F2A44'],
  ['블루', '#2F6FD0'], ['데님', '#4A6FA5'], ['스카이블루', '#87CEEB'],
  ['그린', '#2E8B57'], ['민트', '#98E0C8'], ['레드', '#C62828'],
  ['버건디', '#800020'], ['핑크', '#F4A6C0'], ['오렌지', '#F28C28'],
  ['옐로우', '#F2D03B'], ['퍼플', '#6A4C9C'], ['라벤더', '#C8B6E2'],
].map(([name, hex]) => ({ name, rgb: hexToRgb(hex) }));

// 가장 가까운 대표 색 이름 (redmean 거리)
export function colorName(hex) {
  const { r, g, b } = hexToRgb(hex);
  let best = NAMED_COLORS[0];
  let bestDist = Infinity;
  for (const c of NAMED_COLORS) {
    const rm = (r + c.rgb.r) / 2;
    const dr = r - c.rgb.r, dg = g - c.rgb.g, db = b - c.rgb.b;
    const dist = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best.name;
}

// 두 색의 조합 규칙 판정. 적용된 규칙 목록을 반환한다.
export function pairRules(hexA, hexB) {
  const a = hexToHsl(hexA);
  const b = hexToHsl(hexB);

  // 무채색은 색상(hue) 값이 의미가 없으므로 다른 규칙은 보지 않는다.
  if (a.s < 15 || b.s < 15) return [{ name: '무채색 포함', score: 3 }];

  const d = hueDiff(a.h, b.h);
  if (d <= 15) {
    return Math.abs(a.l - b.l) >= 20 ? [{ name: '톤온톤', score: 3 }] : [];
  }
  if (d <= 45) return [{ name: '유사색', score: 2 }];
  if (d >= 150) {
    if (Math.min(a.s, b.s) <= 40) return [{ name: '보색 포인트', score: 2 }];
    if (a.s >= 60 && b.s >= 60) return [{ name: '강한 보색 충돌', score: -2 }];
  }
  return [];
}

// 조합에 포함된 모든 옷 쌍의 점수를 더한다.
export function scoreItems(items) {
  let score = 0;
  const reasons = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      for (const rule of pairRules(a.color_hex, b.color_hex)) {
        score += rule.score;
        const sign = rule.score > 0 ? `+${rule.score}` : `${rule.score}`;
        reasons.push(`${colorName(a.color_hex)} + ${colorName(b.color_hex)}: ${rule.name} (${sign})`);
      }
    }
  }
  return { score, reasons };
}

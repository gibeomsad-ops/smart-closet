// 업로드 전에 브라우저에서 사진을 줄인다.
// 휴대폰 원본(3~10MB, 4000px 이상)은 서버 요청 한도(4.5MB)를 넘기 쉬워서
// 긴 변 1280px JPEG로 다시 그려 보통 150~400KB로 만든다.

const MAX_EDGE = 1280;
const MAX_BYTES = 2.5 * 1024 * 1024;
const HEIC_RE = /\.(heic|heif)$/i;

export class PhotoError extends Error {}

async function decode(file) {
  // createImageBitmap은 EXIF 회전 정보를 반영해 디코딩한다.
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* 일부 브라우저는 옵션이나 형식을 지원하지 않는다 → <img>로 다시 시도 */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export async function preparePhoto(file) {
  if (!file) throw new PhotoError('사진 파일을 고르지 않았어요.');
  const looksImage = file.type.startsWith('image/') || HEIC_RE.test(file.name);
  if (!looksImage) throw new PhotoError('사진(이미지) 파일만 올릴 수 있어요.');

  let image;
  try {
    image = await decode(file);
  } catch {
    throw new PhotoError(HEIC_RE.test(file.name) || /hei[cf]/i.test(file.type)
      ? '이 브라우저에서는 HEIC 사진을 열 수 없어요. JPG로 바꿔서 올리거나 휴대폰에서 바로 올려 주세요.'
      : '이 사진을 열 수 없어요. JPG나 PNG 파일로 올려 주세요.');
  }

  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  let edge = MAX_EDGE;

  for (const quality of [0.85, 0.75, 0.65]) {
    const scale = Math.min(1, edge / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // 투명 PNG는 흰 배경 위에 그린다 (JPEG는 투명도가 없음)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await toBlob(canvas, quality);
    if (blob && blob.size <= MAX_BYTES) {
      image.close?.();
      return blob;
    }
    edge = Math.round(edge * 0.8);
  }
  image.close?.();
  throw new PhotoError('사진을 충분히 줄이지 못했어요. 다른 사진으로 시도해 주세요.');
}

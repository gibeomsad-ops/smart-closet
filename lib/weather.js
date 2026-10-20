// OpenWeatherMap 현재 날씨 (서울). API 키는 서버에서만 사용한다.
import { ServiceError } from './errors.js';

const SEOUL = { lat: 37.5665, lon: 126.978 };
const CACHE_MS = 10 * 60 * 1000;

let cache = null;

export async function getSeoulWeather() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const key = process.env.WEATHER_API_KEY?.trim();
  if (!key) {
    throw new ServiceError('WEATHER_CONFIG_MISSING', 503,
      '날씨 API 설정이 없습니다. 서버 환경변수 WEATHER_API_KEY를 등록해 주세요. (Vercel은 등록 후 재배포 필요)');
  }

  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.search = new URLSearchParams({
    lat: SEOUL.lat, lon: SEOUL.lon, units: 'metric', lang: 'kr', appid: key,
  });

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new ServiceError('WEATHER_UNAVAILABLE', 502,
      '날씨 서버(OpenWeatherMap)에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', err);
  }
  if (res.status === 401) {
    throw new ServiceError('WEATHER_AUTH', 502,
      '날씨 API 키가 거부되었습니다(401). WEATHER_API_KEY 값을 확인해 주세요. 새로 발급한 키는 활성화까지 최대 2시간이 걸릴 수 있습니다.');
  }
  if (res.status === 429) {
    throw new ServiceError('WEATHER_RATE_LIMIT', 502,
      '날씨 API 호출 한도를 넘었습니다(429). 잠시 후 다시 시도해 주세요.');
  }
  if (!res.ok) {
    throw new ServiceError('WEATHER_UNAVAILABLE', 502,
      `날씨 서버가 오류를 돌려줬습니다(${res.status}). 잠시 후 다시 시도해 주세요.`);
  }
  const json = await res.json();

  const data = {
    city: '서울',
    temperature: Math.round(json.main.temp * 10) / 10,
    feelsLike: Math.round(json.main.feels_like * 10) / 10,
    humidity: json.main.humidity,
    description: json.weather?.[0]?.description ?? '',
    icon: json.weather?.[0]?.icon ?? '',
    updatedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return data;
}

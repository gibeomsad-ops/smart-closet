// OpenWeatherMap 현재 날씨 (서울). API 키는 서버에서만 사용한다.
const SEOUL = { lat: 37.5665, lon: 126.978 };
const CACHE_MS = 10 * 60 * 1000;

let cache = null;

export async function getSeoulWeather() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const key = process.env.WEATHER_API_KEY;
  if (!key) throw new Error('WEATHER_API_KEY 환경변수가 설정되지 않았습니다.');

  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.search = new URLSearchParams({
    lat: SEOUL.lat, lon: SEOUL.lon, units: 'metric', lang: 'kr', appid: key,
  });

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OpenWeatherMap 응답 오류: ${res.status}`);
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

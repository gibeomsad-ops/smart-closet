// Vercel 서버리스 함수. /api/* 요청은 vercel.json의 rewrite로 여기로 들어온다.
import app from '../lib/app.js';

export default app;

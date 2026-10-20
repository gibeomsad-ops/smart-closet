// 로컬 실행용 진입점. Vercel에서는 api/index.js가 같은 app을 사용한다.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import app from './lib/app.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const server = express();
server.use(app);
server.use(express.static(path.join(root, 'public')));

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`스마트 옷장: http://localhost:${port}`));

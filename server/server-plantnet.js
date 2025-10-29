import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fetch from 'node-fetch';
import FormData from 'form-data';
import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;
import mime from 'mime-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const API_KEY = '2b10YgYuoM5Osh8EnCc9Zm5KCe';
const PROXY_SERVER = 'http://fSDcc0:nzvMAS@45.147.29.46:8000';

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

async function identifyWithNodeFetch(images) {
  try {
    const form = new FormData();
    images.forEach((img, idx) => {
      let ext = mime.extension(img.mimetype) || 'bin';
      let normalizedExt = ext === 'jpg' ? 'jpeg' : ext;
      let contentType = normalizedExt === 'jpeg' ? 'image/jpeg' : img.mimetype;
      form.append('images', img.buffer, {
        filename: `image${idx}.${normalizedExt}`,
        contentType: contentType
      });
      form.append('organs', img.organ);
    });

    const agent = PROXY_SERVER ? new HttpsProxyAgent(PROXY_SERVER) : undefined;

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${API_KEY}`,
      {
        method: 'POST',
        body: form,
        agent,
        headers: form.getHeaders(),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
    }
    return await response.json();
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  }
}

app.post('/identify', upload.fields([
  { name: 'flower', maxCount: 1 },
  { name: 'leaf', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || (!req.files['flower'] && !req.files['leaf'])) {
      return res.status(400).json({ error: 'Загрузите хотя бы одно изображение' });
    }
    const images = [];
    if (req.files['flower']?.[0]) {
      images.push({
        buffer: req.files['flower'][0].buffer,
        mimetype: req.files['flower'][0].mimetype,
        organ: 'flower'
      });
    }
    if (req.files['leaf']?.[0]) {
      images.push({
        buffer: req.files['leaf'][0].buffer,
        mimetype: req.files['leaf'][0].mimetype,
        organ: 'leaf'
      });
    }
    const data = await identifyWithNodeFetch(images);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PlantNet сервер работает' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🌿 PlantNet сервер запущен на порту ${PORT}`);
});

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const mime = require('mime-types');
const https = require('https');
const http = require('http');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3001;

const API_KEY = process.env.API_KEY;
const PROXY_SERVER = process.env.PROXY_SERVER;
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;
const GIGACHAT_SCOPE = 'GIGACHAT_API_PERS';

if (!API_KEY) {
  console.error('❌ Ошибка: API_KEY не найден в .env');
  process.exit(1);
}

if (!GIGACHAT_AUTH_KEY) {
  console.error('❌ Ошибка: GIGACHAT_AUTH_KEY не найден в .env');
  process.exit(1);
}

console.log('✅ API_KEY загружен');
console.log('✅ GIGACHAT_AUTH_KEY загружен');
if (PROXY_SERVER) {
  console.log('🔌 Прокси сервер:', PROXY_SERVER);
}

app.use(cors({
  origin: 'http://localhost:8099',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ========================
// PROXY & HTTPS AGENTS
// ========================

function getAgents() {
  if (!PROXY_SERVER) {
    // БЕЗ прокси
    return {
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true
      })
    };
  }

  // С прокси
  const httpAgent = new HttpProxyAgent(PROXY_SERVER);
  const httpsAgent = new HttpsProxyAgent(PROXY_SERVER);
  
  return { httpAgent, httpsAgent };
}

// ========================
// PLANT RECOGNITION ROUTES
// ========================

async function identifyPlant(images) {
  try {
    console.log('🌱 Начинаем подготовку изображений...');
    
    const form = new FormData();
    
    // Добавляем изображения
    images.forEach((img, idx) => {
      let ext = mime.extension(img.mimetype) || 'jpg';
      let normalizedExt = ext === 'jpeg' ? 'jpg' : ext;

      console.log(`📷 Изображение ${idx}: ${img.organ} (${normalizedExt})`);

      form.append('images', img.buffer, {
        filename: `plant${idx}.${normalizedExt}`,
        contentType: img.mimetype
      });

      form.append('organs', img.organ);
    });

    console.log('🚀 Отправляем запрос к PlantNet API...');

    const agents = getAgents();
    
    const response = await axios.post(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${API_KEY}`,
      form,
      {
        headers: form.getHeaders(),
        httpAgent: agents.httpAgent,
        httpsAgent: agents.httpsAgent,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000  // 60 секунд
      }
    );

    console.log('✅ Результат успешно получен:', response.data.results?.length, 'совпадений');
    return response.data;
    
  } catch (error) {
    console.error('❌ Ошибка PlantNet:', error.response?.status, error.response?.data || error.message);
    
    const errorMsg = error.response?.data?.message || error.message;
    throw new Error(`PlantNet ошибка: ${errorMsg}`);
  }
}

app.post('/api/identify', upload.fields([
  { name: 'flower', maxCount: 1 },
  { name: 'leaf', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('🌿 Получен запрос на определение растения');
    console.log('📦 Файлы:', Object.keys(req.files || {}));
    
    if (!req.files || (!req.files['flower'] && !req.files['leaf'])) {
      console.error('❌ Нет изображений');
      return res.status(400).json({ 
        error: 'Загрузите хотя бы одно изображение',
        suggestion: 'Выберите фото цветка или листа'
      });
    }
    
    const images = [];
    
    if (req.files['flower']?.[0]) {
      console.log('✓ Обнаружено фото цветка');
      images.push({
        buffer: req.files['flower'][0].buffer,
        mimetype: req.files['flower'][0].mimetype,
        organ: 'flower'
      });
    }
    
    if (req.files['leaf']?.[0]) {
      console.log('✓ Обнаружено фото листа');
      images.push({
        buffer: req.files['leaf'][0].buffer,
        mimetype: req.files['leaf'][0].mimetype,
        organ: 'leaf'
      });
    }
    
    console.log(`🔄 Всего изображений: ${images.length}`);
    const data = await identifyPlant(images);
    
    console.log('✅ Отправляем результат клиенту');
    res.json(data);
    
  } catch (error) {
    console.error('❌ Ошибка в /api/identify:', error);
    
    res.status(500).json({
      error: error.message || 'Ошибка обработки запроса',
      suggestion: 'Проверьте подключение к интернету и прокси',
      timestamp: new Date().toISOString()
    });
  }
});

// ========================
// GIGACHAT ROUTES
// ========================

let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('🔑 Используем кэшированный токен');
    return cachedToken;
  }
  
  try {
    console.log('🔑 Запрашиваем новый токен...');
    
    const response = await axios.post(
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      `scope=${GIGACHAT_SCOPE}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': uuidv4(),
          'Authorization': `Basic ${GIGACHAT_AUTH_KEY}`
        },
        httpsAgent
      }
    );
    
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (29 * 60 * 1000);
    
    console.log('✅ Токен получен успешно');
    return cachedToken;
  } catch (error) {
    console.error('❌ Ошибка получения токена:', error.message);
    throw error;
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    console.log('💬 Получен запрос на чат');
    
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Неверный формат сообщений' });
    }
    
    const accessToken = await getAccessToken();
    
    const systemMessage = {
      role: 'system',
      content: 'Ты - эксперт по растениям и садоводству. Отвечай подробно и полезно на вопросы о растениях, их уходе, болезнях и выращивании. Используй эмодзи растений 🌱🌿🌸. Не отвечай на вопросы несвязанные с растениями'
    };
    
    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat',
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 1024
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        httpsAgent
      }
    );
    
    const aiResponse = response.data.choices[0].message.content;
    console.log('✅ Ответ получен от GigaChat');
    
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('❌ Ошибка GigaChat:', error.message);
    
    res.status(500).json({
      error: 'Ошибка обработки запроса',
      details: error.response?.data || error.message
    });
  }
});

// ========================
// HEALTH CHECK
// ========================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      plantnet: 'ready',
      gigachat: 'ready'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ FloroMate сервер запущен на http://localhost:${PORT}`);
  console.log(`\n📌 Доступные маршруты:`);
  console.log(`   POST /api/identify - определение растения (multipart/form-data)`);
  console.log(`   POST /api/chat - общение с AI ассистентом`);
  console.log(`   GET /api/health - проверка статуса\n`);
});

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const mime = require('mime-types');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Загружаем .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = 3001;

// Переменные из .env
const API_KEY = process.env.API_KEY;
const PROXY_SERVER = process.env.PROXY_SERVER;
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;
const GIGACHAT_SCOPE = 'GIGACHAT_API_PERS';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/floromate_db';

// PostgreSQL Pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle PostgreSQL client', err);
});

// Проверка переменных окружения
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
console.log('✅ DATABASE_URL:', DATABASE_URL);

if (PROXY_SERVER) {
  console.log('🔌 Proxy сервер:', PROXY_SERVER);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  res.removeHeader('X-Powered-By');
  next();
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8099',
    'http://localhost:3000',
    'https://ift-1.brojs.ru',
    'https://static.brojs.ru'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Multer конфигурация для растений
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// HTTPS агент
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// ========================
// DATABASE HELPER FUNCTIONS
// ========================

function formatPlantForFrontend(row) {
  return {
    id: row.id,
    name: row.name,
    scientificName: row.scientific_name,
    image: row.image,
    color: row.color,
    habitat: row.habitat,
    size: row.size,
    category: row.category,
    categoryName: row.category_name,
    description: row.description,
    care: {
      watering: row.watering,
      light: row.light,
      temperature: row.temperature,
      humidity: row.humidity
    },
    features: row.features,
    dangers: row.dangers,
    maintenance: row.maintenance,
    isRecognized: row.is_recognized,
    genus: row.genus,
    family: row.family,
    confidence: row.confidence
  };
}

// ========================
// PLANT DATABASE ROUTES
// ========================

// GET /api/plants - Получение растений с фильтрами и пагинацией
app.get('/api/plants', async (req, res) => {
  try {
    const { colors, habitats, sizes, page = 1, limit = 12 } = req.query;
    
    let query = 'SELECT * FROM plants WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (colors && typeof colors === 'string') {
      const colorArray = colors.split(',');
      query += ` AND color = ANY($${paramIndex})`;
      params.push(colorArray);
      paramIndex++;
    }

    if (habitats && typeof habitats === 'string') {
      const habitatArray = habitats.split(',');
      query += ` AND habitat = ANY($${paramIndex})`;
      params.push(habitatArray);
      paramIndex++;
    }

    if (sizes && typeof sizes === 'string') {
      const sizeArray = sizes.split(',');
      query += ` AND size = ANY($${paramIndex})`;
      params.push(sizeArray);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    const offset = (Number(page) - 1) * Number(limit);
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);
    
    res.json({
      plants: result.rows.map(formatPlantForFrontend),
      totalPages: Math.ceil(totalCount / Number(limit)),
      currentPage: Number(page),
      total: totalCount
    });
  } catch (error) {
    console.error('Error fetching plants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/plants/search - Поиск растений
app.get('/api/plants/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const searchQuery = `
      SELECT * FROM plants 
      WHERE LOWER(name) LIKE LOWER($1) 
         OR LOWER(scientific_name) LIKE LOWER($1)
      ORDER BY 
        CASE 
          WHEN LOWER(name) = LOWER($2) THEN 1
          WHEN LOWER(scientific_name) = LOWER($2) THEN 2
          ELSE 3
        END,
        name
      LIMIT 50
    `;
    
    const searchPattern = `%${query}%`;
    const result = await pool.query(searchQuery, [searchPattern, query]);
    
    res.json(result.rows.map(formatPlantForFrontend));
  } catch (error) {
    console.error('Error searching plants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/plants/:id - Получение деталей растения
app.get('/api/plants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM plants WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }
    
    res.json(formatPlantForFrontend(result.rows[0]));
  } catch (error) {
    console.error('Error fetching plant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/plants/recognize - Добавление распознанного растения
app.post('/api/plants/recognize', async (req, res) => {
  try {
    const { scientificName, genus, family, confidence } = req.body;
    
    if (!scientificName) {
      return res.status(400).json({ error: 'Scientific name is required' });
    }

    // Проверка существования растения
    const existingPlant = await pool.query(
      'SELECT * FROM plants WHERE scientific_name = $1',
      [scientificName]
    );

    if (existingPlant.rows.length > 0) {
      console.log(`ℹ️ Растение уже существует: ${scientificName}`);
      return res.json({ 
        message: 'Plant already exists', 
        plant: formatPlantForFrontend(existingPlant.rows[0]),
        isNew: false
      });
    }

    // Добавление нового распознанного растения БЕЗ изображения
    const query = `
      INSERT INTO plants (
        name, scientific_name, genus, family, confidence, is_recognized
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      scientificName, // Используем научное название как имя
      scientificName,
      genus || null,
      family || null,
      confidence || null,
      true // Помечаем как распознанное
    ];
    
    const result = await pool.query(query, values);
    console.log(`✅ Новое растение добавлено: ${scientificName}`);
    
    res.status(201).json({ 
      message: 'Plant added successfully', 
      plant: formatPlantForFrontend(result.rows[0]),
      isNew: true
    });
  } catch (error) {
    console.error('Error adding recognized plant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================
// PLANT RECOGNITION ROUTES
// ========================

async function identifyPlant(images) {
  const form = new FormData();
  try {
    images.forEach((img, idx) => {
      let ext = mime.extension(img.mimetype) || 'jpg';
      let normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
      form.append('images', img.buffer, {
        filename: `plant${idx}.${normalizedExt}`,
        contentType: img.mimetype
      });
      form.append('organs', img.organ);
    });

    console.log('🚀 Отправляем запрос к PlantNet API...');
    const axiosConfig = {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000
    };

    if (PROXY_SERVER) {
      axiosConfig.httpAgent = new HttpProxyAgent(PROXY_SERVER);
      axiosConfig.httpsAgent = new HttpsProxyAgent(PROXY_SERVER);
      console.log('🔌 Используем прокси для PlantNet');
    }

    const response = await axios.post(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${API_KEY}`,
      form,
      axiosConfig
    );

    console.log('✅ Результат получен:', response.data.results?.length || 0, 'совпадений');
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка PlantNet:', error.response?.status, error.message);
    throw new Error(`PlantNet ошибка: ${error.message}`);
  }
}

app.post('/api/identify', upload.fields([
  { name: 'flower', maxCount: 1 },
  { name: 'leaf', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('🌿 Получен запрос на определение растения');

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

    const data = await identifyPlant(images);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error.message,
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
      gigachat: 'ready',
      database: DATABASE_URL ? 'connected' : 'not configured'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ FloroMate сервер запущен на http://localhost:${PORT}`);
  console.log(`🗄️  PostgreSQL: ${DATABASE_URL}`);
  console.log(`\n📌 Доступные маршруты:`);
  console.log(`  POST /api/identify - определение растения`);
  console.log(`  POST /api/chat - AI ассистент`);
  console.log(`  GET  /api/plants - список растений из БД`);
  console.log(`  GET  /api/plants/search?query=... - поиск растений`);
  console.log(`  GET  /api/plants/:id - детали растения`);
  console.log(`  POST /api/plants/recognize - добавить распознанное растение`);
  console.log(`  GET  /api/health - проверка статуса\n`);
});

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
const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;

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

// Безопасные заголовки
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

// Multer конфигурация
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
// DATABASE HELPER
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

// GET /api/plants
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
    const totalCount = parseInt(countResult.rows[0].count, 10);

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

// GET /api/plants/search
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

// ========================
// PLANT RECOGNIZE (ПОЛНОЕ СОХРАНЕНИЕ)
// ========================
app.post('/api/plants/recognize', async (req, res) => {
  try {
    const {
      scientificName, name, image, color, habitat, size, category,
      categoryName, description, watering, light, temperature,
      humidity, features, dangers, maintenance, genus, family, confidence
    } = req.body;

    if (!scientificName) {
      return res.status(400).json({ error: 'Scientific name required' });
    }

    // Проверяем существование
    const existing = await pool.query(
      'SELECT * FROM plants WHERE scientific_name = $1',
      [scientificName]
    );

    if (existing.rows.length > 0) {
      return res.json({
        message: 'Plant already exists',
        plant: formatPlantForFrontend(existing.rows[0]),
        isNew: false
      });
    }

    const query = `
      INSERT INTO plants (
        name, scientific_name, image, color, habitat, size, category,
        category_name, description, watering, light, temperature,
        humidity, features, dangers, maintenance, genus, family, confidence,
        is_recognized
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,
        true
      )
      RETURNING *
    `;

    const values = [
      name || scientificName,
      scientificName,
      image,
      color,
      habitat,
      size,
      category,
      categoryName,
      description,
      watering,
      light,
      temperature,
      humidity,
      features && Array.isArray(features) ? JSON.stringify(features) : null, // ✅
      dangers,
      maintenance,
      genus,
      family,
      confidence || 0.95
    ];
    

    const result = await pool.query(query, values);

    console.log(`✅ FULL Plant added: ${scientificName}`);

    res.status(201).json({
      message: 'Plant fully added with GigaChat data',
      plant: formatPlantForFrontend(result.rows[0]),
      isNew: true
    });
  } catch (error) {
    console.error('Error adding full plant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================
// PLANT RECOGNITION (PlantNet)
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
    console.error('❌ Ошибка определения растения:', error.message);
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
    tokenExpiry = Date.now() + 29 * 60 * 1000;
    console.log('✅ Токен получен успешно');
    return cachedToken;
  } catch (error) {
    console.error('❌ Ошибка получения токена:', error.message);
    throw error;
  }
}

// Чат с Гигачатом (у тебя уже работал)
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
      content: 'Ты - эксперт по растениям и садоводству. Отвечай полезно на вопросы о растениях в двух трех предложениях, их уходе, болезнях и выращивании. Используй эмодзи растений 🌱🌿🌸. Не отвечай на вопросы несвязанные с растениями'
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

// Обогащение карточки растения через GigaChat
app.post('/api/plants/enrich', async (req, res) => {
  try {
    const { scientificName } = req.body;
    if (!scientificName) {
      return res.status(400).json({ error: 'scientificName required' });
    }

    console.log(`🧠 GigaChat enrich: ${scientificName}`);

    const accessToken = await getAccessToken();

    const systemMessage = {
      role: 'system',
      content: 'Ты ботаник-эксперт. Отвечай ТОЛЬКО в виде валидного JSON без лишнего текста.'
    };

    const userPrompt = `
Для растения "${scientificName}" верни ТОЛЬКО JSON в формате:

{
  "name": "Русское название",
  "color": "green|purple|red|yellow|white",
  "habitat": "indoor|garden|tropical|desert",
  "size": "small|medium|large",
  "category": "foliage|flowering",
  "categoryName": "Название категории",
  "description": "Короткое описание (2-3 предложения)",
  "care": {
    "watering": "1-2 раза в неделю",
    "light": "яркий рассеянный",
    "temperature": "18-27°C",
    "humidity": "60-80%"
  },
  "features": ["черта1", "черта2"],
  "dangers": "не ядовитое",
  "maintenance": "низкий|средний|высокий"
}
`;

    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat',
        messages: [systemMessage, { role: 'user', content: userPrompt }],
        temperature: 0.1,
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

    let gigaChatData = null;
    try {
      gigaChatData = JSON.parse(response.data.choices[0].message.content);
    } catch (e) {
      console.error('❌ JSON parse error GigaChat:', e.message);
      console.error('RAW content:', response.data.choices[0].message.content);
      return res.status(500).json({
        error: 'Bad JSON from GigaChat',
        raw: response.data.choices[0].message.content
      });
    }

    console.log(`✅ GigaChat filled data for ${scientificName}`);

    res.json({
      scientificName,
      enriched: true,
      data: gigaChatData
    });
  } catch (error) {
    console.error('❌ GigaChat enrich error:', error.response?.status, error.message);
    res.status(500).json({
      error: 'GigaChat enrichment failed',
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

// ========================
// PLANT.ID HEALTH ASSESSMENT (DISEASE DETECTION)
// ========================

if (!PLANT_ID_API_KEY) {
  console.warn('⚠️ PLANT_ID_API_KEY не найден в .env');
} else {
  console.log('✅ PLANT_ID_API_KEY загружен');
}

// ========================
// PLANT.ID HEALTH ASSESSMENT (DISEASE DETECTION) - ПОЛНОСТЬЮ НА РУССКОМ
// ========================
const diseaseTranslations = {
  'rust': 'Ржавчина',
  'fungi': 'Грибки',
  'fungus': 'Грибок',
  'animalia': 'Животные вредители',
  'insecta': 'Насекомые',
  'senescence': 'Старение',
  'mold': 'Плесень',
  'mildew': 'Мучнистая роса',
  'blight': 'Фитофтороз',
  'rot': 'Гниль',
  'wilt': 'Увядание',
  'spot': 'Пятнистость',
  'leaf spot': 'Пятнистость листьев',
  'powdery mildew': 'Мучнистая роса',
  'downy mildew': 'Ложная мучнистая роса',
  'anthracnose': 'Антракноз',
  'canker': 'Рак растений',
  'scab': 'Парша',
  'virus': 'Вирус',
  'bacteria': 'Бактерии',
  'bacterial': 'Бактериальный',
  'fungal': 'Грибковый',
  'pest': 'Вредитель',
  'disease': 'Болезнь',
  'nutrient deficiency': 'Дефицит питательных веществ',
  'nitrogen deficiency': 'Дефицит азота',
  'iron deficiency': 'Дефицит железа',
  'water stress': 'Водный стресс',
  'sunburn': 'Солнечный ожог',
  'frost damage': 'Повреждение морозом'
};

// Функция перевода названия болезни (ИСПРАВЛЕННАЯ)
function translateDiseaseName(englishName) {
  // Проверяем, что это строка
  if (!englishName || typeof englishName !== 'string') {
    return 'Неизвестная проблема';
  }
  
  const lowerName = englishName.toLowerCase().trim();
  
  // Точное совпадение
  if (diseaseTranslations[lowerName]) {
    return diseaseTranslations[lowerName];
  }
  
  // Частичное совпадение
  for (const [eng, rus] of Object.entries(diseaseTranslations)) {
    if (lowerName.includes(eng)) {
      return rus;
    }
  }
  
  // Если перевод не найден, возвращаем оригинал
  return englishName;
}

// ========================
// PLANT.ID HEALTH ASSESSMENT - ПОЛНОСТЬЮ НА РУССКОМ
// ========================
app.post('/api/disease-detect', upload.single('image'), async (req, res) => {
  try {
    console.log('🦠 Получен запрос на определение болезни растения');
    
    if (!req.file) {
      return res.status(400).json({ error: 'Загрузите изображение' });
    }

    if (!PLANT_ID_API_KEY) {
      return res.status(500).json({ error: 'PLANT_ID_API_KEY не настроен на сервере' });
    }

    const base64Image = req.file.buffer.toString('base64');
    
    console.log('🚀 Отправляем запрос к Plant.id Health Assessment API...');

    const requestBody = {
      images: [`data:image/jpeg;base64,${base64Image}`],
      latitude: 49.207,
      longitude: 16.608,
      similar_images: true,
      health: 'all'
    };

    const axiosConfig = {
      headers: {
        'Api-Key': PLANT_ID_API_KEY,
        'Content-Type': 'application/json'
      },
      params: {
        language: 'ru',
        details: 'common_names,description,treatment,classification,cause,url'
      },
      timeout: 60000
    };

    if (PROXY_SERVER) {
      axiosConfig.httpAgent = new HttpProxyAgent(PROXY_SERVER);
      axiosConfig.httpsAgent = new HttpsProxyAgent(PROXY_SERVER);
      console.log('🔌 Используем прокси для Plant.id');
    }

    const response = await axios.post(
      'https://api.plant.id/v3/health_assessment',
      requestBody,
      axiosConfig
    );

    const data = response.data;
    console.log('✅ Результат получен от Plant.id');

    const isHealthy = data.result?.is_healthy?.binary ?? true;
    const isHealthyProb = data.result?.is_healthy?.probability ?? 1;
    const diseaseSuggestions = data.result?.disease?.suggestions ?? [];

    console.log('Здоровое растение:', isHealthy);
    console.log('Найдено болезней:', diseaseSuggestions.length);

    // Форматируем ответ с РУССКИМИ названиями
    const formattedResponse = {
      is_healthy: isHealthy,
      is_healthy_probability: isHealthyProb,
      diseases: diseaseSuggestions.map(disease => {
        // Пытаемся получить русское название из API или переводим сами
        const apiRussianName = disease.details?.common_names?.[0];
        const translatedName = translateDiseaseName(disease.name);
        const russianName = apiRussianName || translatedName;
        
        return {
          name: russianName,
          scientific_name: disease.name || '',
          common_names: disease.details?.common_names || [russianName],
          probability: disease.probability ?? 0,
          description: disease.details?.description || null,
          treatment: disease.details?.treatment?.biological || disease.details?.treatment?.chemical || disease.details?.treatment?.prevention || null,
          url: disease.details?.url || null,
          cause: disease.details?.cause || null,
          classification: disease.details?.classification ? translateDiseaseName(disease.details.classification) : 'Проблема'
        };
      }),
      best_match: diseaseSuggestions.length > 0 ? (() => {
        const topDisease = diseaseSuggestions[0];
        const apiRussianName = topDisease.details?.common_names?.[0];
        const translatedName = translateDiseaseName(topDisease.name);
        const russianName = apiRussianName || translatedName;
        
        return {
          disease_name: russianName,
          scientific_name: topDisease.name || '',
          common_names: topDisease.details?.common_names || [russianName],
          confidence: topDisease.probability ?? 0,
          description: topDisease.details?.description || null,
          treatment: topDisease.details?.treatment || null,
          cause: topDisease.details?.cause || null,
          severity: topDisease.details?.classification ? translateDiseaseName(topDisease.details.classification) : 'Проблема'
        };
      })() : null
    };

    res.json(formattedResponse);

  } catch (error) {
    console.error('❌ Ошибка Plant.id:', error.response?.status, error.message);
    console.error('Детали ошибки:', error.response?.data);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data,
      timestamp: new Date().toISOString()
    });
  }
});


// Запуск сервера
app.listen(PORT, () => {
  console.log(`🌿 FloroMate API запущен: http://localhost:${PORT}`);
  console.log('📦 PostgreSQL:', DATABASE_URL);
  console.log('POST /api/identify - распознавание растений');
  console.log('POST /api/chat - AI чат');
  console.log('GET /api/plants - список растений');
  console.log('GET /api/plants/search?query=... - поиск растений');
  console.log('POST /api/plants/recognize - сохранить распознанное растение');
  console.log('POST /api/plants/enrich - обогащение данных растения (GigaChat)');
  console.log('GET /api/plants/photo - фото растения (Perenual)');
  console.log('GET /api/health - проверка состояния API');
});

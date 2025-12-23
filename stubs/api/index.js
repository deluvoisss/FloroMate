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
const bcrypt = require('bcrypt');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = 3001;

// Переменные из .env
const API_KEY = process.env.API_KEY;
const PROXY_SERVER = process.env.PROXY_SERVER;
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;
// Отдельный ключ для ландшафтного дизайна (GigaChat Pro)
const GIGACHAT_AUTH_KEY2 = process.env.GIGACHAT_AUTH_KEY2;
const GIGACHAT_SCOPE = 'GIGACHAT_API_PERS';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/floromate_db';
const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Проверка обязательных переменных
if (!GROQ_API_KEY) {
  console.error('❌ Ошибка: GROQ_API_KEY не найден в .env');
  process.exit(1);
}

console.log('✅ GROQ_API_KEY загружен');

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

if (!GIGACHAT_AUTH_KEY2) {
  console.warn('⚠️ GIGACHAT_AUTH_KEY2 не найден в .env — раздел ландшафтного дизайна работать не будет');
}
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

// ========================
// STORAGE
// ========================
const verificationCodes = new Map();

// ========================
// ЗАГЛУШКА: КОД ТОЛЬКО В КОНСОЛЬ
// ========================
console.log('📝 Режим разработки: коды выводятся только в консоль');

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

app.use(express.static(path.join(__dirname, '../../public')));
app.use('/images3D', express.static(path.join(__dirname, '../../public/images3D')));
app.use('/treeModels', express.static(path.join(__dirname, '../../public/treeModels')));

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
// AUTHENTICATION ROUTES
// ========================

// Инициализация таблицы users
app.post('/api/auth/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    `);
    console.log('✅ Таблица users создана');
    res.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('❌ Ошибка создания таблицы:', error);
    res.status(500).json({ error: 'Database initialization failed' });
  }
});

// Проверка доступности username
app.get('/api/auth/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 3) {
      return res.status(400).json({
        available: false,
        error: 'Username too short'
      });
    }

    const result = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    const available = result.rows.length === 0;
    console.log(`🔍 Проверка username "${username}": ${available ? 'доступен' : 'занят'}`);
    res.json({ available });
  } catch (error) {
    console.error('❌ Ошибка проверки username:', error);
    res.status(500).json({ available: false, error: 'Internal server error' });
  }
});

// Отправка кода верификации
app.post('/api/auth/send-verification', async (req, res) => {
  try {
    const { phone, isPasswordReset } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Номер телефона обязателен' });
    }

    // Проверяем существование пользователя
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    if (!isPasswordReset && existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'Пользователь с таким телефоном уже существует'
      });
    }

    if (isPasswordReset && existingUser.rows.length === 0) {
      return res.status(400).json({
        error: 'Пользователь с таким телефоном не найден'
      });
    }

    // Генерируем 6-значный код
    const code = crypto.randomInt(100000, 999999).toString();
    
    // Сохраняем код
    verificationCodes.set(phone, {
      code,
      expires: Date.now() + 5 * 60 * 1000,
      isPasswordReset: isPasswordReset || false
    });

    // ✅ ТОЛЬКО КОНСОЛЬ
    console.log('\n' + '='.repeat(50));
    console.log(`📱 КОД ВЕРИФИКАЦИИ ДЛЯ: ${phone}`);
    console.log(`🔢 КОД: ${code}`);
    console.log(`⏰ Действителен до: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString()}`);
    console.log(`📋 Тип: ${isPasswordReset ? 'Сброс пароля' : 'Регистрация'}`);
    console.log('='.repeat(50) + '\n');

    res.json({ 
      success: true, 
      message: 'Код сгенерирован (проверь консоль сервера)',
      code: code // Отправляем код на фронт для удобства
    });
  } catch (error) {
    console.error('❌ Ошибка отправки кода:', error);
    res.status(500).json({ error: 'Не удалось отправить код' });
  }
});

// Проверка кода и регистрация пользователя
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { phone, code, userData } = req.body;
    
    if (!phone || !code || !userData) {
      return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
    }

    // Проверяем код верификации
    const storedData = verificationCodes.get(phone);
    if (!storedData) {
      return res.status(400).json({ error: 'Код не найден или истёк срок действия' });
    }

    if (Date.now() > storedData.expires) {
      verificationCodes.delete(phone);
      return res.status(400).json({ error: 'Срок действия кода истёк' });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Неверный код' });
    }

    // Код верный, создаём пользователя
    const passwordHash = await bcrypt.hash(userData.password, 10);
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, phone, username, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, username, phone, created_at`,
      [userData.firstName, userData.lastName, phone, userData.username, passwordHash]
    );

    // Удаляем использованный код
    verificationCodes.delete(phone);

    const user = result.rows[0];
    console.log(`✅ Пользователь зарегистрирован: ${user.username}`);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('❌ Ошибка верификации:', error);
    if (error.code === '23505') {
      return res.status(400).json({
        error: 'Имя пользователя или телефон уже используется'
      });
    }
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

// Сброс пароля
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;
    
    if (!phone || !code || !newPassword) {
      return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
    }

    // Проверяем код
    const storedData = verificationCodes.get(phone);
    if (!storedData || !storedData.isPasswordReset) {
      return res.status(400).json({ error: 'Неверный код или код не для сброса пароля' });
    }

    if (Date.now() > storedData.expires) {
      verificationCodes.delete(phone);
      return res.status(400).json({ error: 'Срок действия кода истёк' });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Неверный код' });
    }

    // Обновляем пароль
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE phone = $2
       RETURNING id, first_name, last_name, username, phone`,
      [passwordHash, phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Удаляем использованный код
    verificationCodes.delete(phone);

    const user = result.rows[0];
    console.log(`✅ Пароль изменен для: ${user.username}`);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('❌ Ошибка сброса пароля:', error);
    res.status(500).json({ error: 'Ошибка сброса пароля' });
  }
});

// Вход в систему
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Требуется имя пользователя и пароль' });
    }

    // Ищем пользователя
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const user = result.rows[0];

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Обновляем время последнего входа
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    console.log(`✅ Вход выполнен: ${user.username}`);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('❌ Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка входа в систему' });
  }
});

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

// POST /api/plants/recognize
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
      features && Array.isArray(features) ? JSON.stringify(features) : null,
      dangers,
      maintenance,
      genus,
      family,
      confidence || 0.95
    ];

    const result = await pool.query(query, values);
    console.log(`✅ FULL Plant added: ${scientificName}`);

    res.status(201).json({
      message: 'Plant fully added',
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
// GIGACHAT & GROQ ROUTES
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

// Отдельный токен для ландшафтного дизайна (использует GIGACHAT_AUTH_KEY2)
let landscapeToken = null;
let landscapeTokenExpiry = null;

async function getLandscapeAccessToken() {
  if (landscapeToken && landscapeTokenExpiry && Date.now() < landscapeTokenExpiry) {
    console.log('🔑 Используем кэшированный токен (landscape)');
    return landscapeToken;
  }

  if (!GIGACHAT_AUTH_KEY2) {
    throw new Error('GIGACHAT_AUTH_KEY2 не настроен в .env');
  }

  try {
    console.log('🔑 Запрашиваем новый токен для ландшафтного дизайна...');
    const response = await axios.post(
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      `scope=${GIGACHAT_SCOPE}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': uuidv4(),
          'Authorization': `Basic ${GIGACHAT_AUTH_KEY2}`
        },
        httpsAgent
      } 
    );

    landscapeToken = response.data.access_token;
    landscapeTokenExpiry = Date.now() + 29 * 60 * 1000;
    console.log('✅ Токен для ландшафтного дизайна получен успешно');
    return landscapeToken;
  } catch (error) {
    console.error('❌ Ошибка получения токена для ландшафтного дизайна:', error.message);
    throw error;
  }
}

// ========================
// GROQ AI TRANSLATION
// ========================
async function translatePlantWithGroq(scientificName) {
  try {
    console.log(`🤖 Groq обрабатывает: ${scientificName}`);
    const prompt = `Ты ботаник. Для растения "${scientificName}" верни ТОЛЬКО JSON:
{
  "name": "Полное русское название растения (например: Тюльпан Геснера, Роза садовая)",
  "commonName": "Народное название"
}
ВАЖНО: "name" должно быть ПОЛНЫМ названием с видом, не общим словом!`;

    const axiosConfig = {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    if (PROXY_SERVER) {
      axiosConfig.httpAgent = new HttpProxyAgent(PROXY_SERVER);
      axiosConfig.httpsAgent = new HttpsProxyAgent(PROXY_SERVER);
      console.log('🔌 Используем прокси для Groq');
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Ты ботаник-эксперт. Отвечай ТОЛЬКО валидным JSON без markdown.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 512
      },
      axiosConfig
    );

    const content = response.data.choices[0].message.content.trim();
    let jsonContent = content.replace(/``````\n?/g, '');
    const plantData = JSON.parse(jsonContent);
    
    console.log(`✅ Groq перевел: ${plantData.name}`);
    return plantData;
  } catch (error) {
    console.error('❌ Ошибка Groq:', error.message);
    return null;
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

app.post('/api/plants/enrich', async (req, res) => {
  try {
    const { scientificName } = req.body;
    
    if (!scientificName) {
      return res.status(400).json({ error: 'scientificName required' });
    }

    console.log(`🧠 Groq enrich: ${scientificName}`);
    const groqData = await translatePlantWithGroq(scientificName);
    
    res.json({
      scientificName,
      enriched: true,
      data: groqData
    });
  } catch (error) {
    console.error('❌ Groq enrich error:', error.message);
    res.status(500).json({
      error: 'Groq enrichment failed',
      details: error.message
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
      database: DATABASE_URL ? 'connected' : 'not configured',
      authentication: 'ready'
    }
  });
});

// ========================
// PLANT.ID DISEASE DETECTION
// ========================
if (!PLANT_ID_API_KEY) {
  console.warn('⚠️ PLANT_ID_API_KEY не найден в .env');
} else {
  console.log('✅ PLANT_ID_API_KEY загружен');
}

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

function translateDiseaseName(englishName) {
  if (!englishName || typeof englishName !== 'string') {
    return 'Неизвестная проблема';
  }
  
  const lowerName = englishName.toLowerCase().trim();
  
  if (diseaseTranslations[lowerName]) {
    return diseaseTranslations[lowerName];
  }
  
  for (const [eng, rus] of Object.entries(diseaseTranslations)) {
    if (lowerName.includes(eng)) {
      return rus;
    }
  }
  
  return englishName;
}

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

    const formattedResponse = {
      is_healthy: isHealthy,
      is_healthy_probability: isHealthyProb,
      diseases: diseaseSuggestions.map(disease => {
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

// ========================
// LANDSCAPE DESIGN ROUTES (GigaChat Pro)
// ========================

app.post('/api/landscape/generate', upload.single('image'), async (req, res) => {
  try {
    console.log('🌿 Получен запрос на генерацию ландшафта (GigaChat Pro)');

    if (!req.file && !req.body.prompt) {
      return res.status(400).json({ error: 'Загрузите изображение или введите описание ландшафта' });
    }

    if (!GIGACHAT_AUTH_KEY2) {
      return res.status(500).json({ error: 'GIGACHAT_AUTH_KEY2 не настроен на сервере' });
    }

    const userPrompt = req.body.prompt || '';
    
    // Системный защитный промпт для фильтрации нерелевантных запросов
    const safetySystemPrompt = 
      'Ты профессиональный ландшафтный дизайнер и эксперт по описанию изображений. ' +
      'Твоя задача - работать ТОЛЬКО с запросами, связанными с ландшафтным дизайном, садоводством, растениями, ' +
      'озеленением участков, дизайном садов и парков. ' +
      'Если пользователь задает вопрос или просит что-то, НЕ связанное с ландшафтным дизайном, садоводством или растениями, ' +
      'вежливо откажи и объясни, что ты специализируешься только на ландшафтном дизайне. ' +
      'Принимай только запросы про: растения, деревья, кустарники, цветы, сады, парки, ландшафты, ' +
      'озеленение, дизайн участков, садоводство, уход за растениями.';

    const defaultPrompt = 
      'Сделай этот ландшафт реалистичным, эстетически красивым и реализуемым в реальности. ' +
      'Добавь растения, деревья, кустарники и другие элементы ландшафтного дизайна, ' +
      'но не изменяй кардинально композицию и перспективу. Улучши внешний вид участка, ' +
      'сохраняя его структуру.';

    const finalUserPrompt = userPrompt.trim() || defaultPrompt;

    if (req.file) {
      console.log('📋 Размер файла:', req.file.size, 'байт');
      console.log('📋 MIME тип:', req.file.mimetype);
    } else {
      console.log('📝 Запрос без изображения, только текстовый промпт');
    }

    // 1. Получаем access token для GigaChat Pro
    const accessToken = await getLandscapeAccessToken();

    let imageDescription = '';
    let fileId = null;

    // 2. Если есть изображение - загружаем и анализируем
    if (req.file) {
      console.log('📤 Этап 1: Загружаем изображение в хранилище GigaChat...');
    const uploadForm = new FormData();
    uploadForm.append('file', req.file.buffer, {
      filename: req.file.originalname || 'landscape.jpg',
      contentType: req.file.mimetype,
    });
    uploadForm.append('purpose', 'general');

    const uploadResponse = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/files',
      uploadForm,
      {
        headers: {
          ...uploadForm.getHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
        httpsAgent,
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

      fileId = uploadResponse.data?.id;
    if (!fileId) {
        throw new Error('Не удалось загрузить изображение');
    }
    console.log('✅ Файл загружен в GigaChat, id:', fileId);

      // 3. Этап 1: Анализируем изображение и получаем детальное промпт-описание для улучшенной версии
      console.log('🔍 Этап 1: Анализируем изображение и создаем промпт для улучшенной версии...');

      const analysisResponse = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat-Pro',
        messages: [
          {
            role: 'system',
              content: safetySystemPrompt + ' ' +
                'Твоя задача - детально описать изображение ландшафта и создать точное текстовое описание ' +
                'улучшенной версии этого ландшафта для последующей генерации изображения. ' +
                'Описание должно быть максимально детальным и включать все элементы: растения, деревья, ' +
                'кустарники, структуру участка, перспективу, освещение, цвета, стиль дизайна.',
          },
          {
            role: 'user',
              content: `Проанализируй это изображение ландшафта. Учти следующие пожелания: ${finalUserPrompt}. ` +
                `Создай детальное текстовое описание улучшенной версии этого ландшафта. ` +
                `Описание должно быть максимально точным и детальным, чтобы по нему можно было сгенерировать ` +
                `реалистичное изображение улучшенного ландшафтного дизайна. ` +
                `Верни только описание, без дополнительных комментариев.`,
            attachments: [fileId],
          },
        ],
        stream: false,
        update_interval: 0,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        httpsAgent,
        timeout: 120000,
      }
    );

      imageDescription = 
        analysisResponse.data?.choices?.[0]?.message?.content ||
        analysisResponse.data?.message?.content ||
        '';

      if (!imageDescription || imageDescription.trim().length < 50) {
        throw new Error('Не удалось получить детальное описание изображения от нашей модели');
      }

      console.log('✅ Получено описание для генерации (длина:', imageDescription.length, 'символов)');
      console.log('📋 Промпт:', imageDescription.substring(0, 200) + '...');
    } else {
      // Если нет изображения - используем пользовательский промпт напрямую
      console.log('📝 Этап 1 пропущен: нет изображения, используем текстовый промпт напрямую');
      imageDescription = finalUserPrompt;
    }

    // 4. Этап 2: Генерируем улучшенное изображение по детальному описанию используя text2image
    console.log('🎨 Этап 2: Генерируем улучшенное изображение по описанию...');
    
    const chatResponse = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat-Pro',
        messages: [
          {
            role: 'system',
            content: safetySystemPrompt + ' ' +
              'Твоя задача - создать детальное текстовое описание ландшафта для генерации изображения. ' +
              'Описание должно быть максимально точным и детальным.',
          },
          {
            role: 'user',
            content: `Сгенерируй реалистичное изображение ландшафтного дизайна по следующему детальному описанию: ${imageDescription}`,
          },
        ],
        stream: false,
        update_interval: 0,
        function_call: 'auto', // Включаем автоматический вызов функции text2image
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        httpsAgent,
        timeout: 180000, // Увеличиваем таймаут до 3 минут для генерации изображений
      }
    );

    // Логируем полную структуру ответа для отладки
    console.log('✅ Ответ GigaChat Pro получен. Полная структура ответа:');
    console.log(JSON.stringify(chatResponse.data, null, 2));

    // Ответ может быть в формате { message: { content: "<img src=\"...\"/>", ... } }
    // или в openai-совместимом формате с choices[0].message.content
    const rawMessageContent =
      chatResponse.data?.message?.content ||
      chatResponse.data?.choices?.[0]?.message?.content ||
      '';

    console.log('✅ Извлеченный Content:', rawMessageContent);
    console.log('✅ Тип content:', typeof rawMessageContent);
    console.log('✅ Длина content:', rawMessageContent?.length || 0);
    
    // Проверяем все возможные поля, где может быть изображение
    console.log('✅ Структура choices[0].message:', JSON.stringify(chatResponse.data?.choices?.[0]?.message, null, 2));

    // Проверяем function_call в ответе - если использовался function calling для text2image
    const functionCall = chatResponse.data?.choices?.[0]?.message?.function_call;
    if (functionCall) {
      console.log('🔧 Обнаружен function_call:', JSON.stringify(functionCall, null, 2));
      
      // Если функция text2image была вызвана, результат может быть в function_call.result или в следующем ответе
      if (functionCall.name === 'text2image' || functionCall.function_name === 'text2image') {
        console.log('🎨 Найден вызов функции text2image');
        
        // Результат может быть в function_call.arguments или в отдельном поле
        const functionResult = functionCall.result || functionCall.arguments;
        console.log('📋 Результат function_call:', functionResult);
        
        // Если есть image_id или file_id в результате
        if (functionResult && typeof functionResult === 'string') {
          try {
            const parsed = JSON.parse(functionResult);
            if (parsed.image_id || parsed.file_id || parsed.id) {
              const imageId = parsed.image_id || parsed.file_id || parsed.id;
              console.log('🎨 Найден ID изображения в function_call.result:', imageId);
              
              // Скачиваем изображение
              try {
                const fileResponse = await axios.get(
                  `https://gigachat.devices.sberbank.ru/api/v1/files/${imageId}/content`,
                  {
                    headers: {
                      Accept: 'image/jpeg, image/png, image/*',
                      Authorization: `Bearer ${accessToken}`,
                    },
                    httpsAgent,
                    responseType: 'arraybuffer',
                    timeout: 120000,
                  }
                );
                
                const contentType = fileResponse.headers['content-type'] || 'image/jpeg';
                const base64Image = Buffer.from(fileResponse.data, 'binary').toString('base64');
                const dataUrl = `data:${contentType};base64,${base64Image}`;
                
                return res.json({
                  imageUrl: dataUrl,
                  prompt: finalUserPrompt,
                  generatedPrompt: imageDescription,
                  message: 'Ландшафт успешно обработан',
                });
              } catch (fileError) {
                console.error('❌ Ошибка при скачивании файла из function_call:', fileError.message);
              }
            }
          } catch (e) {
            console.log('⚠️ Не удалось распарсить function_call.result как JSON');
          }
        }
      }
    }

    // Проверяем, есть ли изображение в base64 прямо в ответе
    const base64ImageMatch = rawMessageContent.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
    if (base64ImageMatch) {
      console.log('✅ Найдено изображение в base64 прямо в ответе');
      const dataUrl = base64ImageMatch[0];
      return res.json({
        imageUrl: dataUrl,
        prompt: finalUserPrompt,
        generatedPrompt: imageDescription,
        message: 'Ландшафт успешно обработан',
      });
    }

    // Парсим ID изображения из тега <img src="ID"/> или других форматов
    const imgMatch = rawMessageContent.match(/<img[^>]*src=["']([^"']+)["']/);
    
    // Также проверяем другие возможные форматы: file://, просто ID, UUID и т.д.
    let generatedImageId = null;
    
    if (imgMatch && imgMatch[1]) {
      generatedImageId = imgMatch[1].trim();
      console.log('🎨 Найден ID изображения из тега img:', generatedImageId);
    } else {
      // Пробуем найти ID в других форматах
      // Проверяем attachments в сообщении
      const messageAttachments = 
        chatResponse.data?.choices?.[0]?.message?.attachments ||
        chatResponse.data?.message?.attachments ||
        [];
      
      console.log('📎 Проверяем attachments в сообщении:', JSON.stringify(messageAttachments, null, 2));
      
      if (messageAttachments.length > 0) {
        // Ищем file_id или id в attachments
        const attachment = messageAttachments.find(a => a.file_id || a.id) || messageAttachments[0];
        generatedImageId = attachment.file_id || attachment.id;
        console.log('🎨 Найден ID из attachments:', generatedImageId);
      }
      
      // Проверяем другие поля в ответе, где может быть ID файла
      if (!generatedImageId) {
        const allKeys = Object.keys(chatResponse.data?.choices?.[0]?.message || {});
        console.log('📋 Все ключи в message:', allKeys);
        
        // Проверяем, может быть изображение в других полях
        if (chatResponse.data?.choices?.[0]?.message?.function_call) {
          console.log('🔧 Найден function_call:', JSON.stringify(chatResponse.data.choices[0].message.function_call, null, 2));
        }
        
        // Пробуем извлечь ID из текста ответа (может быть просто ID без тегов)
        const idMatch = rawMessageContent.match(/[a-f0-9]{32,}/i);
        if (idMatch) {
          generatedImageId = idMatch[0];
          console.log('🎨 Найден потенциальный ID из текста:', generatedImageId);
        }
      }
    }
    
    if (!generatedImageId) {
      console.error('❌ Не удалось найти ID изображения. Полная структура ответа:');
      console.error(JSON.stringify({
        data: chatResponse.data,
        messageContent: rawMessageContent,
        messageKeys: chatResponse.data?.choices?.[0]?.message ? Object.keys(chatResponse.data.choices[0].message) : []
      }, null, 2));
      
      // Если в ответе есть сообщение об ошибке или ограничении, возвращаем его пользователю
      const errorMessage = rawMessageContent || 'Неизвестная ошибка';
      
      // Возвращаем детальную информацию об ошибке с полной структурой ответа для отладки
      return res.status(500).json({
        error: 'Наша модель не смогла сгенерировать изображение',
        message: errorMessage,
        debug: {
          hasContent: !!rawMessageContent,
          contentLength: rawMessageContent?.length || 0,
          contentPreview: rawMessageContent?.substring(0, 500),
          hasAttachments: !!(chatResponse.data?.choices?.[0]?.message?.attachments?.length),
          hasFunctionCall: !!chatResponse.data?.choices?.[0]?.message?.function_call,
          responseStructure: {
            hasChoices: !!chatResponse.data?.choices,
            choicesLength: chatResponse.data?.choices?.length || 0,
            messageKeys: chatResponse.data?.choices?.[0]?.message ? Object.keys(chatResponse.data.choices[0].message) : []
          }
        },
        details: 'Попробуйте изменить описание или загрузить другое изображение'
      });
    }

    console.log('🎨 Идентификатор сгенерированного изображения для скачивания:', generatedImageId);

    // Проверяем, что ID выглядит валидным
    if (generatedImageId.includes('777777777777') || generatedImageId.length < 10) {
      console.warn('⚠️ Подозрительный ID изображения:', generatedImageId);
    }

    // 4. Скачиваем сгенерированное изображение по его идентификатору
    console.log('📥 Скачиваем сгенерированное изображение из GigaChat...');
    
    let fileResponse;
    let retries = 2;
    let lastError;
    
    // Пробуем скачать файл несколько раз с задержкой (файл может быть еще не готов)
    while (retries > 0) {
    try {
      fileResponse = await axios.get(
        `https://gigachat.devices.sberbank.ru/api/v1/files/${generatedImageId}/content`,
        {
          headers: {
              Accept: 'image/jpeg, image/png, image/*',
            Authorization: `Bearer ${accessToken}`,
          },
          httpsAgent,
          responseType: 'arraybuffer',
          timeout: 120000,
        }
      );
        break; // Успешно, выходим из цикла
    } catch (fileError) {
        lastError = fileError;
        console.error(`❌ Ошибка при скачивании файла (попытка ${3 - retries + 1}):`, {
        status: fileError.response?.status,
          statusText: fileError.response?.statusText,
          data: fileError.response?.data?.toString?.() || fileError.response?.data,
        message: fileError.message,
      });
      
        if (fileError.response?.status === 404) {
          // Файл не найден - возможно нужно подождать или использовать другой endpoint
          if (retries > 1) {
            console.log('⏳ Файл еще не готов, ждем 2 секунды и пробуем снова...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
            continue;
          }
        } else {
          // Другая ошибка - не пробуем снова
          break;
        }
        retries--;
      }
    }
    
    if (!fileResponse) {
      throw new Error(
        `Не удалось получить сгенерированное изображение после нескольких попыток. Попробуйте еще раз.`
      );
    }

    const contentType = fileResponse.headers['content-type'] || 'image/jpeg';
    const base64Image = Buffer.from(fileResponse.data, 'binary').toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    console.log('✅ Ландшафт успешно сгенерирован GigaChat Pro');

    res.json({
      imageUrl: dataUrl,
      prompt: finalUserPrompt,
      generatedPrompt: imageDescription,
      message: 'Ландшафт успешно обработан',
    });
  } catch (error) {
    console.error('❌ Ошибка генерации ландшафта через GigaChat Pro:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // Если это ошибка лимитов — отдаем понятный ответ
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Превышен лимит запросов',
        message: 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.',
        retryAfter: error.response.headers?.['retry-after'] || 60,
      });
    }

    // Больше не возвращаем оригинальное изображение — отдаем реальную ошибку
    return res.status(error.response?.status || 500).json({
      error: 'Ошибка генерации ландшафта',
      message: error.message,
      details: error.response?.data || null,
    });
  }
});

// ========================
// DEBUG: QUICK TEST USER
// ========================
app.post('/api/debug/create-test-user', async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash('test123', 10);
    
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, phone, username, password_hash)
       VALUES ('Test', 'User', '+79999999999', 'testuser', $1)
       RETURNING id, username, first_name`,
      [passwordHash]
    );
    
    console.log('✅ Test user created');
    res.json({
      success: true,
      credentials: {
        username: 'testuser',
        password: 'test123'
      }
    });
    
  } catch (error) {
    if (error.code === '23505') {
      return res.json({
        message: 'User already exists',
        credentials: {
          username: 'testuser',
          password: 'test123'
        }
      });
    }
    res.status(500).json({ error: error.message });
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
  console.log('POST /api/landscape/generate - генерация дизайна ландшафта');
  console.log('GET /api/health - проверка состояния API');
  console.log('🔐 Authentication endpoints:');
  console.log('  POST /api/auth/init-db - инициализация БД');
  console.log('  GET /api/auth/check-username - проверка username');
  console.log('  POST /api/auth/send-verification - отправка кода');
  console.log('  POST /api/auth/verify-code - верификация и регистрация');
  console.log('  POST /api/auth/reset-password - сброс пароля');
  console.log('  POST /api/auth/login - вход в систему');
  console.log('🌱 Plant endpoints:');
  console.log('  POST /api/identify - распознавание растений');
  console.log('  POST /api/chat - AI чат');
  console.log('  GET /api/plants - список растений');
  console.log('  GET /api/plants/search?query=... - поиск растений');
  console.log('  POST /api/plants/recognize - сохранить распознанное растение');
  console.log('  POST /api/plants/enrich - обогащение данных растения');
  console.log('  POST /api/disease-detect - определение болезней растений');
  console.log('  GET /api/health - проверка состояния API');
}); 

// ========================
// FEEDBACK ROUTES
// ========================

app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, message, rating, suggestions } = req.body;

    if (!message || message.trim().length < 10) {
      return res.status(400).json({ 
        error: 'Сообщение должно содержать минимум 10 символов' 
      });
    }

    // Логируем обратную связь (в продакшене можно отправить на email или сохранить в БД)
    console.log('📝 Новая обратная связь:');
    console.log('  Имя:', name || 'Не указано');
    console.log('  Email:', email || 'Не указан');
    console.log('  Оценка:', rating || 'Не указана');
    console.log('  Сообщение:', message);
    if (suggestions) {
      console.log('  Предложения:', suggestions);
    }

    // В продакшене здесь можно добавить отправку email через nodemailer или другой сервис
    // Например: await sendEmail({ to: 'artsint@mail.ru', subject: 'Обратная связь FloroMate', text: ... });

    res.json({ 
      success: true, 
      message: 'Спасибо за вашу обратную связь! Мы обязательно учтем ваши предложения.' 
    });
  } catch (error) {
    console.error('❌ Ошибка обработки обратной связи:', error);
    res.status(500).json({ error: 'Ошибка при отправке обратной связи' });
  }
});

// 🔍 ДЕБАГ
app.get('/api/debug/models-check', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const modelsPath = path.join(__dirname, '../../public/treeModels');
  
  if (!fs.existsSync(modelsPath)) {
    return res.json({ error: 'Папка не существует', path: modelsPath });
  }
  
  const files = fs.readdirSync(modelsPath);
  res.json({ success: true, count: files.length, files });
});

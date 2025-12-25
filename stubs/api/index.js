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

// Environment variables
const API_KEY = process.env.API_KEY;
const PROXY_SERVER = process.env.PROXY_SERVER;
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;
const GIGACHAT_AUTH_KEY2 = process.env.GIGACHAT_AUTH_KEY2;
const GIGACHAT_SCOPE = 'GIGACHAT_API_PERS';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/floromate_db';
const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Validation
if (!GROQ_API_KEY) {
  console.error('❌ Error: GROQ_API_KEY not found in .env');
  process.exit(1);
}

console.log('✅ GROQ_API_KEY loaded');

if (!API_KEY) {
  console.error('❌ Error: API_KEY not found in .env');
  process.exit(1);
}

if (!GIGACHAT_AUTH_KEY) {
  console.error('❌ Error: GIGACHAT_AUTH_KEY not found in .env');
  process.exit(1);
}

console.log('✅ API_KEY loaded');
console.log('✅ GIGACHAT_AUTH_KEY loaded');
console.log('✅ DATABASE_URL:', DATABASE_URL);

if (PROXY_SERVER) {
  console.log('🔌 Proxy server:', PROXY_SERVER);
}

if (!GIGACHAT_AUTH_KEY2) {
  console.warn('⚠️ GIGACHAT_AUTH_KEY2 not found in .env — landscape design section will not work');
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

console.log('📝 Development mode: codes output to console only');

// Security headers
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

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// HTTPS agent
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// ========================
// DATABASE HELPER
// ========================
function formatPlantForFrontend(row) {
  let features = row.features;
  if (typeof features === 'string') {
    try {
      features = JSON.parse(features);
    } catch (e) {
      features = features ? [features] : [];
    }
  }

  if (!Array.isArray(features)) {
    features = features ? [features] : [];
  }

  let dangers = row.dangers;
  if (typeof dangers === 'string' && dangers.startsWith('[')) {
    try {
      dangers = JSON.parse(dangers);
    } catch (e) {
      // keep as string
    }
  }

  if (!Array.isArray(dangers) && dangers) {
    dangers = [dangers];
  }

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
    features: features,
    dangers: dangers || [],
    maintenance: row.maintenance,
    isRecognized: row.is_recognized || false,
    genus: row.genus,
    family: row.family,
    confidence: row.confidence
  };
}

// ========================
// AUTHENTICATION ROUTES
// ========================

// Init DB
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
    console.log('✅ users table created');
    res.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('❌ Error creating table:', error);
    res.status(500).json({ error: 'Database initialization failed' });
  }
});

// Check username availability
app.get('/api/auth/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 3) {
      return res.status(400).json({ available: false, error: 'Username too short' });
    }

    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    const available = result.rows.length === 0;
    console.log(`🔍 Username check "${username}": ${available ? 'available' : 'taken'}`);
    res.json({ available });
  } catch (error) {
    console.error('❌ Error checking username:', error);
    res.status(500).json({ available: false, error: 'Internal server error' });
  }
});

// Send verification code
app.post('/api/auth/send-verification', async (req, res) => {
  try {
    const { phone, isPasswordReset } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);

    if (!isPasswordReset && existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this phone already exists' });
    }

    if (isPasswordReset && existingUser.rows.length === 0) {
      return res.status(400).json({ error: 'User with this phone not found' });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    verificationCodes.set(phone, {
      code,
      expires: Date.now() + 5 * 60 * 1000,
      isPasswordReset: isPasswordReset || false
    });

    console.log('\n' + '='.repeat(50));
    console.log(`📱 VERIFICATION CODE FOR: ${phone}`);
    console.log(`🔢 CODE: ${code}`);
    console.log(`⏰ Valid until: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString()}`);
    console.log(`📋 Type: ${isPasswordReset ? 'Password reset' : 'Registration'}`);
    console.log('='.repeat(50) + '\n');

    res.json({ success: true, message: 'Code generated (check server console)', code });
  } catch (error) {
    console.error('❌ Error sending code:', error);
    res.status(500).json({ error: 'Failed to send code' });
  }
});

// Verify code and register
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { phone, code, userData } = req.body;
    if (!phone || !code || !userData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const storedData = verificationCodes.get(phone);
    if (!storedData) {
      return res.status(400).json({ error: 'Code not found or expired' });
    }

    if (Date.now() > storedData.expires) {
      verificationCodes.delete(phone);
      return res.status(400).json({ error: 'Code has expired' });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Incorrect code' });
    }

    const passwordHash = await bcrypt.hash(userData.password, 10);
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, phone, username, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, username, phone, created_at`,
      [userData.firstName, userData.lastName, phone, userData.username, passwordHash]
    );

    verificationCodes.delete(phone);
    const user = result.rows[0];
    console.log(`✅ User registered: ${user.username}`);
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
    console.error('❌ Error verifying code:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username or phone already in use' });
    }
    res.status(500).json({ error: 'Registration error' });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const storedData = verificationCodes.get(phone);
    if (!storedData || !storedData.isPasswordReset) {
      return res.status(400).json({ error: 'Invalid code or not for password reset' });
    }

    if (Date.now() > storedData.expires) {
      verificationCodes.delete(phone);
      return res.status(400).json({ error: 'Code has expired' });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Incorrect code' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE phone = $2
       RETURNING id, first_name, last_name, username, phone`,
      [passwordHash, phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    verificationCodes.delete(phone);
    const user = result.rows[0];
    console.log(`✅ Password changed for: ${user.username}`);
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
    console.error('❌ Error resetting password:', error);
    res.status(500).json({ error: 'Password reset error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    console.log(`✅ Login: ${user.username}`);
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
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login error' });
  }
});

// ========================
// PLANT DATABASE ROUTES
// ========================

// GET /api/plants
app.get('/api/plants', async (req, res) => {
  try {
    const { colors, habitats, sizes, page = 1, limit = 12 } = req.query;
    console.log('📋 GET /api/plants query params:', { colors, habitats, sizes, page, limit });

    let query = 'SELECT * FROM public.plants WHERE 1=1';

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
    console.log(`📊 Total plants: ${totalCount}`);

    const offset = (Number(page) - 1) * Number(limit);
    query += ` ORDER BY id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    console.log('🔍 Executing query:', query);
    const result = await pool.query(query, params);
    console.log(`✅ Found ${result.rows.length} plants`);

    const formattedPlants = result.rows.map((row, index) => {
      try {
        return formatPlantForFrontend(row);
      } catch (error) {
        console.error(`❌ Error formatting plant ${index}:`, error);
        return null;
      }
    }).filter(plant => plant !== null);

    const responseData = {
      plants: formattedPlants,
      totalPages: Math.ceil(totalCount / Number(limit)),
      currentPage: Number(page),
      total: totalCount
    };

    res.json(responseData);
  } catch (error) {
    console.error('❌ Error fetching plants:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/plants/search
app.get('/api/plants/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const searchSql = `
      SELECT *
      FROM public.plants
      WHERE LOWER(name) LIKE LOWER($1)
         OR LOWER(scientific_name) LIKE LOWER($1)
      ORDER BY CASE
        WHEN LOWER(name) = LOWER($2) THEN 1
        WHEN LOWER(scientific_name) = LOWER($2) THEN 2
        ELSE 3
      END, name
      LIMIT 50
    `;

    const searchPattern = `%${query.toLowerCase()}%`;

    const result = await pool.query(searchSql, [
      searchPattern,
      query.toLowerCase(),
    ]);

    res.json(result.rows.map(formatPlantForFrontend));
  } catch (error) {
    console.error('❌ Error searching plants:', error);
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

    console.log('🌱 POST /api/plants/recognize called');

    if (!scientificName) {
      return res.status(400).json({ error: 'Scientific name required' });
    }

    const existing = await pool.query(
      'SELECT * FROM plants WHERE scientific_name = $1',
      [scientificName]
    );

    if (existing.rows.length > 0) {
      console.log(`⚠️ Plant already exists: ${scientificName}`);
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
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19,
        true
      )
      RETURNING *
    `;

    const values = [
      name || scientificName,                          // $1
      scientificName,                                  // $2
      image || null,                                   // $3
      color || null,                                   // $4
      habitat || null,                                 // $5
      size || null,                                    // $6
      category || null,                                // $7
      categoryName || null,                            // $8
      description || null,                             // $9
      watering || null,                                // $10
      light || null,                                   // $11
      temperature || null,                             // $12
      humidity || null,                                // $13
      features && Array.isArray(features) ? JSON.stringify(features) : null,  // $14
      dangers || null,                                 // $15
      maintenance || null,                             // $16
      genus || null,                                   // $17
      family || null,                                  // $18
      confidence || 0.95                               // $19
    ];

    console.log('💾 Inserting plant:', {
      name: values[0],
      scientificName: values[1],
      hasImage: !!values[2],
      color: values[3],
      habitat: values[4]
    });

    const result = await pool.query(query, values);
    console.log(`✅ Plant added: ${scientificName} (ID: ${result.rows[0]?.id})`);

    res.status(201).json({
      message: 'Plant fully added',
      plant: formatPlantForFrontend(result.rows[0]),
      isNew: true
    });
  } catch (error) {
    console.error('❌ Error adding plant:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      code: error.code
    });
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

    console.log('🚀 Sending to PlantNet API...');

    const axiosConfig = {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000
    };

    if (PROXY_SERVER) {
      axiosConfig.httpAgent = new HttpProxyAgent(PROXY_SERVER);
      axiosConfig.httpsAgent = new HttpsProxyAgent(PROXY_SERVER);
      console.log('🔌 Using proxy for PlantNet');
    }

    const response = await axios.post(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${API_KEY}`,
      form,
      axiosConfig
    );

    console.log('✅ PlantNet results:', response.data.results?.length || 0);
    return response.data;
  } catch (error) {
    console.error('❌ PlantNet error:', error.response?.status, error.message);
    throw new Error(`PlantNet error: ${error.message}`);
  }
}

app.post('/api/identify', upload.fields([
  { name: 'flower', maxCount: 1 },
  { name: 'leaf', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('🌿 Plant identification request received');
    if (!req.files || (!req.files['flower'] && !req.files['leaf'])) {
      return res.status(400).json({ error: 'Upload at least one image' });
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
    console.error('❌ Plant identification error:', error.message);
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
    console.log('🔑 Using cached token');
    return cachedToken;
  }

  try {
    console.log('🔑 Requesting new token...');
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
    console.log('✅ Token received');
    return cachedToken;
  } catch (error) {
    console.error('❌ Token error:', error.message);
    throw error;
  }
}

// Separate token for landscape design
let landscapeToken = null;
let landscapeTokenExpiry = null;

async function getLandscapeAccessToken() {
  if (landscapeToken && landscapeTokenExpiry && Date.now() < landscapeTokenExpiry) {
    console.log('🔑 Using cached token (landscape)');
    return landscapeToken;
  }

  if (!GIGACHAT_AUTH_KEY2) {
    throw new Error('GIGACHAT_AUTH_KEY2 not configured in .env');
  }

  try {
    console.log('🔑 Requesting new token for landscape...');
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
    console.log('✅ Landscape token received');
    return landscapeToken;
  } catch (error) {
    console.error('❌ Landscape token error:', error.message);
    throw error;
  }
}

// ========================
// GROQ AI TRANSLATION (IMPROVED)
// ========================

async function translatePlantWithGroq(scientificName) {
  try {
    console.log(`🤖 Groq обрабатывает: ${scientificName}`);
    const prompt = `Ты ботаник-эксперт. Для растения "${scientificName}" верни ТОЛЬКО валидный JSON (без markdown):

{
  "name": "Название на русском",
  "commonName": "Популярное название",
  "description": "2-3 предложения описания растения на русском",
  "color": "Цвет цветков/листьев (зеленый, красный, фиолетовый, желтый, белый, розовый, оранжевый, синий)",
  "habitat": "Место произрастания (комнатное, уличное, водное)",
  "size": "Размер взрослого растения (маленькое, среднее, большое)",
  "category": "Категория (лиственное, цветущее, суккулент, папоротник, вьющийся, кустарник, дерево)",
  "categoryName": "Полное название категории на русском",
  "watering": "Частота полива (Частый, Умеренный, Редкий)",
  "light": "Требуемое освещение (Яркий свет, Рассеянный свет, Полутень, Тень)",
  "temperature": "Оптимальная температура (например: 18-25°C)",
  "humidity": "Требуемая влажность (например: 50-70%)",
  "features": [
    "Особенность 1",
    "Особенность 2",
    "Особенность 3"
  ],
  "dangers": "Опасности для домашних животных или людей (ядовитое для кого и чем/неядовитое)",
  "maintenance": "Уровень сложности ухода (Низкий, Средний, Высокий)"
}

ВАЖНО:
- Верни ТОЛЬКО JSON, без markdown блоков
- Все значения должны быть строками или массивами строк
- Если информации недостаточно, используй разумные значения по умолчанию`;
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

    // ← ИСПРАВЛЕНО: только одно объявление content
    const content = response.data.choices[0].message.content.trim();

    // Убираем markdown блоки
    let jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```/g, '').trim();

    const plantData = JSON.parse(jsonContent);

    console.log(`✅ Groq перевел: ${plantData.name}`);
    return plantData;
  } catch (error) {
    console.error('❌ Ошибка Groq:', error.message);
    return null;
  }
}

// ========================
// FEEDBACK TABLE INIT
// ========================

app.post('/api/feedback/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        message TEXT NOT NULL,
        rating INT,
        suggestions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_feedback_email ON feedback(email);
      CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
    `);
    console.log('✅ feedback table created');
    res.json({ message: 'Feedback table initialized successfully' });
  } catch (error) {
    console.error('❌ Error creating feedback table:', error);
    res.status(500).json({ error: 'Database initialization failed' });
  }
});

// ========================
// FEEDBACK GET ALL
// ========================

app.get('/api/feedback/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ 
      success: true, 
      count: result.rows.length,
      feedback: result.rows 
    });
  } catch (error) {
    console.error('❌ Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});


// POST /api/plants/enrich
app.post('/api/plants/enrich', async (req, res) => {
  try {
    const { scientificName } = req.body;
    
    if (!scientificName) {
      console.log('❌ scientificName is missing');
      return res.status(400).json({ 
        error: 'scientificName required',
        scientificName: null,
        enriched: false,
        data: null
      });
    }

    console.log(`🤖 Enriching plant: ${scientificName}`);

    // Call Groq
    const groqData = await translatePlantWithGroq(scientificName);

    if (!groqData) {
      console.log(`⚠️ Groq returned null for: ${scientificName}`);
      return res.json({
        scientificName,
        enriched: false,
        data: null,
        message: 'Could not enrich plant data'
      });
    }

    console.log(`✅ Plant enriched from Groq:`, {
      scientificName,
      name: groqData.name,
      fields: Object.keys(groqData).join(', ')
    });

    res.json({
      scientificName,
      enriched: true,
      data: groqData
    });

  } catch (error) {
    console.error('❌ Error in /api/plants/enrich:', error.message);
    res.status(500).json({
      error: 'Enrichment failed',
      details: error.message,
      scientificName: req.body?.scientificName || null,
      enriched: false,
      data: null
    });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    console.log('💬 Chat request received');
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const accessToken = await getAccessToken();

    const systemMessage = {
      role: 'system',
      content: `Ты — профессиональный ботаник и эксперт по растениям. 
Отвечай кратко (2-4 предложения) на вопросы о:
- Уходе за растениями (полив, свет, температура, влажность)
- Болезнях и вредителях
- Размножении и пересадке
- Выборе растений для дома и сада
- Совместимости растений

Используй эмодзи: 🌱🌿🌸🪴💧☀️🌡️

Если вопрос НЕ о растениях — вежливо откажи и попроси задать вопрос о растениях.`
    };

    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat',
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 512
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
    console.log('✅ GigaChat response received');
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
    console.error('❌ GigaChat error:', error.message);
    res.status(500).json({
      error: 'Request processing error',
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
      database: DATABASE_URL ? 'connected' : 'not configured',
      authentication: 'ready'
    }
  });
});

// ========================
// DEBUG ROUTES
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
       VALUES ('Test', 'User', '79999999999', 'testuser', $1)
       RETURNING id, username, first_name, password_hash`,
      [passwordHash]
    );
    console.log('✅ Test user created');
    res.json({
      success: true,
      credentials: { username: 'testuser', password: 'test123' }
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.json({
        message: 'User already exists',
        credentials: { username: 'testuser', password: 'test123' }
      });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/plants-direct', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Direct query to plants table');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM plants');
    const totalCount = parseInt(countResult.rows[0].count, 10);
    console.log(`DEBUG: Total plants in DB: ${totalCount}`);
    const result = await pool.query('SELECT * FROM plants ORDER BY id DESC LIMIT 50');
    console.log(`DEBUG: Found ${result.rows.length} plants directly`);
    res.json({
      success: true,
      totalCount: totalCount,
      returnedCount: result.rows.length,
      plants: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        scientific_name: row.scientific_name,
        hasImage: !!row.image,
        color: row.color,
        habitat: row.habitat,
        isRecognized: row.is_recognized
      }))
    });
  } catch (error) {
    console.error('DEBUG Error in direct query:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});


// ========================
// FEEDBACK ROUTES
// ========================

app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, phone, message, rating, suggestions } = req.body;

    // Валидация
    if (!email || !message) {
      return res.status(400).json({
        error: 'Email and message are required'
      });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({
        error: 'Message must be at least 10 characters'
      });
    }

    // Проверка email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Вставка в БД
    const result = await pool.query(
      `INSERT INTO feedback (name, email, message, rating, suggestions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, created_at`,
      [name || null, email, message, rating ? parseInt(rating) : null || null, suggestions || null]
    );
    

    console.log(`✅ Feedback received from: ${email}`);
    console.log(`📝 Message: ${message.substring(0, 50)}...`);

    res.status(201).json({
      success: true,
      message: 'Feedback sent successfully',
      feedback: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error saving feedback:', error);
    res.status(500).json({
      error: 'Failed to save feedback',
      details: error.message
    });
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
});

// ========================
// GARDEN ENDPOINTS
// ========================

// Инициализация таблицы garden_diary
app.post('/api/garden/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS garden_diary (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        title VARCHAR(255) NOT NULL,
        text TEXT,
        photo_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_garden_diary_user_id ON garden_diary(user_id);
      CREATE INDEX IF NOT EXISTS idx_garden_diary_date ON garden_diary(date);
    `);
    res.json({ message: 'Garden diary table initialized successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database initialization failed' });
  }
});


// Задачи
app.post('/api/garden/tasks', async (req, res) => {
  try {
    const { userId, title, dueDate, urgent, description } = req.body;
    const result = await pool.query(
      `INSERT INTO garden_tasks (user_id, title, due_date, completed, urgent, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, title, dueDate, false, urgent || false, description || null]
      //                        ↑ НОВАЯ ЗАДАЧА ВСЕГДА false
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/garden/tasks/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM garden_tasks WHERE user_id = $1 ORDER BY due_date ASC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/garden/tasks/:taskId', async (req, res) => {
  try {
    const { completed } = req.body;
    const result = await pool.query(
      `UPDATE garden_tasks SET completed = $1 WHERE id = $2 RETURNING *`,
      [completed, req.params.taskId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/garden/tasks/:taskId', async (req, res) => {
  try {
    await pool.query(`DELETE FROM garden_tasks WHERE id = $1`, [req.params.taskId]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Полив
app.post('/api/garden/watering', async (req, res) => {
  try {
    const { userId, plant, frequency, amount, description } = req.body;
    const result = await pool.query(
      `INSERT INTO garden_watering (user_id, plant, frequency, amount, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, plant, frequency, amount || null, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/garden/watering/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM garden_watering WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/garden/watering/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM garden_watering WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удобрения
app.post('/api/garden/fertilizer', async (req, res) => {
  try {
    const { userId, name, type, schedule, amount, description } = req.body;
    const result = await pool.query(
      `INSERT INTO garden_fertilizer (user_id, name, type, schedule, amount, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, type || 'минеральное', schedule, amount || null, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/garden/fertilizer/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM garden_fertilizer WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/garden/fertilizer/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM garden_fertilizer WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Дневник
app.post('/api/garden/diary', async (req, res) => {
  try {
    const { userId, title, text, date } = req.body;

    // ✅ Проверьте, что userId существует в users
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(400).json({ 
        error: 'User not found', 
        userId: userId 
      });
    }

    // Только после проверки вставляйте запись
    const result = await pool.query(
      `INSERT INTO garden_diary (user_id, title, text, date) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [userId, title, text, date]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving diary:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code 
    });
  }
});

app.get('/api/garden/diary/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM garden_diary WHERE user_id = $1 ORDER BY date DESC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/garden/diary/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM garden_diary WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Урожай
app.post('/api/garden/harvest', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const result = await pool.query(
      `INSERT INTO garden_harvest (user_id, amount)
       VALUES ($1, $2) RETURNING *`,
      [userId, parseFloat(amount)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/garden/harvest/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM garden_harvest WHERE user_id = $1 ORDER BY date DESC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/garden/harvest/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM garden_harvest WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ========================
// START SERVER
// ========================

app.listen(PORT, () => {
  console.log(`🌿 FloroMate API running on http://localhost:${PORT}`);
  console.log(`🗄️ PostgreSQL: ${DATABASE_URL}`);
  console.log('📝 Available endpoints:');
  console.log('  POST /api/identify - Plant identification');
  console.log('  POST /api/chat - AI chat');
  console.log('  GET /api/plants - Get all plants');
  console.log('  GET /api/plants/search?query=... - Search plants');
  console.log('  POST /api/plants/recognize - Add recognized plant');
  console.log('  POST /api/plants/enrich - Enrich plant with Groq');
  console.log('  POST /api/plants/disease-detect - Disease detection');
  console.log('  GET /api/health - API health check');
});

module.exports = app;

// ============================================
// API ROUTE: /api/garden-chat - GARDEN AI
// ============================================
app.post('/api/garden-chat', async (req, res) => {
  try {
    const { userMessage, gardenContext } = req.body;

    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    console.log('🌱 Garden AI Request:', userMessage);

    // 🔐 Получаем токен
    const token = await getAccessToken();

    // 📝 Системный промпт для ИИ
  const systemPrompt = `Ты — профессиональный агроном и опытный садовод с 20-летним стажем. 
Ты помогаешь людям решать проблемы с растениями в огороде и саду.

Когда пользователь описывает проблему или состояние сада — ТЫ ОБЯЗАТЕЛЬНО:

1. Даёшь точный анализ причины проблемы (2–4 предложения).
2. Предлагаешь КОНКРЕТНЫЕ действия: что делать, когда, как.
3. Всегда рекомендуешь подходящие удобрения — с ПРИМЕРАМИ реальных препаратов (например: аммиачная селитра, суперфосфат, калийная соль, Кемира, Фертика, куриный помёт и т.д.).
4. Даёшь точный режим полива: сколько литров, как часто, утром/вечером, под корень или опрыскивание.
5. Создаёшь практичные задачи с чёткими инструкциями.
6. Добавляешь запись в дневник сада с планом действий.

ОТВЕЧАЙ ИСКЛЮЧИТЕЛЬНО ВАЛИДНЫМ JSON В ЭТОМ ФОРМАТЕ (без markdown, без лишнего текста):

{
  "analysis": "Краткий, но точный анализ проблемы и главная причина",
  "tasks": [
    {
      "title": "Конкретное действие с эмодзи (например: '🌿 Полить помидоры тёплой водой')",
      "dueDate": "YYYY-MM-DD (ближайший подходящий день)",
      "urgent": true или false,
      "description": "Подробная инструкция: как, сколько, чем, когда именно"
    }
  ],
  "watering": [
    {
      "plant": "Точное название растения",
      "frequency": "каждый день / через день / 2 раза в неделю и т.д.",
      "amount": "1–2 литра под куст / 0.5 литра на растение и т.д.",
      "description": "Подробно: время суток, температура воды, способ полива"
    }
  ],
  "fertilizer": [
    {
      "name": "Конкретное удобрение с эмодзи (например: '🌾 Аммиачная селитра', '🍂 Куриный помёт', '🧪 Фертика Универсал')",
      "type": "минеральное / органическое / комплексное",
      "schedule": "раз в неделю / раз в 10 дней / раз в 2 недели",
      "amount": "10 г на 10 л воды / 1 ст. ложка на куст и т.д.",
      "description": "Зачем нужно, как вносить (под корень, по листу), меры предосторожности"
    }
  ],
  "diaryEntry": {
    "title": "Краткий заголовок события/проблемы",
    "text": "Полное описание: что произошло, причина, что делаем для решения, план на ближайшие дни"
  }
}

СТРОГИЕ ПРАВИЛА:
— ВСЕГДА возвращай ВСЕ поля (даже если массив пустой — оставь [])
— ВСЕГДА предлагай хотя бы одно удобрение, если проблема связана с ростом, цветением, плодоношением или внешним видом
— Удобрения — только реальные, доступные в магазинах (не выдуманные)
— Даты — в формате YYYY-MM-DD, используй текущую дату ± несколько дней
— НИКАКОГО текста вне JSON! Ни "Вот рекомендации", ни \`\`\`json
— Если не уверен — всё равно дай рекомендации на основе типичных причин

ПРИМЕРЫ ХОРОШИХ ОТВЕТОВ:

Проблема: "Помидоры желтеют"
{
  "analysis": "Пожелтение листьев помидоров указывает на дефицит азота. Необходимо срочно внести азотное удобрение и обеспечить стабильный полив.",
  "tasks": [
    {
      "title": "🌿 Внести азотное удобрение под помидоры",
      "dueDate": "2025-12-22",
      "urgent": true,
      "description": "Развести селитру 10 грамм на 10 литров воды. Полить раствором 1 литр под каждый куст вечером по влажной почве."
    }
  ],
  "watering": [
    {
      "plant": "Помидоры",
      "frequency": "каждый день",
      "amount": "1-2 литра под куст",
      "description": "Поливать только под корень, избегая попадания на листья. Лучше рано утром или вечером."
    }
  ],
  "fertilizer": [
    {
      "name": "🌾 Азотное удобрение (селитра)",
      "type": "минеральное",
      "schedule": "раз в 10 дней",
      "amount": "10 грамм на 10 литров воды",
      "description": "Азот стимулирует рост листвы. Вносить с начала вегетации до появления цветов."
    }
  ],
  "diaryEntry": {
    "title": "Дефицит азота у помидоров",
    "text": "Обнаружены признаки нехватки азота: пожелтение нижних листьев. Запланирована подкормка селитрой и нормализация режима полива."
  }
}`;


    // 🤖 Отправляем запрос к Gigachat
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Проблема с садом: ${userMessage}\n\nТекущее состояние сада:\n${JSON.stringify(
          gardenContext,
          null,
          2,
        )}`,
      },
    ];

    const chatResponse = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat',
        messages,
        temperature: 0.7,
        top_p: 0.1,
        max_tokens: 2000,
        stream: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      },
    );

    const aiText = chatResponse.data.choices[0].message.content;
    console.log('🤖 AI Response:', aiText);

    // 🎯 Парсим JSON из ответа
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI не вернул корректный JSON');
    }

    const gardenData = JSON.parse(jsonMatch[0]);

    console.log('✅ Parsed Garden Data:', gardenData);
    res.json(gardenData);
  } catch (error) {
    console.error('❌ Garden AI Error:', error.message);
    res.status(500).json({
      error: error.message || 'Garden AI processing error',
    });
  }
});

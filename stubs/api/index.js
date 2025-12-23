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
    console.log(`🤖 Groq processing: ${scientificName}`);

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
      console.log('🔌 Using proxy for Groq');
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Ты ботаник-эксперт. Отвечай ТОЛЬКО валидным JSON без markdown блоков и комментариев.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1024
      },
      axiosConfig
    );

    let content = response.data.choices[0].message.content.trim();
    
    // Clean up markdown code blocks if present
    content = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/```/g, '')
      .trim();

    console.log('📝 Raw Groq response:', content.substring(0, 200) + '...');

    const plantData = JSON.parse(content);

    console.log(`✅ Groq enriched: ${plantData.name || scientificName}`);
    console.log('📊 Fields received:', Object.keys(plantData).join(', '));

    return plantData;

  } catch (error) {
    console.error('❌ Groq error:', error.message);
    if (error.response?.data) {
      console.error('Groq API error:', error.response.data);
    }
    return null;
  }
}

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
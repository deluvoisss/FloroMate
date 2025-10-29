// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');  

const app = express();
const PORT = 3002;

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// ===== ВАЖНО: Используйте Authorization key из личного кабинета =====
const GIGACHAT_AUTH_KEY = 'MDE5YTFhYmMtZjJkNC03MmE2LThiNzMtMmI3YjM1ZjVmMDVhOjY4YzgyNjJmLTNkN2EtNDEwMi1hMDlkLThjMDk2OWI5NDAwYg==';
const GIGACHAT_SCOPE = 'GIGACHAT_API_PERS';

// Кэш токена
let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  // Проверяем, есть ли действительный токен
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('🔑 Используем кэшированный токен');
    return cachedToken;
  }

  try {
    console.log('🔑 Запрашиваем новый токен...');
    
    const response = await axios.post(
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      new URLSearchParams({
        scope: GIGACHAT_SCOPE
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': uuidv4(), // UUID v4 формат
          'Authorization': `Basic ${GIGACHAT_AUTH_KEY}`
        },
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      }
    );
    
    cachedToken = response.data.access_token;
    // Токен действует 30 минут, сохраняем время истечения
    tokenExpiry = Date.now() + (29 * 60 * 1000); // 29 минут для надежности
    
    console.log('✅ Токен получен успешно');
    return cachedToken;
  } catch (error) {
    console.error('❌ Ошибка получения токена:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    console.log('📨 Получен запрос на чат');
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Неверный формат сообщений' });
    }
    
    const accessToken = await getAccessToken();
    
    const systemMessage = {
      role: 'system',
      content: 'Ты - эксперт по растениям и садоводству. Отвечай подробно и полезно на вопросы о растениях, их уходе, болезнях и выращивании. Используй эмодзи растений 🌱🌿🌸. Не отвечай на вопросы несвязанные с растениями'
    };
    
    console.log('💬 Отправляем запрос в GigaChat...');
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
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      }
    );
    
    const aiResponse = response.data.choices[0].message.content;
    console.log('✅ Ответ получен от GigaChat');
    
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('❌ Ошибка GigaChat:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    res.status(500).json({ 
      error: 'Ошибка обработки запроса',
      details: error.response?.data || error.message
    });
  }
});

// Тестовый endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Сервер работает!' });
});

// Тест получения токена
app.get('/api/test-token', async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ 
      status: 'success', 
      message: 'Токен получен',
      tokenLength: token.length 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      details: error.response?.data 
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Сервер запущен на http://localhost:${PORT}`);
  console.log(`📡 React должен быть на http://localhost:3000`);
  console.log(`🧪 Тест сервера: http://localhost:${PORT}/api/test`);
  console.log(`🔑 Тест токена: http://localhost:${PORT}/api/test-token\n`);
});

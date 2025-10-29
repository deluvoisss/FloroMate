import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const GIGACHAT_API_URL = 'https://api.gigachat.ai/chat'; // замените на актуальный адрес
const GIGACHAT_API_KEY = 'your_gigachat_api_key_here';

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Неверный формат сообщений' });
  }

  try {
    const response = await fetch(GIGACHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GIGACHAT_API_KEY}`
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GigaChat error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const aiResponse = data.response || 'AI ответ отсутствует.';

    res.json({ response: aiResponse });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🤖 GigaChat сервер запущен на порту ${PORT}`);
});

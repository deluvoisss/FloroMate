import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector } from '../../store/hooks';
import './ChatAssistant.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Привет! Я AI-помощник по растениям 🌿 Задайте мне вопрос о уходе за растениями!'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ← ДОБАВИТЬ: Получаем данные пользователя
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const userSubscription = user?.subscription;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // ← ДОБАВИТЬ: Проверка авторизации
    if (!isAuthenticated) {
      setMessages([...messages, {
        role: 'assistant',
        content: '🔒 Пожалуйста, войдите в систему, чтобы использовать AI-ассистента.'
      }]);
      return;
    }

    // ← ДОБАВИТЬ: Проверка лимита запросов
    if (userSubscription && userSubscription.usedRequests >= userSubscription.dailyRequests) {
      setMessages([...messages, {
        role: 'assistant',
        content: `🚫 Достигнут лимит запросов на сегодня (${userSubscription.dailyRequests}). Обновите подписку для продолжения.`
      }]);
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          userId: user?.id // ← ДОБАВИТЬ: отправляем userId для учета запросов
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setMessages([...newMessages, {
        role: 'assistant',
        content: data.response
      }]);

    } catch (error) {
      console.error('Ошибка:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте позже.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQuestions: string[] = [
    'Как ухаживать за монстерой?',
    'Какие растения подходят для дома?',
    'Почему желтеют листья?',
    'Как часто поливать кактус?'
  ];

  return (
    <>
      {!isOpen && (
        <button
          className="chat-assistant-button"
          onClick={() => setIsOpen(true)}
          aria-label="Открыть чат"
        >
          🤖 AI
        </button>
      )}

      {isOpen && (
        <div className="chat-assistant-container">
          <div className="chat-assistant-header">
            <div>
              <div className="chat-assistant-title">Растительный AI</div>
              <div className="chat-assistant-status">● Онлайн</div>
              {/* ← ДОБАВИТЬ: Показываем лимит запросов */}
              {isAuthenticated && userSubscription && (
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '4px' }}>
                  Запросов: {userSubscription.usedRequests}/{userSubscription.dailyRequests}
                </div>
              )}
            </div>
            <button
              className="chat-assistant-close"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          <div className="chat-assistant-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message chat-message-${msg.role}`}>
                <div className="chat-message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="chat-message-content">{msg.content}</div>
              </div>
            ))}

            {isLoading && (
              <div className="chat-message chat-message-assistant">
                <div className="chat-message-avatar">🤖</div>
                <div className="chat-message-loading">...</div>
              </div>
            )}

            {messages.length === 1 && (
              <div className="chat-quick-questions">
                <div className="chat-quick-title">Популярные вопросы:</div>
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    className="chat-quick-question"
                    onClick={() => {
                      setInputValue(question);
                      setTimeout(() => sendMessage(), 100);
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-assistant-input-container">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Задайте вопрос о растениях..."
              rows={1}
              disabled={isLoading}
              className="chat-input"
            />
            <button
              className="chat-send-button"
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
            >
              ➤
            </button>
          </div>

          <div className="chat-assistant-footer">Powered by GigaChat AI</div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;

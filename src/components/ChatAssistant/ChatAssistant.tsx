import React, { useState, useRef, useEffect } from 'react';
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // ОБНОВЛЁННЫЙ АДРЕС - теперь один сервер на порту 3001
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages
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
          className="chat-toggle-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Открыть чат"
        >
          AI
        </button>
      )}

      {isOpen && (
        <div className="chat-container">
          <div className="chat-header">
            <h3>Растительный AI</h3>
            <span className="status-indicator">● Онлайн</span>
            <button
              className="chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message message-${msg.role}`}>
                <span className="message-icon">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </span>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}

            {isLoading && (
              <div className="message message-assistant">
                <span className="message-icon">🤖</span>
                <div className="message-content loading">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="quick-questions">
              <p>Популярные вопросы:</p>
              {quickQuestions.map((question, index) => (
                <button
                  key={index}
                  className="quick-question-btn"
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

          <div className="chat-input-area">
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
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="send-btn"
            >
              📤
            </button>
          </div>

          <p className="powered-by">Powered by GigaChat AI</p>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
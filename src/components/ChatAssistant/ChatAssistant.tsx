import React, { useState, useRef, useEffect } from 'react';
import './ChatAssistant.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Привет! Я AI-помощник по растениям 🌿 Задайте мне вопрос о уходе за растениями!'
    }
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
      const response = await fetch('http://localhost:3002/api/chat', {
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
          className="chat-button"
          onClick={() => setIsOpen(true)}
          aria-label="Открыть чат"
        >
          <span className="chat-icon">🤖</span>
          <span className="chat-badge">AI</span>
        </button>
      )}

      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">🌿</div>
              <div>
                <h3>Растительный AI</h3>
                <span className="chat-status">● Онлайн</span>
              </div>
            </div>
            <button 
              className="chat-close"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="chat-message assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="quick-questions">
              <p className="quick-title">Популярные вопросы:</p>
              {quickQuestions.map((question, index) => (
                <button
                  key={index}
                  className="quick-question"
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

          <div className="chat-input-container">
            <textarea
              className="chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Задайте вопрос о растениях..."
              rows={1}
              disabled={isLoading}
            />
            <button
              className="chat-send"
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              aria-label="Отправить"
            >
              ➤
            </button>
          </div>

          <div className="chat-footer">
            Powered by GigaChat AI
          </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;

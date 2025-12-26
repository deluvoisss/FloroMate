import React, { useState, useRef, useEffect } from 'react';
import './LandscapeDesign.css';

const LandscapeDesign: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultSectionRef = useRef<HTMLDivElement>(null);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Функция для показа toast уведомления
  const showToast = (message: string) => {
    // Очищаем предыдущий таймер если есть
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    // Скрываем предыдущий toast
    setToast({ message, visible: false });
    
    // Показываем новый toast с небольшой задержкой для анимации
    setTimeout(() => {
      setToast({ message, visible: true });
      
      // Автоматически скрываем через 5 секунд
      toastTimeoutRef.current = setTimeout(() => {
        setToast(prev => prev ? { ...prev, visible: false } : null);
      }, 5000);
    }, 50);
  };

  // Скрываем toast при изменении ввода
  const handleInputChange = () => {
    if (toast) {
      setToast({ ...toast, visible: false });
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleInputChange();
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setStatus({ type: 'error', message: '❌ Пожалуйста, загрузите изображение (JPG, PNG)' });
        return;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setStatus({ type: 'error', message: '❌ Файл слишком большой. Максимальный размер: 10MB' });
        return;
      }

      const minSize = 100 * 1024;
      if (file.size < minSize) {
        setStatus({ type: 'error', message: '❌ Файл слишком маленький. Минимальный размер: 100KB' });
        return;
      }

      setSelectedImage(file);
      setResultUrl(null);
      setStatus(null);
      
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setStatus({ type: 'error', message: '❌ Пожалуйста, загрузите изображение (JPG, PNG)' });
        return;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setStatus({ type: 'error', message: '❌ Файл слишком большой. Максимальный размер: 10MB' });
        return;
      }

      const minSize = 100 * 1024;
      if (file.size < minSize) {
        setStatus({ type: 'error', message: '❌ Файл слишком маленький. Минимальный размер: 100KB' });
        return;
      }

      setSelectedImage(file);
      setResultUrl(null);
      setStatus(null);
      
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleGenerate = async () => {
    if (!selectedImage && !customPrompt.trim()) {
      setStatus({ type: 'error', message: '❌ Пожалуйста, загрузите фото или введите описание ландшафта' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: '⏳ Отправка запроса на обработку...' });
    setResultUrl(null);

    try {
      const formData = new FormData();
      if (selectedImage) {
        formData.append('image', selectedImage);
      }
      if (customPrompt.trim()) {
        formData.append('prompt', customPrompt.trim());
      }

      const response = await fetch('http://147.45.184.57/api/landscape/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
        
        // Если есть детальное сообщение в debug, показываем его в toast
        if (errorData.debug?.contentPreview) {
          showToast(errorData.debug.contentPreview);
        }
        
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        // Если есть детальное сообщение в debug, показываем его в toast
        if (data.debug?.contentPreview) {
          showToast(data.debug.contentPreview);
        }
        throw new Error(data.error || data.message);
      }

      if (data.imageUrl) {
        setResultUrl(data.imageUrl);
        setStatus({ type: 'success', message: '✅ Ландшафт успешно обработан!' });
        // Скрываем toast при успехе
        if (toast) {
          setToast({ ...toast, visible: false });
        }
        
        // Плавно прокручиваем к результату
        setTimeout(() => {
          resultSectionRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 100);
      } else {
        throw new Error('Не удалось получить обработанное изображение');
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      const errorMessage = error instanceof Error ? error.message : 'Произошла ошибка при обработке';
      setStatus({ 
        type: 'error', 
        message: errorMessage
      });
      // Детальное сообщение уже показано в toast выше в блоке if (!response.ok)
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResultUrl(null);
    setCustomPrompt('');
    setStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="landscape-design-page">
      <div className="landscape-container">
        <div className="landscape-header">
          <h1>🌿 Дизайн ландшафта</h1>
          <p className="subtitle">
            Загрузите фото вашего участка или опишите желаемый ландшафт, и мы создадим для вас дизайн с красивыми растениями
          </p>
        </div>

        <div className="landscape-form">
          <div className="upload-section">
            <label className="section-label">📸 Загрузите фото (необязательно)</label>
            <div
              className="dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="preview-container">
                  <img src={previewUrl} alt="Превью" className="preview-image" />
                  <div className="preview-overlay">
                    <span className="preview-text">Нажмите для замены фото</span>
                  </div>
                </div>
              ) : (
                <div className="dropzone-content">
                  <div className="dropzone-icon">📸</div>
                  <p className="dropzone-text">Перетащите фото сюда или нажмите для выбора</p>
                  <p className="dropzone-hint">Формат: JPG, PNG (от 100KB до 10MB)</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
          </div>

          <div className="prompt-section">
            <label className="section-label" htmlFor="custom-prompt">
              ✍️ Опишите желаемый ландшафт (необязательно)
            </label>
            <textarea
              id="custom-prompt"
              className="prompt-input"
              placeholder="Например: Добавь розы, кустарники и небольшой пруд. Сделай сад в английском стиле с аккуратными дорожками..."
              value={customPrompt}
              onChange={(e) => {
                handleInputChange();
                setCustomPrompt(e.target.value);
              }}
              rows={4}
            />
            <p className="prompt-hint">
              Опишите ваши пожелания к ландшафту. Если загружено фото, описание будет использовано для улучшения результата.
            </p>
          </div>

          {status && (
            <div className={`status-message status-${status.type}`}>
              {status.message}
            </div>
          )}

          <div className="button-group">
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={(!selectedImage && !customPrompt.trim()) || loading}
            >
              {loading ? '⏳ Обработка...' : '✨ Создать дизайн'}
            </button>
            {(selectedImage || customPrompt.trim() || resultUrl) && (
              <button
                className="btn-secondary"
                onClick={handleReset}
                disabled={loading}
              >
                🔄 Сбросить
              </button>
            )}
          </div>
        </div>

        {resultUrl && (
          <div className="result-section" ref={resultSectionRef}>
            <h2>🎨 Результат обработки</h2>
            <div className="result-image-container">
              <img src={resultUrl} alt="Обработанный ландшафт" className="result-image" />
            </div>
            <div className="result-actions">
              <a
                href={resultUrl}
                download="landscape-design.jpg"
                className="btn-download"
              >
                💾 Скачать результат
              </a>
            </div>
          </div>
        )}

        {/* Toast уведомление */}
        {toast && (
          <div className={`toast ${toast.visible ? 'toast-visible' : 'toast-hidden'}`}>
            <div className="toast-content">
              <div className="toast-icon">ℹ️</div>
              <div className="toast-message">{toast.message}</div>
              <button 
                className="toast-close"
                onClick={() => {
                  setToast({ ...toast, visible: false });
                  if (toastTimeoutRef.current) {
                    clearTimeout(toastTimeoutRef.current);
                  }
                }}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandscapeDesign;
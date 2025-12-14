import React, { useState, useRef } from 'react';
import './LandscapeDesign.css';

const LandscapeDesign: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!selectedImage) {
      setStatus({ type: 'error', message: '❌ Пожалуйста, загрузите фото ландшафта' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: '⏳ Отправка фото на обработку...' });
    setResultUrl(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('http://localhost:3001/api/landscape/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.imageUrl) {
        setResultUrl(data.imageUrl);
        setStatus({ type: 'success', message: '✅ Ландшафт успешно обработан!' });
      } else {
        throw new Error('Не удалось получить обработанное изображение');
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      setStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Произошла ошибка при обработке' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResultUrl(null);
    setStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="landscape-design-page">
      <div className="landscape-container">
        <div className="landscape-header">
          <h1>🌿 Дизайн ландшафта по фото</h1>
          <p className="subtitle">
            Загрузите фото вашего участка, и мы создадим для вас дизайн с красивыми растениями
          </p>
          <div className="requirements">
            <p className="requirements-title">📋 Требования к изображению:</p>
            <ul className="requirements-list">
              <li>Формат: JPG, PNG</li>
              <li>Размер: от 100KB до 10MB</li>
              <li>Рекомендуется: фото ландшафта, участка или сада</li>
              <li>Разрешение: чем выше, тем лучше результат</li>
            </ul>
          </div>
        </div>

        <div className="landscape-form">
          <div className="upload-section">
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
                  <p className="dropzone-hint">Поддерживаются форматы: JPG, PNG</p>
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

          {status && (
            <div className={`status-message status-${status.type}`}>
              {status.message}
            </div>
          )}

          <div className="button-group">
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={!selectedImage || loading}
            >
              {loading ? '⏳ Обработка...' : '✨ Создать дизайн'}
            </button>
            {(selectedImage || resultUrl) && (
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
          <div className="result-section">
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
      </div>
    </div>
  );
};

export default LandscapeDesign;

import React, { useState } from 'react';
import './PlantRecognition.css';

interface PlantResult {
  species?: {
    commonNames?: string[];
    scientificNameWithoutAuthor?: string;
  };
  genus?: {
    scientificNameWithoutAuthor: string;
  };
  family?: {
    scientificNameWithoutAuthor: string;
  };
  score: number;
}

interface RecognitionResponse {
  results?: PlantResult[];
  error?: string;
  suggestion?: string;
}

const PlantRecognition: React.FC = () => {
  const [flowerImage, setFlowerImage] = useState<File | null>(null);
  const [leafImage, setLeafImage] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [results, setResults] = useState<PlantResult[]>([]);
  const [bestMatch, setBestMatch] = useState<PlantResult | null>(null);

  const handleFlowerImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFlowerImage(e.target.files[0]);
      console.log('📸 Выбрано фото цветка:', e.target.files[0].name);
    }
  };

  const handleLeafImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setLeafImage(e.target.files[0]);
      console.log('🍃 Выбрано фото листа:', e.target.files[0].name);
    }
  };

  const getPlantName = (plant: PlantResult) => {
    if (plant.species?.commonNames && plant.species.commonNames.length > 0)
      return plant.species.commonNames[0];
    if (plant.species?.scientificNameWithoutAuthor)
      return plant.species.scientificNameWithoutAuthor;
    if (plant.genus?.scientificNameWithoutAuthor)
      return `Род: ${plant.genus.scientificNameWithoutAuthor}`;
    if (plant.family?.scientificNameWithoutAuthor)
      return `Семейство: ${plant.family.scientificNameWithoutAuthor}`;
    return 'Неизвестное растение';
  };

  const handleIdentify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!flowerImage && !leafImage) {
      setStatus({ type: 'error', message: '❌ Загрузите хотя бы одно изображение' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: '⏳ Анализ изображений...' });
    console.log('🚀 Отправка запроса на сервер...');

    try {
      const formData = new FormData();

      if (flowerImage) {
        formData.append('flower', flowerImage);
        console.log('➕ Добавлено фото цветка');
      }

      if (leafImage) {
        formData.append('leaf', leafImage);
        console.log('➕ Добавлено фото листа');
      }

      const response = await fetch('http://localhost:3001/identify', {
        method: 'POST',
        body: formData,
      });

      console.log('📥 Ответ получен, статус:', response.status);

      const data: RecognitionResponse = await response.json();
      console.log('📊 Данные ответа:', data);

      if (!response.ok || data.error) {
        const errorMsg = `❌ ${data.error || 'Ошибка при определении растения'}`;
        const suggestion = data.suggestion ? `\n\n💡 ${data.suggestion}` : '';
        setStatus({
          type: 'error',
          message: errorMsg + suggestion
        });
        setResults([]);
        setBestMatch(null);
      } else if (data.results && data.results.length > 0) {
        const sortedResults = [...data.results].sort((a, b) => b.score - a.score);
        setStatus({
          type: 'success',
          message: `✅ Найдено ${data.results.length} совпадений!`
        });
        setResults(sortedResults);
        setBestMatch(sortedResults[0]);
      } else {
        setStatus({ type: 'info', message: 'ℹ️ Растение не найдено в базе' });
        setResults([]);
        setBestMatch(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('❌ Ошибка запроса:', error);
      setStatus({
        type: 'error',
        message: `❌ Ошибка подключения к серверу\n\n💡 Убедитесь, что:\n1. Сервер запущен на http://localhost:3001\n2. Используйте: node server.js\n\nОшибка: ${errorMessage}`
      });
      setResults([]);
      setBestMatch(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFlowerImage(null);
    setLeafImage(null);
    setResults([]);
    setBestMatch(null);
    setStatus(null);
    console.log('🔄 Сброс формы');
  };

  return (
    <div className="plant-recognition-page">
      <div className="recognition-container">
        <div className="recognition-header">
          <h1>🌿 Определение растений</h1>
          <p className="subtitle">Загрузите фото цветка или листа для точного определения</p>
        </div>

        <form onSubmit={handleIdentify} className="recognition-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="flower-input" className="form-label">
                📸 Фото цветка
              </label>
              <input
                id="flower-input"
                type="file"
                accept="image/*"
                onChange={handleFlowerImageChange}
                disabled={loading}
                className="file-input"
              />
              {flowerImage && (
                <div className="file-preview">
                  <span className="preview-icon">✓</span>
                  <span className="preview-text">{flowerImage.name}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="leaf-input" className="form-label">
                🍃 Фото листа
              </label>
              <input
                id="leaf-input"
                type="file"
                accept="image/*"
                onChange={handleLeafImageChange}
                disabled={loading}
                className="file-input"
              />
              {leafImage && (
                <div className="file-preview">
                  <span className="preview-icon">✓</span>
                  <span className="preview-text">{leafImage.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="button-group">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? '⏳ Анализ...' : '🔍 Определить растение'}
            </button>
            <button type="button" onClick={handleReset} disabled={loading} className="btn-secondary">
              🔄 Сбросить
            </button>
          </div>
        </form>

        {status && (
          <div className={`status ${status.type}`}>
            {status.message}
          </div>
        )}

        {bestMatch && (
          <div className="best-match">
            <h2 className="result-title">🏆 Лучший результат</h2>
            <div className="plant-item featured">
              <div className="plant-name">
                {getPlantName(bestMatch)}
              </div>
              {bestMatch.species?.scientificNameWithoutAuthor && (
                <div className="plant-info">
                  <strong>Научное название:</strong> <em>{bestMatch.species.scientificNameWithoutAuthor}</em>
                </div>
              )}
              {bestMatch.genus?.scientificNameWithoutAuthor && (
                <div className="plant-info">
                  <strong>Род:</strong> <em>{bestMatch.genus.scientificNameWithoutAuthor}</em>
                </div>
              )}
              {bestMatch.family?.scientificNameWithoutAuthor && (
                <div className="plant-info">
                  <strong>Семейство:</strong> <em>{bestMatch.family.scientificNameWithoutAuthor}</em>
                </div>
              )}
              <div className="plant-info confidence">
                <strong>Уверенность:</strong>
                <div className="confidence-bar-container">
                  <div 
                    className="confidence-bar" 
                    style={{ width: `${bestMatch.score * 100}%` }}
                  ></div>
                  <span className="confidence-text">{(bestMatch.score * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {results.length > 1 && (
          <div className="all-results">
            <h2 className="result-title">📋 Другие совпадения</h2>
            <div className="results-list">
              {results.slice(1).map((plant, index) => (
                <div key={index + 1} className="plant-item">
                  <div className="plant-name">
                    {getPlantName(plant)}
                  </div>
                  {plant.species?.scientificNameWithoutAuthor && (
                    <div className="plant-info">
                      <strong>Научное название:</strong> {plant.species.scientificNameWithoutAuthor}
                    </div>
                  )}
                  <div className="plant-info">
                    <strong>Уверенность:</strong> {(plant.score * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlantRecognition;

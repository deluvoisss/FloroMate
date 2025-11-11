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
  const [loading, setLoading] = useState(false);
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

  const getPlantName = (plant: PlantResult): string => {
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

  const handleIdentify = async (e: React.FormEvent) => {
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

      // ОБНОВЛЁННЫЙ АДРЕС - теперь один сервер на порту 3001
      const response = await fetch('/api/identify', {
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
        message: `❌ Ошибка подключения к серверу\n\n💡 Убедитесь, что:\n1. Сервер запущен на http://localhost:3001\n2. Используйте: node server/server.js\n\nОшибка: ${errorMessage}`
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
    <div className="plant-recognition-container">
      <h2>🌿 Определение растений</h2>
      <p>Загрузите фото цветка или листа для точного определения</p>

      <form onSubmit={handleIdentify} className="recognition-form">
        <div className="image-upload-group">
          <label htmlFor="flower-input" className="upload-label">
            📸 Фото цветка
          </label>
          <input
            id="flower-input"
            type="file"
            accept="image/*"
            onChange={handleFlowerImageChange}
            className="file-input"
          />
          {flowerImage && (
            <div className="file-info">
              ✓ {flowerImage.name}
            </div>
          )}
        </div>

        <div className="image-upload-group">
          <label htmlFor="leaf-input" className="upload-label">
            🍃 Фото листа
          </label>
          <input
            id="leaf-input"
            type="file"
            accept="image/*"
            onChange={handleLeafImageChange}
            className="file-input"
          />
          {leafImage && (
            <div className="file-info">
              ✓ {leafImage.name}
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="identify-btn">
          {loading ? '⏳ Анализ...' : '🔍 Определить растение'}
        </button>

        <button type="button" onClick={handleReset} className="reset-btn">
          🔄 Сбросить
        </button>
      </form>

      {status && (
        <div className={`status-message status-${status.type}`}>
          {status.message}
        </div>
      )}

      {bestMatch && (
        <div className="best-match">
          <h3>🏆 Лучший результат</h3>
          <h4>{getPlantName(bestMatch)}</h4>

          {bestMatch.species?.scientificNameWithoutAuthor && (
            <p>Научное название: <em>{bestMatch.species.scientificNameWithoutAuthor}</em></p>
          )}

          {bestMatch.genus?.scientificNameWithoutAuthor && (
            <p>Род: <em>{bestMatch.genus.scientificNameWithoutAuthor}</em></p>
          )}

          {bestMatch.family?.scientificNameWithoutAuthor && (
            <p>Семейство: <em>{bestMatch.family.scientificNameWithoutAuthor}</em></p>
          )}

          <p className="confidence">
            Уверенность: <strong>{(bestMatch.score * 100).toFixed(1)}%</strong>
          </p>
        </div>
      )}

      {results.length > 1 && (
        <div className="other-matches">
          <h3>📋 Другие совпадения</h3>
          {results.slice(1).map((plant, index) => (
            <div key={index} className="match-item">
              <p>{getPlantName(plant)}</p>
              {plant.species?.scientificNameWithoutAuthor && (
                <p className="scientific-name">{plant.species.scientificNameWithoutAuthor}</p>
              )}
              <p className="score">Уверенность: {(plant.score * 100).toFixed(1)}%</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlantRecognition;
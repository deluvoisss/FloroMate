import React, { useState, ChangeEvent, FormEvent } from 'react';
import './DiseaseDetection.css';

interface DiseaseResult {
  name: string;
  probability: number;
  scientific_name?: string;
  description?: string;
  treatment?: string;
  common_names?: string[];
  url?: string;
}

interface BestMatch {
  disease_name: string;
  confidence: number;
  scientific_name?: string;
  description?: string;
  treatment?: string;
  severity?: string;
}

interface ApiResponse {
  is_healthy: boolean;
  is_healthy_probability: number;
  diseases: DiseaseResult[];
  best_match?: BestMatch;
  error?: string;
}

const DiseaseDetection: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [bestMatch, setBestMatch] = useState<BestMatch | null>(null);
  const [allResults, setAllResults] = useState<DiseaseResult[]>([]);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      setStatus(null);
      setBestMatch(null);
      setAllResults([]);
      setIsHealthy(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!imageFile) {
      setStatus({ message: '❌ Пожалуйста, выберите изображение', type: 'error' });
      return;
    }

    setLoading(true);
    setStatus({ message: '🔍 Анализируем растение на наличие болезней...', type: 'info' });

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      console.log('Отправка запроса на анализ болезней...');

      const response = await fetch('http://localhost:3001/api/disease-detect', {
        method: 'POST',
        body: formData
      });

      console.log('Ответ получен, статус:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      console.log('Данные от API:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      setIsHealthy(data.is_healthy);

      if (data.is_healthy) {
        setStatus({ 
          message: `✅ Растение здоровое! (Уверенность: ${(data.is_healthy_probability * 100).toFixed(1)}%)`, 
          type: 'success' 
        });
        setBestMatch(null);
        setAllResults([]);
      } else {
        if (data.best_match) {
          setBestMatch(data.best_match);
          setStatus({ 
            message: '⚠️ Обнаружены проблемы со здоровьем растения', 
            type: 'error' 
          });
        } else if (data.diseases.length === 0) {
          setStatus({
            message: '🤔 Не удалось определить конкретное заболевание. Попробуйте сделать более качественное фото.',
            type: 'info'
          });
        }

        if (data.diseases && data.diseases.length > 0) {
          setAllResults(data.diseases);
        }
      }

    } catch (error) {
      console.error('Ошибка при анализе:', error);
      setStatus({ 
        message: `❌ Ошибка при анализе: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setStatus(null);
    setBestMatch(null);
    setAllResults([]);
    setIsHealthy(null);
  };

  return (
    <div className="disease-detection-page">
      <div className="detection-container">
        <div className="detection-header">
          <h1>🦠 Определение болезней растений</h1>
          <p className="subtitle">Загрузите фото растения для диагностики заболеваний</p>
        </div>

        <form onSubmit={handleSubmit} className="detection-form">
          <div className="form-group">
            <label htmlFor="image" className="form-label">
              📷 Фото растения
            </label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
              className="file-input"
            />
            {imageFile && (
              <div className="file-preview">
                <span className="preview-icon">✓</span>
                <span className="preview-text">{imageFile.name}</span>
              </div>
            )}
            {previewUrl && (
              <div className="image-preview">
                <img src={previewUrl} alt="Preview" />
              </div>
            )}
          </div>

          <div className="button-group">
            <button
              type="submit"
              disabled={loading || !imageFile}
              className="btn-primary"
            >
              {loading ? '⏳ Анализируем...' : '🔬 Проверить здоровье'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="btn-secondary"
            >
              🔄 Сбросить
            </button>
          </div>
        </form>

        {status && (
          <div className={`status ${status.type}`}>
            {status.message}
          </div>
        )}

        {isHealthy === true && (
          <div className="healthy-plant">
            <div className="healthy-icon">🌿</div>
            <h3>Растение выглядит здоровым!</h3>
            <p>Признаков заболеваний не обнаружено. Продолжайте ухаживать за вашим растением.</p>
          </div>
        )}

        {bestMatch && (
          <div className="best-match">
            <h2 className="result-title">⚠️ Основная проблема</h2>
            <div className="disease-item featured">
              <div className="disease-name">{bestMatch.disease_name}</div>
              
              {bestMatch.scientific_name && (
                <p className="disease-info">
                  <strong>Научное название:</strong> <em>{bestMatch.scientific_name}</em>
                </p>
              )}
              
              {bestMatch.severity && (
                <p className="disease-info">
                  <strong>Тип:</strong> {bestMatch.severity}
                </p>
              )}
              
              {bestMatch.description && (
                <p className="disease-info">
                  <strong>Описание:</strong> {bestMatch.description}
                </p>
              )}
              
              {bestMatch.treatment && (
                <div className="treatment-box">
                  <strong>💊 Лечение:</strong>
                  <p>{bestMatch.treatment}</p>
                </div>
              )}

              <div className="confidence-bar-container">
                <div 
                  className="confidence-bar" 
                  style={{ width: `${bestMatch.confidence * 100}%` }}
                />
                <div className="confidence-text">
                  {(bestMatch.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {allResults.length > 1 && (
          <div className="all-results">
            <h2 className="result-title">📋 Другие возможные проблемы</h2>
            <div className="results-list">
              {allResults.slice(1).map((disease, index) => (
                <div key={index} className="disease-item">
                  <div className="disease-name">{disease.name}</div>
                  
                  {disease.scientific_name && (
                    <p className="disease-info">
                      <em>{disease.scientific_name}</em>
                    </p>
                  )}

                  {disease.common_names && disease.common_names.length > 0 && (
                    <p className="disease-info">
                      <strong>Также известно как:</strong> {disease.common_names.join(', ')}
                    </p>
                  )}

                  {disease.description && (
                    <p className="disease-info">{disease.description}</p>
                  )}

                  <div className="confidence-bar-container">
                    <div 
                      className="confidence-bar" 
                      style={{ width: `${disease.probability * 100}%` }}
                    />
                    <div className="confidence-text">
                      {(disease.probability * 100).toFixed(1)}%
                    </div>
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

export default DiseaseDetection;

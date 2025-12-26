import React, { useState, ChangeEvent, FormEvent } from 'react';
import './DiseaseDetection.css';

interface DiseaseResult {
  name: string;
  probability: number;
  scientific_name?: string;
  description?: string;
  treatment?: string;
  common_names?: string[];
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
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [bestMatch, setBestMatch] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [isHealthy, setIsHealthy] = useState(null);

  const handleFileChange = (e: ChangeEvent) => {
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

      const response = await fetch('http://147.45.184.57/api/disease-detect', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setIsHealthy(data.is_healthy);
      if (data.is_healthy) {
        setStatus({
          message: `✅ Растение здоровое! (Уверенность: ${(data.is_healthy_probability * 100).toFixed(1)}%)`,
          type: 'success',
        });
        setBestMatch(null);
        setAllResults([]);
      } else {
        if (data.best_match) {
          setBestMatch(data.best_match);
          setStatus({
            message: '⚠️ Обнаружены проблемы со здоровьем растения',
            type: 'error',
          });
        } else if (data.diseases.length === 0) {
          setStatus({
            message: '🤔 Не удалось определить болезнь. Попробуйте загрузить более качественное фото.',
            type: 'info',
          });
        }

        if (data.diseases && data.diseases.length > 0) {
          setAllResults(data.diseases);
        }
      }
    } catch (error) {
      setStatus({
        message: `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        type: 'error',
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
      {/* Decorative Plants */}
      <div className="decorative-plants">
        <div className="deco-plant deco-1">🌿</div>
        <div className="deco-plant deco-2">🍃</div>
        <div className="deco-plant deco-3">🌱</div>
      </div>

      <div className="detection-wrapper">
        {/* Header */}
        <div className="detection-container">
          <div className="detection-header">
            <h1 className="page-title">🦠 Диагностика болезней растений</h1>
            <p className="page-subtitle">
              Загрузите фото больного растения — мы определим проблему и предложим решение
            </p>
          </div>

          {/* Form Section */}
          <form className="detection-form" onSubmit={handleSubmit}>
            <div className="upload-section">
              <label className="upload-label">
                <span className="label-icon">📸</span>
                Фото растения
              </label>

              <div className="file-input-wrapper">
                <input
                  type="file"
                  className="file-input"
                  onChange={handleFileChange}
                  disabled={loading}
                  accept="image/*"
                />

                {!previewUrl ? (
                  <div className="file-input-placeholder" onClick={() => document.querySelector('.file-input')?.click()}>
                    <span className="placeholder-icon">📁</span>
                    <span className="placeholder-text">Выбрать фото</span>
                  </div>
                ) : (
                  <>
                    <div className="image-preview">
                      <img src={previewUrl} alt="Preview" />
                      <div className="preview-badge">✓</div>
                    </div>
                  </>
                )}
              </div>

              {imageFile && <p className="file-name">{imageFile.name}</p>}
            </div>

            {/* Buttons */}
            <div className="button-group">
              <button
                className="btn-analyze"
                type="submit"
                disabled={loading || !imageFile}
              >
                {loading ? '⏳ Анализируем...' : '🔬 Проверить здоровье'}
              </button>
              <button
                className="btn-reset"
                type="button"
                onClick={handleReset}
                disabled={loading}
              >
                🔄 Сбросить
              </button>
            </div>
          </form>

          {/* Status Message */}
          {status && (
            <div className={`status-message status-${status.type}`}>
              {status.message}
            </div>
          )}

          {/* Healthy Plant Message */}
          {isHealthy === true && (
            <div className="healthy-alert">
              <div className="healthy-icon">🌱</div>
              <h3>Растение выглядит здоровым!</h3>
              <p>Признаков заболеваний не обнаружено. Продолжайте ухаживать за вашим растением.</p>
            </div>
          )}

          {/* Best Match Result */}
          {bestMatch && (
            <div className="best-match-section">
              <h2 className="result-title">⚠️ Обнаруженная проблема</h2>
              <div className="best-match-card">
                <h3 className="match-name">{bestMatch.disease_name}</h3>

                {bestMatch.scientific_name && (
                  <div className="match-info">
                    <span className="info-label">Научное название:</span>
                    <span className="info-value scientific">{bestMatch.scientific_name}</span>
                  </div>
                )}

                {bestMatch.description && (
                  <div className="match-info">
                    <span className="info-label">Описание:</span>
                    <span className="info-value">{bestMatch.description}</span>
                  </div>
                )}

                {bestMatch.treatment && (
                  <div className="treatment-box">
                    <span className="treatment-icon">💊</span>
                    <div className="treatment-content">
                      <span className="treatment-label">Рекомендации по лечению:</span>
                      <p>{bestMatch.treatment}</p>
                    </div>
                  </div>
                )}

                <div className="confidence-section">
                  <span className="confidence-label">Уверенность диагностики:</span>
                  <div className="confidence-bar-container">
                    <div
                      className="confidence-bar"
                      style={{ width: `${bestMatch.confidence * 100}%` }}
                    >
                      <span className="confidence-text">
                        {(bestMatch.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alternative Results */}
          {allResults.length > 1 && (
            <div className="other-results-section">
              <h2 className="result-title">📋 Другие возможные проблемы</h2>
              <div className="disease-list">
                {allResults.slice(1).map((disease, idx) => (
                  <div key={idx} className="disease-card">
                    <div className="disease-info">
                      <span className="disease-rank">#{idx + 2}</span>
                      <div className="disease-content">
                        <div className="disease-name-small">{disease.name}</div>
                        {disease.scientific_name && (
                          <div className="disease-scientific">{disease.scientific_name}</div>
                        )}
                        {disease.description && (
                          <div className="disease-desc">{disease.description}</div>
                        )}
                      </div>
                      <div className="disease-confidence">
                        {(disease.probability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="confidence-mini-bar">
                      <div
                        className="confidence-mini-fill"
                        style={{ width: `${disease.probability * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiseaseDetection;
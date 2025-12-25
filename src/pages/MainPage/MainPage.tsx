import React from 'react';
import { Link } from 'react-router-dom';
import Feedback from '../../components/Feedback/FeedBack';
import './MainPage.css';

const MainPage: React.FC = () => {
  return (
    <div className="main-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">FloroMate</h1>
          <p className="hero-subtitle">Ваш спутник в мире растений</p>
          <p className="hero-description">
            Определяйте растения по фото, диагностируйте болезни, 
            создавайте уникальные ландшафты и ухаживайте за своим садом
          </p>
          <div className="hero-buttons">
            <Link to="/recognition1" className="btn btn-primary">
              🌿 Распознать растение
            </Link>
            <Link to="/recognition2" className="btn btn-secondary">
              🦠 Проверить здоровье
            </Link>
          </div>
        </div>
        <div className="hero-decorative">
          <div className="leaf leaf-1">🍃</div>
          <div className="leaf leaf-2">🌿</div>
          <div className="leaf leaf-3">🍂</div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2 className="section-title">Возможности FloroMate</h2>
        <div className="features-grid">
          {/* Распознавание */}
          <div className="feature-card">
            <div className="feature-icon">📸</div>
            <h3>Распознавание растений</h3>
            <p>
              Сфотографируйте любое растение — получите подробную информацию: 
              научное название, семейство, условия выращивания и уход
            </p>
            <Link to="/recognition1" className="feature-link">Попробовать →</Link>
          </div>

          {/* Диагностика болезней */}
          <div className="feature-card">
            <div className="feature-icon">🦠</div>
            <h3>Диагностика болезней</h3>
            <p>
              Загрузите фото больного растения и получите точную диагностику 
              с рекомендациями по лечению и профилактике
            </p>
            <Link to="/recognition2" className="feature-link">Диагностировать →</Link>
          </div>

          {/* Энциклопедия */}
          <div className="feature-card">
            <div className="feature-icon">📚</div>
            <h3>Энциклопедия растений</h3>
            <p>
              Каталог с тысячами видов растений. Фильтруйте по цвету, 
              размеру, условиям выращивания и найдите идеальное растение
            </p>
            <Link to="/encyclopedia" className="feature-link">Исследовать →</Link>
          </div>

          {/* Конструктор */}
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>Конструктор ландшафта</h3>
            <p>
              Проектируйте свой сад в интерактивном конструкторе. 
              Добавляйте растения, расставляйте предметы, экспортируйте проект
            </p>
            <Link to="/konstructor" className="feature-link">Создавать →</Link>
          </div>

          {/* Личный сад */}
          <div className="feature-card">
            <div className="feature-icon">🌱</div>
            <h3>Личный сад</h3>
            <p>
              Ведите каталог вашего сада. Отслеживайте растения, 
              получайте напоминания об уходе и делитесь с сообществом
            </p>
            <Link to="/privategarden" className="feature-link">Мой сад →</Link>
          </div>

          {/* AI Ассистент */}
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>AI Ассистент</h3>
            <p>
              Задавайте вопросы о растениях, уходе и ландшафтном дизайне. 
              Интеллектуальный помощник всегда готов помочь
            </p>
            <Link to="#chat" className="feature-link">Поговорить →</Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats">
        <div className="stats-container">
          <div className="stat-item">
            <h3 className="stat-number">10K+</h3>
            <p>Видов растений</p>
          </div>
          <div className="stat-item">
            <h3 className="stat-number">500+</h3>
            <p>Болезней определяется</p>
          </div>
          <div className="stat-item">
            <h3 className="stat-number">95%</h3>
            <p>Точность распознавания</p>
          </div>
          <div className="stat-item">
            <h3 className="stat-number">24/7</h3>
            <p>AI помощь доступна</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta-content">
          <h2>Начните выращивать прямо сейчас</h2>
          <p>Присоединитесь к тысячам любителей растений</p>
          <Link to="/auth" className="btn btn-large">
            Создать аккаунт
          </Link>
        </div>
      </section>

      {/* Testimonials Section */}
      <Feedback />

      {/* Footer CTA */}
      <section className="footer-cta">
        <div className="footer-content">
          <h3>Хотите узнать больше?</h3>
          <div className="footer-links">
            <Link to="/ourteam" className="footer-link">О нас</Link>
            <Link to="/subscription" className="footer-link">Премиум</Link>
            <Link to="/privategarden" className="footer-link">Личный сад</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MainPage;

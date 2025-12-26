import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Feedback from '../../components/Feedback/FeedBack';
import './MainPage.css';
import TextType from '../../ReactBits/TextType';
import raspozn from '../../image/raspozn.png';
import diag from '../../image/diag.png';
import encyc from '../../image/encyc.png';
import land from '../../image/land.png';
import soob from '../../image/soob.png';
import ai from '../../image/ai.png';
import BlurText from "../../ReactBits/BlurText";
import BlobCursor from '../../ReactBits/BlobCursor';
import telegramIcon from '../../image/tg.svg';
import rutubeIcon from '../../image/rutube.svg';
import vkIcon from '../../image/vk.svg';

const MainPage: React.FC = () => {
  const handleAnimationComplete = () => {
  console.log('Animation completed!');
};
  useEffect(() => {
  const track = document.getElementById('features-carousel-track') as HTMLDivElement | null;
  const dotsContainer = document.getElementById('carousel-dots');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  if (!track || !dotsContainer || !prevBtn || !nextBtn) return;

  const cards = Array.from(track.children) as HTMLDivElement[];
  const cardCount = cards.length;
  let currentIndex = 0;

  // Создаём точки
  dotsContainer.innerHTML = '';
  for (let i = 0; i < cardCount; i++) {
    const dot = document.createElement('div');
    dot.classList.add('carousel-dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  }

  const dots = Array.from(dotsContainer.children) as HTMLDivElement[];

 function updateCarousel() {
  const cardWidth = cards[0].offsetWidth;
  const gap = 24;
  const containerWidth = (track.parentElement as HTMLDivElement).offsetWidth;

  const offset =
    currentIndex * (cardWidth + gap)
    - (containerWidth - cardWidth) / 2;

  track.style.transform = `translateX(${-offset}px)`;

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });
}


  function goToSlide(index: number) {
    currentIndex = index;
    updateCarousel();
  }

  function nextSlide() {
    if (currentIndex < cardCount - 1) {
      currentIndex++;
    } else {
      currentIndex = 0; // возвращаемся к первой
    }
    updateCarousel();
  }

  function prevSlide() {
    if (currentIndex > 0) {
      currentIndex--;
    } else {
      currentIndex = cardCount - 1; // к последней
    }
    updateCarousel();
  }

  prevBtn.addEventListener('click', prevSlide);
  nextBtn.addEventListener('click', nextSlide);

  // Автопрокрутка
  let autoplayInterval = setInterval(nextSlide, 4500);

  // Пауза при наведении
  const container = track.parentElement!;
  container.addEventListener('mouseenter', () => clearInterval(autoplayInterval));
  container.addEventListener('mouseleave', () => {
    autoplayInterval = setInterval(nextSlide, 4500);
  });

  // Адаптивность
  const resizeHandler = () => updateCarousel();
  window.addEventListener('resize', resizeHandler);

  updateCarousel();

  return () => {
    clearInterval(autoplayInterval);
    window.removeEventListener('resize', resizeHandler);
  };
}, []);
  return (
    
    <div className="main-page">
       <BlobCursor
      blobType="circle"
      fillColor="#8FA67A"
      trailCount={2}
       sizes={[50, 55]}
       innerSizes={[20, 25]} 
      innerColor="rgba(255,255,255,0.8)"
      opacities={[0.6, 0.6]}
      shadowColor="rgba(4, 2, 2, 0.75)"
      shadowBlur={5}
      shadowOffsetX={10}
      shadowOffsetY={10}
      filterStdDeviation={30}
      useFilter={true}
      fastDuration={0.1}
      slowDuration={0.5}
      zIndex={9999} 
    />
      <section className="hero">
         <div className="bubble"></div>
  <div className="bubble"></div>
  <div className="bubble"></div>
  <div className="bubble"></div>
  <div className="bubble"></div>
  <div className="bubble"></div>
  <div className="hero-content">
   <h1 className="hero-title">
            <TextType
              text="FloroMate"
              typingSpeed={100}
              showCursor={false}           // без курсора
              cursorCharacter="|"
              cursorBlinkDuration={0.8}
              initialDelay={400}
              loop={false}
              hideCursorWhileTyping={false}
            />
          </h1>

          {/* 2. Подзаголовок — на новой строке, после завершения заголовка */}
          <p className="hero-subtitle">
            <TextType
              text="Ваш спутник в мире растений"
              typingSpeed={75}
              showCursor={false}           // без курсора
              cursorCharacter="|"
              initialDelay={2000}          // стартует через ~2 секунды
              loop={false}
              hideCursorWhileTyping={false}
            />
          </p>

          {/* 3. Описание — одна фраза, печатается один раз */}
          <p className="hero-description">
            <TextType
              text="Определяйте растения по фото, диагностируйте болезни, создавайте уникальные ландшафты и ухаживайте за своим садом"
              typingSpeed={60}
              showCursor={false}           // без курсора
              cursorCharacter="|"
              initialDelay={4000}          // стартует через ~4 секунды
              loop={false}                 // без цикла и стирания
            />
          </p>
          </div>
      </section>


      {/* Features Section — Карусель возможностей */}
<section className="features-carousel-section">
 
<div className='section-title'>
<BlurText
  text="Возможности FloroMate"
  delay={150}
  animateBy="words"
  direction="top"
  onAnimationComplete={handleAnimationComplete}
  className="text-2xl mb-8"
/>
</div>

  <div className="carousel-container">
    <div className="carousel-track" id="features-carousel-track">
      {/* Карточка 1 */}
      <div className="carousel-card">
        <img src={raspozn} alt="Распознавание растений" />
        <div className="carousel-card-content">
          <h3>Распознавание растений</h3>
          <p>Сфотографируйте любое растение камерой телефона — FloroMate мгновенно определит вид, семейство, научное название и даст подробные рекомендации по уходу</p>
        </div>
      </div>

      {/* Карточка 2 */}
      <div className="carousel-card">
      <img src={diag} alt="Диагностика болезней" />
        <div className="carousel-card-content">
          <h3>Диагностика болезней</h3>
          <p>Загрузите фото листа, стебля или плода с признаками болезни — наш ИИ точно определит проблему и предложит эффективные методы лечения и профилактики</p>
        </div>
      </div>

      {/* Карточка 3 */}
      <div className="carousel-card">
       <img src={encyc} alt="энциклопедия" />
        <div className="carousel-card-content">
          <h3>Энциклопедия растений</h3>
          <p>Доступ к базе из десятков тысяч видов растений с высококачественными фото, описаниями, характеристиками и удобными фильтрами по условиям выращивания</p>
        </div>
      </div>

      {/* Карточка 4 */}
      <div className="carousel-card">
        <img src={land} alt="конструктор" />
        <div className="carousel-card-content">
          <h3>Конструктор ландшафта</h3>
          <p>Создавайте проекты сада мечты: расставляйте растения, дорожки, водоёмы, мебель и декор в удобном 3D-редакторе, сохраняйте и экспортируйте планы</p>
        </div>
      </div>

      {/* Карточка 5 */}
      <div className="carousel-card">
        <img src={soob} alt="Личный сад" />
        <div className="carousel-card-content">
          <h3>Личный сад</h3>
          <p>Ведите цифровой дневник своего сада: добавляйте растения, отслеживайте их рост, получайте умные напоминания о поливе, подкормке и пересадке</p>
        </div>
      </div>

      {/* Карточка 6 */}
      <div className="carousel-card">
         <img src={ai} alt="AI Ассистент" />
        <div className="carousel-card-content">
          <h3>AI Ассистент</h3>
          <p>Задавайте любые вопросы о растениях, уходе, болезнях или дизайне сада — интеллектуальный помощник ответит подробно и понятно в любое время суток</p>
        </div>
      </div>
    </div>

    {/* Кнопки навигации */}
    <button className="carousel-btn prev" id="prev-btn">‹</button>
    <button className="carousel-btn next" id="next-btn">›</button>

    {/* Точки-индикаторы */}
    <div className="carousel-dots" id="carousel-dots"></div>
  </div>
</section>

      {/* Testimonials Section */}
      <Feedback />

     {/* Footer CTA */}
     <section className="footer-cta">
  <div className="footer-content">
    <div className="footer-main-row">
      {/* Левая часть - ваши существующие ссылки */}
      <div className="footer-info">
        <h3>Хотите узнать больше?</h3>
        <div className="footer-links">
          <Link to="/ourteam" className="footer-link">О нас</Link>
          <Link to="/subscription" className="footer-link">Премиум</Link>
          <Link to="/privategarden" className="footer-link">Личный сад</Link>
        </div>
      </div>

      {/* Правая часть - FloroMate + соцсети */}
      <div className="footer-social">
        <div className="social-brand">
          <span className="brand-text">FloroMate в соцсетях</span>
        </div>
       <div className="social-icons">
  <a href="https://t.me/floromate" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
    <img src={telegramIcon} alt="Telegram" />
  </a>
  
  <a href="https://rutube.ru/floromate" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="Rutube">
    <img src={rutubeIcon} alt="Rutube" />
  </a>
  
  <a href="https://vk.com/floromate" className="social-link" target="_blank" rel="noopener noreferrer" aria-label="VK">
    <img src={vkIcon} alt="VK" />
  </a>
</div>
      </div>
    </div>
  </div>
</section>


    </div>
  );
};

export default MainPage;

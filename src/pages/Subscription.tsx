import React, { useEffect, useState } from 'react';
import SpotlightCard from '../components/SpotlightCard/SpotlightCard';
import PaymentModal from '../components/PaymentModal/PaymentModal';
import AuthModal from '../components/AuthModal/AuthModal';
import './Subscription.css';

const Subscription: React.FC = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    planName: string;
    monthlyPrice: string;
    yearlyPrice: string;
    isProUltra?: boolean;
  }>({
    isOpen: false,
    planName: '',
    monthlyPrice: '',
    yearlyPrice: '',
    isProUltra: false,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '0₽',
      period: '',
      specialOffer: {
        price: '0',
        period: 'в год',
        discount: ''
      },
      description: 'Идеальный старт для знакомства с FloroMate',
      features: [
        '3 запроса в день',
        'Доступ к энциклопедии растений',
        'Базовая диагностика болезней',
        'Ограниченные функции распознавания'
      ],
      spotlightColor: 'rgba(255, 255, 255, 0.1)',
      isPremium: false,
      highlight: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '490₽',
      period: 'в месяц',
      originalPrice: '490₽',
      specialOffer: {
        price: '2890',
        period: 'в год',
        discount: 'Экономия ~40%'
      },
      description: 'Для активных любителей растений и садоводов',
      features: [
        '20 запросов в день',
        'Полный доступ к энциклопедии',
        'Расширенная диагностика болезней',
        'Личный блог растений',
        'Приоритетная поддержка',
        'Экспорт данных'
      ],
      spotlightColor: 'rgba(147, 162, 103, 0.15)',
      isPremium: true,
      highlight: false
    },
    {
      id: 'pro-ultra',
      name: 'Pro Ultra',
      price: '690₽',
      period: 'в месяц',
      originalPrice: '690₽',
      specialOffer: {
        price: '3790',
        period: 'в год',
        discount: 'Экономия ~54%'
      },
      description: 'Максимальные возможности для профессионалов',
      features: [
        '100 запросов в день',
        'Все функции Pro',
        'Доступ к личному саду',
        'Приоритетная поддержка 24/7',
        'AI-консультации без ограничений',
        'Продвинутая аналитика',
        'Интеграции с внешними сервисами',
        'Персональный менеджер'
      ],
      spotlightColor: 'rgba(138, 43, 226, 0.15)',
      isPremium: true,
      highlight: true,
      badge: 'Выгодно!'
    }
  ];

  return (
    <div className="subscription-page">
      <div className="subscription-container">
        <div className="subscription-header">
          <h1>Выберите подписку</h1>
          <p className="subscription-subtitle">
            Начните свой путь к идеальному саду уже сегодня. Выберите тариф, 
            который подходит именно вам, и получите доступ ко всем возможностям FloroMate.
          </p>
        </div>

        <div className="subscription-grid">
          {plans.map((plan) => (
            <SpotlightCard
              key={plan.id}
              className={`subscription-card ${plan.highlight ? 'subscription-card-highlight' : ''} ${plan.id === 'free' ? 'subscription-card-free' : ''}`}
              spotlightColor={plan.spotlightColor}
            >
                <div className="subscription-card-header">
                <div className="subscription-card-name-wrapper">
                  <h2 className="subscription-card-name">{plan.name}</h2>
                  {plan.badge && (
                    <div className="subscription-badge-inline">{plan.badge}</div>
                  )}
                </div>
                <p className="subscription-card-description">{plan.description}</p>
              </div>

              <div className="subscription-card-pricing">
                <div className="subscription-price-main">
                  <span className="subscription-price">{plan.price}</span>
                  {plan.period && <span className="subscription-period">/{plan.period}</span>}
                </div>
                {plan.specialOffer && (
                  <div className="subscription-special-offer">
                    <div className="subscription-offer-wrapper">
                      <div className="subscription-offer-price-wrapper">
                        <span className="subscription-offer-price">{plan.specialOffer.price}₽</span>
                        <span className="subscription-offer-period">/{plan.specialOffer.period}</span>
                      </div>
                      <div className="subscription-offer-discount">{plan.specialOffer.discount}</div>
                    </div>
                  </div>
                )}
              </div>

              <ul className="subscription-features">
                {plan.features.map((feature, index) => (
                  <li key={index} className="subscription-feature">
                    <span className="subscription-feature-icon">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                className={`subscription-button ${plan.highlight ? 'subscription-button-highlight' : ''} ${plan.id === 'free' ? 'subscription-button-free' : ''} ${plan.id === 'pro' ? 'subscription-button-pro' : ''}`}
                onClick={() => {
                  if (plan.id === 'free') {
                    setIsAuthModalOpen(true);
                  } else {
                    setPaymentModal({
                      isOpen: true,
                      planName: plan.name,
                      monthlyPrice: plan.price,
                      yearlyPrice: plan.specialOffer ? `${plan.specialOffer.price}₽` : plan.price,
                      isProUltra: plan.highlight,
                    });
                  }
                }}
              >
                {plan.id === 'free' ? 'Начать бесплатно' : plan.highlight ? 'Выбрать Pro Ultra' : 'Выбрать Pro'}
              </button>
            </SpotlightCard>
          ))}
        </div>

        <div className="subscription-enterprise">
          <div className="subscription-enterprise-content">
            <h2 className="subscription-enterprise-title">Вы компания?</h2>
            <p className="subscription-enterprise-description">
              Предлагаем индивидуальные условия сотрудничества для бизнеса. 
              Специальные тарифы, корпоративные интеграции и персональный подход.
            </p>
            <a 
              href="mailto:artsint@mail.ru?subject=Корпоративное сотрудничество"
              className="subscription-enterprise-button"
            >
              Связаться с нами
            </a>
            <div className="subscription-enterprise-email">
              <span className="subscription-email-icon">✉</span>
              <span>artsint@mail.ru</span>
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
        planName={paymentModal.planName}
        monthlyPrice={paymentModal.monthlyPrice}
        yearlyPrice={paymentModal.yearlyPrice}
        isProUltra={paymentModal.isProUltra}
        onPaymentComplete={() => {
          // Заглушка - просто закрываем модальное окно
          alert('Оплата успешно выполнена! (Это демо-режим)');
          setPaymentModal({ ...paymentModal, isOpen: false });
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialType="register"
      />
    </div>
  );
};

export default Subscription;

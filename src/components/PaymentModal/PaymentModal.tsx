import React, { useState } from 'react';
import './PaymentModal.css';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  monthlyPrice: string;
  yearlyPrice: string;
  onPaymentComplete: () => void;
  isProUltra?: boolean;
}

type PaymentStep = 'period' | 'payment';

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  planName,
  monthlyPrice,
  yearlyPrice,
  onPaymentComplete,
  isProUltra = false,
}) => {
  const [step, setStep] = useState<PaymentStep>('period');
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('year');
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
  });

  if (!isOpen) return null;

  const handlePeriodSelect = (period: 'month' | 'year') => {
    setSelectedPeriod(period);
  };

  const handleProceedToPayment = () => {
    setStep('payment');
  };

  const handleCardInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'cardNumber') {
      // Форматирование номера карты: только цифры, группами по 4
      const cleaned = value.replace(/\s/g, '').replace(/\D/g, '');
      if (cleaned.length <= 16) {
        const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
        setCardData({ ...cardData, [name]: formatted });
      }
    } else if (name === 'expiryDate') {
      // Форматирование даты: MM/YY
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 4) {
        const formatted = cleaned.length > 2 
          ? `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`
          : cleaned;
        setCardData({ ...cardData, [name]: formatted });
      }
    } else if (name === 'cvv') {
      // CVV: только 3-4 цифры
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 4) {
        setCardData({ ...cardData, [name]: cleaned });
      }
    } else {
      setCardData({ ...cardData, [name]: value });
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Заглушка - просто показываем успех
    onPaymentComplete();
  };

  const handleClose = () => {
    setStep('period');
    setSelectedPeriod('year');
    setCardData({ cardNumber: '', cardName: '', expiryDate: '', cvv: '' });
    onClose();
  };

  const selectedPrice = selectedPeriod === 'year' ? yearlyPrice : monthlyPrice;

  return (
    <div className="payment-modal-overlay" onClick={handleClose}>
      <div className={`payment-modal ${isProUltra ? 'payment-modal-pro-ultra' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className="payment-modal-close" onClick={handleClose}>×</button>

        {step === 'period' && (
          <div className="payment-modal-content">
            <h2 className="payment-modal-title">Выберите период подписки</h2>
            <p className="payment-modal-subtitle">Тариф: {planName}</p>

            <div className="payment-period-options">
              <div
                className={`payment-period-option ${selectedPeriod === 'year' ? 'selected' : ''}`}
                onClick={() => handlePeriodSelect('year')}
              >
                <div className="payment-period-header">
                  <span className="payment-period-name">Год</span>
                  <span className="payment-period-badge">Выгодно</span>
                </div>
                <div className="payment-period-price">{yearlyPrice}</div>
                <div className="payment-period-savings">{isProUltra ? 'Экономия ~54%' : 'Экономия ~40%'}</div>
              </div>

              <div
                className={`payment-period-option ${selectedPeriod === 'month' ? 'selected' : ''}`}
                onClick={() => handlePeriodSelect('month')}
              >
                <div className="payment-period-header">
                  <span className="payment-period-name">Месяц</span>
                </div>
                <div className="payment-period-price">{monthlyPrice}</div>
                <div className="payment-period-savings">Ежемесячная оплата</div>
              </div>
            </div>

            <button className="payment-proceed-button" onClick={handleProceedToPayment}>
              Продолжить к оплате
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="payment-modal-content">
            <h2 className="payment-modal-title">Оплата подписки</h2>
            <p className="payment-modal-subtitle">
              {planName} • {selectedPeriod === 'year' ? 'Год' : 'Месяц'} • {selectedPrice}
            </p>

            <form className="payment-form" onSubmit={handlePaymentSubmit}>
              <div className="payment-form-group">
                <label htmlFor="cardNumber">Номер карты</label>
                <input
                  type="text"
                  id="cardNumber"
                  name="cardNumber"
                  value={cardData.cardNumber}
                  onChange={handleCardInputChange}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  required
                />
              </div>

              <div className="payment-form-group">
                <label htmlFor="cardName">Имя держателя карты</label>
                <input
                  type="text"
                  id="cardName"
                  name="cardName"
                  value={cardData.cardName}
                  onChange={handleCardInputChange}
                  placeholder="IVAN IVANOV"
                  required
                />
              </div>

              <div className="payment-form-row">
                <div className="payment-form-group">
                  <label htmlFor="expiryDate">Срок действия</label>
                  <input
                    type="text"
                    id="expiryDate"
                    name="expiryDate"
                    value={cardData.expiryDate}
                    onChange={handleCardInputChange}
                    placeholder="MM/YY"
                    maxLength={5}
                    required
                  />
                </div>

                <div className="payment-form-group">
                  <label htmlFor="cvv">CVV</label>
                  <input
                    type="text"
                    id="cvv"
                    name="cvv"
                    value={cardData.cvv}
                    onChange={handleCardInputChange}
                    placeholder="123"
                    maxLength={4}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="payment-submit-button">
                Оформить подписку за {selectedPrice}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;


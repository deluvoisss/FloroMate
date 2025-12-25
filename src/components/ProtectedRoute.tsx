import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { hasAccess, getRequiredSubscription } from '../utils/subscriptionUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredFeature?: 'diseaseDetection' | 'plantRecognition' | 'landscapeConstructor' | 'landscapeDesigner' | 'personalGarden';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredFeature }) => {
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const userSubscription = useAppSelector((state) => state.auth.user?.subscription?.type || 'free');

  // Проверка авторизации
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Проверка доступа к функции
  if (requiredFeature && !hasAccess(userSubscription as any, requiredFeature)) {
    const requiredSub = getRequiredSubscription(requiredFeature);
    alert(`🔒 Эта функция доступна только для подписки ${requiredSub?.toUpperCase()}. Пожалуйста, обновите подписку.`);
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

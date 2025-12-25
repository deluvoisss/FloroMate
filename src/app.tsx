import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store/store';
import Header from './components/Header/Header';
import ProtectedRoute from './components/ProtectedRoute';
import MainPage from './pages/MainPage/MainPage';
import LandscapeDesign from './pages/LandscapeDesign';
import LandscapeConstructor from './pages/LandscapeConstructor';
import Encyclopedia from './pages/Encyclopedia/Encyclopedia';
import PlantRecognition from './pages/PlantRecognition/PlantRecognition';
import DiseaseDetection from './pages/DiseaseDetection/DiseaseDetection';
import OurTeam from './pages/OurTeam';
import PrivateGarden from './pages/PrivateGarden';
import Subscription from './pages/Subscription';
import Auth from './pages/Auth';
import './App.css';

const App: React.FC = () => {
  // ✅ Используйте publicPath из конфига
  // Должно совпадать с publicPath в brojs.config
  const basePath = '/floromate';
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  return (
    <Router basename={basePath}>
      <Header />
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/encyclopedia" element={<Encyclopedia />} />
        <Route path="/auth" element={<Auth />} />

        {/* Узнать по фото */}
        <Route path="/recognition1" element={<ProtectedRoute><PlantRecognition /></ProtectedRoute>} />
        <Route path="/recognition2" element={<ProtectedRoute><DiseaseDetection /></ProtectedRoute>} />

        {/* Мастерская ландшафта */}
        <Route path="/landscapedesign" element={<ProtectedRoute><LandscapeDesign /></ProtectedRoute>} />
        <Route path="/konstructor" element={<ProtectedRoute><LandscapeConstructor /></ProtectedRoute>} />

        {/* Остальные страницы */}
        <Route path="/ourteam" element={<OurTeam />} />
        <Route path="/privategarden" element={<ProtectedRoute><PrivateGarden /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />

        {/* Fallback маршрут */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;

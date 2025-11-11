import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header/Header';
import MainPage from './pages/MainPage';
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

  return (
    <Router basename={basePath}>
      <div className="app">
        <Header />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/mainpage" replace />} />
            <Route path="/mainpage" element={<MainPage />} />
            <Route path="/encyclopedia" element={<Encyclopedia />} />
            
            {/* Узнать по фото */}
            <Route path="/recognition1" element={<PlantRecognition />} />
            <Route path="/recognition2" element={<DiseaseDetection />} />
            
            {/* Мастерская ландшафта */}
            <Route path="/landscapedesign" element={<LandscapeDesign />} />
            <Route path="/konstructor" element={<LandscapeConstructor />} />
            
            {/* Остальные страницы */}
            <Route path="/ourteam" element={<OurTeam />} />
            <Route path="/privategarden" element={<PrivateGarden />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Fallback маршрут */}
            <Route path="*" element={<Navigate to="/mainpage" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;

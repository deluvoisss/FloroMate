import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header/Header';
import Encyclopedia from './pages/Encyclopedia/Encyclopedia';
import PlantRecognition from './pages/PlantRecognition/PlantRecognition';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <div className="app">
        <Header />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/encyclopedia" replace />} />
            <Route path="/encyclopedia" element={<Encyclopedia />} />
            <Route path="/recognition" element={<PlantRecognition />} />
            <Route path="*" element={<Navigate to="/encyclopedia" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;

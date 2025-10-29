import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

const Header: React.FC = () => {
  const location = useLocation();

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          <span className="logo-icon">🌿</span>
          <span className="logo-text">FloroMate</span>
        </Link>

        <nav className="header-nav">
          <Link 
            to="/encyclopedia" 
            className={`nav-link ${location.pathname === '/encyclopedia' ? 'active' : ''}`}
          >
            📚 Энциклопедия
          </Link>
          <Link 
            to="/recognition" 
            className={`nav-link ${location.pathname === '/recognition' ? 'active' : ''}`}
          >
            📸 Определение
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;

import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/authSlice';
import logo from '../../assets/logo.png';
import flower1 from '../../assets/flowers1.jpg';
import flower2 from '../../assets/flowers2.jpg';
import flower3 from '../../assets/flowers3.jpg';
import flower4 from '../../assets/flowers4.jpg';
import flower5 from '../../assets/flowers5.jpg';
import './Header.css';
import AuthModal from '../AuthModal/AuthModal';

const flowers = [flower1, flower2, flower3, flower4, flower5];

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const coinRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  const [currentFlowerIndex, setCurrentFlowerIndex] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalType, setAuthModalType] = useState<'login' | 'register' | 'resetPassword'>('login');
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const triggerSpin = () => {
      if (coinRef.current) {
        coinRef.current.classList.remove('spinning');
        void coinRef.current.offsetWidth;
        coinRef.current.classList.add('spinning');
        setCurrentFlowerIndex((prev) => (prev + 1) % flowers.length);
      }
    };

    let inactivityTimeout: NodeJS.Timeout | null = null;
    let spinInterval: NodeJS.Timeout | null = null;

    const stopSpinning = () => {
      if (spinInterval) {
        clearInterval(spinInterval);
        spinInterval = null;
      }
    };

    const startSpinning = () => {
      if (!spinInterval) {
        spinInterval = setInterval(triggerSpin, 5000);
      }
    };

    const resetInactivityTimer = (e: MouseEvent) => {
      const movedSignificantly =
        Math.abs(e.clientX - lastMousePos.current.x) > 5 ||
        Math.abs(e.clientY - lastMousePos.current.y) > 5;

      if (movedSignificantly) {
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        stopSpinning();
        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout);
        }
        inactivityTimeout = setTimeout(() => {
          startSpinning();
        }, 15000);
      }
    };

    triggerSpin();
    document.addEventListener('mousemove', resetInactivityTimer);

    return () => {
      document.removeEventListener('mousemove', resetInactivityTimer);
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
      }
      if (spinInterval) {
        clearInterval(spinInterval);
      }
    };
  }, []);


  const isRecognitionActive = location.pathname === '/floromate/recognition1' ||
  location.pathname === '/floromate/recognition2';

const isLandscapeActive = location.pathname === '/floromate/landscapedesign' ||
  location.pathname === '/floromate/konstructor';

  const handleMenuEnter = (menu: string) => {
    setOpenMenu(menu);
  };

  const handleMenuLeave = () => {
    setOpenMenu(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    setShowUserMenu(false);
  };

  const handleOpenAuthModal = (type: 'login' | 'register' | 'resetPassword') => {
    setAuthModalType(type);
    setIsAuthModalOpen(true);
  };

  const handleResetPassword = () => {
    setShowUserMenu(false);
    handleOpenAuthModal('resetPassword');
  };

  const handleProtectedClick = (e: React.MouseEvent, path: string) => {
    if (!isAuthenticated) {
      e.preventDefault();
      handleOpenAuthModal('login');
    } else {
      navigate(path);
      setOpenMenu(null);
    }
  };

  const handleLockedItemClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      handleOpenAuthModal('login');
    }
  };
  
  const handleCloseAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalType('login');
  };

  return (
    <>
      <header className="header">
        <div className="header-container">
          <ul className='header-nav'>
            {/* Справочник растений */}
            <li>
              <Link 
                to="/encyclopedia" 
                className={`nav-link ${location.pathname === '/encyclopedia' ? 'active' : ''}`}
              >
                Справочник растений
              </Link>
            </li>

            {/* Узнать по фото */}
            <li 
                className="nav-item-wrapper"
                onMouseEnter={() => handleMenuEnter('recognition')}
                onMouseLeave={handleMenuLeave}
              >
                <div 
                  className={`nav-item ${isRecognitionActive ? 'active' : ''} ${!isAuthenticated ? 'locked' : ''}`}
                  onClick={handleLockedItemClick}
                >
                  Узнать по фото
                  {!isAuthenticated && <span className="lock-icon">🔒</span>}
                  {!isAuthenticated && <div className="tooltip">Необходимо авторизоваться</div>}
                </div>
                
                {/* Dropdown появляется только для авторизованных */}
                {openMenu === 'recognition' && isAuthenticated && (
                  <div className="dropdown-menu">
                    <div 
                      onClick={(e) => handleProtectedClick(e, 'recognition1')} 
                      className="dropdown-item"
                    >
                      Определить растение
                    </div>
                    <div 
                      onClick={(e) => handleProtectedClick(e, 'recognition2')} 
                      className="dropdown-item"
                    >
                      Определить болезнь
                    </div>
                  </div>
                )}
              </li>
            {/* Мастерская ландшафта */}
            <li 
                className="nav-item-wrapper"
                onMouseEnter={() => handleMenuEnter('landscape')}
                onMouseLeave={handleMenuLeave}
              >
                <div 
                  className={`nav-item ${isLandscapeActive ? 'active' : ''} ${!isAuthenticated ? 'locked' : ''}`}
                  onClick={handleLockedItemClick}
                >
                  Мастерская ландшафта
                  {!isAuthenticated && <span className="lock-icon">🔒</span>}
                  {!isAuthenticated && <div className="tooltip">Необходимо авторизоваться</div>}
                </div>
                
                {/* Dropdown появляется только для авторизованных */}
                {openMenu === 'landscape' && isAuthenticated && (
                  <div className="dropdown-menu">
                    <div 
                      onClick={(e) => handleProtectedClick(e, '/landscapedesign')} 
                      className="dropdown-item"
                    >
                      Ландшафтный дизайн
                    </div>
                    <div 
                      onClick={(e) => handleProtectedClick(e, '/konstructor')} 
                      className="dropdown-item"
                    >
                      Конструктор участка
                    </div>
                  </div>
                )}
              </li>

          </ul>

          {/* Логотип в центре */}
          <Link to="/mainpage" className="nav-link-logo" aria-label="Главная страница">
            <div ref={coinRef} className="coin">
              <div className="coin-face coin-front">
                <img src={logo} alt="Logo" />
              </div>
              <div className="coin-face coin-back">
                <img src={flowers[currentFlowerIndex]} alt="Logo Back" />
              </div>
            </div>
          </Link>

          {/* Правая навигация */}
          <ul className='header-nav'>
            <li>
              <Link
                to="/ourteam"
                className={`nav-link ${location.pathname === '/ourteam' ? 'active' : ''}`}
              >
                Наша команда
              </Link>
            </li>
            <li   
              className="nav-item-wrapper"
              onMouseEnter={() => handleMenuEnter('privategarden')}
              onMouseLeave={handleMenuLeave}
            >
              <div 
                className={`nav-item ${isLandscapeActive ? 'active' : ''} ${!isAuthenticated ? 'locked' : ''}`}
                onClick={(e) => handleProtectedClick(e, '/privategarden')}
              >
                Личный сад
                {!isAuthenticated && <span className="lock-icon">🔒</span>}
                {!isAuthenticated && <div className="tooltip">Необходимо авторизоваться</div>}
              </div>
            </li>

            <li   
              className="nav-item-wrapper"
              onMouseEnter={() => handleMenuEnter('subscription')}
              onMouseLeave={handleMenuLeave}
            >
              <div 
                className={`nav-item ${isLandscapeActive ? 'active' : ''} ${!isAuthenticated ? 'locked' : ''}`}
                onClick={(e) => handleProtectedClick(e, '/subscription')}
              >
                Премиум-доступ
                {!isAuthenticated && <span className="lock-icon">🔒</span>}
                {!isAuthenticated && <div className="tooltip">Необходимо авторизоваться</div>}
              </div>
            </li>
            <li>
            {isAuthenticated ? (
              <div 
                className="nav-item-wrapper"
                ref={userMenuRef}
                onMouseEnter={() => handleMenuEnter('user')}
                onMouseLeave={handleMenuLeave}
              >
                <div className="nav-item">
                  {user?.first_name || 'Профиль'}
                </div>
                {openMenu === 'user' && (
                  <div className="dropdown-menu user-dropdown">
                    <div className="user-info">
                      <strong>{user?.username}</strong>
                      <small>{user?.email}</small>
                    </div>
                    <div className="dropdown-divider" />
                    <span 
                      className="dropdown-item logout" 
                      onClick={handleResetPassword}
                    >
                      Сменить пароль
                    </span>
                    <span 
                      className="dropdown-item logout" 
                      onClick={handleLogout}
                    >
                      Выйти
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <button className="login-button" onClick={() => handleOpenAuthModal('login')}>
                Войти
              </button>
            )}

            </li>
          </ul>
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuthModal}
        initialType={authModalType}
      />
    </>
  );
};

export default React.memo(Header);
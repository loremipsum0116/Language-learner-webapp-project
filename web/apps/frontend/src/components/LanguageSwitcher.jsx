import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // 현재 언어 감지
  const getCurrentLanguage = () => {
    if (currentPath === '/home-jp') return 'jp';
    if (currentPath === '/home') return 'en';
    return 'en'; // 기본값은 영어
  };
  
  const currentLang = getCurrentLanguage();
  
  return (
    <div className="language-switcher">
      <Link 
        to="/home" 
        className={`lang-btn ${currentLang === 'en' ? 'active' : ''}`}
        title="English"
      >
        <span className="flag">🇺🇸</span>
        <span className="lang-text">EN</span>
      </Link>
      <Link 
        to="/home-jp" 
        className={`lang-btn ${currentLang === 'jp' ? 'active' : ''}`}
        title="日本語"
      >
        <span className="flag">🇯🇵</span>
        <span className="lang-text">JP</span>
      </Link>
    </div>
  );
}
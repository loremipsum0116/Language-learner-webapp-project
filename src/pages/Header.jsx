import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // 경로: src/pages/Header.jsx → src/context/AuthContext.jsx

/**
 * 공통 네비게이션 바 (단무새 - Dan-mu-sae)
 * - 왼쪽 : 단무새 로고 → 홈
 * - 오른쪽(로그인) : 대시보드 · SRS 학습 · 오답노트 · 로그아웃
 * - 오른쪽(비로그인) : 로그인 · 가입
 * 부트스트랩 5 기반, 모바일 토글 지원, 단무새 귀여운 테마
 */
export default function Header() {
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary border-bottom" style={{ height: '80px' }}>
      <div className="container" style={{ height: '100%' }}>
        {/* 브랜드 로고 */}
        <Link to="/home" className="navbar-brand fw-bold fs-4 text-decoration-none d-flex align-items-center gap-1" style={{ height: '100%' }}>
          <img 
            src="/danmoosae.png"
            alt="" 
            style={{ height: '60px', width: 'auto', objectFit: 'contain' }}
          />
          <span style={{ color: '#8b4513', fontWeight: '700', fontSize: '1.5rem' }}>단무새</span>
        </Link>

        {/* 모바일 토글 버튼 */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
          aria-controls="mainNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="mainNav">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-2">
            {isLoggedIn ? (
              <>
                <li className="nav-item">
                  <Link to="/dashboard" className="nav-link">
                    대시보드
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/srs" className="btn btn-sm btn-primary d-flex align-items-center gap-1">
                    <img src="/danmoosae.png" alt="" style={{ height: '16px', width: 'auto' }} />
                    SRS 학습
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/odat-note" className="btn btn-sm btn-secondary">
                    📝 오답노트
                  </Link>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    onClick={logout}
                    className="btn btn-sm btn-outline-secondary"
                  >
                    로그아웃
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link to="/login" className="nav-link">
                    로그인
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/register" className="btn btn-sm btn-outline-primary">
                    가입
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

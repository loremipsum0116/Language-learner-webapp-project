import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // 경로: src/pages/Header.jsx → src/context/AuthContext.jsx

/**
 * 공통 네비게이션 바 (Vocabio)
 * - 왼쪽 : 로고 → 홈
 * - 오른쪽(로그인) : 대시보드 · SRS 학습 · 오답노트 · 로그아웃
 * - 오른쪽(비로그인) : 로그인 · 가입
 * 부트스트랩 5 기반, 모바일 토글 지원
 */
export default function Header() {
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary border-bottom">
      <div className="container">
        {/* 브랜드 로고 */}
        <Link to="/" className="navbar-brand fw-bold fs-4 text-primary text-decoration-none">
          Vocabio
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
                  <Link to="/learn" className="btn btn-sm btn-primary">
                    SRS 학습
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/odat-note" className="btn btn-sm btn-outline-danger">
                    오답노트
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

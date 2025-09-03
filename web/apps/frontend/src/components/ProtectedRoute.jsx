// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { user, loading } = useAuth(); // 'useAuth'는 항상 정의되어 있으므로 '?.'는 불필요합니다.

  // 1. AuthContext가 사용자 인증 상태를 확인하는 동안 로딩 화면을 보여줍니다.
  if (loading) {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </main>
   
  );
  }

  // 2. 로딩이 끝났는데 user가 없으면(로그인되지 않았으면) 로그인 페이지로 보냅니다.
  if (!user) {
    // 사용자가 원래 가려던 경로(location)를 state에 담아 전달합니다.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 3. 로딩이 끝났고 user가 있으면 요청한 페이지를 보여줍니다.
  return children || <Outlet />;
}
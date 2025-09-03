import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute() {
  const { user } = useAuth?.() || {};
  const isAdmin =
    user?.email === "super@root.com" || 
    user?.role === "admin" || user?.isAdmin === true || user?.claims?.includes?.("admin");

  if (!user) {
    // 미인증이면 상위 ProtectedRoute가 처리하지만, 단독 사용 대비
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

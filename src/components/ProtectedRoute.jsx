// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
    const { user, loading } = useAuth();
    const loc = useLocation();
    if (loading) return <div className="container p-4">로딩 중…</div>;
    if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
    return <Outlet />;
}

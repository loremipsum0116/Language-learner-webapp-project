import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute() {
    const { user, loading } = useAuth();
    const loc = useLocation();

    if (loading) return <div className="container p-4">로딩 중…</div>;
    if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;

    if (user.role !== "ADMIN") {
        return (
            <main className="container py-4">
                <h3>403 Forbidden</h3>
                <p className="text-muted">관리자 권한이 필요합니다.</p>
            </main>
        );
    }
    return <Outlet />;
}

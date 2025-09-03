// src/pages/Logout.jsx
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Logout() {
    const { logout } = useAuth();
    const nav = useNavigate();
    useEffect(() => {
        (async () => {
            try {
                await logout();
            } finally {
                nav("/login", { replace: true });
            }
        })();
    }, [logout, nav]);

    return (
        <main className="container py-4">
            <p>로그아웃 중…</p>
        </main>
    );
}

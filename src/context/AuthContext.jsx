// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchJSON, withCreds } from "../api/client";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // ★ 1. SRS ID 목록을 전역 상태로 관리합니다.
    const [srsIds, setSrsIds] = useState(new Set());

    async function refreshUser() {
        try {
            const me = await fetchJSON("/me", withCreds());
            setUser(me?.data || me);
        } catch {
            setUser(null);
        }
    }
    const addSrsId = (vocabId) =>
        setSrsIds(prev => new Set(prev).add(vocabId));

    const removeSrsId = (id) => setSrsIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    // ★ 2. SRS ID 목록을 새로고침하는 함수를 정의합니다.
    async function refreshSrsIds() {
        // 로그인 상태가 아니면 실행하지 않습니다.
        if (!user) {
            setSrsIds(new Set());
            return;
        }
        try {
            const { data } = await fetchJSON('/srs/all-cards', withCreds());
            setSrsIds(new Set((data || []).map(card => card.vocabId)));
        } catch (e) {
            console.error("Failed to refresh SRS IDs:", e);
            // 에러 발생 시 기존 목록을 유지하거나 비울 수 있습니다.
            setSrsIds(new Set());
        }
    }

    async function updateProfile(patch) {
        const me = await fetchJSON("/me", withCreds({ method: "PATCH", body: JSON.stringify(patch) }));
        setUser(me?.data || me);
        return me?.data || me;
    }

    async function login(email, password) {
        await fetchJSON("/auth/login", withCreds({ method: "POST", body: JSON.stringify({ email, password }) }));
        // 로그인 성공 후 사용자 정보와 SRS 목록을 모두 새로고침합니다.
        await refreshUser();
        await refreshSrsIds();
    }

    async function register(email, password) {
        await fetchJSON("/auth/register", withCreds({ method: "POST", body: JSON.stringify({ email, password }) }));
        await refreshUser();
    }

    async function logout() {
        try {
            await fetchJSON("/auth/logout", withCreds({ method: "POST" }));
        } finally {
            setUser(null);
            setSrsIds(new Set()); // 로그아웃 시 SRS 목록도 비웁니다.
        }
    }

    useEffect(() => {
        (async () => {
            setLoading(true);
            await refreshUser();
            // ★ 3. 초기 로드 시 SRS 목록도 함께 불러옵니다.
            await refreshSrsIds();
            setLoading(false);
        })();
        const handler = (e) => {
            if (!e?.detail?.vocabId) return;
            removeSrsId(e.detail.vocabId);
        };
        window.addEventListener('srs:remove', handler);
        return () => window.removeEventListener('srs:remove', handler);
    }, [user?.id]); // user.id가 변경될 때 (로그인/로그아웃) 다시 실행

    return (
        <AuthCtx.Provider
            // ★ 4. srsIds와 refreshSrsIds를 Context 값으로 제공합니다.
            value={{
                user, loading,                    // 기본
                srsIds, refreshSrsIds,            // SRS 상태
                addSrsId, removeSrsId,            // ← 새로 노출
                login, register, logout, updateProfile
            }}
        >
            {children}
        </AuthCtx.Provider>
    );
}

export function useAuth() {
    return useContext(AuthCtx);
}
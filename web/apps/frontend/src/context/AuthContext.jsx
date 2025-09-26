// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { fetchJSON, withCreds, isAbortError, API_BASE } from "../api/client";

const AuthContext = createContext(null);

let globalAuthContext = null;

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [srsIds, setSrsIds] = useState(new Set());

    const refreshUser = useCallback(async (signal) => {
        try {
            const { data } = await fetchJSON("/me", withCreds({ signal }));
            setUser(data);
        } catch (e) {
            setUser(null);
            if (!isAbortError(e) && e.status !== 401) {
                console.error("Failed to fetch user:", e);
            }
        }
    }, []);

    const refreshSrsIds = useCallback(async (signal) => {
        if (!user) {
            setSrsIds(new Set());
            return;
        }
        try {
            const { data } = await fetchJSON('/srs/all-cards', withCreds({ signal }));
            setSrsIds(new Set((data || []).map(card => card.vocabId)));
        } catch (e) {
            if (!isAbortError(e)) {
                console.error("Failed to refresh SRS IDs:", e);
            }
        }
    }, [user]);

    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            setLoading(true);
            await refreshUser(ac.signal);
            setLoading(false);
        })();
        return () => ac.abort();
    }, [refreshUser]);

    useEffect(() => {
        const ac = new AbortController();
        if (user) {
            refreshSrsIds(ac.signal);
        }
        return () => ac.abort();
    }, [user, refreshSrsIds]);

    const login = async (email, password) => {
        console.log('[LOGIN DEBUG] Attempting login with:', { email, passwordLength: password?.length });
        console.log('[LOGIN DEBUG] API_BASE:', API_BASE);

        try {
            // Use raw fetch to bypass the 401 handling in fetchJSON
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            console.log('[LOGIN DEBUG] Raw response status:', response.status);
            console.log('[LOGIN DEBUG] Raw response headers:', [...response.headers.entries()]);

            if (response.status === 401) {
                const errorText = await response.text();
                console.log('[LOGIN DEBUG] 401 response body:', errorText);
                const err = new Error("Invalid credentials");
                err.status = 401;
                throw err;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.log('[LOGIN DEBUG] Error response body:', errorText);
                const err = new Error(`HTTP ${response.status}`);
                err.status = response.status;
                throw err;
            }

            const data = await response.json();
            console.log('[LOGIN DEBUG] Login successful:', data);

            // 승인 대기 상태인 경우 에러로 처리
            if (data.pending || data.type === 'ACCOUNT_PENDING' || !data.success) {
                console.log('[LOGIN DEBUG] Account pending approval');
                const err = new Error(JSON.stringify({
                    message: data.message,
                    pending: true,
                    type: 'ACCOUNT_PENDING'
                }));
                err.status = 200;
                throw err;
            }

            await refreshUser();
        } catch (error) {
            console.error('[LOGIN DEBUG] Login failed:', error);
            throw error;
        }
    };

    // ✅ 1. register 함수 정의
    const register = async (email, password) => {
        // 회원가입 API 호출
        const response = await fetchJSON("/auth/register", withCreds({
            method: "POST",
            body: JSON.stringify({ email, password })
        }));

        // 승인이 필요한 경우 자동 로그인하지 않음
        if (response.data?.requiresApproval) {
            // 승인 대기 상태를 알리기 위해 에러로 던짐
            const err = new Error(JSON.stringify({
                message: response.data.message,
                requiresApproval: true,
                type: 'ACCOUNT_PENDING'
            }));
            err.status = 200;
            throw err;
        }

        // 가입 성공 후 바로 로그인 처리 (super@root.com만)
        await login(email, password);
    };

    const logout = async () => {
        try {
            await fetchJSON("/auth/logout", withCreds({ method: "POST" }));
        } finally {
            setUser(null);
            setSrsIds(new Set());
        }
    };

    const handleTokenExpiration = useCallback(() => {
        setUser(null);
        setSrsIds(new Set());
    }, []);
    
    // ✅ 2. value 객체에 register 함수 추가 - useMemo로 최적화
    const value = useMemo(() => ({
        user, 
        loading, 
        login, 
        logout, 
        register, 
        srsIds, 
        refreshSrsIds, 
        handleTokenExpiration
    }), [user, loading, login, logout, register, srsIds, refreshSrsIds, handleTokenExpiration]);

    useEffect(() => {
        globalAuthContext = value;
        return () => {
            globalAuthContext = null;
        };
    }, [value]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

export function getGlobalAuthContext() {
    return globalAuthContext;
}
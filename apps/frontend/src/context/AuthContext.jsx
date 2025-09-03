// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { fetchJSON, withCreds, isAbortError } from "../api/client";

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
        await fetchJSON("/auth/login", withCreds({ method: "POST", body: JSON.stringify({ email, password }) }));
        await refreshUser();
    };

    // ✅ 1. register 함수 정의
    const register = async (email, password) => {
        // 회원가입 API 호출
        await fetchJSON("/auth/register", withCreds({ 
            method: "POST", 
            body: JSON.stringify({ email, password }) 
        }));
        // 가입 성공 후 바로 로그인 처리
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
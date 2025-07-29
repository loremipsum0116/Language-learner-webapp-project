// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchJSON, withCreds } from "../api/client";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    async function updateProfile(patch) {
        // patch: { level, tone, address }
        const me = await fetchJSON(
            "/me",
            withCreds({ method: "PATCH", body: JSON.stringify(patch) })
        );
        setUser(me?.data || me);
        return me?.data || me;
    }
    async function refresh() {
        try {
            const me = await fetchJSON("/me", withCreds());
            setUser(me?.data || me);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }

    async function updateProfile(patch) {
        // patch: { level, tone, address }
        const me = await fetchJSON(
            "/me",
            withCreds({ method: "PATCH", body: JSON.stringify(patch) })
        );
        setUser(me?.data || me);
        return me?.data || me;
    }

    async function login(email, password) {
        await fetchJSON("/auth/login", withCreds({ method: "POST", body: JSON.stringify({ email, password }) }));
        await refresh();
    }

    async function register(email, password) {
        await fetchJSON("/auth/register", withCreds({ method: "POST", body: JSON.stringify({ email, password }) }));
        await refresh();
    }

    async function logout() {
        try {
            await fetchJSON("/auth/logout", withCreds({ method: "POST" }));
        } finally {
            setUser(null);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    return (
        <AuthCtx.Provider
            value={{ user, loading, login, register, logout, refresh, updateProfile }}
        >
            {children}
        </AuthCtx.Provider>

    );
}

export function useAuth() {
    return useContext(AuthCtx);
}

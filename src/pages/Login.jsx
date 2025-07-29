// src/pages/Login.jsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate, Link } from "react-router-dom";

function parseServerError(e) {
    let msg = e?.message || "로그인 실패";
    try {
        const j = JSON.parse(msg);
        if (j?.error) msg = j.error;
    } catch { }
    return { status: e?.status, message: msg };
}

export default function Login() {
    const { login } = useAuth();
    const nav = useNavigate();
    const loc = useLocation();
    const redirect = loc.state?.from?.pathname || "/";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [touched, setTouched] = useState({ email: false, password: false });
    const [loading, setLoading] = useState(false);
    const [serverErr, setServerErr] = useState(null);
    const [invalidCred, setInvalidCred] = useState(false); // 401 표시

    const errors = useMemo(() => {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailErr = !email ? "이메일을 입력하세요." : !emailRe.test(email) ? "올바른 이메일 형식이 아닙니다." : "";
        const passwordErr = !password ? "비밀번호를 입력하세요." : "";
        return { email: emailErr, password: passwordErr };
    }, [email, password]);

    const isInvalid = {
        email: (touched.email && !!errors.email) || invalidCred,
        password: (touched.password && !!errors.password) || invalidCred,
    };

    const canSubmit = !errors.email && !errors.password && !loading;

    const onSubmit = async (e) => {
        e.preventDefault();
        setTouched({ email: true, password: true });
        setServerErr(null);
        setInvalidCred(false);
        if (!canSubmit) return;

        try {
            setLoading(true);
            await login(email.trim(), password);
            nav(redirect, { replace: true });
        } catch (e2) {
            const { status, message } = parseServerError(e2);
            setServerErr(message || "로그인 실패");
            if (status === 401 || /invalid credentials/i.test(String(message))) {
                setInvalidCred(true); // 두 필드 모두 붉게
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="container py-4" style={{ maxWidth: 480 }}>
            <h2 className="mb-3">로그인</h2>

            {serverErr && <div className="alert alert-danger">{serverErr}</div>}

            <form noValidate onSubmit={onSubmit}>
                {/* 이메일 */}
                <div className="mb-3">
                    <label className="form-label" htmlFor="login-email">이메일</label>
                    <input
                        id="login-email"
                        className={`form-control ${isInvalid.email ? "is-invalid" : touched.email && !errors.email ? "is-valid" : ""}`}
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setInvalidCred(false);
                        }}
                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        autoComplete="email"
                        required
                    />
                    {isInvalid.email && (
                        <div className="invalid-feedback">
                            {invalidCred ? "이메일 또는 비밀번호가 올바르지 않습니다." : errors.email}
                        </div>
                    )}
                </div>

                {/* 비밀번호 */}
                <div className="mb-3">
                    <label className="form-label" htmlFor="login-password">비밀번호</label>
                    <input
                        id="login-password"
                        className={`form-control ${isInvalid.password ? "is-invalid" : touched.password && !errors.password ? "is-valid" : ""}`}
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setInvalidCred(false);
                        }}
                        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                        autoComplete="current-password"
                        required
                    />
                    {isInvalid.password && (
                        <div className="invalid-feedback">
                            {invalidCred ? "이메일 또는 비밀번호가 올바르지 않습니다." : errors.password}
                        </div>
                    )}
                </div>

                <button className="btn btn-primary w-100" disabled={!canSubmit}>
                    {loading ? "로그인 중…" : "로그인"}
                </button>
            </form>

            <div className="mt-3">
                계정이 없으세요? <Link to="/register">회원가입</Link>
            </div>
        </main>
    );
}

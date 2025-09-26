// src/pages/Register.jsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

function parseServerError(e) {
    // api/client.js의 fetchJSON은 err.status를 넣어줍니다.
    let msg = e?.message || "회원가입 실패";
    let isPending = false;
    try {
        const j = JSON.parse(msg);
        if (j?.error) msg = j.error;
        if (j?.message) msg = j.message;
        if (j?.pending || j?.type === 'ACCOUNT_PENDING' || j?.requiresApproval) isPending = true;
    } catch { }
    return { status: e?.status, message: msg, isPending };
}

export default function Register() {
    const { register } = useAuth();
    const nav = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    // 필드 터치 여부(Blur 이후 유효성 표시)
    const [touched, setTouched] = useState({ email: false, password: false, confirm: false });

    const [loading, setLoading] = useState(false);
    const [serverErr, setServerErr] = useState(null);
    const [serverSuccess, setServerSuccess] = useState(null);
    const [emailTaken, setEmailTaken] = useState(false);
    const [isPendingApproval, setIsPendingApproval] = useState(false);

    // 클라이언트 유효성 규칙
    const errors = useMemo(() => {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailErr = !email ? "이메일을 입력하세요." : !emailRe.test(email) ? "올바른 이메일 형식이 아닙니다." : "";

        // 정책: 8–64자, 영문/숫자 최소 1개 포함
        const passLen = password.length < 8 || password.length > 64;
        const passComp = !/[A-Za-z]/.test(password) || !/[0-9]/.test(password);
        const passwordErr = !password
            ? "비밀번호를 입력하세요."
            : passLen
                ? "비밀번호는 8–64자여야 합니다."
                : passComp
                    ? "영문과 숫자를 최소 1자 이상 포함하세요."
                    : "";

        const confirmErr = confirm !== password ? "비밀번호가 일치하지 않습니다." : "";

        return { email: emailErr, password: passwordErr, confirm: confirmErr };
    }, [email, password, confirm]);

    const isInvalid = {
        email: (touched.email && !!errors.email) || emailTaken,
        password: touched.password && !!errors.password,
        confirm: touched.confirm && !!errors.confirm,
    };

    const canSubmit = !errors.email && !errors.password && !errors.confirm && !loading;

    const onSubmit = async (e) => {
        e.preventDefault();
        // 모든 필드를 터치 상태로 만들어 에러 노출
        setTouched({ email: true, password: true, confirm: true });
        setServerErr(null);
        setServerSuccess(null);
        setEmailTaken(false);
        setIsPendingApproval(false);

        if (!canSubmit) return;

        try {
            setLoading(true);
            await register(email.trim(), password);
            // 승인이 필요 없는 경우만 홈으로 리다이렉트 (super@root.com만)
            nav("/", { replace: true });
        } catch (e2) {
            const { status, message, isPending } = parseServerError(e2);

            // 승인 대기 상태인 경우 성공 메시지 표시하고 리다이렉트하지 않음
            if (isPending || (status === 200 && message && /requiresApproval/i.test(String(message)))) {
                setServerSuccess(message || "회원가입 신청해주셔서 감사합니다! 운영자가 검토 후 빠른 시일 내에 승인 해 드리겠습니다.");
                setIsPendingApproval(true);
                return;
            }

            setServerErr(message || "회원가입 실패");
            if (status === 409 || /already exists/i.test(String(message))) {
                setEmailTaken(true); // 이메일 중복을 필드 에러로 표시
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="container py-4" style={{ maxWidth: 480 }}>
            <h2 className="mb-3">회원가입</h2>

            {serverErr && <div className="alert alert-danger">{serverErr}</div>}
            {serverSuccess && <div className="alert alert-success">{serverSuccess}</div>}

            <form noValidate onSubmit={onSubmit}>
                {/* 이메일 */}
                <div className="mb-3">
                    <label className="form-label" htmlFor="reg-email">이메일</label>
                    <input
                        id="reg-email"
                        className={`form-control ${isInvalid.email ? "is-invalid" : touched.email && !errors.email && !emailTaken ? "is-valid" : ""}`}
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailTaken(false); // 재입력 시 중복 플래그 해제
                        }}
                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        autoComplete="email"
                        required
                    />
                    {isInvalid.email && (
                        <div className="invalid-feedback">{emailTaken ? "이미 등록된 이메일입니다." : errors.email}</div>
                    )}
                </div>

                {/* 비밀번호 */}
                <div className="mb-3">
                    <label className="form-label" htmlFor="reg-password">비밀번호</label>
                    <input
                        id="reg-password"
                        className={`form-control ${isInvalid.password ? "is-invalid" : touched.password && !errors.password ? "is-valid" : ""}`}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                        autoComplete="new-password"
                        required
                    />
                    <div className={isInvalid.password ? "invalid-feedback" : "form-text"}>
                        최소 8–64자, 영문과 숫자 포함(서버는 bcrypt(10–12 rounds)로 저장).
                    </div>
                </div>

                {/* 비밀번호 확인 */}
                <div className="mb-3">
                    <label className="form-label" htmlFor="reg-confirm">비밀번호 확인</label>
                    <input
                        id="reg-confirm"
                        className={`form-control ${isInvalid.confirm ? "is-invalid" : touched.confirm && !errors.confirm ? "is-valid" : ""}`}
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                        autoComplete="new-password"
                        required
                    />
                    {isInvalid.confirm && <div className="invalid-feedback">{errors.confirm}</div>}
                </div>

                <button className="btn btn-primary w-100" disabled={!canSubmit}>
                    {loading ? "가입 중…" : "가입하기"}
                </button>
            </form>

            <div className="mt-3">
                이미 계정이 있으세요? <Link to="/login">로그인</Link>
            </div>
        </main>
    );
}

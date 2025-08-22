import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchJSON, withCreds } from "../api/client";
import { toast } from "react-toastify";

function SectionHeader({ title, desc }) {
    return (
        <div className="mb-3">
            <h4 className="mb-1">{title}</h4>
            {desc && <div className="text-muted">{desc}</div>}
            <hr />
        </div>
    );
}

function FilePicker({ accept, label, onPick }) {
    const ref = useRef(null);
    return (
        <div className="mb-3">
            <label className="form-label">{label}</label>
            <div className="d-flex gap-2">
                <input
                    ref={ref}
                    type="file"
                    className="form-control"
                    accept={accept}
                    onChange={(e) => onPick?.(e.target.files?.[0] || null)}
                />
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                        if (ref.current) ref.current.value = "";
                        onPick?.(null);
                    }}
                >
                    초기화
                </button>
            </div>
        </div>
    );
}

function Preview({ file }) {
    const [preview, setPreview] = useState("");
    const [meta, setMeta] = useState(null);

    React.useEffect(() => {
        setPreview("");
        setMeta(null);
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const txt = String(reader.result || "");
            setMeta({ name: file.name, size: file.size });
            setPreview(txt.slice(0, 1000)); // 최대 1000자만 미리보기
        };
        reader.readAsText(file, "utf-8");
    }, [file]);

    if (!file) return null;
    return (
        <div className="mb-3">
            <div className="small text-muted mb-1">
                {meta?.name} • {meta?.size?.toLocaleString()} bytes
            </div>
            <pre className="p-2 border rounded bg-light" style={{ whiteSpace: "pre-wrap", maxHeight: 240, overflow: "auto" }}>
                {preview}
            </pre>
        </div>
    );
}

export default function AdminNew() {
    const { user } = useAuth();
    const [tab, setTab] = useState("upload"); // upload | validate | reports | logs
    
    // super@root.com 계정인지 확인
    const isSuperAdmin = user?.email === 'super@root.com';
    
    // 디버깅: 현재 사용자 정보 출력
    console.log('Current user:', user);
    
    // 업로드 탭 상태
    const [vocabFile, setVocabFile] = useState(null);
    const [grammarFile, setGrammarFile] = useState(null);
    const [readingFile, setReadingFile] = useState(null);
    const [uploading, setUploading] = useState(null);
    
    // 검증 탭 상태
    const [validating, setValidating] = useState(false);
    const [validationResults, setValidationResults] = useState(null);
    
    // 리포트 탭 상태
    const [loadingReports, setLoadingReports] = useState(false);
    const [reports, setReports] = useState(null);
    
    // 로그 탭 상태
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logs, setLogs] = useState([]);
    
    // 업로드 함수들
    const handleUpload = async (type, file) => {
        if (!file) {
            toast.error('파일을 선택해주세요.');
            return;
        }
        
        setUploading(type);
        const formData = new FormData();
        
        try {
            switch (type) {
                case 'vocab':
                    formData.append('vocabFile', file);
                    break;
                case 'grammar':
                    formData.append('grammarFile', file);
                    break;
                case 'reading':
                    formData.append('readingFile', file);
                    break;
            }
            
            const { data } = await fetchJSON(`/admin/upload/${type}`, withCreds({
                method: 'POST',
                body: formData
            }));
            
            toast.success(data.message);
            
            // 파일 초기화
            switch (type) {
                case 'vocab': setVocabFile(null); break;
                case 'grammar': setGrammarFile(null); break;
                case 'reading': setReadingFile(null); break;
            }
            
            // 에러가 있으면 표시
            if (data.errors && data.errors.length > 0) {
                console.warn('Upload errors:', data.errors);
                toast.warn(`${data.errors.length}개의 에러가 발생했습니다. 콘솔을 확인하세요.`);
            }
            
        } catch (error) {
            console.error(`Upload error (${type}):`, error);
            toast.error(`업로드 실패: ${error.message}`);
        } finally {
            setUploading(null);
        }
    };
    
    // 검증 함수
    const handleValidation = async (type = 'all') => {
        setValidating(true);
        try {
            const { data } = await fetchJSON('/admin/validate', withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            }));
            
            setValidationResults(data.results);
            toast.success(data.message);
            
        } catch (error) {
            console.error('Validation error:', error);
            console.error('Current user email:', user?.email);
            console.error('Is super admin:', isSuperAdmin);
            
            if (error.message.includes('Unauthorized') || error.message.includes('Admin access required')) {
                toast.error(`관리자 권한 필요: super@root.com 계정으로 로그인하세요. 현재: ${user?.email}`);
            } else {
                toast.error(`검증 실패: ${error.message}`);
            }
        } finally {
            setValidating(false);
        }
    };
    
    // 리포트 로드 함수
    const loadReports = async (type = 'all') => {
        setLoadingReports(true);
        try {
            const { data } = await fetchJSON(`/admin/reports?type=${type}`, withCreds());
            setReports(data.reports);
            
        } catch (error) {
            console.error('Reports error:', error);
            toast.error(`리포트 로드 실패: ${error.message}`);
        } finally {
            setLoadingReports(false);
        }
    };
    
    // 로그 로드 함수
    const loadLogs = async (type = '') => {
        setLoadingLogs(true);
        try {
            const { data } = await fetchJSON(`/admin/logs?type=${type}&limit=50`, withCreds());
            setLogs(data.logs);
            
        } catch (error) {
            console.error('Logs error:', error);
            toast.error(`로그 로드 실패: ${error.message}`);
        } finally {
            setLoadingLogs(false);
        }
    };
    
    // 탭 변경시 자동 로드
    React.useEffect(() => {
        if (tab === 'reports' && !reports) {
            loadReports();
        }
        if (tab === 'logs' && logs.length === 0) {
            loadLogs();
        }
    }, [tab]);

    return (
        <main className="container py-4">
            {/* 운영자 전용 대시보드 링크 */}
            {isSuperAdmin && (
                <div className="alert alert-info mb-4">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <strong>🛠️ 운영자 권한 활성화</strong>
                            <p className="mb-0">시간 가속 컨트롤러와 고급 관리 기능에 접근할 수 있습니다.</p>
                        </div>
                        <Link to="/admin/dashboard" className="btn btn-primary">
                            운영자 대시보드
                        </Link>
                    </div>
                </div>
            )}
            
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 className="m-0">관리 콘솔</h3>
                <div className="btn-group" role="tablist" aria-label="admin tabs">
                    <button className={"btn btn-sm " + (tab === "upload" ? "btn-primary" : "btn-outline-primary")} onClick={() => setTab("upload")}>
                        업로드
                    </button>
                    <button className={"btn btn-sm " + (tab === "validate" ? "btn-primary" : "btn-outline-primary")} onClick={() => setTab("validate")}>
                        검증
                    </button>
                    <button className={"btn btn-sm " + (tab === "reports" ? "btn-primary" : "btn-outline-primary")} onClick={() => setTab("reports")}>
                        리포트
                    </button>
                    <button className={"btn btn-sm " + (tab === "logs" ? "btn-primary" : "btn-outline-primary")} onClick={() => setTab("logs")}>
                        로그
                    </button>
                </div>
            </div>

            {/* 업로드 */}
            {tab === "upload" && (
                <>
                    <SectionHeader title="콘텐츠 업로드" desc="CSV(어휘), JSON(문법/리딩) 파일을 업로드하여 데이터베이스에 저장합니다." />
                    <div className="row g-3">
                        <div className="col-lg-4">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h5 className="card-title">어휘 (CSV)</h5>
                                    <div className="form-text mb-2">필드 예: lemma,pos,gender,plural,levelCEFR,freq</div>
                                    <FilePicker accept=".csv,text/csv" label="CSV 선택" onPick={setVocabFile} />
                                    <Preview file={vocabFile} />
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={() => handleUpload('vocab', vocabFile)}
                                        disabled={!vocabFile || uploading === 'vocab'}
                                    >
                                        {uploading === 'vocab' ? '업로드 중...' : '어휘 업로드'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h5 className="card-title">문법 (JSON)</h5>
                                    <div className="form-text mb-2">필드 예: [{`{topic, rule, examples[]}`}], [{`{topic,levelCEFR,items[]}`}]</div>
                                    <FilePicker accept=".json,application/json" label="JSON 선택" onPick={setGrammarFile} />
                                    <Preview file={grammarFile} />
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={() => handleUpload('grammar', grammarFile)}
                                        disabled={!grammarFile || uploading === 'grammar'}
                                    >
                                        {uploading === 'grammar' ? '업로드 중...' : '문법 업로드'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h5 className="card-title">리딩 (JSON)</h5>
                                    <div className="form-text mb-2">필드 예: [{`{title, body, levelCEFR, glosses[]}`}]</div>
                                    <FilePicker accept=".json,application/json" label="JSON 선택" onPick={setReadingFile} />
                                    <Preview file={readingFile} />
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={() => handleUpload('reading', readingFile)}
                                        disabled={!readingFile || uploading === 'reading'}
                                    >
                                        {uploading === 'reading' ? '업로드 중...' : '리딩 업로드'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* 검증 */}
            {tab === "validate" && (
                <>
                    <SectionHeader title="데이터 검증" desc="필수 필드 누락, 중복 데이터, 잘못된 형식 등을 검사합니다." />
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex gap-2 mb-3">
                                <button 
                                    className="btn btn-primary" 
                                    onClick={() => handleValidation('all')}
                                    disabled={validating}
                                >
                                    {validating ? '검증 중...' : '전체 검증'}
                                </button>
                                <button 
                                    className="btn btn-outline-primary" 
                                    onClick={() => handleValidation('vocab')}
                                    disabled={validating}
                                >
                                    어휘만 검증
                                </button>
                                <button 
                                    className="btn btn-outline-primary" 
                                    onClick={() => handleValidation('grammar')}
                                    disabled={validating}
                                >
                                    문법만 검증
                                </button>
                                <button 
                                    className="btn btn-outline-primary" 
                                    onClick={() => handleValidation('reading')}
                                    disabled={validating}
                                >
                                    리딩만 검증
                                </button>
                            </div>
                            <hr />
                            {validationResults ? (
                                <div>
                                    <div className="row mb-3">
                                        <div className="col-md-4">
                                            <div className="text-center">
                                                <h5 className="text-danger">{validationResults.summary.criticalIssues}</h5>
                                                <small>심각한 문제</small>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="text-center">
                                                <h5 className="text-warning">{validationResults.summary.warnings}</h5>
                                                <small>경고</small>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="text-center">
                                                <h5 className="text-info">{validationResults.summary.totalIssues}</h5>
                                                <small>총 이슈</small>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {validationResults.vocab && (
                                        <div className="mb-3">
                                            <h6>어휘 검증 결과 ({validationResults.vocab.totalItems}개 항목)</h6>
                                            {validationResults.vocab.issues.length > 0 ? (
                                                <div className="small">
                                                    {validationResults.vocab.issues.slice(0, 5).map((issue, i) => (
                                                        <div key={i} className={`text-${issue.type === 'critical' ? 'danger' : 'warning'}`}>
                                                            • {issue.message}
                                                        </div>
                                                    ))}
                                                    {validationResults.vocab.issues.length > 5 && (
                                                        <div className="text-muted">...그리고 {validationResults.vocab.issues.length - 5}개 더</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-success small">✓ 문제 없음</div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {validationResults.grammar && (
                                        <div className="mb-3">
                                            <h6>문법 검증 결과 ({validationResults.grammar.exerciseCount}개 연습문제, {validationResults.grammar.itemCount}개 규칙)</h6>
                                            {validationResults.grammar.issues.length > 0 ? (
                                                <div className="small">
                                                    {validationResults.grammar.issues.slice(0, 5).map((issue, i) => (
                                                        <div key={i} className={`text-${issue.type === 'critical' ? 'danger' : 'warning'}`}>
                                                            • {issue.message}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-success small">✓ 문제 없음</div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {validationResults.reading && (
                                        <div className="mb-3">
                                            <h6>리딩 검증 결과 ({validationResults.reading.totalItems}개 항목)</h6>
                                            {validationResults.reading.issues.length > 0 ? (
                                                <div className="small">
                                                    {validationResults.reading.issues.slice(0, 5).map((issue, i) => (
                                                        <div key={i} className={`text-${issue.type === 'critical' ? 'danger' : 'warning'}`}>
                                                            • {issue.message}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-success small">✓ 문제 없음</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-muted">검증 결과가 여기에 표시됩니다.</div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* 리포트 */}
            {tab === "reports" && (
                <>
                    <SectionHeader title="리포트" desc="시스템 성능 지표, 사용자 활동, 튜터 사용 통계를 확인합니다." />
                    <div className="d-flex gap-2 mb-3">
                        <button 
                            className="btn btn-primary" 
                            onClick={() => loadReports('all')}
                            disabled={loadingReports}
                        >
                            {loadingReports ? '로딩 중...' : '전체 리포트'}
                        </button>
                        <button 
                            className="btn btn-outline-primary" 
                            onClick={() => loadReports('performance')}
                            disabled={loadingReports}
                        >
                            성능 리포트
                        </button>
                        <button 
                            className="btn btn-outline-primary" 
                            onClick={() => loadReports('tutor')}
                            disabled={loadingReports}
                        >
                            튜터 리포트
                        </button>
                        <button 
                            className="btn btn-outline-primary" 
                            onClick={() => loadReports('users')}
                            disabled={loadingReports}
                        >
                            사용자 리포트
                        </button>
                    </div>
                    
                    {reports ? (
                        <div className="row g-3">
                            {reports.performance && (
                                <>
                                    <div className="col-md-6">
                                        <div className="card h-100">
                                            <div className="card-body">
                                                <h6 className="card-title">어휘 성능</h6>
                                                <ul className="mb-0 small">
                                                    <li>총 카드: {reports.performance.vocab.totalCards}개</li>
                                                    <li>평균 정답률: {reports.performance.vocab.avgCorrectRate.toFixed(1)}%</li>
                                                    <li>통과 카드: {reports.performance.vocab.passedCards}개</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="card h-100">
                                            <div className="card-body">
                                                <h6 className="card-title">문법 성능</h6>
                                                <ul className="mb-0 small">
                                                    <li>총 카드: {reports.performance.grammar.totalCards}개</li>
                                                    <li>평균 정답률: {reports.performance.grammar.avgCorrectRate.toFixed(1)}%</li>
                                                    <li>통과 카드: {reports.performance.grammar.passedCards}개</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    {reports.performance.topWrongVocab.length > 0 && (
                                        <div className="col-12">
                                            <div className="card">
                                                <div className="card-body">
                                                    <h6 className="card-title">자주 틀리는 어휘 TOP 10</h6>
                                                    <div className="table-responsive">
                                                        <table className="table table-sm">
                                                            <thead>
                                                                <tr>
                                                                    <th>단어</th>
                                                                    <th>품사</th>
                                                                    <th>레벨</th>
                                                                    <th>오답 횟수</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {reports.performance.topWrongVocab.map((item, i) => (
                                                                    <tr key={i}>
                                                                        <td>{item.lemma}</td>
                                                                        <td>{item.pos}</td>
                                                                        <td>{item.level}</td>
                                                                        <td>{item.wrongCount}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {reports.tutor && (
                                <>
                                    <div className="col-md-6">
                                        <div className="card h-100">
                                            <div className="card-body">
                                                <h6 className="card-title">튜터 사용 (최근 7일)</h6>
                                                <ul className="mb-0 small">
                                                    <li>총 세션: {reports.tutor.weeklyStats.totalSessions}회</li>
                                                    <li>평균 토큰/세션: {reports.tutor.weeklyStats.avgTokensPerSession}</li>
                                                    <li>총 비용: ${reports.tutor.weeklyStats.totalCost}</li>
                                                    <li>에러율: {reports.tutor.weeklyStats.errorRate}%</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="card h-100">
                                            <div className="card-body">
                                                <h6 className="card-title">일별 통계</h6>
                                                <div className="small">
                                                    {reports.tutor.dailyBreakdown.slice(0, 3).map((day, i) => (
                                                        <div key={i}>
                                                            {new Date(day.date).toLocaleDateString()}: {day.sessions}세션 (${day.cost})
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {reports.users && (
                                <div className="col-12">
                                    <div className="card">
                                        <div className="card-body">
                                            <h6 className="card-title">사용자 통계</h6>
                                            <div className="row">
                                                <div className="col-md-3 text-center">
                                                    <h5>{reports.users.total}</h5>
                                                    <small>총 사용자</small>
                                                </div>
                                                <div className="col-md-3 text-center">
                                                    <h5>{reports.users.activeThisWeek}</h5>
                                                    <small>이번 주 활성 사용자</small>
                                                </div>
                                                <div className="col-md-3 text-center">
                                                    <h5>{reports.users.newThisWeek}</h5>
                                                    <small>이번 주 신규 사용자</small>
                                                </div>
                                                <div className="col-md-3 text-center">
                                                    <h5>{reports.users.avgStreak}</h5>
                                                    <small>평균 연속 학습일</small>
                                                </div>
                                            </div>
                                            
                                            {reports.users.topStreaks.length > 0 && (
                                                <div className="mt-3">
                                                    <h6>연속 학습 순위 TOP 5</h6>
                                                    <ul className="small">
                                                        {reports.users.topStreaks.map((user, i) => (
                                                            <li key={i}>{user.email}: {user.streak}일</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-muted">리포트 데이터가 여기에 표시됩니다.</div>
                    )}
                </>
            )}

            {/* 로그 */}
            {tab === "logs" && (
                <>
                    <SectionHeader title="로그" desc="시스템 활동, 튜터 사용, 사용자 활동 로그를 확인합니다." />
                    <div className="d-flex gap-2 mb-3">
                        <button 
                            className="btn btn-primary" 
                            onClick={() => loadLogs('')}
                            disabled={loadingLogs}
                        >
                            {loadingLogs ? '로딩 중...' : '전체 로그'}
                        </button>
                        <button 
                            className="btn btn-outline-primary" 
                            onClick={() => loadLogs('tutor')}
                            disabled={loadingLogs}
                        >
                            튜터 로그
                        </button>
                        <button 
                            className="btn btn-outline-primary" 
                            onClick={() => loadLogs('user_activity')}
                            disabled={loadingLogs}
                        >
                            사용자 활동
                        </button>
                        <button 
                            className="btn btn-outline-primary" 
                            onClick={() => loadLogs('errors')}
                            disabled={loadingLogs}
                        >
                            에러 로그
                        </button>
                    </div>
                    
                    <div className="card">
                        <div className="card-body">
                            {logs.length > 0 ? (
                                <div className="table-responsive">
                                    <table className="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>시간</th>
                                                <th>타입</th>
                                                <th>레벨</th>
                                                <th>메시지</th>
                                                <th>사용자</th>
                                            </tr>
                                        </thead>
                                        <tbody className="small">
                                            {logs.map((log, i) => (
                                                <tr key={i}>
                                                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                                                    <td>
                                                        <span className={`badge bg-${
                                                            log.type === 'error' ? 'danger' : 
                                                            log.type === 'tutor' ? 'primary' : 
                                                            'secondary'
                                                        }`}>
                                                            {log.type}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge bg-${
                                                            log.level === 'ERROR' ? 'danger' : 
                                                            log.level === 'WARN' ? 'warning' : 'info'
                                                        }`}>
                                                            {log.level}
                                                        </span>
                                                    </td>
                                                    <td>{log.message}</td>
                                                    <td>{log.user}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-muted">로그가 여기에 표시됩니다.</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}
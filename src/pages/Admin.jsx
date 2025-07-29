import React, { useRef, useState } from "react";

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

export default function Admin() {
    const [tab, setTab] = useState("upload"); // upload | validate | reports | logs

    // 업로드 탭 상태(껍데기: 실제 업로드 호출 없음)
    const [vocabFile, setVocabFile] = useState(null);     // CSV
    const [grammarFile, setGrammarFile] = useState(null); // JSON
    const [readingFile, setReadingFile] = useState(null); // JSON

    return (
        <main className="container py-4">
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
                    <SectionHeader title="콘텐츠 업로드" desc="CSV(어휘), JSON(문법/리딩) 업로드. 현재는 UI 껍데기만 제공합니다." />
                    <div className="row g-3">
                        <div className="col-lg-4">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h5 className="card-title">어휘 (CSV)</h5>
                                    <div className="form-text mb-2">필드 예: lemma,pos,gender,plural,levelCEFR,freq</div>
                                    <FilePicker accept=".csv,text/csv" label="CSV 선택" onPick={setVocabFile} />
                                    <Preview file={vocabFile} />
                                    <button className="btn btn-secondary" disabled>업로드 (비활성)</button>
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
                                    <button className="btn btn-secondary" disabled>업로드 (비활성)</button>
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
                                    <button className="btn btn-secondary" disabled>업로드 (비활성)</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* 검증 */}
            {tab === "validate" && (
                <>
                    <SectionHeader title="데이터 검증" desc="필수 필드/중복 lemma/라이선스 메타 누락 검사(현재 더미 UI)." />
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex gap-2">
                                <button className="btn btn-outline-primary" disabled>검증 실행 (비활성)</button>
                                <button className="btn btn-outline-secondary" disabled>최근 결과 불러오기</button>
                            </div>
                            <hr />
                            <div className="text-muted">검증 결과가 여기에 표시됩니다. (예: 에러 라인/필드, 중복 키, 누락된 라이선스 등)</div>
                        </div>
                    </div>
                </>
            )}

            {/* 리포트 */}
            {tab === "reports" && (
                <>
                    <SectionHeader title="리포트" desc="아이템 정답률/난이도, 오답 유형 Top, 튜터 토큰/비용/에러 요약(현재 더미 UI)." />
                    <div className="row g-3">
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h6 className="card-title">아이템 정답률(샘플)</h6>
                                    <ul className="mb-0 small">
                                        <li>Vocab: 78%</li>
                                        <li>Grammar: 64%</li>
                                        <li>Reading: 71%</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h6 className="card-title">튜터 사용(샘플)</h6>
                                    <ul className="mb-0 small">
                                        <li>세션/주: 132</li>
                                        <li>평균 토큰/세션: 1.8k</li>
                                        <li>에러율: 1.2%</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* 로그 */}
            {tab === "logs" && (
                <>
                    <SectionHeader title="로그" desc="업로드/검증/튜터 사용 로그 뷰(현재 더미 UI)." />
                    <div className="card">
                        <div className="card-body">
                            <table className="table table-sm">
                                <thead>
                                    <tr>
                                        <th>시간</th>
                                        <th>타입</th>
                                        <th>메시지</th>
                                    </tr>
                                </thead>
                                <tbody className="small">
                                    <tr><td>2025-07-29 10:10</td><td>upload</td><td>Vocab CSV 200행 업로드(샘플)</td></tr>
                                    <tr><td>2025-07-29 10:12</td><td>validate</td><td>중복 lemma 3건 발견(샘플)</td></tr>
                                    <tr><td>2025-07-29 10:20</td><td>tutor</td><td>토큰 초과 경고 2건(샘플)</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}

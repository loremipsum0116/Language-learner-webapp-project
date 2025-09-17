import React from 'react';

const LanguageSelectionModal = ({
    show,
    onHide,
    japaneseCount,
    englishCount,
    onSelectLanguage
}) => {
    if (!show) return null;

    const handleLanguageSelect = (language) => {
        onSelectLanguage(language);
        onHide();
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">
                            🌐 복습할 언어를 선택하세요
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={onHide}
                        ></button>
                    </div>

                    <div className="modal-body">
                        <p className="text-muted mb-4">
                            복습할 카드가 여러 언어로 구성되어 있습니다.
                            먼저 복습할 언어를 선택해주세요.
                        </p>

                        <div className="d-grid gap-3">
                            {japaneseCount > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-outline-primary btn-lg d-flex align-items-center justify-content-between p-3"
                                    onClick={() => handleLanguageSelect('japanese')}
                                >
                                    <div className="d-flex align-items-center">
                                        <span className="fs-3 me-3">🇯🇵</span>
                                        <div className="text-start">
                                            <div className="fw-bold">일본어 복습</div>
                                            <small className="text-muted">JLPT 단어 학습</small>
                                        </div>
                                    </div>
                                    <span className="badge bg-primary fs-6">
                                        {japaneseCount}개
                                    </span>
                                </button>
                            )}

                            {englishCount > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-outline-success btn-lg d-flex align-items-center justify-content-between p-3"
                                    onClick={() => handleLanguageSelect('english')}
                                >
                                    <div className="d-flex align-items-center">
                                        <span className="fs-3 me-3">🇺🇸</span>
                                        <div className="text-start">
                                            <div className="fw-bold">영어 복습</div>
                                            <small className="text-muted">CEFR/TOEIC/TOEFL 단어</small>
                                        </div>
                                    </div>
                                    <span className="badge bg-success fs-6">
                                        {englishCount}개
                                    </span>
                                </button>
                            )}
                        </div>

                        <div className="mt-4 p-3 bg-light rounded">
                            <small className="text-muted">
                                💡 <strong>팁:</strong> 한 언어의 복습을 완료하면
                                자동으로 다른 언어의 복습이 시작됩니다.
                            </small>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onHide}
                        >
                            취소
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LanguageSelectionModal;
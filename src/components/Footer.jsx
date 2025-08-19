// src/components/Footer.jsx
import React from 'react';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-dark text-light py-3 mt-5 border-top">
            <div className="container">
                <div className="row">
                    <div className="col-md-8">
                        <div className="row">
                            <div className="col-md-6">
                                <h6 className="text-uppercase mb-3">단무새</h6>
                                <ul className="list-unstyled small">
                                    <li><a href="#" className="text-light text-decoration-none">서비스 소개</a></li>
                                    <li><a href="#" className="text-light text-decoration-none">이용약관</a></li>
                                    <li><a href="#" className="text-light text-decoration-none">개인정보처리방침</a></li>
                                    <li><a href="#" className="text-light text-decoration-none">고객센터</a></li>
                                </ul>
                            </div>
                            <div className="col-md-6">
                                <h6 className="text-uppercase mb-3">학습 서비스</h6>
                                <ul className="list-unstyled small">
                                    <li><a href="/vocab" className="text-light text-decoration-none">단어 학습</a></li>
                                    <li><a href="/learn/grammar" className="text-light text-decoration-none">문법 학습</a></li>
                                    <li><a href="/srs" className="text-light text-decoration-none">복습 관리</a></li>
                                    <li><a href="/dashboard" className="text-light text-decoration-none">학습 현황</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <h6 className="text-uppercase mb-3">회사 정보</h6>
                        <p className="small text-muted mb-1">단무새</p>
                        <p className="small text-muted mb-1">대표자: 심현석</p>
                        <p className="small text-muted mb-1">사업자등록번호: 000-00-00000</p>
                        <p className="small text-muted mb-0">통신판매업신고번호: 제0000-서울-00000호</p>
                    </div>
                </div>
                <hr className="my-3" />
                <div className="row align-items-center">
                    <div className="col-md-8">
                        <p className="mb-0 small text-muted">
                            © {currentYear} 단무새. All rights reserved.
                        </p>
                    </div>
                    <div className="col-md-4 text-md-end">
                        <div className="d-flex justify-content-md-end">
                            <a href="#" className="text-muted me-3" title="Facebook">
                                <i className="bi bi-facebook"></i>
                            </a>
                            <a href="#" className="text-muted me-3" title="Instagram">
                                <i className="bi bi-instagram"></i>
                            </a>
                            <a href="#" className="text-muted" title="YouTube">
                                <i className="bi bi-youtube"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
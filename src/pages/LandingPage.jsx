import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from './Header';
import Footer from '../components/Footer';

const LandingPage = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  }, []);

  const handleGetStarted = () => {
    if (user) {
      navigate('/home');
    } else {
      navigate('/login');
    }
  };

  const handleSkip = () => {
    navigate('/home');
  };

  return (
    <>
      <Header />
      <div className="container-fluid bg-light min-vh-100">
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="text-center mb-5">
                <img 
                  src="/danmoosae.png" 
                  alt="단무새" 
                  style={{height: '100px', width: 'auto'}}
                  className="mb-4"
                />
                <h1 className="display-4 fw-bold text-primary mb-3">
                  단무새와 함께하는 English Learning
                </h1>
                <p className="lead text-muted mb-4">
                  AI-powered personalized learning for mastering English<br/>
                  AI 기반 맞춤형 학습으로 영어를 완벽하게 마스터하세요
                </p>
                
                <div className="d-flex gap-3 justify-content-center mb-5">
                  <button className="btn btn-primary btn-lg px-4" onClick={handleGetStarted}>
                    <i className="bi bi-rocket-takeoff me-2"></i>
                    Start Learning
                  </button>
                  <button className="btn btn-outline-primary btn-lg px-4" onClick={handleSkip}>
                    <i className="bi bi-eye me-2"></i>
                    Explore Demo
                  </button>
                </div>
              </div>

              <div className="row justify-content-center mb-5">
                <div className="col-md-10 col-lg-8">
                  <div className="card shadow-sm">
                    <div className="card-body p-0">
                      <video
                        ref={videoRef}
                        className="w-100 rounded"
                        controls
                        autoPlay
                        muted
                        playsInline
                        style={{maxHeight: '600px', objectFit: 'contain'}}
                        onLoadStart={() => console.log('비디오 로딩 시작')}
                        onCanPlay={() => console.log('비디오 재생 가능')}
                        onError={() => console.log('비디오 로드 실패')}
                      >
                        <source src="http://localhost:4000/api/video/final_23sec_video.mp4" type="video/mp4" />
                        <source src="/final_23sec_video.mp4" type="video/mp4" />
                        Your browser does not support video playback.
                      </video>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-4">
                <div className="col-md-4">
                  <div className="card h-100 text-center border-0 shadow-sm">
                    <div className="card-body p-4">
                      <i className="bi bi-brain text-primary mb-3" style={{fontSize: '3rem'}}></i>
                      <h5 className="card-title fw-bold">Smart AI Learning</h5>
                      <p className="card-text">
                        Personalized curriculum based on your learning patterns<br/>
                        <small className="text-muted">당신의 학습 패턴에 맞춘 AI 커리큘럼</small>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card h-100 text-center border-0 shadow-sm">
                    <div className="card-body p-4">
                      <i className="bi bi-arrow-repeat text-primary mb-3" style={{fontSize: '3rem'}}></i>
                      <h5 className="card-title fw-bold">SRS Memory System</h5>
                      <p className="card-text">
                        Scientific spaced repetition for long-term retention<br/>
                        <small className="text-muted">과학적인 간격 반복으로 장기 기억 향상</small>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card h-100 text-center border-0 shadow-sm">
                    <div className="card-body p-4">
                      <i className="bi bi-controller text-primary mb-3" style={{fontSize: '3rem'}}></i>
                      <h5 className="card-title fw-bold">Interactive Quizzes</h5>
                      <p className="card-text">
                        Engaging quizzes in various formats for fun learning<br/>
                        <small className="text-muted">다양한 형태의 퀴즈로 재미있는 학습</small>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center mt-5">
                <button className="btn btn-link" onClick={handleSkip}>
                  Skip Intro <i className="bi bi-arrow-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default LandingPage;
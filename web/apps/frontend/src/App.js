// src/App.js
import React from "react";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Routes, Route } from "react-router-dom";
import Header from "./pages/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LearnVocab from "./pages/LearnVocab";
import Dict from "./pages/Dict";
import EnglishDict from "./pages/EnglishDict";
import JapaneseDict from "./pages/JapaneseDict";
import ProtectedRoute from "./components/ProtectedRoute";
import Logout from "./pages/Logout";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRoute from "./components/AdminRoute";
import VocabList from "./pages/VocabList";
import MyWordbook from "./pages/MyWordbook";
import LearnStart from "./pages/LearnStart";
import Dashboard from "./pages/Dashboard";
import GrammarHub from './pages/GrammarHub';
import GrammarQuiz from './pages/GrammarQuiz';
import JapaneseGrammarHub from './pages/JapaneseGrammarHub';
import JapaneseGrammarQuiz from './pages/JapaneseGrammarQuiz';
import SrsDashboard from "./pages/SrsDashboard";
import SrsQuiz from "./pages/SrsQuiz";
import SrsFolderDetail from './pages/SrsFolderDetail';
import SrsParentFolder from './pages/SrsParentFolder';
import WrongAnswers from "./pages/WrongAnswers";
import WrongAnswerQuiz from "./pages/WrongAnswerQuiz";
import LandingPage from "./pages/LandingPage";
import Reading from "./pages/Reading";
import ReadingList from "./pages/ReadingList";
import ReadingReview from "./pages/ReadingReview";
import JapaneseReadingList from "./pages/JapaneseReadingList";
import JapaneseReading from "./pages/JapaneseReading";
import Listening from "./pages/Listening";
import ListeningList from "./pages/ListeningList";
import ListeningPractice from "./pages/ListeningPractice";
import JapaneseListeningList from "./pages/JapaneseListeningList";
import JapaneseListeningPractice from "./pages/JapaneseListeningPractice";

const Placeholder = ({ title }) => (
  <div className="container py-4">
    <h2>{title}</h2>
    <p>구현 예정</p>
  </div>
);

export default function App() {
  return (
    <>
      <ToastContainer /> {/* ToastContainer 추가 */}
      <div className="app-wrapper">
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/home"
          element={
            <>
              <Header />
              <div className="main-content">
                <Home />
              </div>
              <Footer />
            </>
          }
        />
        <Route 
          path="/login" 
          element={
            <>
              <Header />
              <div className="main-content">
                <Login />
              </div>
              <Footer />
            </>
          } 
        />
        <Route 
          path="/register" 
          element={
            <>
              <Header />
              <div className="main-content">
                <Register />
              </div>
              <Footer />
            </>
          } 
        />
        <Route 
          path="/logout" 
          element={
            <>
              <Header />
              <div className="main-content">
                <Logout />
              </div>
              <Footer />
            </>
          } 
        />
        <Route 
          path="/odat-note" 
          element={
            <>
              <Header />
              <div className="main-content">
                <WrongAnswers />
              </div>
              <Footer />
            </>
          } 
        />
        <Route 
          path="/vocab" 
          element={
            <>
              <Header />
              <div className="main-content">
                <VocabList />
              </div>
              <Footer />
            </>
          } 
        />

        {/* 보호 라우트: 로그인 필요 */}
        <Route element={<ProtectedRoute />}>
          <Route 
            path="/learn" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <LearnStart />
                </div>
                <Footer />
              </>
            } 
          />
          <Route 
            path="/learn/vocab" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <LearnVocab />
                </div>
                <Footer />
              </>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <Dashboard />
                </div>
                <Footer />
              </>
            } 
          />
          <Route 
            path="/my-wordbook" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <MyWordbook />
                </div>
                <Footer />
              </>
            } 
          />
          <Route 
            path="/srs/folder/:id" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <SrsFolderDetail />
                </div>
                <Footer />
              </>
            } 
          />
          <Route 
            path="/srs/parent/:id" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <SrsParentFolder />
                </div>
                <Footer />
              </>
            } 
          />
          {/* SRS 관련 라우트 추가 */}
          <Route 
            path="/srs" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <SrsDashboard />
                </div>
                <Footer />
              </>
            } 
          />
          <Route 
            path="/srs/quiz" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <SrsQuiz />
                </div>
                <Footer />
              </>
            } 
          />
          <Route 
            path="/srs/wrong-answers" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <WrongAnswers />
                </div>
                <Footer />
              </>
            } 
          />
          <Route 
            path="/srs/wrong-answers/quiz" 
            element={
              <>
                <Header />
                <div className="main-content">
                  <WrongAnswerQuiz />
                </div>
                <Footer />
              </>
            } 
          />
          
          {/* Grammar 관련 라우트 */}
          <Route
            path="/learn/grammar"
            element={
              <>
                <Header />
                <div className="main-content">
                  <GrammarHub />
                </div>
                <Footer />
              </>
            }
          />
          <Route
            path="/learn/grammar/:topicId"
            element={
              <>
                <Header />
                <div className="main-content">
                  <GrammarQuiz />
                </div>
                <Footer />
              </>
            }
          />

          {/* Japanese Grammar 관련 라우트 */}
          <Route
            path="/learn/japanese-grammar"
            element={
              <>
                <Header />
                <div className="main-content">
                  <JapaneseGrammarHub />
                </div>
                <Footer />
              </>
            }
          />
          <Route
            path="/learn/japanese-grammar/:topicId"
            element={
              <>
                <Header />
                <div className="main-content">
                  <JapaneseGrammarQuiz />
                </div>
                <Footer />
              </>
            }
          />
          
          
          {/* Listening 관련 라우트 */}
          <Route
            path="/listening"
            element={
              <>
                <Header />
                <div className="main-content">
                  <Listening />
                </div>
                <Footer />
              </>
            }
          />
          <Route
            path="/listening/list"
            element={
              <ProtectedRoute>
                <Header />
                <div className="main-content">
                  <ListeningList />
                </div>
                <Footer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listening/practice"
            element={
              <ProtectedRoute>
                <Header />
                <div className="main-content">
                  <ListeningPractice />
                </div>
                <Footer />
              </ProtectedRoute>
            }
          />

          {/* Japanese Listening 관련 라우트 */}
          <Route
            path="/japanese-listening"
            element={
              <>
                <Header />
                <div className="main-content">
                  <Placeholder title="일본어 리스닝 홈" />
                </div>
                <Footer />
              </>
            }
          />
          <Route
            path="/japanese-listening/list"
            element={
              <ProtectedRoute>
                <Header />
                <div className="main-content">
                  <JapaneseListeningList />
                </div>
                <Footer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/japanese-listening/practice"
            element={
              <ProtectedRoute>
                <Header />
                <div className="main-content">
                  <JapaneseListeningPractice />
                </div>
                <Footer />
              </ProtectedRoute>
            }
          />

          {/* 관리자 전용 */}
          <Route element={<AdminRoute />}>
            <Route 
              path="/admin" 
              element={
                <>
                  <Header />
                  <div className="main-content">
                    <Admin />
                  </div>
                  <Footer />
                </>
              } 
            />
            <Route 
              path="/admin/dashboard" 
              element={
                <>
                  <Header />
                  <div className="main-content">
                    <AdminDashboard />
                  </div>
                  <Footer />
                </>
              } 
            />
          </Route>
        </Route>

        {/* Reading 관련 라우트 (인증 필요) */}
        <Route 
          path="/reading" 
          element={
            <ProtectedRoute>
              <Header />
              <div className="main-content">
                <ReadingList />
              </div>
              <Footer />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reading/practice" 
          element={
            <ProtectedRoute>
              <Header />
              <div className="main-content">
                <Reading />
              </div>
              <Footer />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reading/review" 
          element={
            <ProtectedRoute>
              <Header />
              <div className="main-content">
                <ReadingReview />
              </div>
              <Footer />
            </ProtectedRoute>
          }
        />

        {/* Japanese Reading 관련 라우트 (인증 필요) */}
        <Route
          path="/japanese-reading"
          element={
            <ProtectedRoute>
              <Header />
              <div className="main-content">
                <JapaneseReadingList />
              </div>
              <Footer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/japanese-reading/practice"
          element={
            <ProtectedRoute>
              <Header />
              <div className="main-content">
                <JapaneseReading />
              </div>
              <Footer />
            </ProtectedRoute>
          }
        />

        {/* 공개 라우트 */}
        <Route 
          path="/read/:id" 
          element={
            <>
              <Header />
              <div className="main-content">
                <Placeholder title="리딩(글로스)" />
              </div>
              <Footer />
            </>
          } 
        />
        <Route
          path="/dict"
          element={
            <>
              <Header />
              <div className="main-content">
                <Dict />
              </div>
              <Footer />
            </>
          }
        />
        <Route
          path="/english-dict"
          element={
            <>
              <Header />
              <div className="main-content">
                <EnglishDict />
              </div>
              <Footer />
            </>
          }
        />
        <Route
          path="/japanese-dict"
          element={
            <>
              <Header />
              <div className="main-content">
                <JapaneseDict />
              </div>
              <Footer />
            </>
          }
        />
        </Routes>
      </div>
    </>
  );
}

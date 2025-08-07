// src/App.js
import React from "react";
import { ToastContainer } from 'react-toastify'; // 1. 임포트
import 'react-toastify/dist/ReactToastify.css'; // 2. CSS 임포트
import { Routes, Route } from "react-router-dom";
import Header from "./pages/Header";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LearnVocab from "./pages/LearnVocab";
import Dict from "./pages/Dict";
import ProtectedRoute from "./components/ProtectedRoute";
import Logout from "./pages/Logout";
import Admin from "./pages/Admin";
import AdminRoute from "./components/AdminRoute";
import VocabList from "./pages/VocabList";
import MyWordbook from "./pages/MyWordbook";
import OdatNote from "./pages/OdatNote";
import LearnStart from "./pages/LearnStart";
import SrsManager from "./pages/SrsManager";
import Dashboard from "./pages/Dashboard";
import GrammarHub from './pages/GrammarHub';   // ★ 1. GrammarHub 컴포넌트 임포트
import GrammarQuiz from './pages/GrammarQuiz'; // ★ 2. GrammarQuiz 컴포넌트 임포트

const Placeholder = ({ title }) => (
  <div className="container py-4">
    <h2>{title}</h2>
    <p>구현 예정</p>
  </div>
);

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/odat-note" element={<OdatNote />} />
        <Route path="/vocab" element={<VocabList />} />

        {/* 보호 라우트: 로그인 필요 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/learn" element={<LearnStart />} />
          <Route path="/learn/vocab" element={<LearnVocab />} />
          <Route path="/learn/srs-manager" element={<SrsManager />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-wordbook" element={<MyWordbook />} />

          {/* ★★★★★ 3. Placeholder를 실제 컴포넌트로 교체 및 새 경로 추가 ★★★★★ */}
          <Route path="/learn/grammar" element={<GrammarHub />} />
          <Route path="/learn/grammar/:topicId" element={<GrammarQuiz />} />

          {/* 관리자 전용 */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>

        {/* 공개 라우트 */}
        <Route path="/read/:id" element={<Placeholder title="리딩(글로스)" />} />
        <Route path="/tutor" element={<Placeholder title="튜터" />} />
        <Route path="/dict" element={<Dict />} />
      </Routes>
    </>
  );
}
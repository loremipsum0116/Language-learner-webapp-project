import React from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./pages/Header"; // 공통 헤더 (Vocabio 로고 포함)

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
import SrsManager from "./pages/SrsManager"; // 신규 페이지

const Placeholder = ({ title }) => (
  <div className="container py-4">
    <h2>{title}</h2>
    <p>구현 예정</p>
  </div>
);

export default function App() {
  return (
    <>
      {/* 공통 헤더: Vocabio 로고 클릭 시 홈으로 이동 */}
      <Header />

      {/* 라우트 설정 */}
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
          <Route path="/dashboard" element={<Placeholder title="대시보드" />} />
          <Route path="/my-wordbook" element={<MyWordbook />} />

          {/* 관리자 전용 */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>

        {/* 공개 라우트(추후 보호로 전환 가능) */}
        <Route path="/learn/grammar" element={<Placeholder title="문법(클로즈)" />} />
        <Route path="/read/:id" element={<Placeholder title="리딩(글로스)" />} />
        <Route path="/tutor" element={<Placeholder title="튜터" />} />
        <Route path="/dict" element={<Dict />} />
      </Routes>
    </>
  );
}

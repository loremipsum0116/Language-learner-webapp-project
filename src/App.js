// src/App.js
import React from "react";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
import GrammarHub from './pages/GrammarHub';
import GrammarQuiz from './pages/GrammarQuiz';
import SrsDashboard from "./pages/SrsDashboard";
import SrsQuiz from "./pages/SrsQuiz";
import SrsFolderDetail from './pages/SrsFolderDetail';

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
      <ToastContainer /> {/* ToastContainer 추가 */}
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
          <Route path="/srs/folder/:id" element={<SrsFolderDetail />} />
          {/* SRS 관련 라우트 추가 */}
          <Route path="/srs" element={<SrsDashboard />} />
          <Route path="/srs/quiz" element={<SrsQuiz />} />
          
          {/* Grammar 관련 라우트 */}
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

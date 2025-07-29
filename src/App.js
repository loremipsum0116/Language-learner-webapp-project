import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

// 간단 플레이스홀더
const Placeholder = ({ title }) => <div style={{padding:20}}><h2>{title}</h2><p>구현 예정</p></div>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Placeholder title="/login" />} />
      <Route path="/register" element={<Placeholder title="/register" />} />
      <Route path="/dashboard" element={<Placeholder title="/dashboard" />} />
      <Route path="/learn/vocab" element={<Placeholder title="/learn/vocab" />} />
      <Route path="/learn/grammar" element={<Placeholder title="/learn/grammar" />} />
      <Route path="/read/:id" element={<Placeholder title="/read/:id" />} />
      <Route path="/tutor" element={<Placeholder title="/tutor" />} />
      <Route path="/dict" element={<Placeholder title="/dict" />} />
      <Route path="/admin" element={<Placeholder title="/admin" />} />
    </Routes>
  );
}

// src/api/srs.js
import { fetchJSON } from "./client";

export const SrsApi = {
  async listFolders(dateStr) {
    const qs = dateStr ? `?date=${encodeURIComponent(dateStr)}` : "";
    const res = await fetchJSON(`/srs/folders${qs}`, { credentials: "include" });
    return res.data ?? res;
  },
  async picker() {
    const res = await fetchJSON(`/srs/folders/picker`, { credentials: "include" });
    return res.data ?? res;
  },
  async quickCreate(name) {
    const res = await fetchJSON(`/srs/folders/quick-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }), // name을 안 넘기면 JSON.stringify가 속성을 생략함
    });
    return res.data ?? res;
  },
  async getFolder(id) {
    const res = await fetchJSON(`/srs/folders/${id}`, { credentials: "include" });
    return res.data ?? res;
  },
  async addItems(folderId, payload) {
    const res = await fetchJSON(`/srs/folders/${folderId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return res.data ?? res;
  },
  async removeItem(folderId, cardId) {
    const res = await fetchJSON(`/srs/folders/${folderId}/items/${cardId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return res.data ?? res;
  },
  async getQueue(folderId) {
    const res = await fetchJSON(`/srs/queue?folderId=${folderId}`, { credentials: "include" });
    return res.data ?? res;
  },
};

export const QuizApi = {
  async submitAnswer({ folderId, cardId, correct }) {
    const res = await fetchJSON(`/quiz/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ folderId, cardId, correct }),
    });
    return res.data ?? res;
  },
};

// src/api/srs.js
import { fetchJSON } from "./client";

export const SrsApi = {
    // 대시보드용
    dashboard() {
        return fetchJSON("/srs/dashboard", { credentials: "include" })
            .then(r => r.data ?? r);
    },

    // 폴더 CRUD(단일 계층)
    async picker() {
        try {
            const r = await fetchJSON("/srs/folders", { credentials: "include" });
            const list = r?.data ?? r;
            if (Array.isArray(list) && list.length) return list;
        } catch (_) { }
        // 폴백: /srs/dashboard 사용
        const r2 = await fetchJSON("/srs/dashboard", { credentials: "include" });
        const list2 = r2?.data ?? r2;
        return Array.isArray(list2) ? list2 : [];
    },
    quickCreate(name) {
        return fetchJSON("/srs/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name }),
        }).then(r => r.data ?? r);
    },
    toggleAlarm(id, active) {
        return fetchJSON(`/srs/folders/${id}/alarm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ active }),
        }).then(r => r.data ?? r);
    },
    deleteFolder(id) {
        return fetchJSON(`/srs/folders/${id}`, {
            method: "DELETE",
            credentials: "include",
        }).then(r => r.data ?? r);
    },

    // 폴더-아이템(카드) 조작
    addItems(folderId, { vocabIds }) {
        return fetchJSON(`/srs/folders/${folderId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ vocabIds }),
        }).then(r => r.data ?? r);
    },
    removeItems(folderId, { itemIds }) {
        return fetchJSON(`/srs/folders/${folderId}/items/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ itemIds }),
        }).then(r => r.data ?? r);
    },
    moveItems(fromFolderId, toFolderId, { cardIds }) {
        return fetchJSON(`/srs/folders/${fromFolderId}/move-items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ toFolderId, cardIds }),
        }).then(r => r.data ?? r);
    },
    markLearned(folderId, { cardIds, learned }) {
        return fetchJSON(`/srs/folders/${folderId}/mark-learned`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ cardIds, learned }),
        }).then(r => r.data ?? r);
    },
    resetWrongCount(folderId, { cardIds }) {
        return fetchJSON(`/srs/folders/${folderId}/reset-wrong`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ cardIds }),
        }).then(r => r.data ?? r);
    },
    getFolderItems(folderId) {
        return fetchJSON(`/srs/folders/${folderId}/items`, { credentials: "include" })
            .then(r => r.data ?? r);
    },
    // 학습 큐(기존)
    getQueue(folderId) {
        const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
        return fetchJSON(`/srs/queue${qs}`, { credentials: "include" })
            .then(r => r.data ?? r);
    },
};
export const QuizApi = {
    async submitAnswer({ folderId, cardId, correct }) {
        // 1순위 /quiz/answer, 없으면 /srs/answer 로 폴백
        const payload = { folderId, cardId, correct };
        try {
            const r = await fetchJSON(`/quiz/answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            return r.data ?? r;
        } catch (e) {
            if (e.status === 404) {
                const r2 = await fetchJSON(`/srs/answer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(payload),
                });
                return r2.data ?? r2;
            }
            throw e;
        }
    },
};
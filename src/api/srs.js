// src/api/srs.js
import { fetchJSON } from "./client";

export const SrsApi = {
    async picker(opts = {}) {
        const qs = opts.flatten ? `?flatten=${encodeURIComponent(opts.flatten)}` : '';
        const res = await fetchJSON(`/srs/folders/picker${qs}`, { credentials: 'include' });
        return res.data ?? res;
    },
    async listChildrenLite(rootId) {
        const res = await fetchJSON(`/srs/folders/${rootId}/children-lite`, { credentials: 'include' });
        return res.data ?? res;
    },

    async addItems(folderId, payload) {
        const res = await fetchJSON(`/srs/folders/${folderId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        return res.data ?? res;
    },
    listSubfolders(rootId) { return fetchJSON(`/srs/folders/${rootId}/children`, { credentials: 'include' }).then(r => r.data?.children ?? []); },
    createSubfolder(parentId, name) {
        return fetchJSON(`/srs/folders/${parentId}/subfolders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name })
        }).then(r => r.data ?? r);
    },
    addItems(folderId, payload) {
        return fetchJSON(`/srs/folders/${folderId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        }).then(r => r.data ?? r);
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

"use strict";
// Core shared types for the Language Learner application
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVocab = exports.isUser = void 0;
// Type Guards
const isUser = (obj) => {
    return obj && typeof obj.email === 'string' && typeof obj.role === 'string';
};
exports.isUser = isUser;
const isVocab = (obj) => {
    return obj && typeof obj.lemma === 'string' && typeof obj.pos === 'string';
};
exports.isVocab = isVocab;
//# sourceMappingURL=index.js.map
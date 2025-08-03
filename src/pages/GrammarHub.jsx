// src/pages/GrammarHub.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { grammarTopics } from '../data/mockGrammar';

export default function GrammarHub() {
    const topicsByLevel = grammarTopics.reduce((acc, topic) => {
        (acc[topic.level] = acc[topic.level] || []).push(topic);
        return acc;
    }, {});

    return (
        <main className="container py-4">
            <div className="mb-4">
                <h2 className="mb-1">문법 학습</h2>
                <p className="text-muted">독일어 문법의 기초를 다져보세요. 학습하고 싶은 주제를 선택하세요.</p>
            </div>

            {Object.entries(topicsByLevel).map(([level, topics]) => (
                <section key={level} className="mb-4">
                    <h4 className="mb-3 ps-2 border-start border-4 border-primary">CEFR {level}</h4>
                    <div className="row g-3">
                        {topics.map(topic => (
                            <div key={topic.id} className="col-md-6 col-lg-4">
                                <div className="card h-100">
                                    <div className="card-body d-flex flex-column">
                                        <h5 className="card-title">{topic.title}</h5>
                                        <p className="card-text text-muted flex-grow-1">{topic.description}</p>
                                        <Link to={`/learn/grammar/${topic.id}`} className="btn btn-primary mt-auto">
                                            학습 시작
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </main>
    );
}
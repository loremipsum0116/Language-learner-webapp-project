// src/Header.jsx
import { Link } from 'react-router-dom';

export default function Header() {
    return (
        <nav className="navbar navbar-light bg-light">
            <div className="container">
                <Link to="/" className="navbar-brand fw-bold" aria-label="Vocabio 홈으로 이동">
                    Vocabio
                </Link>
            </div>
        </nav>
    );
}

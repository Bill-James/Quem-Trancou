import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner container">
        <Link to="/" className="navbar__brand">
          <span className="brand-icon">✦</span>
          <span className="brand-name">Quem<em>Trançou</em><span className="brand-dot">?</span></span>
        </Link>

        <div className={`navbar__links ${menuOpen ? 'open' : ''}`}>
          <Link to="/explorar" onClick={() => setMenuOpen(false)}>Explorar</Link>
          <Link to="/ranking" onClick={() => setMenuOpen(false)}>Ranking</Link>
          <Link to="/feed" onClick={() => setMenuOpen(false)}>Feed</Link>
          {currentUser ? (
            <>
              <Link to="/perfil" onClick={() => setMenuOpen(false)}>Meu Perfil</Link>
              <button className="btn-logout" onClick={handleLogout}>Sair</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-nav-ghost" onClick={() => setMenuOpen(false)}>Entrar</Link>
              <Link to="/cadastro" className="btn-nav-gold" onClick={() => setMenuOpen(false)}>Cadastrar</Link>
            </>
          )}
        </div>

        <button className="navbar__burger" onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import './Auth.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await login(email, senha);
      navigate('/perfil');
    } catch {
      setErro('Email ou senha incorretos. Tenta novamente.');
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
      </div>
      <div className="auth-box">
        <div className="auth-brand"><span>✦</span> Quem<em>Trançou</em>?</div>
        <h2>Bem-vinda de volta</h2>
        <p className="auth-sub">Entra na tua conta para continuar</p>
        {erro && <div className="auth-erro">{erro}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="o@teu.email" required />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'A entrar...' : 'Entrar ✦'}
          </button>
        </form>
        <p className="auth-switch">Ainda não tens conta? <Link to="/cadastro">Cadastra-te aqui</Link></p>
      </div>
    </div>
  );
}

export function Cadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState('cliente');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return; }
    setLoading(true);
    try {
      const cred = await signup(email, senha, nome);
      await setDoc(doc(db, 'usuarios', cred?.user?.uid || email), {
        nome, email, tipo,
        criadoEm: serverTimestamp(),
        pontuacao: 0, nota: 0, avaliacoes: 0,
      });
      navigate('/perfil');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setErro('Este email já está em uso.');
      else setErro('Erro ao criar conta. Tenta novamente.');
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
      </div>
      <div className="auth-box">
        <div className="auth-brand"><span>✦</span> Quem<em>Trançou</em>?</div>
        <h2>Cria a tua conta</h2>
        <p className="auth-sub">Grátis. Sempre.</p>
        {erro && <div className="auth-erro">{erro}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="tipo-selector">
            <button type="button" className={`tipo-btn ${tipo === 'cliente' ? 'active' : ''}`} onClick={() => setTipo('cliente')}>💇 Sou Cliente</button>
            <button type="button" className={`tipo-btn ${tipo === 'trancista' ? 'active' : ''}`} onClick={() => setTipo('trancista')}>✨ Sou Trancista</button>
          </div>
          <div className="form-group">
            <label>Nome completo</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="O teu nome" required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="o@teu.email" required />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'A criar conta...' : 'Criar Conta Grátis ✦'}
          </button>
        </form>
        <p className="auth-switch">Já tens conta? <Link to="/login">Entra aqui</Link></p>
      </div>
    </div>
  );
}

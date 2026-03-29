import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import './Home.css';

const DEMO_TRANCISTAS = [
  { id: 'demo1', nome: 'Amara Diallo', especialidade: 'Box Braids & Knotless', nota: 4.9, avaliacoes: 312, preco: 'AOA 5.000 – 15.000', tempo: '3–6h', badge: '🥇 Top da Semana', cor: '#E8547A', emoji: '👑' },
  { id: 'demo2', nome: 'Beatriz Lopes', especialidade: 'Fulani Braids & Cornrows', nota: 4.8, avaliacoes: 198, preco: 'AOA 4.000 – 10.000', tempo: '2–4h', badge: '⚡ Mais Rápida', cor: '#2A9D8F', emoji: '⚡' },
  { id: 'demo3', nome: 'Celeste Nkosi', especialidade: 'Goddess Braids & Twists', nota: 4.7, avaliacoes: 245, preco: 'AOA 3.500 – 8.000', tempo: '3–5h', badge: '💰 Melhor Preço', cor: '#D4A843', emoji: '✨' },
];

const TIPOS_TRANCA = [
  { icon: '🌀', nome: 'Box Braids' }, { icon: '🔗', nome: 'Knotless' },
  { icon: '🌿', nome: 'Fulani' }, { icon: '💫', nome: 'Cornrows' },
  { icon: '🌺', nome: 'Goddess' }, { icon: '🪢', nome: 'Twists' },
];

function StarRating({ nota }) {
  return (
    <span className="stars">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= Math.round(nota) ? 'star filled' : 'star'}>★</span>
      ))}
      <strong> {nota.toFixed(1)}</strong>
    </span>
  );
}

export default function Home() {
  const [trancistas, setTrancistas] = useState(DEMO_TRANCISTAS);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [counter, setCounter] = useState({ profissionais: 0, avaliacoes: 0, cidades: 0 });

  useEffect(() => {
    const targets = { profissionais: 1240, avaliacoes: 8900, cidades: 18 };
    const duration = 2000;
    const steps = 60;
    const stepTime = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setCounter({
        profissionais: Math.floor(targets.profissionais * ease),
        avaliacoes: Math.floor(targets.avaliacoes * ease),
        cidades: Math.floor(targets.cidades * ease),
      });
      if (step >= steps) clearInterval(timer);
    }, stepTime);

    try {
      const q = query(collection(db, 'trancistas'), orderBy('pontuacao', 'desc'), limit(3));
      getDocs(q).then(snap => {
        if (!snap.empty) setTrancistas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } catch (e) {}

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__bg">
          <div className="hero__orb hero__orb--1" />
          <div className="hero__orb hero__orb--2" />
          <div className="hero__orb hero__orb--3" />
          <div className="hero__pattern" />
        </div>
        <div className="hero__content container">
          <div className="hero__badge"><span>✦</span> A plataforma nº 1 de trancistas em Angola</div>
          <h1 className="hero__title">
            O melhor talento em<br /><em>tranças</em> está<br />
            <span className="hero__title-highlight">aqui perto de ti</span>
          </h1>
          <p className="hero__sub">
            Encontra, avalia e marca com as melhores trancistas.<br />
            Ranking real. Preços transparentes. Resultados que falam por si.
          </p>
          <div className="hero__search">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Que tipo de trança procuras?" value={busca} onChange={e => setBusca(e.target.value)} />
              <Link to={`/explorar?q=${busca}`} className="search-btn">Pesquisar</Link>
            </div>
          </div>
          <div className="hero__tags">
            {TIPOS_TRANCA.map(t => (
              <button key={t.nome} className={`tag ${filtroTipo === t.nome ? 'tag--active' : ''}`} onClick={() => setFiltroTipo(t.nome === filtroTipo ? '' : t.nome)}>
                {t.icon} {t.nome}
              </button>
            ))}
          </div>
        </div>
        <div className="hero__scroll-hint"><span>↓</span></div>
      </section>

      <section className="stats">
        <div className="container stats__grid">
          <div className="stat"><span className="stat__num">{counter.profissionais.toLocaleString()}+</span><span className="stat__label">Trancistas cadastradas</span></div>
          <div className="stat stat--accent"><span className="stat__num">{counter.avaliacoes.toLocaleString()}+</span><span className="stat__label">Avaliações verificadas</span></div>
          <div className="stat"><span className="stat__num">{counter.cidades}</span><span className="stat__label">Cidades cobertas</span></div>
        </div>
      </section>

      <section className="ranking-preview">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">🏆 Ranking em Destaque</span>
            <h2>As Melhores<br /><em>desta Semana</em></h2>
            <p>Classificadas com base em qualidade, rapidez, preço e atendimento</p>
          </div>
          <div className="cards-grid">
            {trancistas.map((t, i) => (
              <Link to={`/trancista/${t.id}`} key={t.id} className="card" style={{ '--accent': t.cor }}>
                <div className="card__rank">#{i + 1}</div>
                <div className="card__badge" style={{ background: t.cor }}>{t.badge}</div>
                <div className="card__avatar"><span>{t.emoji}</span></div>
                <div className="card__info">
                  <h3>{t.nome}</h3>
                  <p className="card__specialty">{t.especialidade}</p>
                  <StarRating nota={t.nota} />
                  <span className="card__reviews">({t.avaliacoes} avaliações)</span>
                </div>
                <div className="card__footer">
                  <div className="card__detail"><span className="detail-icon">💰</span><span>{t.preco}</span></div>
                  <div className="card__detail"><span className="detail-icon">⏱</span><span>{t.tempo}</span></div>
                </div>
                <div className="card__cta">Ver Perfil →</div>
              </Link>
            ))}
          </div>
          <div className="section-cta">
            <Link to="/ranking" className="btn-gold-lg">Ver Ranking Completo ✦</Link>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <div className="container">
          <div className="section-header section-header--light">
            <span className="section-tag">Como Funciona</span>
            <h2>Simples.<br /><em>Transparente.</em> Justo.</h2>
          </div>
          <div className="steps">
            {[
              { n: '01', icon: '🔍', title: 'Pesquisa', desc: 'Filtra por tipo de trança, preço, localização ou disponibilidade.' },
              { n: '02', icon: '📊', title: 'Compara', desc: 'Vê portfólios, lê avaliações reais e compara lado a lado.' },
              { n: '03', icon: '📅', title: 'Marca', desc: 'Agenda diretamente com a trancista escolhida no próprio site.' },
              { n: '04', icon: '⭐', title: 'Avalia', desc: 'Depois do serviço, dá a tua avaliação e alimenta o ranking.' },
            ].map(s => (
              <div className="step" key={s.n}>
                <div className="step__num">{s.n}</div>
                <div className="step__icon">{s.icon}</div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-trancista">
        <div className="container cta-trancista__inner">
          <div className="cta-trancista__text">
            <span className="section-tag">Para Trancistas</span>
            <h2>O teu talento<br />merece <em>visibilidade</em></h2>
            <p>Cria o teu perfil profissional, mostra o teu portfólio, define os teus preços e começa a receber clientes.</p>
            <Link to="/cadastro" className="btn-gold-lg">Criar Perfil Grátis ✦</Link>
          </div>
          <div className="cta-trancista__visual">
            <div className="cta-badge"><span className="cta-badge__icon">🥇</span><span className="cta-badge__label">Top da Semana</span></div>
            <div className="cta-badge cta-badge--2"><span className="cta-badge__icon">⚡</span><span className="cta-badge__label">Mais Rápida</span></div>
            <div className="cta-badge cta-badge--3"><span className="cta-badge__icon">💰</span><span className="cta-badge__label">Melhor Preço</span></div>
            <div className="cta-badge cta-badge--4"><span className="cta-badge__icon">❤️</span><span className="cta-badge__label">Mais Recomendada</span></div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand"><span className="brand-icon-sm">✦</span><span>Quem<em>Trançou</em>?</span></div>
          <p className="footer__copy">© 2025 QuemTrançou? · Feito com ❤️ para valorizar as trancistas de Angola</p>
          <div className="footer__links">
            <Link to="/sobre">Sobre</Link>
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/contato">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

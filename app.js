import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, query, orderBy, where, onSnapshot, serverTimestamp, updateDoc, deleteField, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBKlsoxb03nDoerHYCtfFFoQ8PFUXa5asA",
  authDomain: "quem-trancou.firebaseapp.com",
  projectId: "quem-trancou",
  storageBucket: "quem-trancou.firebasestorage.app",
  messagingSenderId: "858295754308",
  appId: "1:858295754308:web:f4341b11921bf7ab3c2611"
});
const auth = getAuth(app);
const db = getFirestore(app);

const CLOUDINARY_CLOUD_NAME = 'dgvjdkgmg';
const CLOUDINARY_UPLOAD_PRESET = 'quem-trancou';

async function uploadParaCloudinary(file, onProgress) {
  const isVideo = file.type.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    xhr.upload.onprogress = (e) => { if(e.lengthComputable && onProgress) onProgress(Math.round((e.loaded/e.total)*100)); };
    xhr.onload = () => {
      if(xhr.status === 200) {
        const d = JSON.parse(xhr.responseText);
        resolve({ url: d.secure_url, type: isVideo ? 'video' : 'image', publicId: d.public_id });
      } else {
        reject(new Error('Erro no upload: ' + xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new Error('Falha na ligação ao Cloudinary'));
    xhr.open('POST', url);
    xhr.send(formData);
  });
}

let currentUser = null;
let currentUserPerfil = null;
let allTrancistas = [];
let filtroTipo = 'Todos';
let filtroCidade = 'Todas';
let currentTrancistaPerfil = null;
let registoTipo = 'cliente';
let uploadedPortfolioFiles = [];
let existingPortfolioItems = [];
let marcacoesUnsub = null;

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if(user) {
    try {
      const snap = await getDoc(doc(db, 'usuarios', user.uid));
      currentUserPerfil = snap.exists() ? snap.data() : {};
    } catch(e) { currentUserPerfil = {}; }

    renderNavAuth(user);
    notifInit(user.uid, currentUserPerfil?.tipo || 'cliente');

    const pAtiva = document.querySelector('.page.active');
    if(pAtiva && (pAtiva.id === 'page-login' || pAtiva.id === 'page-cadastro')) showPage('perfil');
  } else {
    currentUserPerfil = null;
    renderNavAuth(null);
    notifReset();
  }
  loadAllTrancistas();
});

function getFotoUrl(dados) {
  if(!dados || !dados.fotoPerfil) return null;
  if(typeof dados.fotoPerfil === 'string') return dados.fotoPerfil;
  if(dados.fotoPerfil.url) return dados.fotoPerfil.url;
  return null;
}

function renderNavAuth(user) {
  const navAuth = document.getElementById('navAuth');
  if(user) {
    const initial = (user.displayName || user.email || '?')[0].toUpperCase();
    const nome = (user.displayName || user.email || '').split(' ')[0] || 'Perfil';
    const fotoUrl = getFotoUrl(currentUserPerfil);
    const avatarHtml = fotoUrl ? `<img src="${fotoUrl}" alt="${nome}">` : initial;
    navAuth.innerHTML = `
      <div class="nav-perfil-wrap">
        <div class="notif-trigger" id="notifTrigger" onclick="notifTogglePanel()">
          <div class="notif-avatar" id="notifAvatar">${avatarHtml}</div>
          <span class="notif-trigger-label">${nome}</span>
          <span class="notif-badge" id="notifBadge" style="display:none">0</span>
        </div>
      </div>
      <button class="btn-logout" onclick="doLogout()">Sair</button>`;
  } else {
    navAuth.innerHTML = `
      <a href="#" class="btn-nav-ghost" onclick="event.preventDefault();showPage('login')">Entrar</a>
      <a href="#" class="btn-nav-gold" onclick="event.preventDefault();showPage('cadastro')">Criar conta</a>`;
  }
}

async function loadAllTrancistas() {
  try {
    const snap = await getDocs(query(collection(db, 'trancistas'), orderBy('nota', 'desc')));
    allTrancistas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { allTrancistas = []; }
  renderHomeCards();
  renderExplorar();
  renderRanking();
  renderFeed();
  animateStats();
}

function animateStats() {
  const total = allTrancistas.length;
  const avals = allTrancistas.reduce((s, t) => s + (t.avaliacoes || 0), 0);
  const cidades = [...new Set(allTrancistas.map(t => t.cidade).filter(Boolean))].length;
  animCount('statProf', total);
  animCount('statAval', avals);
  animCount('statCid', cidades);
}
function animCount(id, target) {
  if(!target) { document.getElementById(id).textContent = '0'; return; }
  let i = 0; const steps = 50;
  const timer = setInterval(() => {
    i++;
    document.getElementById(id).textContent = Math.floor(target * (i / steps)).toLocaleString() + '+';
    if(i >= steps) clearInterval(timer);
  }, 30);
}

function renderHomeCards() {
  const el = document.getElementById('homeCards');
  const top3 = allTrancistas.slice(0, 3);
  if(!top3.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">✦</span><p>Ainda não há trancistas cadastradas.<br>Sê a primeira!</p><button class="btn-gold-lg" onclick="showPage('cadastro')">Criar Perfil Grátis ✦</button></div>`;
    return;
  }
  const cores = ['#E8547A', '#2A9D8F', '#D4A843'];
  el.innerHTML = top3.map((t, i) => {
    const foto = getFotoUrl(t);
    return `<div class="card" style="--accent:${t.cor||cores[i]}" onclick="showTrancista('${t.id}')">
      <div class="card__rank">#${i+1}</div>
      ${foto ? `<img class="card__avatar-img" src="${foto}" alt="${t.nome}">` : `<div class="card__avatar-placeholder">✦</div>`}
      <div class="card__info"><h3>${t.nome||'Trancista'}</h3><p class="card__specialty">${t.especialidade||''}</p>
      ${stars(t.nota||0)} <span class="card__reviews">(${t.avaliacoes||0} avaliações)</span></div>
      <div class="card__footer">
        <div class="card__detail"><span>💰</span><span>AOA ${Number(t.precoMin||0).toLocaleString()}–${Number(t.precoMax||0).toLocaleString()}</span></div>
        <div class="card__detail"><span>⏱</span><span>${t.tempo||'—'}</span></div>
      </div>
      <div class="card__cta">Ver Perfil →</div>
    </div>`;
  }).join('');
}

function renderExplorar() {
  const busca = (document.getElementById('filtroSearch') || {}).value || '';
  const disp = (document.getElementById('filtroDisp') || {}).checked || false;
  const ordem = (document.getElementById('filtroOrdem') || {}).value || 'nota';
  let lista = allTrancistas.filter(t => {
    const mb = !busca || (t.nome||'').toLowerCase().includes(busca.toLowerCase()) || (t.especialidade||'').toLowerCase().includes(busca.toLowerCase());
    const mt = filtroTipo === 'Todos' || (t.especialidade||'').toLowerCase().includes(filtroTipo.toLowerCase()) || (t.tiposEscolhidos||[]).some(x => x.toLowerCase().includes(filtroTipo.toLowerCase()));
    const mc = filtroCidade === 'Todas' || t.cidade === filtroCidade;
    const md = !disp || t.disponivel;
    return mb && mt && mc && md;
  }).sort((a, b) => {
    if(ordem === 'nota') return (b.nota||0) - (a.nota||0);
    if(ordem === 'avaliacoes') return (b.avaliacoes||0) - (a.avaliacoes||0);
    if(ordem === 'preco_asc') return (a.precoMin||0) - (b.precoMin||0);
    if(ordem === 'preco_desc') return (b.precoMin||0) - (a.precoMin||0);
    return 0;
  });
  const el = document.getElementById('resultados');
  const ct = document.getElementById('explorarCount');
  if(ct) ct.textContent = lista.length + ' profissionais encontradas';
  if(!lista.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">😔</span><p>Nenhuma trancista encontrada com esses filtros.</p></div>`;
    return;
  }
  el.innerHTML = lista.map(t => {
    const foto = getFotoUrl(t);
    return `<div class="resultado-card" style="--accent:${t.cor||'var(--gold)'}" onclick="showTrancista('${t.id}')">
      <div class="resultado-card__left">
        ${foto
          ? `<div class="resultado-avatar"><img src="${foto}" alt="${t.nome}"></div>`
          : `<div class="resultado-avatar-placeholder">✦${t.disponivel ? '<span class="disponivel-dot"></span>' : ''}</div>`}
        <div class="resultado-info">
          <div class="resultado-top"><h3>${t.nome||'Trancista'}</h3></div>
          <p class="resultado-specialty">${t.especialidade||''}</p>
          <div class="resultado-meta">${stars(t.nota||0)}<span class="sep">·</span><span class="meta-item">📍 ${t.cidade||'Angola'}</span>${t.tempo ? `<span class="sep">·</span><span class="meta-item">⏱ ${t.tempo}</span>` : ''}</div>
        </div>
      </div>
      <div class="resultado-card__right">
        ${(t.precoMin||t.precoMax) ? `<div class="resultado-preco">AOA ${Number(t.precoMin||0).toLocaleString()}–${Number(t.precoMax||0).toLocaleString()}</div>` : ''}
        <div class="resultado-status ${t.disponivel ? 'disponivel' : 'indisponivel'}">${t.disponivel ? '✓ Disponível' : '✗ Ocupada'}</div>
        <span class="resultado-cta">Ver perfil →</span>
      </div>
    </div>`;
  }).join('');
}
window.setFiltroTipo = (btn, val) => { filtroTipo = val; document.querySelectorAll('.filtro-group .filtro-opt').forEach(b => { if(['Todos','Box Braids','Knotless','Cornrows','Fulani Braids','Goddess Braids','Twists'].includes(b.textContent)) b.classList.remove('active'); }); btn.classList.add('active'); renderExplorar(); };
window.setFiltroCidade = (btn, val) => { filtroCidade = val; document.querySelectorAll('.filtro-group .filtro-opt').forEach(b => { if(['Todas','Luanda','Benguela','Huambo','Lubango'].includes(b.textContent)) b.classList.remove('active'); }); btn.classList.add('active'); renderExplorar(); };
window.renderExplorar = renderExplorar;

function renderRanking() {
  const sorted = [...allTrancistas].sort((a, b) => (b.nota||0) - (a.nota||0));
  const podiumEl = document.getElementById('podium');
  const listEl = document.getElementById('rankingList');
  if(!sorted.length) {
    podiumEl.innerHTML = '';
    listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">🏆</span><p>Ainda não há trancistas no ranking.</p></div>`;
    return;
  }
  const cores = ['#E8547A', '#2A9D8F', '#D4A843'];
  const top3 = sorted.slice(0, 3);
  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = ['podium-block--2', 'podium-block--1', 'podium-block--3'];
  const bigs = [false, true, false];
  const crowns = [false, true, false];
  const labels = ['2º', '1º', '3º'];
  podiumEl.innerHTML = order.map((t, i) => {
    const foto = getFotoUrl(t);
    return `<div class="podium__spot" style="--c:${t.cor||cores[i]}" onclick="showTrancista('${t.id}')">
      ${crowns[i] ? '<div class="crown">👑</div>' : ''}
      <div class="podium-avatar ${bigs[i] ? 'podium-avatar--big' : ''}" style="border-color:${t.cor||cores[i]}">
        ${foto ? `<img src="${foto}" alt="${t.nome}">` : `<span>✦</span>`}
      </div>
      <div class="podium-name">${t.nome||'Trancista'}</div>
      <div class="podium-pts" style="color:${t.cor||cores[i]}">${(t.pontuacao||0).toLocaleString()} pts</div>
      <div class="podium-block ${heights[i]}"><span>${labels[i]}</span></div>
    </div>`;
  }).join('');
  listEl.innerHTML = `<div class="ranking-list__header"><span>Pos.</span><span>Trancista</span><span>Nota</span><span>Avaliações</span><span></span></div>
    ${sorted.map((t, i) => {
      const foto = getFotoUrl(t);
      return `<div class="ranking-row" onclick="showTrancista('${t.id}')">
        <span class="rank-pos" style="color:${i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'inherit'}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
        <div class="rank-trancista"><div class="rank-avatar" style="border-color:${t.cor||'var(--gold)'}">
          ${foto ? `<img src="${foto}" alt="${t.nome}">` : `✦`}
        </div><div><strong>${t.nome||'Trancista'}</strong><span class="rank-city">📍 ${t.cidade||''}</span></div></div>
        <span class="rank-nota">⭐ ${(t.nota||0).toFixed(1)}</span>
        <span class="rank-aval">${t.avaliacoes||0}</span>
        <span class="rank-cta">→</span>
      </div>`;
    }).join('')}`;
}
window.setRankTab = (btn) => { document.querySelectorAll('.tab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderRanking(); };

function renderFeed() {
  const el = document.getElementById('feedPosts');
  const trancistas = allTrancistas.filter(t => (t.portfolio||[]).length > 0);
  if(!trancistas.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">📸</span><p>Ainda não há publicações.</p></div>`;
  } else {
    const posts = [];
    trancistas.forEach(t => {
      (t.portfolio||[]).forEach((item, i) => {
        const url = typeof item === 'string' ? item : item.url;
        const type = typeof item === 'string' ? 'image' : (item.type || 'image');
        posts.push({ trancista: t, url, type, id: t.id + '_' + i });
      });
    });
    posts.sort(() => Math.random() - .5);
    el.innerHTML = posts.slice(0, 12).map(p => {
      const foto = getFotoUrl(p.trancista);
      const mediaHtml = p.type === 'video'
        ? `<video class="post-img" src="${p.url}" controls muted playsinline></video>`
        : `<img class="post-img" src="${p.url}" alt="Trabalho" onclick="openLightbox('${p.url}','image')">`;
      return `<div class="post-card">
        <div class="post-header">
          <div class="post-avatar">${foto ? `<img src="${foto}" alt="${p.trancista.nome}">` : `✦`}</div>
          <div class="post-meta"><strong>${p.trancista.nome||'Trancista'}</strong><span class="post-info">📍 ${p.trancista.cidade||'Angola'}</span></div>
          ${p.trancista.especialidade ? `<span class="post-tipo" style="background:${(p.trancista.cor||'var(--gold)')+'22'};color:${p.trancista.cor||'var(--gold)'}">${p.trancista.especialidade}</span>` : ''}
        </div>${mediaHtml}
        <div class="post-body"><p>${p.trancista.bio||'Trabalho da trancista.'}</p></div>
        <div class="post-footer">
          <div class="post-footer-btns">
            <button class="like-btn" id="like_${p.id}" data-count="0" onclick="toggleLike('${p.id}','${p.trancista.id}')">🤍 0</button>
            <button class="comment-btn" onclick="abrirComentarios('${p.id}','${p.trancista.id}')">💬 Comentar</button>
            <button class="share-btn" onclick="showTrancista('${p.trancista.id}')">👤 Ver Perfil</button>
          </div>
          <div class="comentarios-area" id="coments_${p.id}" style="display:none"></div>
        </div>
      </div>`;
    }).join('');
    posts.slice(0,12).forEach(async p => {
      try {
        await new Promise(r => auth.onAuthStateChanged(u => { currentUser = u; r(); }));
        const snap = await getDoc(doc(db, 'feed_likes', p.id));
        if(snap.exists()) {
          const data = snap.data();
          const count = data.count || 0;
          const btn = document.getElementById('like_'+p.id);
          if(btn) {
            btn.dataset.count = count;
            const userId = currentUser ? currentUser.uid : null;
            const jaDeuLike = userId && data.users && data.users[userId] === true;
            btn.textContent = (jaDeuLike ? '❤️' : '🔥') + ' ' + count;
            if(jaDeuLike) btn.classList.add('liked');
          }
        }
      } catch(e) {}
    });
  }
  const tipos = {};
  allTrancistas.forEach(t => (t.tiposEscolhidos||[]).forEach(x => tipos[x] = (tipos[x]||0) + 1));
  const top = Object.entries(tipos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  document.getElementById('tendencias').innerHTML = top.map(([nome], i) =>
    `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(253,246,236,.05);font-family:'Syne',sans-serif;font-size:.85rem;color:rgba(253,246,236,.7)"><span style="color:var(--gold);font-weight:700;width:24px">#${i+1}</span><span>${nome}</span></div>`
  ).join('') || '<p style="color:rgba(253,246,236,.3);font-size:.85rem">Em breve...</p>';
}
window.toggleLike = async (postId, trancistId) => {
  const btn = document.getElementById('like_'+postId);
  if(!btn || btn.disabled) return;
  const userId = currentUser ? currentUser.uid : null;
  if(!userId) { alert('Precisas de entrar para dar like.'); return; }
  btn.disabled = true;
  const postRef = doc(db, 'feed_likes', postId);
  try {
    const snapAtual = await getDoc(postRef);
    const dados = snapAtual.exists() ? snapAtual.data() : {};
    const jaLikado = dados.users?.[userId] === true;
    const countAtual = dados.count || 0;
    if(jaLikado) {
      await updateDoc(postRef, { count: Math.max(0, countAtual - 1), [`users.${userId}`]: deleteField() });
    } else {
      await setDoc(postRef, { trancistId, count: countAtual + 1, [`users.${userId}`]: true }, { merge: true });
      await setDoc(doc(db, 'notificacoes', trancistId + '_like_' + postId + '_' + userId), { tipo: 'like', trancistId, postId, userId, userName: currentUser.displayName || currentUser.email, lida: false, criadoEm: serverTimestamp() }, { merge: true });
    }
    const snapFinal = await getDoc(postRef);
    const countFinal = snapFinal.exists() ? (snapFinal.data().count || 0) : 0;
    const novoLike = snapFinal.exists() && snapFinal.data().users?.[userId] === true;
    btn.classList.toggle('liked', novoLike);
    btn.dataset.count = countFinal;
    btn.textContent = (novoLike ? '❤️' : '🤍') + ' ' + countFinal;
  } catch(e) { console.error(e); }
  btn.disabled = false;
};

window.showTrancista = async (id) => {
  showPage('trancista');
  const el = document.getElementById('trancistaPerfil');
  if(!el) return;
  el.innerHTML = `<div class="tp-loading"><span>✦</span> A carregar perfil...</div>`;
  let t = allTrancistas.find(x => x.id === id);
  if(!t) {
    try { const snap = await getDoc(doc(db, 'trancistas', id)); if(snap.exists()) t = { id, ...snap.data() }; } catch(e) {}
  }
  if(!t) { el.innerHTML = `<div class="tp-loading">Perfil não encontrado.</div>`; return; }
  currentTrancistaPerfil = t;
  const portfolio = t.portfolio || [];
  const foto = getFotoUrl(t);
  el.innerHTML = `<div class="tp-page" style="padding-top:0">
    <div class="tp-hero" style="--c:${t.cor||'var(--gold)'}">
      <div class="tp-hero__bg"></div>
      <div class="container tp-hero__inner">
        <div class="tp-avatar">${foto ? `<img src="${foto}" alt="${t.nome}">` : `✦`}</div>
        <div class="tp-hero__info">
          <div class="tp-hero__top"><h1>${t.nome||'Trancista'}</h1><span class="tp-status ${t.disponivel ? 'on' : 'off'}">${t.disponivel ? '● Disponível' : '● Ocupada'}</span></div>
          <p class="tp-specialty">${t.especialidade||''}</p>
          <div class="tp-rating"><span class="tp-stars">${starsHtml(t.nota||0)}</span><strong>${(t.nota||0).toFixed(1)}</strong><span>(${t.avaliacoes||0} avaliações)</span><span class="sep">·</span><span>📍 ${t.cidade||'Angola'}</span></div>
        </div>
        ${currentUser?.uid !== id ? `<button class="tp-marcar-btn" onclick="openMarcacao()">📅 Marcar Agora</button>` : ''}
      </div>
    </div>
    <div class="container tp-body">
      <div class="tp-main">
        ${t.bio ? `<section class="tp-section"><h3>Sobre</h3><p>${t.bio}</p></section>` : ''}
        ${portfolio.length ? `<section class="tp-section"><h3>Portfólio de Trabalhos</h3><div class="tp-portfolio-grid">${portfolio.map(item => {
          const url = typeof item === 'string' ? item : item.url;
          const type = typeof item === 'string' ? 'image' : (item.type || 'image');
          if(type === 'video') return `<div class="tp-portfolio-item" onclick="openLightbox('${url}','video')"><video src="${url}" muted playsinline></video><span class="media-type-badge">▶ Vídeo</span></div>`;
          return `<div class="tp-portfolio-item" onclick="openLightbox('${url}','image')"><img src="${url}" alt="Trabalho"></div>`;
        }).join('')}</div></section>` : ''}
        <section class="tp-section"><h3>Serviços & Preços</h3>
          <div class="tp-servicos-grid">
            ${(t.precoMin||t.precoMax) ? `<div class="tp-detalhe"><span class="tp-detalhe-icon">💰</span><div><strong>Preço</strong><span>AOA ${Number(t.precoMin||0).toLocaleString()} – ${Number(t.precoMax||0).toLocaleString()}</span></div></div>` : ''}
            ${t.tempo ? `<div class="tp-detalhe"><span class="tp-detalhe-icon">⏱</span><div><strong>Tempo médio</strong><span>${t.tempo}</span></div></div>` : ''}
            <div class="tp-detalhe"><span class="tp-detalhe-icon">${t.comMaterial ? '✓' : '✗'}</span><div><strong>Material</strong><span>${t.comMaterial ? 'Incluído' : 'Não incluído'}</span></div></div>
            <div class="tp-detalhe"><span class="tp-detalhe-icon">📍</span><div><strong>Localização</strong><span>${t.cidade||'Angola'}</span></div></div>
          </div>
          ${(t.tiposEscolhidos||[]).length ? `<div style="margin-top:12px"><p style="font-family:'Syne',sans-serif;font-size:.75rem;color:rgba(253,246,236,.4);margin-bottom:10px">TIPOS DE TRANÇA</p><div class="tp-chips">${t.tiposEscolhidos.map(x => `<span class="tp-chip">${x}</span>`).join('')}</div></div>` : ''}
        </section>
        ${(t.avaliacoesRecentes||[]).length ? `<section class="tp-section"><h3>Avaliações Recentes</h3><div class="tp-avals">${t.avaliacoesRecentes.map(a => `<div class="tp-aval"><div class="tp-aval-header"><div class="tp-aval-user">${(a.nome||'?')[0]}</div><div><strong>${a.nome||'Cliente'}</strong><span class="tp-stars" style="font-size:.85rem">${starsHtml(a.nota||5)}</span></div><span class="tp-aval-data">${a.data||''}</span></div><p>${a.texto||''}</p></div>`).join('')}</div></section>` : ''}
      </div>
      <aside class="tp-sidebar">
        <div class="tp-card"><h4>Estatísticas</h4>
          <div class="tp-stat-row"><span>Nota média</span><strong>${(t.nota||0).toFixed(1)} ⭐</strong></div>
          <div class="tp-stat-row"><span>Avaliações</span><strong>${t.avaliacoes||0}</strong></div>
          <div class="tp-stat-row"><span>Fotos/Vídeos</span><strong>${portfolio.length}</strong></div>
        </div>
        <div class="tp-cta-card" style="--c:${t.cor||'var(--gold)'}">
          <h4>Pronta para marcar?</h4><p>${t.disponivel ? 'Disponível agora' : 'Momentaneamente ocupada'}</p>
          ${currentUser?.uid !== id ? `<button class="tp-cta-btn" onclick="openMarcacao()">📅 Marcar Agora</button>` : `<p style="color:var(--gold);font-family:'Syne',sans-serif;font-size:.85rem;font-weight:700">Este é o teu perfil ✦</p>`}
          ${t.whatsapp ? `<a href="https://wa.me/${t.whatsapp.replace(/\D/g,'')}" class="tp-wa-btn" target="_blank">💬 WhatsApp</a>` : ''}
        </div>
      </aside>
    </div>
  </div>`;
};

window.openMarcacao = () => {
  if(!currentUser) { showPage('login'); return; }
  const t = currentTrancistaPerfil;
  if(!t) return;
  document.getElementById('modalNome').textContent = 'Marcar com ' + t.nome;
  document.getElementById('modalData').min = new Date().toISOString().split('T')[0];
  const sel = document.getElementById('modalTipo');
  sel.innerHTML = (t.tiposEscolhidos||['Box Braids']).map(x => `<option>${x}</option>`).join('');
  document.getElementById('modalNota').value = '';
  document.getElementById('modalMarcacao').style.display = 'flex';
};
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
window.enviarMarcacao = async () => {
  if(!currentUser || !currentTrancistaPerfil) return;
  const dataVal = document.getElementById('modalData').value;
  if(!dataVal) { alert('Por favor escolhe uma data.'); return; }
  try {
    await addDoc(collection(db, 'marcacoes'), {
      clienteId: currentUser.uid,
      clienteNome: currentUser.displayName || currentUser.email,
      clienteEmail: currentUser.email,
      trancistId: currentTrancistaPerfil.id,
      trancistaNome: currentTrancistaPerfil.nome,
      data: dataVal,
      tipo: document.getElementById('modalTipo').value,
      nota: document.getElementById('modalNota').value,
      criadoEm: serverTimestamp(),
      estado: 'pendente'
    });
    closeModal('modalMarcacao');
    alert('✦ Pedido enviado! A trancista irá contactar-te em breve.');
  } catch(e) {
    alert('Erro ao enviar pedido: ' + e.message);
  }
};

window.renderPerfil = async () => {
  if(!currentUser) { showPage('login'); return; }
  const el = document.getElementById('perfilContent');
  if(!el) return;
  el.innerHTML = `<div class="tp-loading"><span>✦</span> A carregar...</div>`;

  try {
    const snap = await getDoc(doc(db, 'usuarios', currentUser.uid));
    currentUserPerfil = snap.exists() ? snap.data() : {};
  } catch(e) { currentUserPerfil = {}; }

  const isTrancista = currentUserPerfil.tipo === 'trancista';
  let tData = {};
  if(isTrancista) {
    try { const s = await getDoc(doc(db, 'trancistas', currentUser.uid)); if(s.exists()) tData = s.data(); } catch(e) {}
  }

  existingPortfolioItems = (tData.portfolio||[]).map(item => typeof item === 'string' ? { url: item, type: 'image' } : item);
  uploadedPortfolioFiles = [];

  const dadosFoto = isTrancista ? tData : currentUserPerfil;
  const foto = getFotoUrl(dadosFoto);
  const initial = (currentUser.displayName || '?')[0].toUpperCase();
  const avatarHtml = foto ? `<img src="${foto}" alt="foto">` : initial;

  el.innerHTML = `<div class="perfil-page" style="padding-top:0">
    <div class="perfil-hero"><div class="container perfil-hero__inner">
      <div class="perfil-avatar-big">${avatarHtml}</div>
      <div class="perfil-hero__info">
        <h1>${currentUser.displayName||'Utilizador'}</h1>
        <p class="perfil-email">${currentUser.email}</p>
        <div class="perfil-badges">
          <span class="perfil-tipo-badge">${isTrancista ? '✨ Trancista' : '💇 Cliente'}</span>
          ${tData.disponivel && isTrancista ? '<span class="disponivel-badge">✓ Disponível</span>' : ''}
        </div>
      </div>
      <div class="perfil-hero__actions">
        <button class="btn-edit" onclick="toggleEditarPerfil()">✏️ Editar Perfil</button>
        <button class="btn-sair" onclick="doLogout()">Sair</button>
      </div>
    </div></div>
    <div class="container perfil-body">
      <div id="perfilMsg"></div>
      ${isTrancista ? `<div class="perfil-stats">
        <div class="pstat"><span class="pstat__n">${(tData.nota||0).toFixed(1)}</span><span>Nota média</span></div>
        <div class="pstat"><span class="pstat__n">${tData.avaliacoes||0}</span><span>Avaliações</span></div>
        <div class="pstat"><span class="pstat__n">${(tData.portfolio||[]).length}</span><span>Fotos/Vídeos</span></div>
        <div class="pstat"><span class="pstat__n">${tData.pontuacao||0}</span><span>Pontos</span></div>
      </div>` : ''}
      <div id="perfilFormArea">${renderPerfilVer(tData, isTrancista)}</div>
      <div id="marcacoesArea"><div class="loading-msg">A carregar marcações...</div></div>
    </div>
  </div>`;

  if(marcacoesUnsub) { marcacoesUnsub(); marcacoesUnsub = null; }
  carregarMarcacoes(currentUser.uid, isTrancista);
};

function renderPerfilVer(tData, isTrancista) {
  const dados = isTrancista ? tData : currentUserPerfil;
  const temConteudo = dados.bio || dados.cidade;

  return `<div class="perfil-info">
    ${dados.bio ? `<div class="info-card"><h4>Sobre mim</h4><p>${dados.bio}</p></div>` : ''}
    ${dados.cidade ? `<div class="info-card"><h4>Localização</h4><p>📍 ${dados.cidade}, Angola</p></div>` : ''}
    ${dados.whatsapp ? `<div class="info-card"><h4>WhatsApp</h4><p>📞 ${dados.whatsapp}</p></div>` : ''}
    ${isTrancista && (tData.tiposEscolhidos||[]).length ? `<div class="info-card"><h4>Tipos de Trança</h4><div class="chips-display">${tData.tiposEscolhidos.map(t => `<span class="chip-display">${t}</span>`).join('')}</div></div>` : ''}
    ${isTrancista && (tData.precoMin||tData.precoMax) ? `<div class="info-card"><h4>Preços</h4><p>💰 AOA ${Number(tData.precoMin||0).toLocaleString()} – ${Number(tData.precoMax||0).toLocaleString()}</p>${tData.tempo ? `<p>⏱ ${tData.tempo}</p>` : ''}</div>` : ''}
    ${existingPortfolioItems.length ? `<div class="info-card"><h4>Portfólio</h4><div class="tp-portfolio-grid">${existingPortfolioItems.map(item => {
      if(item.type === 'video') return `<div class="tp-portfolio-item" onclick="openLightbox('${item.url}','video')"><video src="${item.url}" muted playsinline></video><span class="media-type-badge">▶ Vídeo</span></div>`;
      return `<div class="tp-portfolio-item" onclick="openLightbox('${item.url}','image')"><img src="${item.url}" alt="trabalho"></div>`;
    }).join('')}</div></div>` : ''}
    ${!temConteudo ? `<div class="perfil-empty"><span>✏️</span><p>O teu perfil está quase vazio. Clica em "Editar Perfil" para o completar!</p></div>` : ''}
  </div>`;
}

function carregarMarcacoes(uid, isTrancista) {
  const campo = isTrancista ? 'trancistId' : 'clienteId';
  let q;
  try {
    q = query(collection(db, 'marcacoes'), where(campo, '==', uid), orderBy('criadoEm', 'desc'));
  } catch(e) {
    document.getElementById('marcacoesArea').innerHTML = '';
    return;
  }

  marcacoesUnsub = onSnapshot(q, (snapshot) => {
    const marcacoes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const area = document.getElementById('marcacoesArea');
    if(!area) return;

    const pendentes = marcacoes.filter(m => m.estado === 'pendente');
    const confirmadas = marcacoes.filter(m => m.estado === 'confirmado');
    const recusadas = marcacoes.filter(m => m.estado === 'recusado');

    notifActualizarBadgeCount(pendentes.length, isTrancista ? 'trancista' : 'cliente', marcacoes);

    if(!marcacoes.length) {
      area.innerHTML = `<div class="marcacoes-section"><h3>${isTrancista ? '📅 Pedidos de Marcação' : '📋 As Minhas Marcações'}</h3><div class="perfil-empty"><span>📭</span><p>${isTrancista ? 'Ainda não tens pedidos de marcação.' : 'Ainda não fizeste nenhuma marcação.'}</p></div></div>`;
      return;
    }

    if(isTrancista) {
      area.innerHTML = `<div class="marcacoes-section">
        <h3>📅 Pedidos de Marcação ${pendentes.length ? `<span class="badge-count">${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}</span>` : ''}</h3>
        ${pendentes.map(m => renderMarcacaoTrancista(m, true)).join('')}
        ${confirmadas.length ? `<div style="margin-top:28px"><h3 style="font-family:'Playfair Display',serif;font-size:1.1rem;color:rgba(253,246,236,.5);margin-bottom:16px;border-bottom:1px solid rgba(212,168,67,.06);padding-bottom:10px">✅ Confirmadas (${confirmadas.length})</h3>${confirmadas.map(m => renderMarcacaoTrancista(m, false)).join('')}</div>` : ''}
        ${recusadas.length ? `<div style="margin-top:28px"><h3 style="font-family:'Playfair Display',serif;font-size:1.1rem;color:rgba(253,246,236,.3);margin-bottom:16px;border-bottom:1px solid rgba(212,168,67,.04);padding-bottom:10px">✗ Recusadas (${recusadas.length})</h3>${recusadas.map(m => renderMarcacaoTrancista(m, false)).join('')}</div>` : ''}
      </div>`;
    } else {
      area.innerHTML = `<div class="marcacoes-section">
        <h3>📋 As Minhas Marcações</h3>
        ${marcacoes.map(m => renderMarcacaoCliente(m)).join('')}
      </div>`;
    }
  }, (err) => {
    console.error('Erro listener marcações:', err);
    const area = document.getElementById('marcacoesArea');
    if(area) area.innerHTML = `<div class="perfil-empty"><span>⚠️</span><p>Erro ao carregar marcações. Verifica os índices no Firebase.</p></div>`;
  });
}

function renderMarcacaoTrancista(m, comAcoes) {
  const inicial = (m.clienteNome||'?')[0].toUpperCase();
  const dataFmt = m.data ? new Date(m.data+'T12:00:00').toLocaleDateString('pt-PT', { weekday:'short', day:'numeric', month:'long' }) : '—';
  const criadoFmt = m.criadoEm?.toDate ? m.criadoEm.toDate().toLocaleDateString('pt-PT') : '';
  return `<div class="marcacao-card marcacao-card--${m.estado}">
    <div class="marcacao-card__top">
      <div class="marcacao-card__user" onclick="verPerfilCliente('${m.clienteId}','${m.clienteNome||''}','${m.clienteEmail||''}')">
        <div class="marc-avatar">${inicial}</div>
        <div><div class="marc-nome">👤 ${m.clienteNome||'Cliente'}</div><div class="marc-email">${m.clienteEmail||''}</div></div>
      </div>
      <span class="marc-estado ${m.estado}">${m.estado==='pendente' ? '⏳ Pendente' : m.estado==='confirmado' ? '✅ Confirmado' : '✗ Recusado'}</span>
    </div>
    <div class="marcacao-card__details">
      <span class="marc-detail">📅 ${dataFmt}</span>
      <span class="marc-detail">✂️ ${m.tipo||'—'}</span>
      ${criadoFmt ? `<span class="marc-detail">🕐 Pedido em ${criadoFmt}</span>` : ''}
    </div>
    ${m.nota ? `<div class="marcacao-card__nota">"${m.nota}"</div>` : ''}
    ${comAcoes && m.estado === 'pendente' ? `<div class="marcacao-card__actions">
      <button class="btn-aceitar" onclick="responderMarcacao('${m.id}','confirmado')">✅ Aceitar</button>
      <button class="btn-rejeitar" onclick="responderMarcacao('${m.id}','recusado')">✗ Recusar</button>
      <button class="btn-ver-cliente" onclick="verPerfilCliente('${m.clienteId}','${m.clienteNome||''}','${m.clienteEmail||''}')">👤 Ver Perfil</button>
    </div>` : ''}
    ${m.estado !== 'pendente' ? `<div class="marcacao-card__actions"><button class="btn-ver-cliente" onclick="verPerfilCliente('${m.clienteId}','${m.clienteNome||''}','${m.clienteEmail||''}')">👤 Ver Perfil da Cliente</button></div>` : ''}
  </div>`;
}

function renderMarcacaoCliente(m) {
  const dataFmt = m.data ? new Date(m.data+'T12:00:00').toLocaleDateString('pt-PT', { weekday:'short', day:'numeric', month:'long' }) : '—';
  return `<div class="marc-cliente-card marc-cliente-card--${m.estado}">
    <div class="marc-cliente-top">
      <div>
        <div class="marc-cliente-nome">✂️ ${m.trancistaNome||'Trancista'}</div>
        <div class="marc-cliente-details">
          <span class="marc-cliente-detail">📅 ${dataFmt}</span>
          <span class="marc-cliente-detail">🪡 ${m.tipo||'—'}</span>
        </div>
      </div>
      <span class="marc-estado ${m.estado}">${m.estado==='pendente' ? '⏳ Pendente' : m.estado==='confirmado' ? '✅ Confirmado' : '✗ Recusado'}</span>
    </div>
    ${m.nota ? `<div class="marc-cliente-nota">"${m.nota}"</div>` : ''}
  </div>`;
}

window.responderMarcacao = async (marcacaoId, novoEstado) => {
  try {
    await updateDoc(doc(db, 'marcacoes', marcacaoId), { estado: novoEstado, respondidoEm: serverTimestamp() });
  } catch(e) { alert('Erro ao actualizar marcação: ' + e.message); }
};

window.verPerfilCliente = async (clienteId, clienteNome, clienteEmail) => {
  const modal = document.getElementById('modalCliente');
  const content = document.getElementById('modalClienteContent');
  if(!modal || !content) return;
  content.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--gold)">⏳ A carregar...</div>`;
  modal.style.display = 'flex';
  try {
    let userData = { nome: clienteNome, email: clienteEmail };
    try { const uSnap = await getDoc(doc(db, 'usuarios', clienteId)); if(uSnap.exists()) userData = { ...userData, ...uSnap.data() }; } catch(e) {}
    const historico = [];
    try {
      const mSnap = await getDocs(query(collection(db, 'marcacoes'), where('clienteId','==',clienteId), where('trancistId','==',currentUser.uid), orderBy('criadoEm','desc')));
      mSnap.docs.forEach(d => historico.push({ id: d.id, ...d.data() }));
    } catch(e) {}
    const totalMarcacoes = historico.length;
    const confirmadas = historico.filter(m => m.estado === 'confirmado').length;
    const inicial = (userData.nome||clienteNome||'?')[0].toUpperCase();
    const foto = getFotoUrl(userData);
    content.innerHTML = `<div class="cliente-modal-perfil">
      <div class="cliente-modal-avatar">${foto ? `<img src="${foto}" alt="">` : inicial}</div>
      <h3 class="cliente-modal-nome">${userData.nome||clienteNome||'Cliente'}</h3>
      <p class="cliente-modal-email">${userData.email||clienteEmail||''}</p>
      ${userData.cidade ? `<p style="font-family:'Syne',sans-serif;font-size:.8rem;color:var(--gold);margin-bottom:16px">📍 ${userData.cidade}</p>` : ''}
      <div class="cliente-modal-stats">
        <div class="cliente-stat"><strong>${totalMarcacoes}</strong><span>Marcações</span></div>
        <div class="cliente-stat"><strong>${confirmadas}</strong><span>Confirmadas</span></div>
        <div class="cliente-stat"><strong>${totalMarcacoes > 0 ? Math.round((confirmadas/totalMarcacoes)*100) : 0}%</strong><span>Taxa confirm.</span></div>
      </div>
      ${historico.length ? `<div style="width:100%;text-align:left">
        <div class="cliente-hist-title">Histórico de marcações contigo</div>
        ${historico.slice(0,5).map(m => {
          const dataFmt = m.data ? new Date(m.data+'T12:00:00').toLocaleDateString('pt-PT', { day:'numeric', month:'short', year:'numeric' }) : '—';
          const estadoCor = m.estado==='confirmado' ? '#2ecc71' : m.estado==='recusado' ? 'var(--accent-pink)' : 'var(--gold)';
          return `<div class="cliente-hist-item"><div><span>${dataFmt}</span><br><span style="font-size:.75rem;color:rgba(253,246,236,.4)">${m.tipo||'—'}</span></div><strong style="color:${estadoCor}">${m.estado==='confirmado'?'✅':m.estado==='recusado'?'✗':'⏳'} ${m.estado}</strong></div>`;
        }).join('')}
      </div>` : ''}
      ${userData.whatsapp ? `<a href="https://wa.me/${userData.whatsapp.replace(/\D/g,'')}" class="tp-wa-btn" target="_blank" style="margin-top:20px">💬 Contactar no WhatsApp</a>` : ''}
    </div>`;
  } catch(e) {
    content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--accent-pink)">Erro ao carregar perfil.</div>`;
  }
};

window.toggleEditarPerfil = async () => {
  if(!currentUser) return;
  const isTrancista = currentUserPerfil?.tipo === 'trancista';
  let tData = {};
  if(isTrancista) {
    try { const s = await getDoc(doc(db, 'trancistas', currentUser.uid)); if(s.exists()) tData = s.data(); } catch(e) {}
  }
  existingPortfolioItems = (tData.portfolio||[]).map(item => typeof item === 'string' ? { url: item, type: 'image' } : item);
  uploadedPortfolioFiles = [];

  const dadosBase = isTrancista ? tData : currentUserPerfil;

  const tipos = ['Box Braids','Knotless','Cornrows','Fulani Braids','Goddess Braids','Twists','Senegalese','Locs'];
  const cidades = ['Luanda','Benguela','Huambo','Lobito','Lubango','Malanje','Cabinda','Kuito'];

  document.getElementById('perfilFormArea').innerHTML = `<div class="perfil-form"><h3>Editar Perfil</h3>
    <div class="form-group"><label>Foto de Perfil</label>
      <div class="upload-area" onclick="document.getElementById('uploadFotoPerfil').click()">
        <div class="upload-icon">📸</div><p>Clica para fazer upload da tua foto de perfil</p>
        <input type="file" id="uploadFotoPerfil" accept="image/*" onchange="previewFotoPerfil(this)">
      </div>
      <div id="fotoPerfilPreview">${getFotoUrl(dadosBase) ? `<img src="${getFotoUrl(dadosBase)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">` : ''}</div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Cidade</label><select id="editCidade"><option value="">Seleciona</option>${cidades.map(c => `<option value="${c}" ${dadosBase.cidade===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>WhatsApp</label><input type="tel" id="editWhatsapp" placeholder="+244 9XX XXX XXX" value="${dadosBase.whatsapp||''}"></div>
    </div>
    <div class="form-group"><label>Bio</label><textarea id="editBio" rows="3" placeholder="Conta um pouco sobre ti...">${dadosBase.bio||''}</textarea></div>
    ${isTrancista ? `
    <div class="form-group"><label>Especialidade Principal</label><input type="text" id="editEspecialidade" placeholder="ex: Box Braids & Knotless" value="${tData.especialidade||''}"></div>
    <div class="form-row">
      <div class="form-group"><label>Preço Mínimo (AOA)</label><input type="number" id="editPrecoMin" placeholder="3000" value="${tData.precoMin||''}"></div>
      <div class="form-group"><label>Preço Máximo (AOA)</label><input type="number" id="editPrecoMax" placeholder="15000" value="${tData.precoMax||''}"></div>
      <div class="form-group"><label>Tempo Médio</label><input type="text" id="editTempo" placeholder="ex: 3–5h" value="${tData.tempo||''}"></div>
    </div>
    <div class="form-group"><label>Tipos de Trança</label><div class="tipos-grid" id="tiposGrid">${tipos.map(t => `<button type="button" class="tipo-chip ${(tData.tiposEscolhidos||[]).includes(t)?'active':''}" onclick="this.classList.toggle('active')">${t}</button>`).join('')}</div></div>
    <div class="form-checks">
      <label class="check-opt"><input type="checkbox" id="editMaterial" ${tData.comMaterial?'checked':''}><span>Material incluído no preço</span></label>
      <label class="check-opt"><input type="checkbox" id="editDisp" ${tData.disponivel!==false?'checked':''}><span>Disponível para marcações</span></label>
    </div>
    <div class="form-group"><label>Fotos e Vídeos do Portfólio</label>
      <div class="upload-area" onclick="document.getElementById('uploadPortfolio').click()">
        <div class="upload-icon">🖼️</div><p>Clica para adicionar fotos ou vídeos dos teus trabalhos</p>
        <input type="file" id="uploadPortfolio" accept="image/*,video/*" multiple onchange="addPortfolioFiles(this)">
      </div>
      <div id="uploadProgressArea"></div>
      <div class="portfolio-preview" id="portfolioPreview">${existingPortfolioItems.map((item, i) => `<div class="portfolio-preview-item">${item.type==='video'?`<video src="${item.url}" muted playsinline></video><span class="media-badge">▶ Vídeo</span>`:`<img src="${item.url}" alt="trabalho">`}<button class="remove-img" onclick="removeExistingItem(${i})">✕</button></div>`).join('')}</div>
    </div>` : ''}
    <button class="btn-save" id="btnSalvar" onclick="salvarPerfil()">Guardar Perfil ✦</button>
    <button style="background:none;border:none;color:rgba(253,246,236,.5);font-family:'Syne',sans-serif;font-size:.82rem;cursor:pointer;margin-left:16px" onclick="renderPerfil()">Cancelar</button>
  </div>`;
};

window.previewFotoPerfil = (input) => {
  const file = input.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById('fotoPerfilPreview').innerHTML = `<img src="${url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`;
};
window.addPortfolioFiles = (input) => { uploadedPortfolioFiles = [...uploadedPortfolioFiles, ...Array.from(input.files)]; renderPortfolioPreview(); };
function renderPortfolioPreview() {
  const prev = document.getElementById('portfolioPreview');
  if(!prev) return;
  const existing = existingPortfolioItems.map((item, i) => `<div class="portfolio-preview-item">${item.type==='video'?`<video src="${item.url}" muted playsinline></video><span class="media-badge">▶ Vídeo</span>`:`<img src="${item.url}" alt="trabalho">`}<button class="remove-img" onclick="removeExistingItem(${i})">✕</button></div>`).join('');
  const newFiles = uploadedPortfolioFiles.map((f, i) => { const url = URL.createObjectURL(f); const isVideo = f.type.startsWith('video/'); return `<div class="portfolio-preview-item">${isVideo?`<video src="${url}" muted playsinline></video><span class="media-badge">▶ Vídeo</span>`:`<img src="${url}" alt="novo">`}<button class="remove-img" onclick="removeNewItem(${i})">✕</button></div>`; }).join('');
  prev.innerHTML = existing + newFiles;
}
window.removeExistingItem = (i) => { existingPortfolioItems.splice(i, 1); renderPortfolioPreview(); };
window.removeNewItem = (i) => { uploadedPortfolioFiles.splice(i, 1); renderPortfolioPreview(); };

window.salvarPerfil = async () => {
  if(!currentUser) return;
  const btn = document.getElementById('btnSalvar');
  btn.disabled = true; btn.textContent = 'A guardar...';
  try {
    const isTrancista = currentUserPerfil?.tipo === 'trancista';

    let fotoPerfilItem = getFotoUrl(currentUserPerfil) || null;

    const fotoInput = document.getElementById('uploadFotoPerfil');
    if(fotoInput && fotoInput.files[0]) {
      btn.textContent = 'A enviar foto...';
      try {
        fotoPerfilItem = await uploadParaCloudinary(fotoInput.files[0], (p) => { btn.textContent = `A enviar foto... ${p}%`; });
      } catch(e) { console.error('Erro upload foto:', e); }
    }

    const dadosBase = {
      bio: document.getElementById('editBio')?.value?.trim() || '',
      cidade: document.getElementById('editCidade')?.value || '',
      whatsapp: document.getElementById('editWhatsapp')?.value?.trim() || '',
      atualizadoEm: serverTimestamp()
    };
    if(fotoPerfilItem) dadosBase.fotoPerfil = fotoPerfilItem;

    await setDoc(doc(db, 'usuarios', currentUser.uid), dadosBase, { merge: true });

    if(isTrancista) {
      let newPortfolioItems = [];
      if(uploadedPortfolioFiles.length > 0) {
        btn.textContent = `A enviar ${uploadedPortfolioFiles.length} ficheiro(s)...`;
        const progressArea = document.getElementById('uploadProgressArea');
        if(progressArea) progressArea.innerHTML = uploadedPortfolioFiles.map((f, i) =>
          `<div class="upload-progress" id="prog_${i}">📤 ${f.name}<div class="upload-progress-bar"><div class="upload-progress-fill" id="progfill_${i}" style="width:0%"></div></div></div>`
        ).join('');
        newPortfolioItems = await Promise.all(uploadedPortfolioFiles.map((file, i) =>
          uploadParaCloudinary(file, (p) => { const fill = document.getElementById('progfill_'+i); if(fill) fill.style.width = p+'%'; })
        ));
      }
      const tiposEscolhidos = Array.from(document.querySelectorAll('#tiposGrid .tipo-chip.active')).map(b => b.textContent);
      const dadosTrancista = {
        ...dadosBase,
        nome: currentUser.displayName || '',
        email: currentUser.email || '',
        especialidade: document.getElementById('editEspecialidade')?.value?.trim() || '',
        precoMin: Number(document.getElementById('editPrecoMin')?.value) || 0,
        precoMax: Number(document.getElementById('editPrecoMax')?.value) || 0,
        tempo: document.getElementById('editTempo')?.value?.trim() || '',
        tiposEscolhidos,
        comMaterial: document.getElementById('editMaterial')?.checked || false,
        disponivel: document.getElementById('editDisp')?.checked || false,
      };
      await setDoc(doc(db, 'trancistas', currentUser.uid), dadosTrancista, { merge: true });
      await updateDoc(doc(db, 'trancistas', currentUser.uid), { portfolio: existingPortfolioItems });
      if(newPortfolioItems.length > 0) {
        await updateDoc(doc(db, 'trancistas', currentUser.uid), { portfolio: arrayUnion(...newPortfolioItems) });
      }
    }

    const snap = await getDoc(doc(db, 'usuarios', currentUser.uid));
    currentUserPerfil = snap.exists() ? snap.data() : {};

    const msg = document.getElementById('perfilMsg');
    if(msg) { msg.className = 'perfil-msg ok'; msg.textContent = '✓ Perfil guardado com sucesso!'; setTimeout(() => msg.textContent = '', 4000); }

    await loadAllTrancistas();
    await renderPerfil();
    renderNavAuth(currentUser);

  } catch(e) {
    console.error('Erro ao guardar:', e);
    const msg = document.getElementById('perfilMsg');
    if(msg) { msg.className = 'perfil-msg err'; msg.textContent = 'Erro ao guardar: ' + e.message; }
    if(btn) { btn.disabled = false; btn.textContent = 'Guardar Perfil ✦'; }
  }
};

window.doLogin = async () => {
  const btn = document.getElementById('loginBtn'); btn.disabled = true; btn.textContent = 'A entrar...';
  const err = document.getElementById('loginErro'); err.style.display = 'none';
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
  } catch(e) {
    err.style.display = 'block'; err.textContent = 'Email ou senha incorretos.';
    btn.disabled = false; btn.textContent = 'Entrar ✦';
  }
};
window.doCadastro = async () => {
  const btn = document.getElementById('cadastroBtn'); btn.disabled = true; btn.textContent = 'A criar conta...';
  const err = document.getElementById('cadastroErro'); err.style.display = 'none';
  const senha = document.getElementById('cadastroSenha').value;
  if(senha.length < 6) { err.style.display = 'block'; err.textContent = 'A senha deve ter pelo menos 6 caracteres.'; btn.disabled = false; btn.textContent = 'Criar Conta Grátis ✦'; return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, document.getElementById('cadastroEmail').value, senha);
    await updateProfile(cred.user, { displayName: document.getElementById('cadastroNome').value });
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nome: document.getElementById('cadastroNome').value,
      email: document.getElementById('cadastroEmail').value,
      tipo: registoTipo,
      criadoEm: serverTimestamp(),
      pontuacao: 0, nota: 0, avaliacoes: 0
    });
    if(registoTipo === 'trancista') {
      await setDoc(doc(db, 'trancistas', cred.user.uid), {
        nome: document.getElementById('cadastroNome').value,
        email: document.getElementById('cadastroEmail').value,
        tipo: 'trancista', nota: 0, avaliacoes: 0, pontuacao: 0,
        disponivel: true, portfolio: [], criadoEm: serverTimestamp()
      });
    }
  } catch(e) {
    err.style.display = 'block';
    err.textContent = e.code === 'auth/email-already-in-use' ? 'Este email já está em uso.' : 'Erro ao criar conta.';
    btn.disabled = false; btn.textContent = 'Criar Conta Grátis ✦';
  }
};
window.doLogout = async () => {
  if(marcacoesUnsub) { marcacoesUnsub(); marcacoesUnsub = null; }
  notifReset();
  notifClosePanel();
  await signOut(auth);
  showPage('home');
};
window.setTipo = (t) => { registoTipo = t; document.getElementById('tipoBtnCliente').classList.toggle('active', t==='cliente'); document.getElementById('tipoBtnTrancista').classList.toggle('active', t==='trancista'); };

let notifPanelAberto = false;
let notifAbaActiva = 'marcacoes';
let notifAcaoPendente = null;
let notifMarcacoes = [];
let notifMarcacoesUnsub = null;
let notifUid = null;
let notifTipoUser = 'cliente';

function notifInit(uid, tipoUser) {
  notifUid = uid;
  notifTipoUser = tipoUser;
  if(notifMarcacoesUnsub) { notifMarcacoesUnsub(); notifMarcacoesUnsub = null; }

  const campo = tipoUser === 'trancista' ? 'trancistId' : 'clienteId';
  let q;
  try {
    q = query(collection(db, 'marcacoes'), where(campo, '==', uid), orderBy('criadoEm', 'desc'));
  } catch(e) { return; }

  notifMarcacoesUnsub = onSnapshot(q, (snap) => {
    notifMarcacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notifActualizarBadgeCount(
      tipoUser === 'trancista' ? notifMarcacoes.filter(m => m.estado === 'pendente').length : notifMarcacoes.filter(m => m.estado !== 'pendente').length,
      tipoUser,
      notifMarcacoes
    );
    if(notifPanelAberto) notifRenderLista(notifAbaActiva);
  }, (err) => { console.error('notifInit erro:', err); });
}

function notifReset() {
  if(notifMarcacoesUnsub) { notifMarcacoesUnsub(); notifMarcacoesUnsub = null; }
  notifMarcacoes = [];
  notifUid = null;
  const badge = document.getElementById('notifBadge');
  if(badge) badge.style.display = 'none';
}

function notifActualizarBadgeCount(contagem, tipoUser, todasMarcacoes) {
  const badge = document.getElementById('notifBadge');
  if(badge) {
    badge.textContent = contagem;
    badge.style.display = contagem > 0 ? 'flex' : 'none';
  }
  const el = document.getElementById('ncount-marcacoes');
  if(el) { el.textContent = contagem; el.className = 'tab-count' + (contagem === 0 ? ' zero' : ''); }
  const subtitle = document.getElementById('notifSubtitle');
  if(subtitle) {
    if(tipoUser === 'trancista') {
      subtitle.textContent = contagem > 0 ? `${contagem} pedido${contagem>1?'s':''} pendente${contagem>1?'s':''}` : 'Sem pedidos pendentes ✦';
    } else {
      const total = todasMarcacoes ? todasMarcacoes.length : 0;
      subtitle.textContent = total > 0 ? `${total} marcaç${total>1?'ões':'ão'} no total` : 'Sem marcações ainda ✦';
    }
  }
}

window.notifTogglePanel = () => { if(notifPanelAberto) notifClosePanel(); else notifOpenPanel(); };

function notifOpenPanel() {
  const panel = document.getElementById('notifPanel');
  if(!panel) return;
  panel.style.display = 'flex';
  panel.classList.remove('closing');
  notifPanelAberto = true;
  notifRenderLista(notifAbaActiva);
  setTimeout(() => document.addEventListener('click', notifClickFora), 10);
}
window.notifClosePanel = function() {
  const panel = document.getElementById('notifPanel');
  if(!panel) return;
  panel.classList.add('closing');
  notifPanelAberto = false;
  document.removeEventListener('click', notifClickFora);
  setTimeout(() => { panel.style.display = 'none'; }, 180);
};
function notifClickFora(e) {
  const panel = document.getElementById('notifPanel');
  const trigger = document.getElementById('notifTrigger');
  const confirmOv = document.getElementById('confirmOverlay');
  if(!panel || !trigger) return;
  if(!panel.contains(e.target) && !trigger.contains(e.target) && !confirmOv?.contains(e.target)) notifClosePanel();
}
window.notifSwitchTab = (btn, aba) => {
  document.querySelectorAll('.notif-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  notifAbaActiva = aba;
  notifRenderLista(aba);
};
function notifRenderLista(aba) {
  const lista = document.getElementById('notifList');
  if(!lista) return;
  if(aba === 'marcacoes') {
    if(!notifMarcacoes.length) {
      lista.innerHTML = `<div class="notif-empty"><span>📭</span><p>Sem marcações de momento.</p></div>`;
      return;
    }
    lista.innerHTML = notifMarcacoes.map(m => notifRenderItemMarcacao(m)).join('');
  } else {
    const emojis = { likes:'🤍', comentarios:'💬', avaliacoes:'⭐' };
    const labels = { likes:'likes', comentarios:'comentários', avaliacoes:'avaliações' };
    lista.innerHTML = `<div class="notif-empty"><span>${emojis[aba]||'📭'}</span><p>Sem ${labels[aba]||'notificações'} de momento.<br><span style="font-size:.75rem;opacity:.6">Em breve...</span></p></div>`;
  }
}
function notifRenderItemMarcacao(m) {
  const isTrancista = notifTipoUser === 'trancista';
  const dataFmt = m.data ? new Date(m.data+'T12:00:00').toLocaleDateString('pt-PT', { day:'numeric', month:'short' }) : '—';
  const criadoFmt = m.criadoEm?.toDate ? tempoRelativo(m.criadoEm.toDate()) : '';
  const nomeExibido = isTrancista ? (m.clienteNome||'Cliente') : (m.trancistaNome||'Trancista');
  const texto = isTrancista
    ? `${m.clienteNome||'Cliente'} pediu marcação para <strong>${m.tipo||'—'}</strong> a ${dataFmt}`
    : `Marcação com <strong>${m.trancistaNome||'Trancista'}</strong> para ${dataFmt}: <strong>${m.estado==='confirmado'?'✅ Confirmada':m.estado==='recusado'?'✗ Recusada':'⏳ Pendente'}</strong>`;
  let acoes = '';
  if(isTrancista && m.estado === 'pendente') {
    acoes = `<div class="notif-actions">
      <button class="btn-notif-aceitar" onclick="notifPedirConfirmacao('${m.id}','aceitar')">✅ Aceitar</button>
      <button class="btn-notif-recusar" onclick="notifPedirConfirmacao('${m.id}','recusar')">✗ Recusar</button>
    </div>`;
  } else if(m.estado !== 'pendente') {
    acoes = `<span class="notif-estado ${m.estado}">${m.estado==='confirmado'?'✅ Confirmada':'✗ Recusada'}</span>`;
  }
  const unread = (isTrancista && m.estado==='pendente') ? 'unread' : '';
  return `<div class="notif-item ${unread}" id="nitem-${m.id}">
    <div class="notif-icon notif-icon--marcacao">📅</div>
    <div class="notif-body">
      <strong>${nomeExibido}</strong>
      <p>${texto}</p>
      ${acoes}
      <span class="notif-time">${criadoFmt}</span>
    </div>
  </div>`;
}
function tempoRelativo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if(diff < 60) return 'Agora mesmo';
  if(diff < 3600) return `Há ${Math.floor(diff/60)} min`;
  if(diff < 86400) return `Há ${Math.floor(diff/3600)}h`;
  if(diff < 172800) return 'Ontem';
  return date.toLocaleDateString('pt-PT', { day:'numeric', month:'short' });
}
window.notifMarcarTodasLidas = () => { notifRenderLista(notifAbaActiva); };

window.notifPedirConfirmacao = (id, tipo) => {
  notifAcaoPendente = { id, tipo };
  const m = notifMarcacoes.find(x => x.id === id);
  if(!m) return;
  const isAceitar = tipo === 'aceitar';
  const dataFmt = m.data ? new Date(m.data+'T12:00:00').toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long' }) : '—';
  document.getElementById('confirmIcon').textContent = isAceitar ? '📅' : '✗';
  document.getElementById('confirmTitulo').textContent = isAceitar ? 'Aceitar marcação?' : 'Recusar marcação?';
  document.getElementById('confirmDesc').textContent = isAceitar
    ? `Confirmas o pedido de ${m.clienteNome||'cliente'}?`
    : `Confirmas a recusa do pedido de ${m.clienteNome||'cliente'}?`;
  document.getElementById('confirmDetail').innerHTML = `
    <div class="confirm-detail-row"><span>Cliente</span><strong>${m.clienteNome||'—'}</strong></div>
    <div class="confirm-detail-row"><span>Data</span><strong>📅 ${dataFmt}</strong></div>
    <div class="confirm-detail-row"><span>Tipo</span><strong>✂️ ${m.tipo||'—'}</strong></div>
    ${m.nota ? `<div class="confirm-detail-row"><span>Nota</span><strong style="font-size:.77rem">"${m.nota}"</strong></div>` : ''}`;
  const simBtn = document.getElementById('confirmSimBtn');
  simBtn.textContent = isAceitar ? '✅ Confirmar Aceitação' : '✗ Confirmar Recusa';
  simBtn.className = isAceitar ? 'confirm-btn-sim' : 'confirm-btn-sim recusar-sim';
  const overlay = document.getElementById('confirmOverlay');
  overlay.style.display = 'flex';
  overlay.onclick = (e) => { if(e.target === overlay) notifFecharConfirm(); };
};
window.notifConfirmarAcao = async () => {
  if(!notifAcaoPendente) return;
  const { id, tipo } = notifAcaoPendente;
  const novoEstado = tipo === 'aceitar' ? 'confirmado' : 'recusado';
  notifFecharConfirm();
  const el = document.getElementById('nitem-'+id);
  if(el) { el.style.transition = 'opacity .3s,transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateX(10px)'; }
  try {
    await updateDoc(doc(db, 'marcacoes', id), { estado: novoEstado, respondidoEm: serverTimestamp() });
  } catch(e) { alert('Erro ao actualizar: ' + e.message); }
  notifAcaoPendente = null;
};
window.notifFecharConfirm = () => { document.getElementById('confirmOverlay').style.display = 'none'; notifAcaoPendente = null; };

window.showPage = (page) => {
  if(currentUser && (page === 'login' || page === 'cadastro')) page = 'perfil';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  const pageEl = document.getElementById('page-'+page);
  if(pageEl) pageEl.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(b => { if(b.getAttribute('onclick')?.includes("'"+page+"'")) b.classList.add('active'); });
  document.getElementById('navLinks')?.classList.remove('open');
  window.scrollTo(0, 0);
  if(page === 'perfil') renderPerfil();
  if(page === 'ranking') renderRanking();
  if(page === 'feed') renderFeed();
  location.hash = page;
};
window.toggleMenu = () => document.getElementById('navLinks').classList.toggle('open');
window.doHeroSearch = () => { const v = document.getElementById('heroSearch').value; if(v) { const fs = document.getElementById('filtroSearch'); if(fs) fs.value = v; } showPage('explorar'); };
window.filterByType = (tipo) => { filtroTipo = tipo; showPage('explorar'); setTimeout(() => { document.querySelectorAll('.filtro-opt').forEach(b => { if(b.textContent === tipo) b.classList.add('active'); else if(['Todos','Box Braids','Knotless','Cornrows','Fulani Braids','Goddess Braids','Twists'].includes(b.textContent)) b.classList.remove('active'); }); renderExplorar(); }, 100); };
window.openLightbox = (url, type) => { const content = document.getElementById('lightboxContent'); if(type === 'video') content.innerHTML = `<video class="lightbox-media" src="${url}" controls autoplay></video>`; else content.innerHTML = `<img class="lightbox-media" src="${url}" alt="">`; document.getElementById('lightbox').style.display = 'flex'; };
window.closeLightbox = () => { document.getElementById('lightbox').style.display = 'none'; document.getElementById('lightboxContent').innerHTML = ''; };
window.abrirComentarios = async (postId, trancistId) => {
  if(!currentUser) { showPage('login'); return; }
  const area = document.getElementById('coments_'+postId);
  if(!area) return;
  if(area.style.display !== 'none') { area.style.display = 'none'; return; }
  area.style.display = 'block';
  area.style.cssText = 'padding:16px 24px;border-top:1px solid rgba(212,168,67,.08)';
  area.innerHTML = `<div style="color:var(--gold);font-size:.85rem;padding:12px 0">A carregar...</div>`;
  try {
    const snap = await getDocs(query(collection(db, 'comentarios'), where('postId','==',postId), orderBy('criadoEm','asc')));
    const comentarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    area.innerHTML = `
      <div id="lista_coments_${postId}" style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        ${comentarios.length ? comentarios.map(c => `
          <div style="display:flex;gap:10px;align-items:flex-start">
            <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--caramel));display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:.75rem;color:var(--espresso);flex-shrink:0">${(c.userName||'?')[0].toUpperCase()}</div>
            <div style="background:rgba(61,28,10,.5);border-radius:10px;padding:10px 14px;flex:1">
              <strong style="font-family:'Syne',sans-serif;font-size:.78rem;color:var(--gold)">${c.userName||'Utilizador'}</strong>
              <p style="font-size:.85rem;color:rgba(253,246,236,.75);margin-top:4px">${c.texto}</p>
            </div>
          </div>`).join('') : `<p style="font-family:'Syne',sans-serif;font-size:.82rem;color:rgba(253,246,236,.3);text-align:center;padding:8px 0">Sem comentários ainda. Sê o primeiro!</p>`}
      </div>
      <div style="display:flex;gap:8px">
        <input type="text" id="input_coment_${postId}" placeholder="Escreve um comentário..." style="flex:1;background:rgba(26,15,8,.6);border:1px solid rgba(212,168,67,.2);border-radius:50px;padding:10px 16px;color:var(--cream);font-family:'DM Sans',sans-serif;font-size:.85rem;outline:none">
        <button onclick="enviarComentario('${postId}','${trancistId}')" style="background:var(--gold);color:var(--espresso);border:none;padding:10px 18px;border-radius:50px;font-family:'Syne',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer">Enviar</button>
      </div>`;
  } catch(e) { area.innerHTML = `<p style="color:var(--accent-pink);font-size:.82rem;padding:12px 0">Erro ao carregar comentários.</p>`; }
};

window.enviarComentario = async (postId, trancistId) => {
  if(!currentUser) { showPage('login'); return; }
  const input = document.getElementById('input_coment_'+postId);
  const texto = input?.value?.trim();
  if(!texto) return;
  input.value = '';
  input.disabled = true;
  try {
    const novoComent = { postId, trancistId, userId: currentUser.uid, userName: currentUser.displayName || currentUser.email, texto, criadoEm: serverTimestamp() };
    await addDoc(collection(db, 'comentarios'), novoComent);
    await setDoc(doc(db, 'notificacoes', trancistId + '_coment_' + postId + '_' + currentUser.uid), { tipo: 'comentario', trancistId, postId, userId: currentUser.uid, userName: currentUser.displayName || currentUser.email, texto, lida: false, criadoEm: serverTimestamp() }, { merge: true });
    const lista = document.getElementById('lista_coments_'+postId);
    if(lista) lista.innerHTML += `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
  <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--caramel));display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:.8rem;color:var(--espresso);flex-shrink:0">${(novoComent.userName||'?')[0].toUpperCase()}</div>
  <div style="flex:1">
    <strong style="font-family:'Syne',sans-serif;font-size:.78rem;color:var(--gold);display:block;margin-bottom:3px">${novoComent.userName||'Utilizador'}</strong>
    <p style="font-size:.88rem;color:rgba(253,246,236,.8);line-height:1.5">${novoComent.texto}</p>
  </div>
</div>`;
  } catch(e) { alert('Erro ao enviar comentário.'); }
  input.disabled = false;
};

function stars(nota) { return `<span class="stars">${[1,2,3,4,5].map(i => `<span class="${i<=Math.round(nota)?'star filled':'star'}">★</span>`).join('')}<strong> ${(nota||0).toFixed(1)}</strong></span>`; }
function starsHtml(nota) { return [1,2,3,4,5].map(i => `<span class="${i<=Math.round(nota)?'filled':''}">★</span>`).join(''); }

const hashInicial = location.hash.replace('#','') || 'home';
if(['home','explorar','ranking','feed'].includes(hashInicial)) showPage(hashInicial);

window.addEventListener('scroll', () => { document.getElementById('navbar').classList.toggle('navbar--scrolled', window.scrollY > 40); });

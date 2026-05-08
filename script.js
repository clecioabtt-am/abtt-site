const STORAGE_KEY = 'abtt_content_v4_local_backup';
const API_URL = '/.netlify/functions/content';
const ADMIN_USER = 'klinger';
const ADMIN_PASS = 'klingergestor';

const defaultData = {
  athletes: [{ id: 'athlete-default', name: 'Atleta ABTT', age: '28', belt: 'Preta', degree: '1º dan', country: '🇧🇷 Brasil', photo: 'assets/abtt-logo-premium.jpg' }],
  news: [{ id: 'news-default', title: 'Bem-vindo ao portal oficial da ABTT', text: 'Acompanhe aqui notícias, conquistas, treinos, graduações e atualizações da equipe.', image: 'assets/abtt-logo-premium.jpg' }],
  events: [{ id: 'event-default', title: 'Aulão ABTT', date: '2026-06-01', image: 'assets/abtt-logo-premium.jpg' }],
  media: [{ id: 'media-default', title: 'Identidade ABTT', type: 'image', src: 'assets/abtt-logo-premium.jpg' }],
  affiliates: [{ id: 'affiliate-default', name: 'ABTT Matriz', country: 'Brasil', city: 'Manaus', coach: 'Equipe ABTT', image: 'assets/abtt-logo-premium.jpg' }]
};

let appData = structuredCloneSafe(defaultData);
let databaseOnline = false;

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeData(input) {
  const data = input && typeof input === 'object' ? input : {};
  return {
    athletes: Array.isArray(data.athletes) ? data.athletes : [],
    news: Array.isArray(data.news) ? data.news : [],
    events: Array.isArray(data.events) ? data.events : [],
    media: Array.isArray(data.media) ? data.media : [],
    affiliates: Array.isArray(data.affiliates) ? data.affiliates : []
  };
}

function localBackupRead() {
  try { return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData); }
  catch (e) { return structuredCloneSafe(defaultData); }
}

function localBackupWrite(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
}

async function loadData() {
  try {
    const response = await fetch(`${API_URL}?v=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (!response.ok) throw new Error('Função Netlify indisponível');
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Resposta inválida da função');
    appData = normalizeData(payload.data);
    databaseOnline = true;
  } catch (error) {
    // IMPORTANTE: não usamos mais localStorage como fonte principal.
    // localStorage causava exatamente o problema de cada navegador mostrar dados diferentes.
    databaseOnline = false;
    appData = structuredCloneSafe(defaultData);
    console.warn('ABTT: banco online não respondeu; exibindo dados padrão temporariamente.', error);
  }
  updateDbStatus();
  return appData;
}

async function saveData(data) {
  const normalized = normalizeData(data);
  try {
    const response = await fetch(`${API_URL}?v=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ data: normalized })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Não foi possível salvar no banco online.');
    databaseOnline = true;
    appData = normalizeData(payload.data || normalized);
  } catch (error) {
    databaseOnline = false;
    updateDbStatus();
    throw error;
  }
  updateDbStatus();
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) return resolve('');
    const maxMb = 4.5;
    if (file.size > maxMb * 1024 * 1024) {
      reject(new Error(`Arquivo muito grande. Use imagem/vídeo com até ${maxMb}MB neste modelo Netlify Functions.`));
      return;
    }
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

function esc(s) {
  return String(s || '').replace(/[&<>\"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function updateDbStatus() {
  const el = document.getElementById('dbStatus');
  if (!el) return;
  el.textContent = databaseOnline ? 'Banco online conectado: publicações sincronizadas.' : 'Banco online offline: verifique Netlify Functions/Blobs.';
  el.className = databaseOnline ? 'db-status online' : 'db-status offline';
}

const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');
if (menuBtn && navLinks) {
  menuBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
  document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
}, { threshold: .16 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const translateTrigger = document.querySelector('.translate-trigger');
if (translateTrigger) {
  translateTrigger.addEventListener('click', () => document.querySelector('.translate-box')?.classList.toggle('show'));
}

function forcePortugueseBrazilLabel() {
  const tries = setInterval(() => {
    document.querySelectorAll('select.goog-te-combo option').forEach(opt => {
      if ((opt.value || '').toLowerCase() === 'pt') opt.textContent = 'português (Brasil)';
    });
  }, 600);
  setTimeout(() => clearInterval(tries), 12000);
}
forcePortugueseBrazilLabel();

function renderPublic() {
  const data = appData;
  const athletes = document.getElementById('athletesGrid');
  if (athletes) {
    athletes.innerHTML = data.athletes.map(a => `<article class="athlete-card reveal active"><img src="${esc(a.photo)}" alt="${esc(a.name)}"><div><span>${esc(a.country)}</span><h3>${esc(a.name)}</h3><p>${esc(a.age)} anos • Faixa ${esc(a.belt)}${a.degree ? ' • ' + esc(a.degree) : ''}</p></div></article>`).join('') || '<p class="empty">Nenhum atleta cadastrado.</p>';
  }

  const news = document.getElementById('newsGrid');
  if (news) {
    news.innerHTML = data.news.map(n => `<article class="post-card reveal active">${n.image ? `<div class="image-fit-frame" style="--bg:url('${esc(n.image)}')"><img src="${esc(n.image)}" alt="${esc(n.title)}"></div>` : ''}<div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></div></article>`).join('') || '<p class="empty">Nenhuma notícia cadastrada.</p>';
  }

  const events = document.getElementById('eventsGrid');
  if (events) {
    events.innerHTML = data.events.map(ev => `<article class="post-card event-card reveal active"><div class="image-fit-frame" style="--bg:url('${esc(ev.image)}')"><img src="${esc(ev.image)}" alt="${esc(ev.title)}"></div><div><span>${formatDate(ev.date)}</span><h3>${esc(ev.title)}</h3></div></article>`).join('') || '<p class="empty">Nenhum evento cadastrado.</p>';
  }

  const affiliates = document.getElementById('affiliatesGrid');
  if (affiliates) {
    affiliates.innerHTML = data.affiliates.map(a => `<article class="affiliate-card reveal active">${a.image ? `<img src="${esc(a.image)}" alt="${esc(a.name)}">` : ''}<div><span>🌍 ${esc(a.country)}</span><h3>${esc(a.name)}</h3><p>${esc(a.city)}${a.coach ? ' • Prof. ' + esc(a.coach) : ''}</p></div></article>`).join('') || '<p class="empty">Nenhuma afiliada cadastrada.</p>';
  }

  const media = document.getElementById('mediaGrid');
  if (media) {
    media.innerHTML = data.media.map(m => `<article class="media-card reveal active"><h3>${esc(m.title)}</h3>${m.type === 'video' ? `<video src="${esc(m.src)}" controls></video>` : `<img src="${esc(m.src)}" alt="${esc(m.title)}">`}</article>`).join('') || '<p class="empty">Nenhuma mídia cadastrada.</p>';
  }
}

function formatDate(value) {
  if (!value) return '';
  try { return new Date(value + 'T00:00:00').toLocaleDateString('pt-BR'); }
  catch (e) { return value; }
}

const loginBox = document.getElementById('loginBox');
const panelBox = document.getElementById('panelBox');
function showPanel() {
  loginBox?.classList.add('hidden');
  panelBox?.classList.remove('hidden');
  renderAdmin();
  updateDbStatus();
}

if (sessionStorage.getItem('abtt_admin') === '1') showPanel();

document.getElementById('loginBtn')?.addEventListener('click', () => {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value.trim();
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    sessionStorage.setItem('abtt_admin', '1');
    showPanel();
  } else {
    alert('Usuário ou senha incorretos.');
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  sessionStorage.removeItem('abtt_admin');
  location.reload();
});

function updateDegreeOptions() {
  const belt = document.getElementById('beltSelect');
  const degree = document.getElementById('degreeSelect');
  if (!belt || !degree) return;
  if (belt.value === 'Preta') {
    degree.innerHTML = ['Sem dan', '1º dan', '2º dan', '3º dan', '4º dan', '5º dan', '6º dan', '7º dan', '8º dan', '9º dan', '10º dan'].map(v => `<option>${v}</option>`).join('');
  } else {
    degree.innerHTML = ['Sem grau', '1 grau', '2 graus', '3 graus', '4 graus'].map(v => `<option>${v}</option>`).join('');
  }
}
document.getElementById('beltSelect')?.addEventListener('change', updateDegreeOptions);
updateDegreeOptions();

function resetForm(form) {
  form.reset();
  form.dataset.editIndex = '';
  updateDegreeOptions();
}

document.querySelectorAll('.form-cancel').forEach(btn => btn.addEventListener('click', () => {
  const form = document.getElementById(btn.dataset.form);
  if (form) resetForm(form);
}));

async function handleForm(id, type, mapper) {
  const form = document.getElementById(id);
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...'; }
      const fd = new FormData(form);
      const data = normalizeData(appData);
      const idx = form.dataset.editIndex;
      const old = idx !== '' ? data[type][Number(idx)] : null;
      const item = await mapper(fd, old);
      if (idx !== '') data[type][Number(idx)] = item;
      else data[type].unshift(item);
      await saveData(data);
      resetForm(form);
      renderAdmin();
      renderPublic();
      alert(idx !== '' ? 'Conteúdo atualizado e sincronizado!' : 'Conteúdo adicionado e sincronizado!');
    } catch (error) {
      alert('Erro ao salvar: ' + error.message + '\n\nConfira se o deploy instalou as dependências e se a função /.netlify/functions/content está funcionando.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
    }
  });
}

handleForm('athleteForm', 'athletes', async (fd, old) => ({
  id: old?.id || createId('athlete'),
  name: fd.get('name'),
  age: fd.get('age'),
  belt: fd.get('belt'),
  degree: fd.get('degree'),
  country: fd.get('country'),
  photo: await fileToDataURL(fd.get('photo')) || old?.photo || 'assets/abtt-logo-premium.jpg'
}));

handleForm('newsForm', 'news', async (fd, old) => ({
  id: old?.id || createId('news'),
  title: fd.get('title'),
  text: fd.get('text'),
  image: await fileToDataURL(fd.get('image')) || old?.image || ''
}));

handleForm('eventForm', 'events', async (fd, old) => ({
  id: old?.id || createId('event'),
  title: fd.get('title'),
  date: fd.get('date'),
  image: await fileToDataURL(fd.get('image')) || old?.image || 'assets/abtt-logo-premium.jpg'
}));

handleForm('mediaForm', 'media', async (fd, old) => ({
  id: old?.id || createId('media'),
  title: fd.get('title'),
  type: fd.get('type'),
  src: await fileToDataURL(fd.get('file')) || old?.src || ''
}));

handleForm('affiliateForm', 'affiliates', async (fd, old) => ({
  id: old?.id || createId('affiliate'),
  name: fd.get('name'),
  country: fd.get('country'),
  city: fd.get('city'),
  coach: fd.get('coach'),
  image: await fileToDataURL(fd.get('image')) || old?.image || 'assets/abtt-logo-premium.jpg'
}));

function editItem(type, index) {
  const data = normalizeData(appData);
  const item = data[type][index];
  let form;
  if (type === 'athletes') {
    form = document.getElementById('athleteForm');
    form.name.value = item.name || '';
    form.age.value = item.age || '';
    form.belt.value = item.belt || 'Branca';
    updateDegreeOptions();
    form.degree.value = item.degree || form.degree.options[0].value;
    form.country.value = item.country || '🇧🇷 Brasil';
  }
  if (type === 'news') {
    form = document.getElementById('newsForm');
    form.title.value = item.title || '';
    form.text.value = item.text || '';
  }
  if (type === 'events') {
    form = document.getElementById('eventForm');
    form.title.value = item.title || '';
    form.date.value = item.date || '';
  }
  if (type === 'media') {
    form = document.getElementById('mediaForm');
    form.title.value = item.title || '';
    form.type.value = item.type || 'image';
  }
  if (type === 'affiliates') {
    form = document.getElementById('affiliateForm');
    form.name.value = item.name || '';
    form.country.value = item.country || '';
    form.city.value = item.city || '';
    form.coach.value = item.coach || '';
  }
  if (form) {
    form.dataset.editIndex = String(index);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function deleteItem(type, index) {
  if (!confirm('Deseja remover este item?')) return;
  try {
    const data = normalizeData(appData);
    data[type].splice(index, 1);
    await saveData(data);
    renderAdmin();
    renderPublic();
  } catch (error) {
    alert('Erro ao remover: ' + error.message);
  }
}
window.editItem = editItem;
window.deleteItem = deleteItem;

function itemLabel(type, item) {
  if (type === 'athletes') return `${item.country || ''} ${item.name || ''} — Faixa ${item.belt || ''} ${item.degree || ''}`;
  if (type === 'news') return item.title;
  if (type === 'events') return `${item.title} — ${item.date}`;
  if (type === 'affiliates') return `${item.name || ''} — ${item.city || ''}, ${item.country || ''}`;
  return `${item.title} — ${item.type === 'video' ? 'Vídeo' : 'Imagem'}`;
}

function renderAdmin() {
  const box = document.getElementById('adminList');
  if (!box) return;
  const data = normalizeData(appData);
  const groups = [['athletes', 'Atletas'], ['news', 'Notícias'], ['events', 'Eventos'], ['affiliates', 'Afiliadas'], ['media', 'Mídias']];
  box.innerHTML = groups.map(([type, title]) => `<div class="admin-section-list"><h3>${title} <small>${data[type].length}</small></h3>${data[type].map((item, i) => `<div class="admin-row"><span>${esc(itemLabel(type, item))}</span><div><button class="mini-btn" onclick="editItem('${type}',${i})">Editar</button><button class="mini-btn danger-mini" onclick="deleteItem('${type}',${i})">Remover</button></div></div>`).join('') || '<p class="empty">Nada cadastrado.</p>'}</div>`).join('');
}

document.getElementById('clearBtn')?.addEventListener('click', async () => {
  if (!confirm('Tem certeza que deseja limpar todos os conteúdos cadastrados no banco online?')) return;
  try {
    await saveData({ athletes: [], news: [], events: [], media: [], affiliates: [] });
    renderAdmin();
    renderPublic();
  } catch (error) {
    alert('Erro ao limpar: ' + error.message);
  }
});

async function refreshFromOnline() {
  await loadData();
  renderPublic();
  if (sessionStorage.getItem('abtt_admin') === '1') renderAdmin();
}

(async function init() {
  await refreshFromOnline();
})();

// Mantém todos os navegadores atualizados com o banco online.
// Assim, publicações feitas por outro administrador aparecem sem depender do cache do navegador.
setInterval(() => {
  if (!document.hidden) refreshFromOnline();
}, 15000);

window.addEventListener('focus', refreshFromOnline);

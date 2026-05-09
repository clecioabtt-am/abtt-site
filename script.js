const $ = (id) => document.getElementById(id);
const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

let supabaseClient;
let currentUser = null;
let profile = null;
let condominios = [];
let lancamentos = [];

function msg(el, text, type = "") {
  el.textContent = text || "";
  el.className = `message ${type}`;
}

function requireConfig() {
  if (!window.DM_SUPABASE_URL || !window.DM_SUPABASE_ANON_KEY || window.DM_SUPABASE_URL.includes("COLE_AQUI")) {
    $("loginMsg").textContent = "Configure o Supabase no arquivo config.js antes de usar o portal.";
    return false;
  }
  supabaseClient = window.supabase.createClient(window.DM_SUPABASE_URL, window.DM_SUPABASE_ANON_KEY);
  return true;
}

async function init() {
  if (!requireConfig()) return;
  await carregarCondominios();
  await restoreSession();

  $("loginBtn").addEventListener("click", loginMorador);
  $("adminAccessBtn")?.addEventListener("click", abrirModalAdmin);
  $("adminLoginBtn")?.addEventListener("click", loginAdmin);
  $("closeAdminLogin")?.addEventListener("click", fecharModalAdmin);
  $("logoutBtn").addEventListener("click", logout);
  $("printBtn").addEventListener("click", () => window.print());
  $("filterTipo").addEventListener("change", renderLancamentos);
  $("filterBusca").addEventListener("input", renderLancamentos);
  $("closeModal").addEventListener("click", () => $("detailModal").classList.add("hidden"));

  $("formCondominio").addEventListener("submit", criarCondominio);
  $("formMorador").addEventListener("submit", criarMorador);
  $("formLancamento").addEventListener("submit", criarLancamento);
}

async function restoreSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.user) {
    currentUser = data.session.user;
    await carregarPerfil();
    await abrirDashboard();
  }
}

async function carregarCondominios() {
  const { data, error } = await supabaseClient.from("condominios").select("*").order("nome");
  if (error) {
    console.warn(error);
    condominios = [];
  } else {
    condominios = data || [];
  }
  popularSelects();
}

function popularSelects() {
  const options = `<option value="">Selecione o condomínio</option>` + condominios.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
  ["loginCondominio", "moradorCondominio", "lanCondominio"].forEach(id => {
    const el = $(id);
    if (el) el.innerHTML = options;
  });
}

function abrirModalAdmin() {
  msg($("adminLoginMsg"), "");
  $("adminLoginModal")?.classList.remove("hidden");
}

function fecharModalAdmin() {
  $("adminLoginModal")?.classList.add("hidden");
}

async function loginMorador() {
  msg($("loginMsg"), "");
  const email = $("loginEmail").value.trim();
  const password = $("loginSenha").value;
  const condominioId = $("loginCondominio").value;

  if (!condominioId) {
    msg($("loginMsg"), "Selecione o seu condomínio para acessar como morador.", "error");
    return;
  }

  if (!email || !password) {
    msg($("loginMsg"), "Informe e-mail e senha.", "error");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    msg($("loginMsg"), "Login inválido. Verifique e-mail e senha.", "error");
    return;
  }

  currentUser = data.user;
  await carregarPerfil();

  if (!profile) {
    msg($("loginMsg"), "Usuário sem perfil cadastrado. Verifique o cadastro com a administração.", "error");
    await supabaseClient.auth.signOut();
    return;
  }

  if (profile.role === "admin") {
    msg($("loginMsg"), "Este formulário é exclusivo para moradores. Use o botão Área Administrativa.", "error");
    await supabaseClient.auth.signOut();
    return;
  }

  if (profile.condominio_id !== condominioId) {
    msg($("loginMsg"), "Este morador não está vinculado ao condomínio selecionado.", "error");
    await supabaseClient.auth.signOut();
    return;
  }

  await abrirDashboard();
}

async function loginAdmin() {
  msg($("adminLoginMsg"), "");
  const email = $("adminEmail").value.trim();
  const password = $("adminSenha").value;

  if (!email || !password) {
    msg($("adminLoginMsg"), "Informe e-mail e senha do administrador.", "error");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    msg($("adminLoginMsg"), "Login administrativo inválido.", "error");
    return;
  }

  currentUser = data.user;
  await carregarPerfil();

  if (!profile || profile.role !== "admin") {
    msg($("adminLoginMsg"), "Este usuário não possui permissão de administrador.", "error");
    await supabaseClient.auth.signOut();
    return;
  }

  fecharModalAdmin();
  await abrirDashboard();
}

async function carregarPerfil() {
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).single();
  if (error) {
    console.warn(error);
    profile = null;
  } else {
    profile = data;
  }
}

async function abrirDashboard() {
  $("loginScreen").classList.add("hidden");
  $("dashboardScreen").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("adminAccessBtn")?.classList.add("hidden");

  const isAdmin = profile?.role === "admin";
  $("adminPanel").classList.toggle("hidden", !isAdmin);
  $("userRoleLabel").textContent = isAdmin ? "Administrador geral" : `Morador | Unidade ${profile.unidade || "-"}`;

  const condominio = isAdmin
    ? { nome: "Todos os condomínios" }
    : condominios.find(c => c.id === profile.condominio_id);

  $("condominioTitulo").textContent = condominio?.nome || "Condomínio";
  $("sessionLabel").textContent = currentUser.email;

  await carregarLancamentos();
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.reload();
}

async function carregarLancamentos() {
  let query = supabaseClient.from("lancamentos").select("*, condominios(nome)").order("data", { ascending: false });

  if (profile?.role !== "admin") {
    query = query.eq("condominio_id", profile.condominio_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    lancamentos = [];
  } else {
    lancamentos = data || [];
  }
  renderResumo();
  renderLancamentos();
}

function renderResumo() {
  const receitas = lancamentos.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor || 0), 0);
  const despesas = lancamentos.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor || 0), 0);
  $("totalReceitas").textContent = money(receitas);
  $("totalDespesas").textContent = money(despesas);
  $("saldoAtual").textContent = money(receitas - despesas);
  $("totalRegistros").textContent = lancamentos.length;
}

function renderLancamentos() {
  const tipo = $("filterTipo").value;
  const busca = $("filterBusca").value.toLowerCase().trim();

  let itens = [...lancamentos];
  if (tipo) itens = itens.filter(l => l.tipo === tipo);
  if (busca) {
    itens = itens.filter(l => [l.descricao, l.categoria, l.local, l.justificativa, l.condominios?.nome].join(" ").toLowerCase().includes(busca));
  }

  $("recordsList").innerHTML = itens.map(l => `
    <article class="record-card">
      <div>
        <h4>${l.descricao || "Lançamento"}</h4>
        <div class="record-meta">
          <span class="tag ${l.tipo === "despesa" ? "expense" : "income"}">${l.tipo === "despesa" ? "Despesa" : "Receita"}</span>
          <span class="tag">${money(l.valor)}</span>
          <span class="tag">${formatDate(l.data)}</span>
          ${profile?.role === "admin" ? `<span class="tag">${l.condominios?.nome || ""}</span>` : ""}
          ${l.categoria ? `<span class="tag">${l.categoria}</span>` : ""}
        </div>
        <p>${l.justificativa ? l.justificativa.slice(0, 160) + (l.justificativa.length > 160 ? "..." : "") : "Sem justificativa informada."}</p>
      </div>
      <div class="record-actions">
        <button class="btn details-btn" onclick="abrirDetalhes('${l.id}')">Ver detalhes</button>
      </div>
    </article>
  `).join("") || `<p>Nenhum lançamento encontrado.</p>`;
}

function formatDate(d) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

window.abrirDetalhes = function(id) {
  const l = lancamentos.find(x => x.id === id);
  if (!l) return;

  const fileLink = (label, url) => url ? `<div class="attachment"><a href="${url}" target="_blank">${label}</a></div>` : "";
  const imageBox = (label, url) => url ? `<div class="attachment"><strong>${label}</strong><img src="${url}" alt="${label}"></div>` : "";

  $("detailContent").innerHTML = `
    <span class="pill">${l.tipo === "despesa" ? "Despesa" : "Receita"}</span>
    <h2>${l.descricao}</h2>
    <div class="detail-grid">
      <div class="detail-box"><strong>Valor</strong><p>${money(l.valor)}</p></div>
      <div class="detail-box"><strong>Data</strong><p>${formatDate(l.data)}</p></div>
      <div class="detail-box"><strong>Categoria</strong><p>${l.categoria || "-"}</p></div>
      <div class="detail-box"><strong>Local</strong><p>${l.local || "-"}</p></div>
    </div>
    <div class="detail-box" style="margin-top:18px"><strong>Justificativa / Motivo</strong><p>${l.justificativa || "Não informado."}</p></div>
    <h3>Documentos e evidências</h3>
    <div class="attachments">
      ${fileLink("Abrir nota fiscal", l.nota_url)}
      ${fileLink("Abrir comprovante", l.comprovante_url)}
      ${imageBox("Foto antes", l.foto_antes_url)}
      ${imageBox("Foto depois", l.foto_depois_url)}
    </div>
  `;
  $("detailModal").classList.remove("hidden");
}

async function criarCondominio(e) {
  e.preventDefault();
  msg($("adminMsg"), "");
  const payload = {
    nome: $("condNome").value.trim(),
    endereco: $("condEndereco").value.trim()
  };
  const { error } = await supabaseClient.from("condominios").insert(payload);
  if (error) return msg($("adminMsg"), "Erro ao cadastrar condomínio: " + error.message, "error");
  e.target.reset();
  await carregarCondominios();
  msg($("adminMsg"), "Condomínio cadastrado com sucesso.", "ok");
}

async function criarMorador(e) {
  e.preventDefault();
  msg($("adminMsg"), "");
  const payload = {
    nome: $("moradorNome").value.trim(),
    email: $("moradorEmail").value.trim(),
    password: $("moradorSenha").value,
    unidade: $("moradorUnidade").value.trim(),
    condominio_id: $("moradorCondominio").value
  };

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch("/.netlify/functions/create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) return msg($("adminMsg"), result.error || "Erro ao criar morador.", "error");

  e.target.reset();
  msg($("adminMsg"), "Morador criado com login de acesso.", "ok");
}

async function uploadFile(file, folder) {
  if (!file) return null;
  const ext = file.name.split(".").pop();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage.from("documentos").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabaseClient.storage.from("documentos").getPublicUrl(path);
  return data.publicUrl;
}

async function criarLancamento(e) {
  e.preventDefault();
  msg($("adminMsg"), "");
  try {
    const condominioId = $("lanCondominio").value;
    const nota = await uploadFile($("lanNota").files[0], `condominios/${condominioId}/notas`);
    const comp = await uploadFile($("lanComprovante").files[0], `condominios/${condominioId}/comprovantes`);
    const antes = await uploadFile($("lanFotoAntes").files[0], `condominios/${condominioId}/fotos`);
    const depois = await uploadFile($("lanFotoDepois").files[0], `condominios/${condominioId}/fotos`);

    const payload = {
      condominio_id: condominioId,
      tipo: $("lanTipo").value,
      data: $("lanData").value,
      valor: Number($("lanValor").value),
      categoria: $("lanCategoria").value.trim(),
      local: $("lanLocal").value.trim(),
      descricao: $("lanDescricao").value.trim(),
      justificativa: $("lanJustificativa").value.trim(),
      nota_url: nota,
      comprovante_url: comp,
      foto_antes_url: antes,
      foto_depois_url: depois
    };

    const { error } = await supabaseClient.from("lancamentos").insert(payload);
    if (error) throw error;

    e.target.reset();
    await carregarLancamentos();
    msg($("adminMsg"), "Lançamento salvo com sucesso.", "ok");
  } catch (err) {
    msg($("adminMsg"), "Erro ao salvar lançamento: " + err.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", init);

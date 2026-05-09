const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Método não permitido." });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas no Netlify." });
    }

    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return json(401, { error: "Sessão administrativa não encontrada." });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(401, { error: "Sessão inválida." });
    }

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || profile?.role !== "admin") {
      return json(403, { error: "Apenas administradores podem criar moradores." });
    }

    const body = JSON.parse(event.body || "{}");
    const { nome, email, password, condominio_id, unidade } = body;

    if (!nome || !email || !password || !condominio_id) {
      return json(400, { error: "Nome, e-mail, senha e condomínio são obrigatórios." });
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, condominio_id, unidade, role: "morador" }
    });

    if (createErr) {
      return json(400, { error: createErr.message });
    }

    const userId = created.user.id;

    const { error: insertErr } = await adminClient.from("profiles").upsert({
      id: userId,
      nome,
      email,
      role: "morador",
      condominio_id,
      unidade,
      ativo: true
    });

    if (insertErr) {
      return json(400, { error: insertErr.message });
    }

    return json(200, { ok: true, user_id: userId });
  } catch (err) {
    return json(500, { error: err.message || "Erro interno." });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

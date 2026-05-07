import { getStore } from '@netlify/blobs';

const STORE_NAME = 'abtt-database';
const KEY = 'site-content';

const defaultData = {
  athletes: [
    { id: 'athlete-default', name: 'Atleta ABTT', age: '28', belt: 'Preta', degree: '1º dan', country: '🇧🇷 Brasil', photo: 'assets/abtt-logo-premium.jpg' }
  ],
  news: [
    { id: 'news-default', title: 'Bem-vindo ao portal oficial da ABTT', text: 'Acompanhe aqui notícias, conquistas, treinos, graduações e atualizações da equipe.', image: 'assets/abtt-logo-premium.jpg' }
  ],
  events: [
    { id: 'event-default', title: 'Aulão ABTT', date: '2026-06-01', image: 'assets/abtt-logo-premium.jpg' }
  ],
  media: [
    { id: 'media-default', title: 'Identidade ABTT', type: 'image', src: 'assets/abtt-logo-premium.jpg' }
  ]
};

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

function normalizeData(input) {
  const data = input && typeof input === 'object' ? input : {};
  return {
    athletes: Array.isArray(data.athletes) ? data.athletes : [],
    news: Array.isArray(data.news) ? data.news : [],
    events: Array.isArray(data.events) ? data.events : [],
    media: Array.isArray(data.media) ? data.media : []
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers });
}

export default async function handler(request, context) {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers });
  }

  try {
    // Function v2 recebe o contexto correto da Netlify automaticamente.
    // Isso evita o erro MissingBlobsEnvironmentError que acontece em algumas Functions antigas.
    const store = getStore({ name: STORE_NAME, consistency: 'strong' });

    if (request.method === 'GET') {
      let data = await store.get(KEY, { type: 'json', consistency: 'strong' });
      if (!data) {
        data = defaultData;
        await store.setJSON(KEY, data);
      }
      return json(200, { ok: true, data: normalizeData(data), source: 'netlify-blobs-v2' });
    }

    if (request.method === 'POST') {
      const payload = await request.json().catch(() => ({}));
      const data = normalizeData(payload.data || payload);
      await store.setJSON(KEY, data);
      return json(200, { ok: true, data, source: 'netlify-blobs-v2' });
    }

    return json(405, { ok: false, error: 'Método não permitido.' });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error?.message || 'Erro interno na função.',
      help: 'Se aparecer MissingBlobsEnvironmentError, faça o deploy pela pasta completa do projeto ou conecte o projeto ao GitHub/Netlify CLI para a Netlify injetar o contexto das Blobs.'
    });
  }
}

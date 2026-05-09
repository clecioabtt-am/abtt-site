# Portal DM - Prestação de Contas Privada

## O que foi atualizado

- Login privado por condomínio.
- Morador vê apenas o próprio condomínio.
- Administrador cadastra condomínios.
- Administrador cadastra moradores e cria login direto no painel.
- Lançamentos com justificativa/motivo.
- Upload de nota fiscal, comprovante, foto antes e foto depois.
- Tela "Ver detalhes" para desmiuçar cada despesa/serviço.
- Impressão/PDF pelo navegador.
- Netlify Function segura para criar usuários no Supabase Auth.

## Arquivos importantes

- `index.html`: interface do portal.
- `style.css`: layout responsivo.
- `script.js`: lógica do portal.
- `config.js`: URL e chave pública do Supabase.
- `database.sql`: estrutura do banco.
- `netlify/functions/create-user.js`: função segura para cadastrar moradores.
- `package.json`: dependência do Supabase para a função.
- `netlify.toml`: configuração do Netlify.

## Passo 1 - Atualizar o GitHub

Extraia este ZIP e envie todos os arquivos para o repositório do Portal Transparência.

Commit sugerido:

Atualização portal privado com cadastro de moradores

## Passo 2 - Configurar variáveis no Netlify

No projeto do Portal no Netlify:

Site configuration > Environment variables

Crie:

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

A `SUPABASE_URL` é a URL do Supabase.
A `SUPABASE_SERVICE_ROLE_KEY` fica em Supabase > Settings > API Keys > Secret/service role.

IMPORTANTE: nunca coloque a service role no arquivo config.js.

## Passo 3 - Configurar config.js

No arquivo `config.js`, coloque:

window.DM_SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
window.DM_SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICA";

Use a chave pública/publishable/anon, nunca a secret.

## Passo 4 - Criar/atualizar banco

No Supabase:

SQL Editor > New Query

Cole o conteúdo do arquivo `database.sql` e clique em Run.

## Passo 5 - Criar usuário administrador

No Supabase:

Authentication > Users > Add user

Crie o usuário administrador.

Depois copie o UUID do usuário e execute no SQL Editor:

insert into profiles (id, nome, email, role, ativo)
values ('UUID_DO_USUARIO_ADMIN', 'Administrador', 'admin@dm.com', 'admin', true)
on conflict (id) do update set role='admin', ativo=true;

## Passo 6 - Usar o painel

Entre no portal com o admin.
Cadastre condomínios.
Cadastre moradores.
Cadastre lançamentos com comprovantes, notas e fotos.

## Observação sobre arquivos

O bucket `documentos` fica público para leitura dos anexos dentro do portal.
Para uso mais avançado, é possível deixar privado e gerar links temporários.


## Login administrativo separado

Esta versão possui dois acessos:

1. Login principal: exclusivo para moradores. O morador precisa selecionar o condomínio.
2. Botão "Área Administrativa": exclusivo para administrador. O administrador entra sem selecionar condomínio.

O sistema identifica o administrador pela tabela `profiles`, campo `role = 'admin'`.

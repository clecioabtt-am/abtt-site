-- PORTAL DM GESTÃO PATRIMONIAL - LIVRO DIGITAL PRIVADO
-- Execute no Supabase: SQL Editor > New Query > Run
-- Depois crie/garanta seu usuário administrador em Authentication > Users
-- e execute o INSERT do perfil administrador no final deste arquivo, trocando o e-mail.

create extension if not exists pgcrypto;

create table if not exists public.condominios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  nome text,
  role text not null check (role in ('admin','morador')),
  condominio_id uuid references public.condominios(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  tipo text not null check (tipo in ('Entrada', 'Saída')),
  descricao text not null,
  categoria text not null,
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  month text not null,
  obs text,
  local_servico text,
  justificativa text,
  created_at timestamptz not null default now()
);

create table if not exists public.anexos (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references public.lancamentos(id) on delete cascade,
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  tipo text not null check (tipo in ('nota_fiscal','comprovante','foto_antes','foto_depois','outro')),
  file_path text not null,
  file_name text,
  mime_type text,
  created_at timestamptz not null default now()
);

alter table public.lancamentos add column if not exists local_servico text;
alter table public.lancamentos add column if not exists justificativa text;

create index if not exists idx_profiles_email on public.profiles(lower(email));
create index if not exists idx_profiles_condominio on public.profiles(condominio_id);
create index if not exists idx_lancamentos_condominio_month on public.lancamentos(condominio_id, month);
create index if not exists idx_lancamentos_data on public.lancamentos(data);
create index if not exists idx_anexos_lancamento on public.anexos(lancamento_id);
create index if not exists idx_anexos_condominio on public.anexos(condominio_id);

-- Bucket privado para notas, comprovantes e fotos antes/depois
insert into storage.buckets (id, name, public)
values ('portal-anexos', 'portal-anexos', false)
on conflict (id) do update set public = false;

-- Função auxiliar para identificar administradores
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and p.role = 'admin'
  );
$$;

alter table public.condominios enable row level security;
alter table public.profiles enable row level security;
alter table public.lancamentos enable row level security;
alter table public.anexos enable row level security;

-- Remove políticas antigas para reexecutar sem erro
drop policy if exists "Moradores podem visualizar condominios" on public.condominios;
drop policy if exists "Moradores podem visualizar lancamentos" on public.lancamentos;
drop policy if exists "Administradores autenticados gerenciam condominios" on public.condominios;
drop policy if exists "Administradores autenticados gerenciam lancamentos" on public.lancamentos;
drop policy if exists "Admin gerencia condominios" on public.condominios;
drop policy if exists "Usuario ve seu condominio" on public.condominios;
drop policy if exists "Admin gerencia profiles" on public.profiles;
drop policy if exists "Usuario ve seu profile" on public.profiles;
drop policy if exists "Admin gerencia lancamentos" on public.lancamentos;
drop policy if exists "Morador ve lancamentos do condominio" on public.lancamentos;
drop policy if exists "Admin gerencia anexos" on public.anexos;
drop policy if exists "Morador ve anexos do condominio" on public.anexos;

-- Condomínios
create policy "Admin gerencia condominios"
on public.condominios for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Usuario ve seu condominio"
on public.condominios for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.profiles p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
      and p.condominio_id = condominios.id
  )
);

-- Perfis
create policy "Admin gerencia profiles"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Usuario ve seu profile"
on public.profiles for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin());

-- Lançamentos
create policy "Admin gerencia lancamentos"
on public.lancamentos for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Morador ve lancamentos do condominio"
on public.lancamentos for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.profiles p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
      and p.role = 'morador'
      and p.condominio_id = lancamentos.condominio_id
  )
);

-- Anexos
create policy "Admin gerencia anexos"
on public.anexos for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Morador ve anexos do condominio"
on public.anexos for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.profiles p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
      and p.role = 'morador'
      and p.condominio_id = anexos.condominio_id
  )
);

-- Políticas do Storage privado
drop policy if exists "Admin envia arquivos do portal" on storage.objects;
drop policy if exists "Admin atualiza arquivos do portal" on storage.objects;
drop policy if exists "Admin apaga arquivos do portal" on storage.objects;
drop policy if exists "Usuarios autenticados veem arquivos do seu condominio" on storage.objects;

create policy "Admin envia arquivos do portal"
on storage.objects for insert
to authenticated
with check (bucket_id = 'portal-anexos' and public.is_admin());

create policy "Admin atualiza arquivos do portal"
on storage.objects for update
to authenticated
using (bucket_id = 'portal-anexos' and public.is_admin())
with check (bucket_id = 'portal-anexos' and public.is_admin());

create policy "Admin apaga arquivos do portal"
on storage.objects for delete
to authenticated
using (bucket_id = 'portal-anexos' and public.is_admin());

create policy "Usuarios autenticados veem arquivos do seu condominio"
on storage.objects for select
to authenticated
using (
  bucket_id = 'portal-anexos'
  and (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where lower(p.email) = lower(auth.jwt() ->> 'email')
        and p.condominio_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.condominios to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.lancamentos to authenticated;
grant select, insert, update, delete on public.anexos to authenticated;

-- IMPORTANTE: depois de criar seu usuário administrador em Authentication > Users,
-- troque o e-mail abaixo pelo e-mail real do administrador e execute este INSERT.
-- Exemplo:
-- insert into public.profiles (email, nome, role)
-- values ('seuemail@dominio.com', 'Administrador DM', 'admin')
-- on conflict (email) do update set role='admin', nome=excluded.nome;

-- Portal DM - Prestação de Contas Privada por Condomínio
-- Execute no Supabase SQL Editor.

create extension if not exists "uuid-ossp";

create table if not exists condominios (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  endereco text,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  role text not null default 'morador' check (role in ('admin', 'morador')),
  condominio_id uuid references condominios(id) on delete set null,
  unidade text,
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists lancamentos (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  tipo text not null check (tipo in ('receita', 'despesa')),
  data date not null,
  valor numeric(12,2) not null default 0,
  categoria text,
  local text,
  descricao text not null,
  justificativa text,
  nota_url text,
  comprovante_url text,
  foto_antes_url text,
  foto_depois_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table condominios enable row level security;
alter table profiles enable row level security;
alter table lancamentos enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
    and ativo = true
  );
$$;

create policy if not exists "Admins gerenciam condominios"
on condominios for all
using (public.is_admin())
with check (public.is_admin());

create policy if not exists "Morador ve seu condominio"
on condominios for select
using (
  public.is_admin()
  or id in (select condominio_id from profiles where id = auth.uid() and ativo = true)
);

create policy if not exists "Admins gerenciam profiles"
on profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy if not exists "Usuario ve proprio perfil"
on profiles for select
using (id = auth.uid() or public.is_admin());

create policy if not exists "Admins gerenciam lancamentos"
on lancamentos for all
using (public.is_admin())
with check (public.is_admin());

create policy if not exists "Morador ve lancamentos do seu condominio"
on lancamentos for select
using (
  public.is_admin()
  or condominio_id in (
    select condominio_id from profiles
    where id = auth.uid()
    and ativo = true
  )
);

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do update set public = true;

create policy if not exists "Admins upload documentos"
on storage.objects for insert
with check (
  bucket_id = 'documentos'
  and public.is_admin()
);

create policy if not exists "Documentos publicos para leitura"
on storage.objects for select
using (bucket_id = 'documentos');

-- Após criar o usuário admin em Authentication > Users, execute:
-- insert into profiles (id, nome, email, role, ativo)
-- values ('UUID_DO_USUARIO_ADMIN', 'Administrador', 'admin@dm.com', 'admin', true)
-- on conflict (id) do update set role='admin', ativo=true;

-- Tables de Keur Santé pour Supabase (Postgres).
-- À exécuter une fois dans Supabase → SQL Editor. L'application les crée aussi
-- d'elle-même au premier accès si elles n'existent pas.

create table if not exists ks_docs (
  collection text not null,
  id         text not null,
  owner      text,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists ks_docs_owner on ks_docs (collection, owner);
create table if not exists ks_counters (
  name  text primary key,
  value integer not null default 0
);
-- Accès réservé au serveur : l'API REST publique de Supabase ne voit rien.
alter table ks_docs enable row level security;
alter table ks_counters enable row level security;

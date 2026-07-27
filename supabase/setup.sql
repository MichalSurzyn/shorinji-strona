-- Konfiguracja bazy pod formularz kontaktowy.
-- Uruchom RAZ w Supabase: Dashboard → SQL Editor → wklej → Run.
-- (REST API nie pozwala tworzyć tabel, dlatego ten plik.)

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 120),
  email text not null check (char_length(email) <= 200),
  message text not null check (char_length(message) <= 4000),
  source text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS: włączone; brak polityk = dostęp tylko przez service-role (backend).
-- Formularz i panel działają przez klienta service-role, więc niczego
-- więcej nie trzeba dodawać.
alter table public.contact_messages enable row level security;

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

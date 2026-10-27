create table public.mistakes (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id text,
  topic text not null default '',
  what text not null check (char_length(what) between 1 and 20000),
  solution text not null default '',
  kind text not null check (char_length(kind) between 1 and 80),
  origin text not null check (origin in ('ejercicio', 'parcial', 'practica')),
  at timestamptz not null,
  overcome boolean not null default false,
  exercise_id text,
  concept_id text,
  card_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mistakes_user_at_idx on public.mistakes (user_id, at desc);
create index mistakes_subject_idx on public.mistakes (subject_id);

create trigger mistakes_set_updated_at before update on public.mistakes
  for each row execute function public.set_updated_at();

alter table public.mistakes enable row level security;
create policy mistakes_own on public.mistakes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

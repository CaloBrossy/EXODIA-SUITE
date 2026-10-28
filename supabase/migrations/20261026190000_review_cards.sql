create type public.card_origin as enum ('manual', 'concept', 'formula', 'question');

create table public.cards (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  front text not null check (char_length(front) between 1 and 500000),
  back text not null check (char_length(back) between 1 and 500000),
  subject_id text,
  tags text[] not null default '{}',
  origin_kind public.card_origin not null default 'manual',
  origin_id text,
  origin_updated_at timestamptz,
  interval_days double precision not null default 0 check (interval_days >= 0),
  ease double precision not null default 2.5 check (ease >= 1.3),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  due_at timestamptz not null,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cards_user_due_idx on public.cards (user_id, due_at);
create index cards_user_updated_idx on public.cards (user_id, updated_at desc);
create index cards_subject_idx on public.cards (subject_id);
create index cards_origin_idx on public.cards (origin_kind, origin_id);

create trigger cards_set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

alter table public.cards enable row level security;
create policy cards_own on public.cards for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

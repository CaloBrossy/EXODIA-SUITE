create type public.event_kind as enum ('clase', 'parcial', 'entrega', 'final', 'laboratorio', 'estudio', 'otro');
create type public.event_repeat as enum ('none', 'weekly');
create type public.event_status as enum ('pendiente', 'hecho');

create table public.events (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  kind public.event_kind not null,
  subject_id text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  repeat public.event_repeat not null default 'none',
  repeat_until timestamptz,
  skip_on text[] not null default '{}',
  location text not null default '' check (char_length(location) <= 300),
  notes text not null default '' check (char_length(notes) <= 20000),
  status public.event_status not null default 'pendiente',
  done_on text[] not null default '{}',
  origin_id text,
  series_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index events_user_start_idx on public.events (user_id, start_at);
create index events_user_updated_idx on public.events (user_id, updated_at desc);
create index events_subject_idx on public.events (subject_id);
create index events_origin_idx on public.events (origin_id);

create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;
create policy events_own on public.events for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

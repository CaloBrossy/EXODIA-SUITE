create table public.datasets (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  subject_id text,
  notes text not null default '' check (char_length(notes) <= 50000),
  rows jsonb not null default '[]' check (jsonb_typeof(rows) = 'array' and pg_column_size(rows) <= 1000000),
  x_axis jsonb not null default '{}' check (jsonb_typeof(x_axis) = 'object'),
  y_axis jsonb not null default '{}' check (jsonb_typeof(y_axis) = 'object'),
  fit text not null default 'none' check (fit in ('none', 'linear', 'poly', 'exp', 'power', 'log')),
  degree integer not null default 2 check (degree between 2 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index datasets_user_updated_idx on public.datasets (user_id, updated_at desc);
create index datasets_subject_idx on public.datasets (subject_id);

create trigger datasets_set_updated_at before update on public.datasets
  for each row execute function public.set_updated_at();

alter table public.datasets enable row level security;
create policy datasets_own on public.datasets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

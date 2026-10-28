create table public.exam_plans (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id text not null,
  subject_id text,
  hours_per_day double precision not null default 2 check (hours_per_day between 1 and 8),
  topics jsonb not null default '[]' check (jsonb_typeof(topics) = 'array' and pg_column_size(topics) <= 200000),
  sessions jsonb not null default '[]' check (jsonb_typeof(sessions) = 'array' and pg_column_size(sessions) <= 500000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exam_plans_user_updated_idx on public.exam_plans (user_id, updated_at desc);
create index exam_plans_event_idx on public.exam_plans (event_id);

create trigger exam_plans_set_updated_at before update on public.exam_plans
  for each row execute function public.set_updated_at();

alter table public.exam_plans enable row level security;
create policy exam_plans_own on public.exam_plans for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

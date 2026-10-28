create type public.exercise_status as enum ('sin_intentar', 'resuelto', 'fallo', 'repasar');
create type public.practice_result as enum ('bien', 'mal', 'ayuda');

create table public.exercises (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 500000),
  subject_id text,
  topic text not null default '' check (char_length(topic) <= 200),
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  source text not null default '' check (char_length(source) <= 300),
  solution text not null default '' check (char_length(solution) <= 500000),
  answer text not null default '' check (char_length(answer) <= 50000),
  status public.exercise_status not null default 'sin_intentar',
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_ms double precision not null default 0 check (last_attempt_ms >= 0),
  last_attempt_at timestamptz,
  tags text[] not null default '{}',
  concept_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_user_updated_idx on public.exercises (user_id, updated_at desc);
create index exercises_subject_idx on public.exercises (subject_id);
create index exercises_status_idx on public.exercises (status);

create trigger exercises_set_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

alter table public.exercises enable row level security;
create policy exercises_own on public.exercises for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.exam_runs (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id text,
  topics text[] not null default '{}',
  count integer not null check (count between 1 and 100),
  limit_ms integer not null check (limit_ms > 0),
  started_at timestamptz not null,
  ended_at timestamptz,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index exam_runs_user_started_idx on public.exam_runs (user_id, started_at desc);

alter table public.exam_runs enable row level security;
create policy exam_runs_own on public.exam_runs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

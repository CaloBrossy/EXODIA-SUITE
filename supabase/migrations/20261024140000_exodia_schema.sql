-- EXODIA: espejo Postgres del esquema Dexie (src/db/models.ts).
-- user_id + RLS: cada fila pertenece al usuario autenticado.

create type public.priority as enum ('low', 'medium', 'high');
create type public.session_phase as enum ('work', 'short', 'long');
create type public.devlab_mode as enum ('guided', 'consult');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.subjects (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  period text not null default '' check (char_length(period) <= 100),
  objectives text not null default '' check (char_length(objectives) <= 50000),
  notes text not null default '' check (char_length(notes) <= 200000),
  archived boolean not null default false,
  seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.concepts (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  discipline text not null default '' check (char_length(discipline) <= 120),
  tags text[] not null default '{}',
  summary text not null default '' check (char_length(summary) <= 5000),
  explanation text not null default '',
  formalism text not null default '',
  examples text not null default '',
  observations text not null default '',
  related_ids text[] not null default '{}',
  favorite boolean not null default false,
  seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz
);

create table public.formulas (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 300),
  latex text not null default '' check (char_length(latex) <= 5000),
  description text not null default '' check (char_length(description) <= 20000),
  variables jsonb not null default '[]',
  result_unit text not null default '' check (char_length(result_unit) <= 80),
  example text not null default '' check (char_length(example) <= 20000),
  discipline text not null default '' check (char_length(discipline) <= 120),
  tags text[] not null default '{}',
  concept_ids text[] not null default '{}',
  eval_expression text not null default '' check (char_length(eval_expression) <= 2000),
  eval_target text not null default '' check (char_length(eval_target) <= 40),
  tool_path text check (tool_path is null or char_length(tool_path) <= 200),
  seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 500),
  content text not null default '',
  tags text[] not null default '{}',
  favorite boolean not null default false,
  concept_ids text[] not null default '{}',
  formula_ids text[] not null default '{}',
  calculation_ids text[] not null default '{}',
  subject_id text references public.subjects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 5000),
  resolved boolean not null default false,
  answer text not null default '' check (char_length(answer) <= 50000),
  concept_id text references public.concepts (id) on delete set null,
  note_id text references public.notes (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.calculations (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default '' check (char_length(kind) <= 60),
  input text not null default '' check (char_length(input) <= 10000),
  result text not null default '' check (char_length(result) <= 10000),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  details text not null default '' check (char_length(details) <= 20000),
  priority public.priority not null default 'medium',
  subject_id text references public.subjects (id) on delete set null,
  project text not null default '' check (char_length(project) <= 200),
  done boolean not null default false,
  due_date text check (due_date is null or char_length(due_date) <= 20),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.sessions (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  phase public.session_phase not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_ms double precision not null check (duration_ms >= 0),
  task_id text references public.tasks (id) on delete set null,
  subject_id text references public.subjects (id) on delete set null
);

create table public.sketches (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 300),
  strokes jsonb not null default '[]',
  background text not null default '' check (char_length(background) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tools (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  url text not null check (url ~* '^https?://'),
  description text not null default '' check (char_length(description) <= 2000),
  sort_order double precision not null default 0,
  seed boolean not null default false
);

create table public.kv (
  key text not null check (char_length(key) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  value jsonb not null,
  primary key (user_id, key)
);

create table public.dev_problems (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 300),
  text text not null default '' check (char_length(text) <= 5000),
  kind text not null default '' check (char_length(kind) <= 30),
  strategy text not null default '' check (char_length(strategy) <= 60),
  lang text not null default '' check (char_length(lang) <= 20),
  mode public.devlab_mode not null default 'guided',
  stage text not null default '' check (char_length(stage) <= 20),
  revealed smallint not null default 0 check (revealed between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subjects_user_name_idx on public.subjects (user_id, name);
create index concepts_user_discipline_idx on public.concepts (user_id, discipline);
create index concepts_user_updated_idx on public.concepts (user_id, updated_at desc);
create index concepts_user_viewed_idx on public.concepts (user_id, last_viewed_at desc);
create index concepts_tags_idx on public.concepts using gin (tags);
create index formulas_user_discipline_idx on public.formulas (user_id, discipline);
create index formulas_user_updated_idx on public.formulas (user_id, updated_at desc);
create index formulas_tags_idx on public.formulas using gin (tags);
create index notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index notes_user_created_idx on public.notes (user_id, created_at desc);
create index notes_subject_idx on public.notes (subject_id);
create index notes_tags_idx on public.notes using gin (tags);
create index questions_user_created_idx on public.questions (user_id, created_at desc);
create index questions_concept_idx on public.questions (concept_id);
create index questions_note_idx on public.questions (note_id);
create index calculations_user_created_idx on public.calculations (user_id, created_at desc);
create index calculations_user_kind_idx on public.calculations (user_id, kind);
create index tasks_user_created_idx on public.tasks (user_id, created_at desc);
create index tasks_subject_idx on public.tasks (subject_id);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index sessions_subject_idx on public.sessions (subject_id);
create index sessions_task_idx on public.sessions (task_id);
create index sketches_user_updated_idx on public.sketches (user_id, updated_at desc);
create index tools_user_order_idx on public.tools (user_id, sort_order);
create index dev_problems_user_updated_idx on public.dev_problems (user_id, updated_at desc);

create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();
create trigger concepts_set_updated_at before update on public.concepts
  for each row execute function public.set_updated_at();
create trigger formulas_set_updated_at before update on public.formulas
  for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();
create trigger sketches_set_updated_at before update on public.sketches
  for each row execute function public.set_updated_at();
create trigger dev_problems_set_updated_at before update on public.dev_problems
  for each row execute function public.set_updated_at();

alter table public.subjects enable row level security;
alter table public.concepts enable row level security;
alter table public.formulas enable row level security;
alter table public.notes enable row level security;
alter table public.questions enable row level security;
alter table public.calculations enable row level security;
alter table public.tasks enable row level security;
alter table public.sessions enable row level security;
alter table public.sketches enable row level security;
alter table public.tools enable row level security;
alter table public.kv enable row level security;
alter table public.dev_problems enable row level security;

create policy subjects_own on public.subjects for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy concepts_own on public.concepts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy formulas_own on public.formulas for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notes_own on public.notes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy questions_own on public.questions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy calculations_own on public.calculations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_own on public.tasks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sessions_own on public.sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sketches_own on public.sketches for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tools_own on public.tools for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy kv_own on public.kv for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dev_problems_own on public.dev_problems for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

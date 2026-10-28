create table public.reports (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  subject_id text,
  note_id text,
  dataset_id text,
  concept_ids text[] not null default '{}',
  sections jsonb not null default '[]' check (jsonb_typeof(sections) = 'array' and pg_column_size(sections) <= 1000000),
  measurements jsonb not null default '[]' check (jsonb_typeof(measurements) = 'array' and pg_column_size(measurements) <= 500000),
  propagation jsonb check (propagation is null or jsonb_typeof(propagation) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_user_updated_idx on public.reports (user_id, updated_at desc);
create index reports_subject_idx on public.reports (subject_id);

create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;
create policy reports_own on public.reports for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

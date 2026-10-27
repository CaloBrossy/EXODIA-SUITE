create table public.library_items (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '',
  kind text not null check (kind in ('libro', 'pdf', 'guia', 'apunte', 'video', 'link')),
  subject_id text,
  url text not null default '',
  physical text not null default '',
  chapters jsonb not null default '[]' check (jsonb_typeof(chapters) = 'array' and pg_column_size(chapters) <= 500000),
  notes text not null default '',
  tags text[] not null default '{}',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index library_items_user_updated_idx on public.library_items (user_id, updated_at desc);
create index library_items_subject_idx on public.library_items (subject_id);

create trigger library_items_set_updated_at before update on public.library_items
  for each row execute function public.set_updated_at();

alter table public.library_items enable row level security;
create policy library_items_own on public.library_items for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

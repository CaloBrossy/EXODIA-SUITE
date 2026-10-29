alter table public.tasks add column if not exists updated_at timestamptz;
update public.tasks set updated_at = created_at where updated_at is null;
alter table public.tasks alter column updated_at set default now();
alter table public.tasks alter column updated_at set not null;

alter table public.questions add column if not exists updated_at timestamptz;
update public.questions set updated_at = created_at where updated_at is null;
alter table public.questions alter column updated_at set default now();
alter table public.questions alter column updated_at set not null;

alter table public.tools add column if not exists updated_at timestamptz not null default to_timestamp(0);
alter table public.kv add column if not exists updated_at timestamptz not null default to_timestamp(0);

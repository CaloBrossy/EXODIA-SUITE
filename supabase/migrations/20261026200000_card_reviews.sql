create type public.card_rating as enum ('again', 'hard', 'good', 'easy');

create table public.card_reviews (
  id text primary key check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null,
  rating public.card_rating not null,
  interval_days double precision not null check (interval_days >= 0),
  ease double precision not null check (ease >= 1.3),
  reviewed_at timestamptz not null
);

create index card_reviews_user_at_idx on public.card_reviews (user_id, reviewed_at desc);
create index card_reviews_card_idx on public.card_reviews (card_id);

alter table public.card_reviews enable row level security;
create policy card_reviews_own on public.card_reviews for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

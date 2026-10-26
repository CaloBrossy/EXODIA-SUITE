-- Plan de estudios: datos opcionales de la materia. null = materia solo de Focus.
alter table public.subjects
  add column plan jsonb
  check (plan is null or (jsonb_typeof(plan) = 'object' and pg_column_size(plan) <= 200000));

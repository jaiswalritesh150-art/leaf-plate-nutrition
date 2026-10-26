-- Kayro appointments: schema. Safe to run repeatedly (idempotent).
-- Run in the Supabase SQL editor, or via `python database/seed.py`.

create extension if not exists pgcrypto;

create table if not exists appointments (
  id               uuid primary key default gen_random_uuid(),
  client_name      text not null check (char_length(btrim(client_name)) between 2 and 80),
  -- 10-digit Indian mobile, digits only. NULL = phone not provided (kept explicit, never invented).
  phone            text check (phone ~ '^[6-9][0-9]{9}$'),
  -- Absolute instant (UTC internally). The clinic timezone is applied in the API layer.
  starts_at        timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 240),
  -- Exactly the three statuses the assignment asks for.
  status           text not null default 'Booked' check (status in ('Booked', 'Done', 'No-show')),
  source           text not null default 'client' check (source in ('client', 'dashboard', 'sample')),
  -- No-show prevention: client taps "I'll be there"; nutritionist logs when a reminder went out.
  confirmed_at     timestamptz,
  reminder_sent_at timestamptz,
  -- Cancellation is a flag, not a 4th status, so the status set stays exactly Booked/Done/No-show.
  cancelled_at     timestamptz,
  -- Lets the seed script be re-run without duplicating sample rows.
  seed_key         text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- THE double-booking guard: at most one *active* (not cancelled) appointment per start time.
-- Enforced by PostgreSQL itself, so concurrent requests cannot both succeed.
create unique index if not exists appointments_one_active_per_slot
  on appointments (starts_at) where cancelled_at is null;

create index if not exists appointments_phone_idx on appointments (phone);
create index if not exists appointments_starts_at_idx on appointments (starts_at);

-- Supabase exposes the public schema through its REST API using the anon key.
-- Row Level Security with NO policies blocks that path entirely. The FastAPI backend connects
-- with the database owner role, which is not subject to RLS, so it keeps working.
alter table appointments enable row level security;

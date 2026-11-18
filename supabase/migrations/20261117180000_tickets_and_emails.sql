-- Individual tickets (one per person on an order) and confirmation-email tracking.

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.ticket_sales (id) on delete cascade,
  tier_id uuid not null references public.ticket_tiers (id),
  -- Shown under the QR code and checked at the door, e.g. NN-7K4P-Q2XM. Random, so it can't be guessed.
  code text not null unique check (code ~ '^NN-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  -- 1..quantity within the order.
  holder_number integer not null check (holder_number >= 1),
  void boolean not null default false,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sale_id, holder_number)
);
create index if not exists tickets_sale_idx on public.tickets (sale_id);
alter table public.tickets enable row level security;

alter table public.ticket_sales
  add column if not exists receipt_sent_at timestamptz,
  add column if not exists tickets_sent_at timestamptz,
  add column if not exists email_error text;

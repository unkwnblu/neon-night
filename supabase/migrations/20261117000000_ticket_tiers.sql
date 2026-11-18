-- Ticket tiers managed from /admin: price, how many are available and when they go on sale.
create table if not exists public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 200),
  price_naira integer not null check (price_naira >= 0),
  quantity integer not null check (quantity > 0),
  sales_start timestamptz not null,
  sales_end timestamptz,
  sort_order integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_window check (sales_end is null or sales_end > sales_start)
);

-- Row level security with no policies: browsers using the public anon key can
-- neither read nor write. The site's server uses the service role key instead.
alter table public.ticket_tiers enable row level security;

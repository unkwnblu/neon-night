-- Ticket sales recorded by admins (cash, transfer, POS). Each row is one order.
create table if not exists public.ticket_sales (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.ticket_tiers (id) on delete restrict,
  buyer_name text not null check (char_length(buyer_name) between 1 and 100),
  buyer_email text not null check (buyer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(buyer_email) <= 200),
  quantity integer not null check (quantity between 1 and 50),
  -- Price at the time of sale, so later price changes don't rewrite history.
  unit_price_naira integer not null check (unit_price_naira >= 0),
  total_naira integer generated always as (quantity * unit_price_naira) stored,
  payment_method text not null check (payment_method in ('cash', 'transfer', 'pos', 'other')),
  note text check (char_length(note) <= 300),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);

create index if not exists ticket_sales_tier_idx on public.ticket_sales (tier_id);
create index if not exists ticket_sales_created_idx on public.ticket_sales (created_at desc);

-- Same lock-down as ticket_tiers: only the server's service role key gets in.
alter table public.ticket_sales enable row level security;

-- Records a sale only if enough tickets are left. Locking the tier row makes
-- two simultaneous sales queue up instead of both seeing the last tickets.
create or replace function public.record_ticket_sale(
  p_tier_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_quantity integer,
  p_payment_method text,
  p_note text
) returns public.ticket_sales
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tier public.ticket_tiers;
  v_sold integer;
  v_sale public.ticket_sales;
begin
  select * into v_tier from public.ticket_tiers where id = p_tier_id for update;
  if not found then
    raise exception 'That ticket tier no longer exists.' using errcode = 'P0002';
  end if;

  select coalesce(sum(quantity), 0) into v_sold
  from public.ticket_sales
  where tier_id = p_tier_id and status = 'paid';

  if v_sold + p_quantity > v_tier.quantity then
    raise exception 'Only % % ticket(s) left.', greatest(v_tier.quantity - v_sold, 0), v_tier.name
      using errcode = 'P0001';
  end if;

  insert into public.ticket_sales (tier_id, buyer_name, buyer_email, quantity, unit_price_naira, payment_method, note)
  values (p_tier_id, p_buyer_name, lower(p_buyer_email), p_quantity, v_tier.price_naira, p_payment_method, nullif(p_note, ''))
  returning * into v_sale;

  return v_sale;
end;
$$;

revoke all on function public.record_ticket_sale(uuid, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_ticket_sale(uuid, text, text, integer, text, text) to service_role;

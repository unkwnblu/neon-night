-- Online ticket sales through Bachs checkout.
--
-- An online order starts as 'pending' and holds its tickets until hold_expires_at,
-- so two buyers can't pay for the last ticket at the same time. The Bachs webhook
-- turns it 'paid'. If the hold lapses first it becomes 'expired', but a late payment
-- (e.g. a slow bank transfer) is still honoured; if that pushes the tier over its
-- quantity the sale is flagged 'oversold' for an admin to sort out.

alter table public.ticket_sales
  add column if not exists source text not null default 'manual' check (source in ('manual', 'online')),
  add column if not exists hold_expires_at timestamptz,
  add column if not exists checkout_id text unique,
  add column if not exists paid_at timestamptz,
  add column if not exists oversold boolean not null default false;

alter table public.ticket_sales drop constraint if exists ticket_sales_status_check;
alter table public.ticket_sales add constraint ticket_sales_status_check
  check (status in ('pending', 'paid', 'expired', 'refunded'));

alter table public.ticket_sales drop constraint if exists ticket_sales_payment_method_check;
alter table public.ticket_sales add constraint ticket_sales_payment_method_check
  check (payment_method in ('cash', 'transfer', 'pos', 'other', 'online'));

update public.ticket_sales set paid_at = created_at where paid_at is null and status in ('paid', 'refunded');

create index if not exists ticket_sales_pending_idx on public.ticket_sales (tier_id) where status = 'pending';

-- Webhook deliveries already handled, so retries and duplicates are ignored.
create table if not exists public.payment_webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.payment_webhook_events enable row level security;

-- Tickets no longer available in a tier: paid, plus pending holds that haven't lapsed.
create or replace function public.tickets_taken(p_tier_id uuid, p_exclude uuid default null)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.ticket_sales
  where tier_id = p_tier_id
    and (p_exclude is null or id <> p_exclude)
    and (status = 'paid' or (status = 'pending' and hold_expires_at > now()));
$$;

-- Manual (admin-recorded) sales now also respect online holds.
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
  v_sale public.ticket_sales;
begin
  select * into v_tier from public.ticket_tiers where id = p_tier_id for update;
  if not found then
    raise exception 'That ticket tier no longer exists.' using errcode = 'P0002';
  end if;

  if public.tickets_taken(p_tier_id) + p_quantity > v_tier.quantity then
    raise exception 'Only % % ticket(s) left.', greatest(v_tier.quantity - public.tickets_taken(p_tier_id), 0), v_tier.name
      using errcode = 'P0001';
  end if;

  insert into public.ticket_sales (tier_id, buyer_name, buyer_email, quantity, unit_price_naira, payment_method, note, paid_at)
  values (p_tier_id, p_buyer_name, lower(p_buyer_email), p_quantity, v_tier.price_naira, p_payment_method, nullif(p_note, ''), now())
  returning * into v_sale;
  return v_sale;
end;
$$;

-- Starts an online order: checks the tier is on sale and has room, then holds the tickets.
create or replace function public.reserve_online_sale(
  p_tier_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_quantity integer,
  p_hold_minutes integer
) returns public.ticket_sales
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tier public.ticket_tiers;
  v_sale public.ticket_sales;
  v_left integer;
begin
  select * into v_tier from public.ticket_tiers where id = p_tier_id for update;
  if not found or v_tier.is_hidden then
    raise exception 'That ticket isn''t available.' using errcode = 'P0002';
  end if;
  if now() < v_tier.sales_start then
    raise exception '% isn''t on sale yet.', v_tier.name using errcode = 'P0001';
  end if;
  if v_tier.sales_end is not null and now() >= v_tier.sales_end then
    raise exception 'Sales for % have closed.', v_tier.name using errcode = 'P0001';
  end if;

  v_left := v_tier.quantity - public.tickets_taken(p_tier_id);
  if p_quantity > v_left then
    if v_left <= 0 then
      raise exception '% is sold out.', v_tier.name using errcode = 'P0001';
    end if;
    raise exception 'Only % % ticket(s) left.', v_left, v_tier.name using errcode = 'P0001';
  end if;

  insert into public.ticket_sales
    (tier_id, buyer_name, buyer_email, quantity, unit_price_naira, payment_method, source, status, hold_expires_at)
  values
    (p_tier_id, p_buyer_name, lower(p_buyer_email), p_quantity, v_tier.price_naira, 'online', 'online', 'pending',
     now() + make_interval(mins => p_hold_minutes))
  returning * into v_sale;
  return v_sale;
end;
$$;

-- Marks an online order paid from the Bachs webhook. Safe to call more than once.
create or replace function public.mark_online_sale_paid(p_checkout_id text)
returns public.ticket_sales
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sale public.ticket_sales;
  v_tier public.ticket_tiers;
begin
  select * into v_sale from public.ticket_sales where checkout_id = p_checkout_id for update;
  if not found or v_sale.status in ('paid', 'refunded') then
    return v_sale;
  end if;

  select * into v_tier from public.ticket_tiers where id = v_sale.tier_id for update;
  update public.ticket_sales
  set status = 'paid',
      paid_at = now(),
      oversold = public.tickets_taken(v_sale.tier_id, v_sale.id) + v_sale.quantity > v_tier.quantity
  where id = v_sale.id
  returning * into v_sale;
  return v_sale;
end;
$$;

revoke all on function public.tickets_taken(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_ticket_sale(uuid, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.reserve_online_sale(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.mark_online_sale_paid(text) from public, anon, authenticated;
grant execute on function public.tickets_taken(uuid, uuid) to service_role;
grant execute on function public.record_ticket_sale(uuid, text, text, integer, text, text) to service_role;
grant execute on function public.reserve_online_sale(uuid, text, text, integer, integer) to service_role;
grant execute on function public.mark_online_sale_paid(text) to service_role;

-- Tickets taken per tier right now (paid + live holds), for the public page.
create or replace function public.tier_availability()
returns table (tier_id uuid, taken integer)
language sql
stable
set search_path = ''
as $$
  select t.id, public.tickets_taken(t.id) from public.ticket_tiers t;
$$;

revoke all on function public.tier_availability() from public, anon, authenticated;
grant execute on function public.tier_availability() to service_role;

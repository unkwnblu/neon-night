-- Owner-only publicity fund: a paid sale moved here is left out of the revenue admins see,
-- but its tickets still count as sold and still work at the door.
alter table public.ticket_sales
  add column if not exists publicity boolean not null default false,
  add column if not exists publicity_at timestamptz,
  add column if not exists publicity_note text check (char_length(publicity_note) <= 200);

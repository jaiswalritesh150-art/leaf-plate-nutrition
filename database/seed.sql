-- Five sample appointments from the assignment, normalised.
-- Dates/times are interpreted in Asia/Kolkata and stored as timestamptz.
-- Re-runnable: seed_key is unique and ON CONFLICT DO NOTHING skips rows that already exist.
-- Meera Iyer's phone was missing in the source, so it stays NULL (not invented).

insert into appointments (client_name, phone, starts_at, status, source, seed_key) values
  ('Riya Shah',   '9820011111', ('2026-10-24 10:00' )::timestamp at time zone 'Asia/Kolkata', 'Booked',  'sample', 'sample-1'),
  ('Arjun Mehta', '9820022222', ('2026-10-24 11:30' )::timestamp at time zone 'Asia/Kolkata', 'Booked',  'sample', 'sample-2'),
  ('Riya Shah',   '9820011111', ('2026-10-25 16:00' )::timestamp at time zone 'Asia/Kolkata', 'Booked',  'sample', 'sample-3'),
  ('Meera Iyer',  null,         ('2026-10-23 09:00' )::timestamp at time zone 'Asia/Kolkata', 'Done',    'sample', 'sample-4'),
  ('Kabir Rao',   '9820033333', ('2026-10-22 14:00' )::timestamp at time zone 'Asia/Kolkata', 'No-show', 'sample', 'sample-5')
on conflict do nothing;

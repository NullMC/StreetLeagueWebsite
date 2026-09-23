-- Street League: presidential penalties for STAFF players.
-- STAFF members are existing players whose position/role is set to STAFF.
-- Each successful presidential penalty is recorded as a dedicated match event,
-- so it remains associated with its match and competition.

alter type public.event_type add value if not exists 'presidential_penalty';

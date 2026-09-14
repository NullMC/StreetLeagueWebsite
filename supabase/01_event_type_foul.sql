-- Street League
-- Migration 01: aggiunge il nuovo tipo di evento "foul".
--
-- IMPORTANTE:
-- Eseguire questa query DA SOLA e fare eseguire/committare
-- completamente la transazione prima di lanciare Migration 02.
--
-- Motivo: PostgreSQL non consente di usare un nuovo valore ENUM
-- nella stessa transazione in cui quel valore viene aggiunto.

alter type public.event_type
add value if not exists 'foul';

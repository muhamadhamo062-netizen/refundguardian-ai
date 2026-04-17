-- Legacy batch-ingest path removed; drop unused audit table if present.
DROP TABLE IF EXISTS public.extension_sync_events CASCADE;

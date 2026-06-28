CREATE OR REPLACE FUNCTION notify_outbox_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('outbox_channel', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER outbox_after_insert
AFTER INSERT ON "OutboxEvent"
FOR EACH ROW EXECUTE FUNCTION notify_outbox_insert();

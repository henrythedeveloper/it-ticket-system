DROP TRIGGER IF EXISTS set_ticket_number ON tickets;
DROP FUNCTION IF EXISTS generate_ticket_number();
ALTER TABLE tickets DROP COLUMN ticket_number;
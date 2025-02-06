ALTER TABLE tickets 
ADD COLUMN ticket_number VARCHAR(20) UNIQUE;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ticket_number := 'TKT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                        LPAD(CAST(NEXTVAL('tickets_id_seq') AS TEXT), 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_number();
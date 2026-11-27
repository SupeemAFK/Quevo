ALTER TABLE ticket_events DROP CONSTRAINT ticket_events_handoff_details_check;
ALTER TABLE ticket_events DROP CONSTRAINT ticket_events_event_type_check;
ALTER TABLE ticket_events DROP COLUMN to_operator_id;
ALTER TABLE ticket_events DROP COLUMN from_operator_id;
ALTER TABLE ticket_events DROP COLUMN event_type;

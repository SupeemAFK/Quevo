ALTER TABLE ticket_events
    ADD COLUMN event_type TEXT NOT NULL DEFAULT 'STATUS',
    ADD COLUMN from_operator_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    ADD COLUMN to_operator_id UUID REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ticket_events ADD CONSTRAINT ticket_events_event_type_check
    CHECK (event_type IN ('STATUS', 'HANDOFF'));

ALTER TABLE ticket_events ADD CONSTRAINT ticket_events_handoff_details_check CHECK (
    (event_type = 'STATUS' AND from_operator_id IS NULL AND to_operator_id IS NULL)
    OR (event_type = 'HANDOFF' AND actor_id IS NOT NULL AND actor_id = from_operator_id
        AND from_operator_id IS NOT NULL AND to_operator_id IS NOT NULL
        AND from_operator_id <> to_operator_id AND from_status IS NOT NULL AND from_status = to_status)
);

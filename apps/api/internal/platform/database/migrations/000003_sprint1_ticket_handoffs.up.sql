CREATE TABLE ticket_handoffs (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    previous_operator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    new_operator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (previous_operator_id <> new_operator_id)
);

CREATE INDEX ticket_handoffs_ticket_transferred_at_idx
    ON ticket_handoffs (ticket_id, transferred_at, id);

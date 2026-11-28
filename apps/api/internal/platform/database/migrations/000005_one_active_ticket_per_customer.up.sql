WITH active_tickets AS (
    SELECT id, customer_id, status,
        row_number() OVER (PARTITION BY customer_id ORDER BY joined_at, id) AS position
    FROM tickets
    WHERE status IN ('WAITING', 'PENDING', 'OPERATING')
), cancelled_duplicates AS (
    UPDATE tickets AS t
    SET status = 'CANCELLED', cancelled_at = now()
    FROM active_tickets AS active
    WHERE t.id = active.id AND active.position > 1
    RETURNING t.id, t.customer_id, active.status AS previous_status
)
INSERT INTO ticket_events (id, ticket_id, from_status, to_status, actor_id, occurred_at)
SELECT md5(id::text || ':one-active-ticket-migration')::uuid,
    id, previous_status, 'CANCELLED', customer_id, now()
FROM cancelled_duplicates;

DROP INDEX tickets_one_active_customer_per_queue;
CREATE UNIQUE INDEX tickets_one_active_customer
    ON tickets (customer_id)
    WHERE status IN ('WAITING', 'PENDING', 'OPERATING');

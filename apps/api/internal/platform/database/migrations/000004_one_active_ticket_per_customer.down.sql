DROP INDEX IF EXISTS tickets_one_active_customer;
CREATE UNIQUE INDEX tickets_one_active_customer_per_queue
    ON tickets (customer_id, branch_id, queue_id, business_date)
    WHERE status IN ('WAITING', 'PENDING', 'OPERATING');

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('CUSTOMER', 'OPERATOR', 'BRANCH_MANAGER'));

CREATE TABLE branch_managers (
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    manager_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (branch_id, manager_id)
);

CREATE UNIQUE INDEX services_branch_name_unique ON services (branch_id, lower(trim(name)));

ALTER TABLE services ADD COLUMN allows_uploads BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN requires_documents BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN document_guidance TEXT NOT NULL DEFAULT '';
ALTER TABLE services ADD CONSTRAINT services_document_policy_check CHECK (NOT requires_documents OR allows_uploads);

CREATE TABLE service_queues (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL,
    service_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, id),
    FOREIGN KEY (branch_id, service_id) REFERENCES services(branch_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX service_queues_name_unique ON service_queues (service_id, lower(trim(name)));

INSERT INTO service_queues (id, branch_id, service_id, name, active)
SELECT id, branch_id, id, 'Main queue', active FROM services;

CREATE TABLE branch_counters (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, id)
);
CREATE UNIQUE INDEX branch_counters_name_unique ON branch_counters (branch_id, lower(trim(name)));

CREATE TABLE counter_queues (
    counter_id UUID NOT NULL REFERENCES branch_counters(id) ON DELETE RESTRICT,
    queue_id UUID NOT NULL REFERENCES service_queues(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (counter_id, queue_id)
);

CREATE TABLE counter_operators (
    counter_id UUID NOT NULL REFERENCES branch_counters(id) ON DELETE RESTRICT,
    operator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (counter_id, operator_id)
);

CREATE TABLE queue_operators (
    queue_id UUID NOT NULL REFERENCES service_queues(id) ON DELETE RESTRICT,
    operator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (queue_id, operator_id)
);

INSERT INTO branch_counters (id, branch_id, name, active)
SELECT md5(id::text || ':counter-1')::uuid, id, 'Counter 1', true FROM branches;
INSERT INTO counter_queues (counter_id, queue_id)
SELECT c.id, q.id FROM branch_counters c JOIN service_queues q ON q.branch_id = c.branch_id;
INSERT INTO counter_operators (counter_id, operator_id)
SELECT DISTINCT c.id, os.operator_id FROM operator_services os JOIN services s ON s.id = os.service_id
JOIN branch_counters c ON c.branch_id = s.branch_id;

ALTER TABLE tickets ADD COLUMN queue_id UUID;
UPDATE tickets SET queue_id = service_id;
ALTER TABLE tickets ALTER COLUMN queue_id SET NOT NULL;
ALTER TABLE tickets ADD CONSTRAINT tickets_branch_queue_fkey
    FOREIGN KEY (branch_id, queue_id) REFERENCES service_queues(branch_id, id) ON DELETE RESTRICT;
ALTER TABLE tickets ADD COLUMN request_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tickets ADD COLUMN request_labels JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tickets ADD CONSTRAINT tickets_request_answers_object_check CHECK (jsonb_typeof(request_answers) = 'object');
ALTER TABLE tickets ADD CONSTRAINT tickets_request_labels_object_check CHECK (jsonb_typeof(request_labels) = 'object');
ALTER TABLE tickets ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN no_show_at TIMESTAMPTZ;

ALTER TABLE tickets DROP CONSTRAINT tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN ('WAITING', 'PENDING', 'OPERATING', 'COMPLETED', 'SKIPPED', 'CANCELLED', 'NO_SHOW'));
ALTER TABLE tickets DROP CONSTRAINT tickets_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_lifecycle_check CHECK (
    (status = 'WAITING' AND called_at IS NULL AND started_at IS NULL AND completed_at IS NULL AND skipped_at IS NULL AND cancelled_at IS NULL AND no_show_at IS NULL AND assigned_operator_id IS NULL)
    OR (status = 'PENDING' AND called_at IS NOT NULL AND started_at IS NULL AND completed_at IS NULL AND skipped_at IS NULL AND cancelled_at IS NULL AND no_show_at IS NULL AND assigned_operator_id IS NOT NULL)
    OR (status = 'OPERATING' AND called_at IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NULL AND skipped_at IS NULL AND cancelled_at IS NULL AND no_show_at IS NULL AND assigned_operator_id IS NOT NULL)
    OR (status = 'COMPLETED' AND called_at IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NOT NULL AND skipped_at IS NULL AND cancelled_at IS NULL AND no_show_at IS NULL AND assigned_operator_id IS NOT NULL)
    OR (status = 'SKIPPED' AND called_at IS NOT NULL AND started_at IS NULL AND completed_at IS NULL AND skipped_at IS NOT NULL AND cancelled_at IS NULL AND no_show_at IS NULL AND assigned_operator_id IS NOT NULL)
    OR (status = 'CANCELLED' AND called_at IS NULL AND started_at IS NULL AND completed_at IS NULL AND skipped_at IS NULL AND cancelled_at IS NOT NULL AND no_show_at IS NULL AND assigned_operator_id IS NULL)
    OR (status = 'NO_SHOW' AND called_at IS NOT NULL AND started_at IS NULL AND completed_at IS NULL AND skipped_at IS NULL AND cancelled_at IS NULL AND no_show_at IS NOT NULL AND assigned_operator_id IS NOT NULL)
);

ALTER TABLE queue_sequences ADD COLUMN queue_id UUID;
UPDATE queue_sequences SET queue_id = service_id;
ALTER TABLE queue_sequences ALTER COLUMN queue_id SET NOT NULL;
ALTER TABLE queue_sequences DROP CONSTRAINT queue_sequences_pkey;
ALTER TABLE queue_sequences DROP CONSTRAINT queue_sequences_branch_id_service_id_fkey;
ALTER TABLE queue_sequences ADD CONSTRAINT queue_sequences_branch_queue_fkey
    FOREIGN KEY (branch_id, queue_id) REFERENCES service_queues(branch_id, id) ON DELETE RESTRICT;
ALTER TABLE queue_sequences ADD CONSTRAINT queue_sequences_branch_service_fkey
    FOREIGN KEY (branch_id, service_id) REFERENCES services(branch_id, id) ON DELETE RESTRICT;
ALTER TABLE queue_sequences ADD PRIMARY KEY (branch_id, queue_id, business_date);

ALTER TABLE tickets DROP CONSTRAINT tickets_branch_id_service_id_business_date_ticket_number_key;
ALTER TABLE tickets ADD CONSTRAINT tickets_branch_queue_business_ticket_unique
    UNIQUE (branch_id, queue_id, business_date, ticket_number);
DROP INDEX tickets_one_active_customer_per_queue;
CREATE UNIQUE INDEX tickets_one_active_customer_per_queue
    ON tickets (customer_id, branch_id, queue_id, business_date)
    WHERE status IN ('WAITING', 'PENDING', 'OPERATING');
CREATE INDEX tickets_queue_order_idx_v2
    ON tickets (branch_id, queue_id, business_date, status, joined_at, id);

CREATE TABLE service_form_fields (
    id UUID PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5),
    field_type TEXT NOT NULL CHECK (field_type IN ('single_select', 'short_text')),
    label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
    required BOOLEAN NOT NULL DEFAULT false,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (service_id, id),
    UNIQUE (service_id, position),
    CHECK (jsonb_typeof(options) = 'array'),
    CHECK ((field_type = 'single_select' AND jsonb_array_length(options) BETWEEN 1 AND 12)
        OR (field_type = 'short_text' AND jsonb_array_length(options) = 0))
);

CREATE TABLE ticket_events (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_events_ticket_time_idx ON ticket_events (ticket_id, occurred_at, id);

INSERT INTO ticket_events (id, ticket_id, from_status, to_status, actor_id, occurred_at)
SELECT md5(t.id::text || ':created')::uuid, t.id, NULL, 'WAITING', t.customer_id, t.joined_at FROM tickets t;

CREATE TABLE ticket_documents (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name TEXT NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 180),
    media_type TEXT NOT NULL CHECK (media_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    byte_size BIGINT NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
    sha256 CHAR(64) NOT NULL,
    content BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_documents_ticket_idx ON ticket_documents (ticket_id, created_at, id);

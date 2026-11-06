CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'OPERATOR')),
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    login_identifier TEXT NOT NULL CHECK (length(trim(login_identifier)) > 0),
    credential_hash TEXT NOT NULL CHECK (length(credential_hash) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX app_users_login_identifier_unique
    ON app_users (lower(trim(login_identifier)));

CREATE TABLE branches (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE services (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, id)
);

CREATE TABLE operator_services (
    operator_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (operator_id, service_id)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CHECK (expires_at > created_at),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE queue_sequences (
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL,
    business_date DATE NOT NULL,
    last_issued BIGINT NOT NULL DEFAULT 0 CHECK (last_issued >= 0),
    PRIMARY KEY (branch_id, service_id, business_date),
    FOREIGN KEY (branch_id, service_id) REFERENCES services(branch_id, id) ON DELETE RESTRICT
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL,
    business_date DATE NOT NULL,
    ticket_number TEXT NOT NULL CHECK (length(trim(ticket_number)) > 0),
    customer_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    assigned_operator_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('WAITING', 'PENDING', 'OPERATING', 'COMPLETED', 'SKIPPED')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    called_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ,
    UNIQUE (branch_id, service_id, business_date, ticket_number),
    FOREIGN KEY (branch_id, service_id) REFERENCES services(branch_id, id) ON DELETE RESTRICT,
    CHECK (
        (status = 'WAITING' AND called_at IS NULL AND started_at IS NULL AND completed_at IS NULL AND skipped_at IS NULL AND assigned_operator_id IS NULL)
        OR (status = 'PENDING' AND called_at IS NOT NULL AND started_at IS NULL AND completed_at IS NULL AND skipped_at IS NULL AND assigned_operator_id IS NOT NULL)
        OR (status = 'OPERATING' AND called_at IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NULL AND skipped_at IS NULL AND assigned_operator_id IS NOT NULL)
        OR (status = 'COMPLETED' AND called_at IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NOT NULL AND skipped_at IS NULL AND assigned_operator_id IS NOT NULL)
        OR (status = 'SKIPPED' AND called_at IS NOT NULL AND started_at IS NULL AND completed_at IS NULL AND skipped_at IS NOT NULL AND assigned_operator_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX tickets_one_active_customer_per_queue
    ON tickets (customer_id, branch_id, service_id, business_date)
    WHERE status IN ('WAITING', 'PENDING', 'OPERATING');

CREATE UNIQUE INDEX tickets_one_active_ticket_per_operator
    ON tickets (assigned_operator_id)
    WHERE assigned_operator_id IS NOT NULL AND status IN ('PENDING', 'OPERATING');

CREATE INDEX tickets_queue_order_idx
    ON tickets (branch_id, service_id, business_date, status, joined_at, id);

CREATE INDEX tickets_customer_idx ON tickets (customer_id, joined_at DESC);

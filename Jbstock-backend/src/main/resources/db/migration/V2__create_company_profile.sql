CREATE TABLE company_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL CHECK (length(name) <= 255),
    address TEXT NOT NULL CHECK (length(address) <= 2000),
    phone TEXT NOT NULL CHECK (length(phone) <= 50),
    email TEXT NOT NULL CHECK (length(email) <= 254),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO company_profile (id, name, address, phone, email)
VALUES (1, '', '', '', '');

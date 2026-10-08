CREATE TABLE company_fiscal_identifier (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL DEFAULT 1 REFERENCES company_profile(id) ON DELETE CASCADE,
    label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 100),
    value TEXT NOT NULL CHECK (length(value) <= 255),
    position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 19),
    UNIQUE (company_id, position)
);

CREATE INDEX idx_company_fiscal_identifier_company
    ON company_fiscal_identifier(company_id, position);

CREATE TABLE application_metadata (
    metadata_key TEXT NOT NULL PRIMARY KEY,
    metadata_value TEXT NOT NULL
);

INSERT INTO application_metadata (metadata_key, metadata_value)
VALUES ('schema_initialized', 'true');
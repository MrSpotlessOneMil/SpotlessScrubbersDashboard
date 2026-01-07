BEGIN;

TRUNCATE messages, calls, jobs, customers, settings RESTART IDENTITY CASCADE;

INSERT INTO customers SELECT * FROM archive.customers_backup;
INSERT INTO jobs SELECT * FROM archive.jobs_backup;
INSERT INTO calls SELECT * FROM archive.calls_backup;
INSERT INTO messages SELECT * FROM archive.messages_backup;
INSERT INTO settings SELECT * FROM archive.settings_backup;

SELECT setval('customers_id_seq', COALESCE((SELECT MAX(id) FROM customers), 1), true);
SELECT setval('jobs_id_seq', COALESCE((SELECT MAX(id) FROM jobs), 1), true);
SELECT setval('calls_id_seq', COALESCE((SELECT MAX(id) FROM calls), 1), true);
SELECT setval('messages_id_seq', COALESCE((SELECT MAX(id) FROM messages), 1), true);
SELECT setval('settings_id_seq', COALESCE((SELECT MAX(id) FROM settings), 1), true);

COMMIT;

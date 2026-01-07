BEGIN;

CREATE SCHEMA IF NOT EXISTS archive;

DROP TABLE IF EXISTS archive.messages_backup;
DROP TABLE IF EXISTS archive.calls_backup;
DROP TABLE IF EXISTS archive.jobs_backup;
DROP TABLE IF EXISTS archive.customers_backup;
DROP TABLE IF EXISTS archive.settings_backup;

CREATE TABLE archive.customers_backup AS TABLE customers;
CREATE TABLE archive.jobs_backup AS TABLE jobs;
CREATE TABLE archive.calls_backup AS TABLE calls;
CREATE TABLE archive.messages_backup AS TABLE messages;
CREATE TABLE archive.settings_backup AS TABLE settings;

COMMIT;

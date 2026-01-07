-- ========================================
-- IMPORT CUSTOMERS
-- ========================================

INSERT INTO customers (id, phone_number, name, email) VALUES (1, '13234827222', 'Aza Tagavitian', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (2, '16268414693', 'Miguel Cabral', 'Mikeybear89@gmail.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (3, '19162209500', 'Robin Barca', 'Rbarca711@gmail.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (4, '13104883201', 'Cynthia Shaw', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (5, '18183379335', 'Harper Cott', 'harperjayne@icloud.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (6, '14157204580', 'Jasper Grenager', 'jaspergrenager@gmail.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (7, '15622947422', 'Kevin Tennick', 'gooden817@gmail.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (8, '19132634352', 'Alex Sharp', 'Alexander.Oliver.Sharp@gmail.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (9, '14242755847', 'Dominic Lutz', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (10, '13238152016', 'Narissa Matini', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (11, '15622055246', 'Lanaya Short', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (12, '15105757155', 'James Smith', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (13, '13109038988', 'Danny Matian', 'Sogolmatian@gmail.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (14, '16465815092', 'Kong Kung', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (15, '18566939475', 'Tyrone Underwood', 'Tunderwood1995@gmail.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (16, '16319531824', 'Tamara Lamorte', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (17, '18057969247', 'Ryan Schroeder', 'Ryantschroeder@hotmail.com');
INSERT INTO customers (id, phone_number, name, email) VALUES (18, '18016160887', 'Tisha Anderson', NULL);
INSERT INTO customers (id, phone_number, name, email) VALUES (19, '13105005333', 'Tony Hogan', 'tonyhogan224u@gmail.com');

-- ========================================
-- INSERT JOBS
-- ========================================

INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (1, 'Deep clean', '2025-11-24', 'scheduled', NULL, false, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (2, 'Deep clean', '2025-12-05', 'scheduled', ARRAY['Telma'], true, true, 287.50, 6.5);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (3, 'Standard', '2025-12-05', 'scheduled', NULL, true, true, 206.00, 1.5);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (4, 'Standard', '2025-12-10', 'scheduled', NULL, false, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (5, 'Standard', '2025-11-30', 'scheduled', NULL, true, true, 263.00, 5.5);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (6, 'Deep Clean with Exterior window cleaning', '2025-12-07', 'scheduled', ARRAY['TBD'], true, false, 855.00, 6.5);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (7, 'Deep cleaning', '2025-12-04', 'scheduled', NULL, true, false, 225.00, 4.5);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (8, 'Standard cleaning', '2025-12-06', 'scheduled', NULL, true, true, 263.00, 5.5);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (9, 'Deep cleaning', '2025-12-09', 'scheduled', ARRAY['Unassigned'], true, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (10, 'Move-In', '2025-12-09', 'scheduled', NULL, false, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (11, 'Airbnb', '2025-12-13', 'scheduled', NULL, false, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (12, 'Airbnb', '2025-12-13', 'scheduled', NULL, false, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (13, 'Move-In', '2025-12-13', 'scheduled', ARRAY['TBD'], true, true, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (14, 'Deep clean', '2025-12-16', 'scheduled', NULL, false, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (15, 'Deep clean', '2025-12-14', 'scheduled', ARRAY['sonia gil'], true, false, 225.00, 4.5);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (16, 'Deep clean', '2025-12-16', 'scheduled', NULL, false, false, 575.00, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (17, 'Deep clean with Interior window cleaning', '2025-12-17', 'scheduled', ARRAY['Rokia'], true, true, 475.00, 6.5);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (18, 'Standard and Deep Cleaning', '2025-12-26', 'scheduled', NULL, false, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (19, 'Deep Clean', '2025-12-15', 'scheduled', NULL, false, false, NULL, NULL);
INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (9, 'Deep cleaning', '2025-12-18', 'scheduled', NULL, false, false, 425.00, NULL);

-- ========================================
-- RESET SEQUENCES (IMPORTANT!)
-- ========================================

SELECT setval('customers_id_seq', 19);
SELECT setval('jobs_id_seq', (SELECT MAX(id) FROM jobs));

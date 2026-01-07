BEGIN;

TRUNCATE messages, calls, jobs, customers, settings RESTART IDENTITY CASCADE;

INSERT INTO settings (spreadsheet_id, hourly_rate, cost_per_job)
VALUES ('', 25.00, 15.00);

INSERT INTO customers (phone_number, name, email) VALUES
('3105550101', 'Jordan Lee', 'jordan.lee@example.com'),
('3105550102', 'Mia Torres', 'mia.torres@example.com'),
('3105550103', 'Chris Patel', NULL),
('3105550104', 'Alexis Green', 'alexis.green@example.com'),
('3105550105', 'Devon Reed', NULL),
('3105550106', 'Dana Brooks', 'dana.brooks@example.com'),
('3105550107', 'Morgan Cruz', NULL),
('3105550108', 'Riley Knight', 'riley.knight@example.com'),
('3105550109', 'Parker Fox', NULL),
('3105550110', 'Taylor Chen', 'taylor.chen@example.com'),
('3105550111', 'Casey Wu', 'casey.wu@example.com'),
('3105550112', 'Jamie Hall', 'jamie.hall@example.com');

INSERT INTO jobs (
  customer_id,
  title,
  date,
  scheduled_at,
  status,
  cleaning_team,
  booked,
  quoted,
  paid,
  price,
  hours,
  created_at
) VALUES
(1, 'Deep Clean', CURRENT_DATE - 14, (CURRENT_DATE - 14) + TIME '09:00', 'completed', ARRAY['Sonia', 'Rokia'], true, true, true, 420.00, 4.5, NOW() - INTERVAL '16 days'),
(1, 'Standard Clean', CURRENT_DATE - 2, (CURRENT_DATE - 2) + TIME '13:30', 'completed', ARRAY['Sonia'], true, true, true, 190.00, 2.5, NOW() - INTERVAL '5 days'),
(2, 'Move-Out Clean', CURRENT_DATE + 3, (CURRENT_DATE + 3) + TIME '10:00', 'scheduled', ARRAY['Telma', 'Rosa'], true, true, false, 520.00, 5.0, NOW() - INTERVAL '2 days'),
(3, 'Deep Clean', CURRENT_DATE + 1, (CURRENT_DATE + 1) + TIME '14:00', 'scheduled', NULL, true, true, false, 260.00, 3.0, NOW() - INTERVAL '3 days'),
(4, 'Quote Requested', CURRENT_DATE + 5, (CURRENT_DATE + 5) + TIME '11:00', 'scheduled', NULL, false, false, false, NULL, NULL, NOW() - INTERVAL '1 days'),
(5, 'Initial Walkthrough', CURRENT_DATE + 7, (CURRENT_DATE + 7) + TIME '09:30', 'scheduled', NULL, false, false, false, NULL, NULL, NOW() - INTERVAL '1 days'),
(6, 'Weekly Maintenance', CURRENT_DATE + 2, (CURRENT_DATE + 2) + TIME '08:30', 'scheduled', ARRAY['Maria', 'Luis'], true, true, false, 150.00, 2.0, NOW() - INTERVAL '4 days'),
(7, 'Deep Clean', CURRENT_DATE - 6, (CURRENT_DATE - 6) + TIME '12:00', 'completed', ARRAY['Rokia'], true, true, true, 360.00, 4.0, NOW() - INTERVAL '9 days'),
(8, 'Standard Clean', CURRENT_DATE + 4, (CURRENT_DATE + 4) + TIME '15:00', 'scheduled', ARRAY['Sonia'], true, true, false, 180.00, 2.0, NOW() - INTERVAL '1 days'),
(8, 'Deep Clean', CURRENT_DATE - 20, (CURRENT_DATE - 20) + TIME '09:00', 'completed', ARRAY['Sonia', 'Rosa'], true, true, true, 480.00, 5.0, NOW() - INTERVAL '22 days'),
(9, 'Lead Intake', CURRENT_DATE + 6, (CURRENT_DATE + 6) + TIME '10:30', 'scheduled', NULL, false, false, false, NULL, NULL, NOW() - INTERVAL '2 days'),
(10, 'Standard Clean', CURRENT_DATE + 1, (CURRENT_DATE + 1) + TIME '16:00', 'scheduled', NULL, true, true, false, 210.00, 2.5, NOW() - INTERVAL '2 days'),
(11, 'Deep Clean', CURRENT_DATE - 1, (CURRENT_DATE - 1) + TIME '08:00', 'scheduled', ARRAY['Maria'], true, true, true, 310.00, 3.5, NOW() - INTERVAL '3 days'),
(11, 'Follow-up Clean', CURRENT_DATE + 8, (CURRENT_DATE + 8) + TIME '13:00', 'scheduled', ARRAY['Maria'], true, true, false, 170.00, 2.0, NOW() - INTERVAL '1 days'),
(12, 'Standard Clean', CURRENT_DATE + 10, (CURRENT_DATE + 10) + TIME '09:00', 'scheduled', NULL, false, false, false, NULL, NULL, NOW() - INTERVAL '1 days'),
(2, 'Window Add-On', CURRENT_DATE + 3, (CURRENT_DATE + 3) + TIME '10:00', 'scheduled', ARRAY['Telma', 'Rosa'], true, true, false, 80.00, 1.0, NOW() - INTERVAL '2 days');

INSERT INTO calls (
  customer_id,
  date,
  duration_seconds,
  transcript,
  audio_url,
  outcome,
  created_at
) VALUES
(4, NOW() - INTERVAL '2 days', 240, 'Customer asked about deep clean pricing.', NULL, 'not_booked', NOW() - INTERVAL '2 days'),
(5, NOW() - INTERVAL '1 days', 180, 'Requested walkthrough details.', NULL, 'voicemail', NOW() - INTERVAL '1 days'),
(9, NOW() - INTERVAL '3 days', 300, 'Initial lead intake call.', NULL, 'not_booked', NOW() - INTERVAL '3 days'),
(2, NOW() - INTERVAL '2 days', 420, 'Confirmed move-out appointment.', NULL, 'booked', NOW() - INTERVAL '2 days'),
(6, NOW() - INTERVAL '5 days', 260, 'Confirmed weekly schedule.', NULL, 'booked', NOW() - INTERVAL '5 days'),
(1, NOW() - INTERVAL '15 days', 310, 'Deep clean walkthrough notes.', NULL, 'booked', NOW() - INTERVAL '15 days'),
(8, NOW() - INTERVAL '21 days', 200, 'Requested deep clean quote.', NULL, 'booked', NOW() - INTERVAL '21 days'),
(11, NOW() - INTERVAL '3 days', 180, 'Confirmed deep clean timing.', NULL, 'booked', NOW() - INTERVAL '3 days');

INSERT INTO messages (
  customer_id,
  call_id,
  role,
  content,
  timestamp,
  message_type
) VALUES
(1, NULL, 'client', 'Thanks for the quote! Can we do Thursday?', NOW() - INTERVAL '16 days', 'text'),
(1, NULL, 'business', 'Booked you for Thursday at 9am. See you then!', NOW() - INTERVAL '16 days', 'text'),
(2, NULL, 'client', 'Move-out clean confirmed.', NOW() - INTERVAL '2 days', 'text'),
(2, NULL, 'business', 'We have you scheduled for 10:00am. Team assigned.', NOW() - INTERVAL '2 days', 'text'),
(3, NULL, 'client', 'Please send the invoice to my email.', NOW() - INTERVAL '3 days', 'text'),
(4, NULL, 'client', 'I am still deciding on the service type.', NOW() - INTERVAL '1 days', 'text'),
(5, NULL, 'business', 'We can do an in-person walkthrough next week.', NOW() - INTERVAL '1 days', 'text'),
(6, NULL, 'client', 'Weekly schedule works. Thanks!', NOW() - INTERVAL '5 days', 'text'),
(7, NULL, 'business', 'Job completed. Thank you!', NOW() - INTERVAL '6 days', 'text'),
(8, NULL, 'client', 'Can we add windows to this clean?', NOW() - INTERVAL '2 days', 'text'),
(8, NULL, 'business', 'Added window add-on. Updated total attached.', NOW() - INTERVAL '2 days', 'text'),
(9, NULL, 'client', 'Just getting a quote for now.', NOW() - INTERVAL '3 days', 'text'),
(10, NULL, 'business', 'Your clean is booked for Friday at 4pm.', NOW() - INTERVAL '2 days', 'text'),
(11, NULL, 'business', 'Reminder: cleaner arrives at 8am tomorrow.', NOW() - INTERVAL '2 days', 'text'),
(11, NULL, 'client', 'Perfect, see you then.', NOW() - INTERVAL '2 days', 'text'),
(12, NULL, 'client', 'Please call me to confirm details.', NOW() - INTERVAL '1 days', 'text');

COMMIT;

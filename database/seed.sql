SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM appointment_events;
DELETE FROM appointment_slots;
DELETE FROM appointments;
DELETE FROM blocks;
DELETE FROM working_hours;
DELETE FROM barber_services;
DELETE FROM services;
DELETE FROM barbers;
DELETE FROM settings;
DELETE FROM login_attempts;

ALTER TABLE appointment_events AUTO_INCREMENT = 1;
ALTER TABLE appointment_slots AUTO_INCREMENT = 1;
ALTER TABLE appointments AUTO_INCREMENT = 1;
ALTER TABLE blocks AUTO_INCREMENT = 1;
ALTER TABLE working_hours AUTO_INCREMENT = 1;
ALTER TABLE services AUTO_INCREMENT = 1;
ALTER TABLE barbers AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO settings (setting_key, setting_value) VALUES
('business_name', 'Barbería Don Filo'),
('business_short_name', 'Don Filo'),
('business_code_prefix', 'DF'),
('tagline', 'Cortes con carácter, estilo de barrio'),
('hero_title', 'Tu mejor versión empieza con un buen corte'),
('hero_subtitle', 'Tradición, precisión y estilo en el corazón de Bogotá. Reserva online las 24 horas y llega directo a tu silla.'),
('hero_cta', 'Reservar cita'),
('about_title', 'Más que un corte, una experiencia'),
('about_text', 'En Don Filo cuidamos cada detalle: el filo de la navaja, la conversación, el aroma del after shave y ese rato en el que solo te tienes que preocupar por verte bien. Tres barberos, un mismo estándar.'),
('services_title', 'Servicios'),
('services_subtitle', 'Elige el servicio, nosotros ponemos el oficio. Precios claros y tiempos reales.'),
('team_title', 'Nuestro equipo'),
('team_subtitle', 'Barberos que dominan el oficio y conocen tu estilo.'),
('gallery_title', 'Galería'),
('gallery_subtitle', 'Algunos trabajos que salen de nuestras sillas.'),
('hours_title', 'Horarios de atención'),
('hours_subtitle', 'Reserva online 24/7. La confirmación llega al instante.'),
('location_title', 'Ubicación'),
('location_subtitle', 'Estamos en el corazón de Bogotá. Llega fácil y reserva sin filas.'),
('contact_title', 'Contacto'),
('contact_subtitle', 'Escríbenos por WhatsApp o síguenos en redes.'),
('footer_text', 'Barbería Don Filo. Hecho con oficio en Bogotá.'),
('address', 'Cra 10 # 20-30, Local 2, Bogotá'),
('address_locality', 'Bogotá'),
('address_region', 'Bogotá D.C.'),
('address_country', 'CO'),
('phone', '+57 300 000 0000'),
('whatsapp', '573000000000'),
('email', 'hola@barberiadonfilo.com'),
('instagram_url', 'https://www.instagram.com/'),
('facebook_url', ''),
('tiktok_url', ''),
('map_embed_url', 'https://www.google.com/maps?q=Cra+10+%23+20-30,+Bogot%C3%A1,+Colombia&output=embed'),
('map_directions_url', 'https://www.google.com/maps/dir/?api=1&destination=Cra+10+%23+20-30,+Bogot%C3%A1,+Colombia'),
('whatsapp_message', 'Hola, quiero reservar una cita en Barbería Don Filo.'),
('site_url', 'http://localhost:3000'),
('seo_title', 'Barbería Don Filo | Reserva tu cita en Bogotá'),
('seo_description', 'Cortes clásicos, barba, cejas y tratamientos capilares en Bogotá. Reserva online en Barbería Don Filo y elige a tu barbero.'),
('og_image_url', '/img/og-image.svg'),
('price_range', '$$'),
('currency', 'COP'),
('color_primary', '#141414'),
('color_secondary', '#c9a227'),
('color_accent', '#f3ead7'),
('color_background', '#0f0f0f'),
('color_surface', '#1f1f1f'),
('color_text', '#f5f2ec'),
('color_muted', '#b9b3a7'),
('font_heading', 'Georgia, ''Times New Roman'', serif'),
('font_body', 'system-ui, -apple-system, ''Segoe UI'', Roboto, Arial, sans-serif'),
('business_hours', '[{"weekday":0,"closed":true,"start":"09:00","end":"19:00"},{"weekday":1,"closed":false,"start":"09:00","end":"19:00"},{"weekday":2,"closed":false,"start":"09:00","end":"19:00"},{"weekday":3,"closed":false,"start":"09:00","end":"19:00"},{"weekday":4,"closed":false,"start":"09:00","end":"19:00"},{"weekday":5,"closed":false,"start":"09:00","end":"19:00"},{"weekday":6,"closed":false,"start":"09:00","end":"19:00"}]'),
('gallery_images', '[{"src":"/img/gallery-1.svg","alt":"Corte clásico con degradado"},{"src":"/img/gallery-2.svg","alt":"Perfilado de barba"},{"src":"/img/gallery-3.svg","alt":"Corte texturizado"},{"src":"/img/gallery-4.svg","alt":"Detalle de barba y navaja"},{"src":"/img/gallery-5.svg","alt":"Estilo clásico con raya"},{"src":"/img/gallery-6.svg","alt":"Acabado con cera mate"}]'),
('payment_cash_enabled', '1'),
('payment_transfer_enabled', '1'),
('payment_cash_label', 'Pagar en el local'),
('payment_transfer_label', 'Transferencia (Nequi / Daviplata / Bancolombia)'),
('transfer_bank_name', 'Bancolombia'),
('transfer_account_type', 'Ahorros'),
('transfer_account_number', '000 000 000 00'),
('transfer_account_holder', 'Barbería Don Filo'),
('transfer_nequi', '300 000 0000'),
('transfer_daviplata', '300 000 0000'),
('transfer_instructions', 'Realiza la transferencia y envía el comprobante por WhatsApp indicando tu código de reserva. Tu cita queda confirmada al recibir el pago.'),
('payment_note', 'En esta versión el pago se confirma manualmente en el local o por transferencia.'),
('slot_interval_minutes', '30'),
('min_advance_minutes', '60'),
('max_advance_days', '30'),
('cancel_min_hours', '2'),
('booking_success_message', 'Tu cita quedó confirmada. Guarda tu código para consultarla o cancelarla.'),
('booking_terms', 'Puedes cancelar sin costo hasta 2 horas antes de la cita. Si no puedes asistir, avísanos por WhatsApp.');

INSERT INTO barbers (id, name, photo_url, bio, active, sort_order) VALUES
(1, 'Filo', '/img/barber-filo.svg', 'Fundador de la casa. Especialista en cortes clásicos, fades limpios y barba con navaja.', 1, 1),
(2, 'Camilo', '/img/barber-camilo.svg', 'Le gusta el detalle: texturas, diseños y tratamientos capilares. Mano firme y conversación larga.', 1, 2),
(3, 'Andrés', '/img/barber-andres.svg', 'Rápido, preciso y buen consejero. Ideal para cortes de niño y perfiles que aguantan la semana.', 1, 3);

INSERT INTO services (id, name, description, price, duration_minutes, active, sort_order) VALUES
(1, 'Corte clásico', 'Corte a tijera y máquina, lavado y peinado final.', 25000, 30, 1, 1),
(2, 'Corte + barba', 'Corte completo más perfilado y arreglo de barba con navaja.', 40000, 60, 1, 2),
(3, 'Barba', 'Perfilado, recorte y acabado con aceite y bálsamo.', 18000, 30, 1, 3),
(4, 'Corte niño', 'Corte para los más pequeños, con paciencia y buen trato.', 20000, 30, 1, 4),
(5, 'Perfilado de cejas', 'Diseño y perfilado de cejas con cera y pinza.', 8000, 30, 1, 5),
(6, 'Tratamiento capilar', 'Limpieza profunda, mascarilla y masaje capilar.', 35000, 60, 1, 6);

INSERT INTO barber_services (barber_id, service_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 6),
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5);

INSERT INTO working_hours (barber_id, weekday, start_time, end_time, break_start, break_end) VALUES
(1, 1, '09:00:00', '19:00:00', '13:00:00', '14:00:00'),
(1, 2, '09:00:00', '19:00:00', '13:00:00', '14:00:00'),
(1, 3, '09:00:00', '19:00:00', '13:00:00', '14:00:00'),
(1, 4, '09:00:00', '19:00:00', '13:00:00', '14:00:00'),
(1, 5, '09:00:00', '19:00:00', '13:00:00', '14:00:00'),
(1, 6, '09:00:00', '19:00:00', '13:00:00', '14:00:00'),
(2, 0, '10:00:00', '20:00:00', '14:00:00', '15:00:00'),
(2, 2, '10:00:00', '20:00:00', '14:00:00', '15:00:00'),
(2, 3, '10:00:00', '20:00:00', '14:00:00', '15:00:00'),
(2, 4, '10:00:00', '20:00:00', '14:00:00', '15:00:00'),
(2, 5, '10:00:00', '20:00:00', '14:00:00', '15:00:00'),
(2, 6, '10:00:00', '20:00:00', '14:00:00', '15:00:00'),
(3, 1, '09:00:00', '17:00:00', NULL, NULL),
(3, 2, '09:00:00', '17:00:00', NULL, NULL),
(3, 3, '09:00:00', '17:00:00', NULL, NULL),
(3, 4, '09:00:00', '17:00:00', NULL, NULL),
(3, 5, '09:00:00', '17:00:00', NULL, NULL);

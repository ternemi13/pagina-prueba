# Notas del proyecto

Decisiones tomadas durante el desarrollo y pendientes para una segunda versión.

## Decisiones técnicas

- **CommonJS en todo el backend.** Sin TypeScript ni paso de build. El frontend es HTML, CSS y JavaScript vanilla servido como estático.
- **Fechas en hora local del negocio.** Las citas y bloqueos se guardan como `DATETIME` en hora de `America/Bogota` (sin horario de verano). El servidor fija `TZ` y usa dayjs con `utc` y `timezone`. No se guardan timestamps UTC para evitar conversiones ambiguas al mostrar la agenda.
- **Una sola base de datos por instalación.** La configuración del negocio vive en `settings`; no hay multi-tenant. Para otro cliente se crea otra base y se cambian los datos desde el panel.
- **Sesiones en MySQL.** `express-session` con `express-mysql-session`. La tabla `sessions` la crea `schema.sql` (`createDatabaseTable: false`), no el store.
- **CSRF con `csrf-csrf`.** El token se entrega en `GET /api/auth/csrf` y se envía en el encabezado `x-csrf-token`. La cookie es `barberia.csrf` en desarrollo y `__Host-barberia.csrf` en producción. El cliente vuelve a pedir el token cuando el servidor responde con error CSRF.
- **Cookies seguras en producción.** `httpOnly`, `sameSite=lax` y `secure` cuando `NODE_ENV=production`. La app confía en el primer proxy (`trust proxy`) para funcionar detrás de HTTPS en Hostinger.
- **Contraseñas con bcryptjs (12 rondas).** No hay credenciales fijas en el código. El primer administrador se crea con `npm run admin:create`.
- **Bloqueo de login por usuario e IP.** Se registran los intentos en `login_attempts`: 5 fallos en 15 minutos bloquean 15 minutos. Los límites de rate limiting se amplían en `NODE_ENV=test` para no interferir con las pruebas.
- **Reserva transaccional.** Crear cita abre una transacción, bloquea la fila del barbero con `SELECT ... FOR UPDATE`, revalida horario, bloqueos, reglas y slots, inserta la cita y luego una fila por slot en `appointment_slots`. La llave primaria `(barber_id, slot_start)` es la última defensa contra la doble reserva: si falla, se hace rollback y se responde 409.
- **"Cualquiera disponible".** Se prueban los barberos candidatos en orden dentro de la misma transacción hasta que uno pueda reservar. Si ninguno puede, se responde 409.
- **Bloqueos con vista previa.** Antes de crear un bloqueo se calculan las citas afectadas. El admin puede cancelarlas con motivo o abortar la creación; nunca se cancelan en silencio. Un bloqueo con `barber_id NULL` aplica a todo el negocio.
- **Calendario con un solo endpoint.** `GET /api/admin/calendar?start=...&end=...` devuelve citas y bloqueos del rango. Las vistas día, semana y mes del panel reutilizan ese endpoint cambiando el rango y el filtro de barbero.
- **Pagos aislados.** `src/services/payments` centraliza métodos, validación, instrucciones de transferencia y etiquetas. No hay pasarela online en esta versión; el admin marca las citas como pagadas manualmente.
- **Datos de demo relativos.** `scripts/seed.js` genera 12 citas y 2 bloqueos con fechas relativas a la semana actual, además de cargar `database/seed.sql` con barberos, servicios, horarios y settings. El admin no viene en el seed.
- **Seed protegido.** Si la base ya tiene citas, `npm run db:seed` se detiene para no borrar datos reales. Solo continúa con `ALLOW_DESTRUCTIVE_SEED=1`; `npm run db:reset` sigue siendo destructivo y debe usarse únicamente en desarrollo.
- **Pruebas con base separada.** `tests/helpers.js` fuerza `NODE_ENV=test` y `DB_NAME=barberia_test` (configurable con `TEST_DB_NAME`) antes de cargar la configuración. Cada archivo recrea esa base y carga el seed. Si MySQL no está encendido, las pruebas de integración se omiten con un mensaje claro; la prueba de concurrencia termina con error.
- **Script de concurrencia autocontenido.** `scripts/test-concurrency.js` prepara la base de prueba, levanta la app en un puerto efímero, obtiene cookies y token CSRF, y lanza las solicitudes en paralelo con `fetch`. No requiere el servidor de desarrollo encendido.

## Limitaciones conocidas

- No hay envío de correos ni mensajes automáticos de WhatsApp. Los enlaces de WhatsApp abren la aplicación con el mensaje prellenado.
- No hay pasarela de pagos online: solo pago en el local o transferencia con comprobante manual.
- Los bloqueos recurrentes simples quedaron como mejora opcional; la versión actual permite rangos de horas, días completos y rangos de días.
- La zona horaria es fija por configuración. Cambiarla requiere ajustar `TZ` y las fechas ya guardadas.
- Las pruebas de integración y concurrencia requieren MySQL local encendido; no se ejecutan en un entorno sin base de datos.
- El panel está pensado para un negocio por instalación; no incluye sucursales múltiples.

## Pendientes para una segunda versión

- Pasarela de pagos (Wompi o Mercado Pago) usando la interfaz de `src/services/payments` y webhooks para confirmar el pago.
- Recordatorios automáticos por WhatsApp o correo (por ejemplo, 24 horas antes) y confirmación de asistencia.
- Reseñas y calificaciones de clientes después de la cita.
- Bloqueos recurrentes configurables (todos los lunes de 13:00 a 14:00, vacaciones anuales, etc.).
- Multi-sucursal y multi-zona horaria.
- Exportación de reportes contables más completos y conciliación de pagos.
- Notificaciones internas al admin cuando entra una reserva o cancelación.

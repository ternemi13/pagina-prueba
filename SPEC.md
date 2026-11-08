# SPEC: Sistema web para barbería con agendamiento de citas y panel de administración

## 0. Cómo debes trabajar (léelo primero)
1. Lee todo este spec y NO escribas código todavía. Primero responde con un plan por fases y las dudas que tengas. Espera mi aprobación.
2. Trabaja por fases (sección 14). Al terminar cada una, ejecuta las pruebas y dime cómo verificarla manualmente.
3. Todo se desarrolla y prueba en LOCAL. No dependas de ningún servicio externo de pago.
4. Si una decisión no está en el spec, elige la opción más simple y robusta y anótala en NOTES.md.
5. Idioma: interfaz y textos en español. Código, tablas, columnas, variables y commits en inglés.

## 1. Caso de uso (ficticio)
Negocio: "Barbería Don Filo", Bogotá, Colombia.
Dirección ficticia: Cra 10 # 20-30, Local 2, Bogotá. Teléfono/WhatsApp ficticio: +57 300 000 0000.
Horario general: lunes a sábado 9:00-19:00, domingo cerrado. Zona horaria: America/Bogota. Moneda: COP.
Equipo: 3 barberos (Filo, Camilo, Andrés), cada uno con horario propio.
Necesidad: que los clientes reserven online las 24 horas, y que el dueño controle citas, calendario y datos desde un panel con usuario y clave.
El sistema debe ser REUTILIZABLE: cada dato del negocio (nombre, textos, colores, dirección, mapa, redes, métodos de pago, reglas) vive en la base de datos (tabla settings), no escrito a mano en el HTML. Así puedo vender el mismo sistema a otras barberías y salones cambiando solo datos.

## 2. Stack obligatorio
- Node.js (LTS) con Express. JavaScript (CommonJS o ESM, elige uno y sé consistente). Sin TypeScript, sin paso de build.
- MySQL/MariaDB con mysql2 (pool y consultas preparadas SIEMPRE).
- Frontend: HTML, CSS y JavaScript vanilla servidos como archivos estáticos por Express. Sin frameworks de frontend ni compilación. Mobile-first.
- Autenticación: express-session con almacén en MySQL (express-mysql-session o equivalente), bcryptjs para hashear contraseñas (evita dependencias nativas que den problemas en el hosting).
- Seguridad: helmet, express-rate-limit, protección CSRF con una librería mantenida (csurf está deprecado; usa csrf-csrf o equivalente), validación de entrada con zod.
- Fechas: dayjs con plugins utc y timezone. Zona fija America/Bogota (sin horario de verano). Guarda las fechas de citas como DATETIME en hora local del negocio y documenta esta decisión.
- Configuración por variables de entorno en .env (con .env.example y .env en .gitignore): DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, SESSION_SECRET, PORT, NODE_ENV, TZ.
- Dependencias mínimas y bien mantenidas. Evita paquetes con compilación nativa.
- Estructura sugerida:
  /src (server.js, app.js, config, db, routes, controllers, services, middleware, utils)
  /public (sitio público y flujo de reserva: html, css, js, img)
  /admin (panel: html, css, js)
  /database (schema.sql, seed.sql)
  /scripts (init-db, seed, reset-db, create-admin, test-concurrency)
  /tests

## 3. Entorno local (XAMPP)
- Base de datos local: MySQL de XAMPP en localhost:3306, usuario root, SIN contraseña, base de datos "barberia".
- No uses Apache ni PHP de XAMPP. Solo MySQL. La app Node corre en http://localhost:3000.
- Si MySQL no está encendido, la app debe mostrar en consola un mensaje claro en español: "No se pudo conectar a MySQL. Enciende MySQL desde el panel de XAMPP e inténtalo de nuevo." y avisarme a mí también cuando falle un comando por esto.
- Scripts npm obligatorios:
  - npm run db:init  → crea la base de datos si no existe e importa schema.sql
  - npm run db:seed  → carga datos de demo
  - npm run db:reset → borra todo, recrea tablas y carga seed (para empezar de cero al probar)
  - npm run admin:create → crea el primer usuario admin pidiendo usuario y clave por consola
  - npm run dev / npm start → arranca el servidor
  - npm run test:concurrency → prueba de reservas simultáneas (sección 7)
  - npm test → pruebas automáticas

## 4. Sitio público (landing)
Una sola página responsive (mobile-first), rápida y limpia, con estas secciones:
- Hero con nombre, eslogan y botón grande "Reservar cita".
- Servicios con precio y duración.
- Equipo de barberos (foto placeholder y nombre).
- Galería de trabajos (imágenes placeholder).
- Horarios de atención (calculados desde la configuración).
- Ubicación con mapa de Google Maps embebido (URL configurable en settings) y botón "Cómo llegar".
- Contacto: botón de WhatsApp (enlace wa.me con mensaje prellenado), teléfono, redes sociales.
- Footer con datos del negocio.
- SEO básico: title, meta description, Open Graph y JSON-LD tipo LocalBusiness, todo generado desde settings.
- Colores y tipografía mediante variables CSS que se llenan desde settings (color primario, secundario, acento), para cambiar el look por cliente sin tocar el CSS.
- Diseño con identidad de barbería (sobrio, tonos oscuros con un acento), cuidado y profesional. No debe parecer una plantilla genérica.

## 5. Flujo de reserva (cliente)
Pasos con barra de progreso y navegación atrás/adelante sin perder datos:
1. Elegir servicio (muestra precio y duración).
2. Elegir barbero, o "Cualquiera disponible".
3. Elegir fecha (calendario simple; días sin disponibilidad se ven deshabilitados).
4. Elegir hora (solo horas realmente libres, en botones grandes táctiles).
5. Datos del cliente: nombre y teléfono obligatorios; email y notas opcionales.
6. Método de pago: "Pagar en el local" o "Transferencia (Nequi/Daviplata/Bancolombia)". Si elige transferencia, mostrar los datos de la cuenta configurados por el admin y la indicación de enviar comprobante por WhatsApp.
7. Resumen y confirmar.
Después de confirmar:
- Pantalla de éxito con resumen y un código de reserva único y legible (ej. DF-8K3M2), con botón para abrir WhatsApp con los datos de la cita al negocio (opcional para el cliente).
- Consultar cita: el cliente ingresa código + teléfono y puede ver el detalle y cancelarla si faltan más de X horas (configurable, por defecto 2).
- Si eligió "cualquiera disponible", el sistema asigna automáticamente un barbero libre.
- Si la hora fue tomada por otra persona mientras elegía, mostrar un mensaje amable y volver al paso de horas con la lista actualizada.
- Validar en el servidor teléfono (formato colombiano de 10 dígitos, permitir +57), email y longitudes. Nunca confiar en el frontend.

## 6. Disponibilidad y reglas
- Cada barbero tiene su horario semanal propio (días, hora de inicio y fin, pausa de almuerzo opcional), tabla working_hours.
- Cada barbero ofrece solo ciertos servicios (barber_services).
- Intervalo base de slots: 30 minutos (configurable en settings). Las duraciones de servicios son múltiplos del intervalo. Una cita ocupa N slots consecutivos según la duración del servicio.
- Reglas configurables en settings: anticipación mínima para reservar (por defecto 60 min), días máximos hacia adelante (por defecto 30), horas mínimas para que el cliente cancele (por defecto 2).
- Endpoint de disponibilidad: dado servicio, barbero (o "any") y fecha, devuelve solo horas de inicio donde caben todos los slots requeridos: dentro del horario, sin citas existentes, sin bloqueos, sin pasar el cierre, sin horas pasadas del día actual y respetando la anticipación mínima.
- Toda la lógica de disponibilidad vive en un servicio del backend (src/services), con pruebas unitarias.

## 7. PREVENCIÓN DE DOBLE RESERVA (crítico)
- Tabla appointment_slots con PRIMARY KEY (barber_id, slot_start). Cada cita inserta una fila por cada slot que ocupa.
- Crear una cita ocurre dentro de UNA transacción: (1) bloquear la fila del barbero con SELECT ... FOR UPDATE, (2) revalidar horario, bloqueos y reglas en el servidor, (3) insertar la cita, (4) insertar sus slots. Si la inserción de slots falla por llave duplicada, hacer rollback y responder HTTP 409 con mensaje claro ("Esa hora ya fue tomada, elige otra").
- Para "cualquiera disponible": probar barberos candidatos en orden dentro de la transacción hasta lograr reservar; si ninguno puede, responder 409.
- Cancelar o reprogramar una cita borra/actualiza sus slots en la misma transacción, liberando la hora al instante.
- Crear un bloqueo de calendario (sección 8) usa el mismo bloqueo por barbero (FOR UPDATE) para que no se crucen una reserva y un bloqueo simultáneos.
- Debe existir scripts/test-concurrency.js: lanza 30 solicitudes simultáneas para la MISMA hora y barbero y demuestra que exactamente 1 se crea y 29 reciben 409. También prueba concurrencia con "cualquiera disponible" y con barberos distintos (esas sí deben poder coexistir). Muestra el resultado en consola de forma clara.

## 8. Bloqueos de calendario (admin)
- El admin puede bloquear: un día completo, un rango de horas, un rango de días (vacaciones); para un barbero específico o para todo el negocio; con motivo opcional. También bloqueos recurrentes simples (ej. todos los lunes de 13:00 a 14:00) como mejora opcional.
- Los bloqueos se reflejan de inmediato en el flujo público: esas horas dejan de aparecer sin necesidad de recargar el servidor.
- Si el bloqueo cae sobre citas existentes, el panel muestra la lista de citas afectadas y deja elegir: cancelar esas citas (registrando el motivo) o no crear el bloqueo. Nunca cancelar citas en silencio.

## 9. Panel de administración (/admin)
Acceso y seguridad:
- Login con usuario y contraseña. Sesiones con cookie HttpOnly, SameSite=Lax, Secure en producción, regeneración del ID de sesión al iniciar, expiración por inactividad, cierre de sesión.
- Límite de intentos fallidos (5 intentos, bloqueo de 15 minutos por usuario e IP), tabla login_attempts.
- Protección CSRF en todas las acciones que modifican datos.
- Roles: "admin" (dueño, acceso total) y "barber" (solo ve y gestiona sus propias citas).
- NO hay credenciales fijas en el código. El primer admin se crea con npm run admin:create. Opción para cambiar contraseña desde el panel.
- Todas las rutas y endpoints de /admin exigen sesión y rol; sin login redirigen a la pantalla de acceso.
Funciones:
- Dashboard: citas de hoy, próximas citas, totales del día y la semana, ingresos estimados (citas completadas/pagadas).
- Calendario de citas en vista día y semana, filtrable por barbero.
- Lista de citas con filtros (fecha, barbero, estado de cita, estado de pago) y búsqueda por nombre, teléfono o código.
- Detalle de cita: código, cliente (nombre, teléfono, email, notas), servicio, barbero, fecha y hora, precio, método de pago, estado de pago, historial de cambios.
- Acciones: cancelar (con motivo), marcar completada, marcar no asistió, marcar pagada, reprogramar a otra hora libre (revalidando todo), editar notas.
- Crear cita manual (clientes que llaman o llegan sin cita), respetando las mismas reglas y la misma protección anti doble reserva.
- Gestión de servicios (nombre, descripción, precio, duración, activo/inactivo).
- Gestión de barberos (nombre, foto, servicios que ofrece, horario semanal, activo/inactivo).
- Gestión de bloqueos (crear, ver, eliminar).
- Configuración del negocio: datos, textos de la landing, colores, mapa, redes, WhatsApp, métodos de pago y datos de transferencia, reglas de reserva.
- Exportar citas a CSV (con filtros).
- Interfaz del panel usable en celular, porque el dueño lo va a revisar desde el móvil.

## 10. Modelo de datos mínimo
users (id, username, password_hash, role, barber_id nullable, active, must_change_password, created_at),
barbers, services, barber_services, working_hours (barber_id, weekday, start_time, end_time, break_start, break_end),
blocks (id, barber_id nullable = todo el negocio, start_datetime, end_datetime, reason, created_by),
appointments (id, code único, barber_id, service_id, start_datetime, end_datetime, price_at_booking, customer_name, customer_phone, customer_email, notes, status, payment_method, payment_status, cancel_reason, created_at, updated_at),
appointment_slots (barber_id, slot_start, appointment_id) con PRIMARY KEY (barber_id, slot_start),
appointment_events (historial de cambios por cita), settings (clave/valor), login_attempts, sessions (para el almacén de sesiones).
Estados de cita: confirmed, completed, cancelled, no_show. Estados de pago: pending, paid.
Métodos de pago: cash_on_site, bank_transfer. Usa llaves foráneas, índices adecuados y charset utf8mb4.
Guarda price_at_booking para que cambiar precios después no altere citas ya creadas.

## 11. Pagos (preparado para el futuro)
- En esta versión NO hay pasarela online. El admin marca manualmente las citas como pagadas.
- Aísla la lógica de pagos en src/services/payments (interfaz simple) para poder agregar luego una pasarela (Wompi o Mercado Pago) sin reescribir el flujo. No la implementes ahora.

## 12. Seguridad y calidad
- Solo consultas preparadas. Escapar toda salida (anti XSS). Validar y sanear toda entrada en el servidor con zod.
- Rate limiting en endpoints públicos de reserva, consulta y cancelación (por IP) para evitar spam y fuerza bruta del código de reserva.
- Helmet con una política CSP razonable (el mapa de Google Maps embebido debe seguir funcionando).
- Errores: mensajes amigables al usuario, detalle técnico solo en logs del servidor. Middleware global de errores.
- No exponer datos personales de otros clientes en ningún endpoint público.
- Código ordenado, comentado donde la lógica sea no obvia, sin código muerto.
- Pruebas automáticas para: cálculo de disponibilidad, reglas de reserva, creación/cancelación, bloqueos y permisos por rol.
- Accesibilidad básica: etiquetas en formularios, contraste adecuado, navegación por teclado.

## 13. Datos de demo (seed)
- Barberos: Filo (lun-sáb 9:00-19:00, almuerzo 13:00-14:00), Camilo (martes a domingo 10:00-20:00, almuerzo 14:00-15:00), Andrés (lun-vie 9:00-17:00, sin pausa). Cada uno con horario distinto a propósito para probar la lógica.
- Servicios: Corte clásico $25.000 (30 min), Corte + barba $40.000 (60 min), Barba $18.000 (30 min), Corte niño $20.000 (30 min), Perfilado de cejas $8.000 (30 min), Tratamiento capilar $35.000 (60 min).
- 12 citas de ejemplo repartidas en la semana con distintos estados, 2 bloqueos de ejemplo (uno de un barbero, uno de todo el negocio).
- Settings de demo con los datos de "Barbería Don Filo" y colores (negro carbón, dorado envejecido, crema).
- El usuario admin NO viene en el seed; se crea con npm run admin:create.

## 14. Fases
Fase A: estructura del proyecto, configuración, conexión a MySQL, schema.sql, seed.sql y scripts db:*.
Fase B: servicio de disponibilidad y reservas con transacciones, pruebas unitarias y prueba de concurrencia (la parte más crítica; debe quedar verde antes de seguir).
Fase C: API pública y sitio público con el flujo completo de reserva y consulta/cancelación.
Fase D: autenticación y panel de administración con todas sus funciones.
Fase E: pulido visual, accesibilidad, seguridad (revisión propia del código con una lista de verificación), README y guía de despliegue.

## 15. Criterios de aceptación
1. Desde el celular, un cliente completa una reserva de principio a fin.
2. Con 30 solicitudes simultáneas a la misma hora y barbero, solo 1 se crea (test:concurrency).
3. Un bloqueo creado en el admin hace desaparecer esas horas del flujo público al instante.
4. Cancelar una cita libera la hora para otros clientes.
5. Un servicio de 60 minutos solo se ofrece donde hay 2 slots consecutivos libres.
6. "Cualquiera disponible" asigna un barbero libre y nunca produce solapamientos.
7. Un usuario "barber" no puede ver ni modificar citas de otros barberos; el admin sí ve todo.
8. Sin sesión no se accede a /admin ni a sus endpoints.
9. Tras 5 intentos fallidos de login, la cuenta se bloquea temporalmente.
10. npm run db:reset deja el sistema listo de nuevo con datos de demo.
11. Cambiar nombre, colores, servicios y horarios desde el panel cambia el sitio sin tocar código.
12. El README permite a alguien sin experiencia instalarlo local y desplegarlo.

## 16. Entregables y README
- Código completo, funcionando en local con XAMPP.
- README.md con: requisitos, instalación local paso a paso (Node, XAMPP/MySQL, .env, db:init, db:seed, admin:create, dev), cómo correr las pruebas y la prueba de concurrencia.
- Guía de despliegue en Hostinger (Node.js): crear la base MySQL en hPanel, importar schema.sql con phpMyAdmin, configurar variables de entorno (.env o panel de variables), subir el proyecto (ZIP o GitHub), instalar dependencias, definir el comando de inicio y el puerto, activar HTTPS, crear el admin de producción y verificar. Indica claramente qué pasos pueden variar según el plan y que debo confirmarlos en hPanel.
- Sección "Cómo adaptar el sitio a otro cliente": qué cambiar en settings, imágenes y seed.
- NOTES.md con decisiones tomadas y pendientes para una segunda versión (pasarela de pagos, recordatorios por WhatsApp/email, reseñas).
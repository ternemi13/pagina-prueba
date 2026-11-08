# Barbería Don Filo

Sistema web reutilizable para barberías y salones: sitio público con reserva de citas 24/7, consulta y cancelación por código, y panel de administración con calendario, agenda, bloqueos, servicios, barberos y configuración del negocio.

Todo el contenido comercial (nombre, textos, colores, dirección, mapa, redes, WhatsApp, métodos de pago y reglas de reserva) se guarda en la tabla `settings`, por lo que el mismo sistema se puede adaptar a otro cliente sin tocar el código.

## Características principales

- Reserva pública en pasos: servicio, barbero (o "cualquiera disponible"), fecha, hora, datos del cliente, pago y confirmación.
- Disponibilidad calculada en el servidor según horarios, almuerzos, bloqueos, citas, anticipación mínima y días máximos.
- Protección contra doble reserva con transacciones, `SELECT ... FOR UPDATE` y llave primaria en `appointment_slots`.
- Código de reserva único para consultar y cancelar la cita (con límite de horas configurable).
- Panel `/admin` con dashboard, calendario en vistas día, semana y mes, filtros, detalle, cancelación, reprogramación, pago, notas, CSV y gestión completa.
- Roles `admin` y `barber`; el barbero solo ve y gestiona sus propias citas.
- Login con sesiones en MySQL, bcrypt, CSRF, rate limiting, bloqueo tras 5 intentos fallidos y cambio de contraseña desde el panel.
- Base de datos MySQL/MariaDB con consultas preparadas y fechas en hora local de Bogotá.

## Requisitos

- Node.js 20 o superior.
- MySQL 8 o MariaDB 10.4 o superior. En local se recomienda el MySQL de XAMPP.
- npm.

No se necesita Apache ni PHP de XAMPP: solo el servicio MySQL.

## Instalación local paso a paso

1. Instala Node.js 20+ y abre XAMPP. Enciende únicamente **MySQL**.
2. Descarga o clona el proyecto y entra a la carpeta:

   ```powershell
   cd C:\ruta\al\proyecto
   ```

3. Instala las dependencias:

   ```powershell
   npm install
   ```

4. Crea el archivo de configuración a partir del ejemplo:

   ```powershell
   Copy-Item .env.example .env
   ```

   Edita `.env` y define al menos un `SESSION_SECRET` largo y aleatorio (mínimo 32 caracteres). Para XAMPP lo habitual es:

   ```dotenv
   NODE_ENV=development
   PORT=3000
   TZ=America/Bogota
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=barberia
   SESSION_SECRET=un-secreto-largo-aleatorio-de-32-o-mas-caracteres
   ```

5. Crea la base de datos e importa el esquema:

   ```powershell
   npm run db:init
   ```

6. Carga los datos de demostración (barberos, servicios, horarios, 12 citas y 2 bloqueos):

   ```powershell
   npm run db:seed
   ```

   El seed **borra las citas y bloqueos existentes**. Si la base ya tiene citas, el script se detiene para evitar pérdidas accidentales. Para forzarlo en un entorno de desarrollo:

   ```powershell
   $env:ALLOW_DESTRUCTIVE_SEED='1'; npm run db:seed
   ```

7. Crea el primer usuario administrador. El seed no incluye credenciales:

   ```powershell
   npm run admin:create
   ```

8. Arranca el servidor:

   ```powershell
   npm run dev
   ```

   Para producción o uso normal:

   ```powershell
   npm start
   ```

9. Abre en el navegador:

   - Sitio público: <http://localhost:3000>
   - Reservar: <http://localhost:3000/reservar>
   - Consultar o cancelar cita: <http://localhost:3000/consulta>
   - Panel: <http://localhost:3000/admin>

### Si MySQL no está encendido

La app y los scripts muestran este mensaje:

> No se pudo conectar a MySQL. Enciende MySQL desde el panel de XAMPP e inténtalo de nuevo.

Enciende MySQL desde XAMPP y repite el comando.

### Reiniciar los datos de demo

```powershell
npm run db:reset
```

Borra la base `barberia`, recrea el esquema y vuelve a cargar el seed. El usuario administrador también se borra: vuelve a ejecutar `npm run admin:create`. **No lo uses en producción ni con citas reales.**

## Datos de demostración

- Barberos: Filo (lunes a sábado, 9:00-19:00, almuerzo 13:00-14:00), Camilo (martes a domingo, 10:00-20:00, almuerzo 14:00-15:00) y Andrés (lunes a viernes, 9:00-17:00, sin pausa).
- Servicios: Corte clásico, Corte + barba, Barba, Corte niño, Perfilado de cejas y Tratamiento capilar, con precios y duraciones distintos.
- 12 citas repartidas en la semana actual y 2 bloqueos de ejemplo.
- Los datos de citas y bloqueos se generan con fechas relativas a la semana en curso cada vez que se ejecuta el seed.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test` o `production`. En producción activa cookies seguras. |
| `PORT` | No | Puerto HTTP. Por defecto `3000`. |
| `TZ` | No | Zona horaria. El sistema usa `America/Bogota` internamente. |
| `DB_HOST` | No | Host de MySQL. Por defecto `localhost`. |
| `DB_PORT` | No | Puerto de MySQL. Por defecto `3306`. |
| `DB_USER` | No | Usuario de MySQL. Por defecto `root`. |
| `DB_PASSWORD` | No | Contraseña de MySQL. En XAMPP suele estar vacía. |
| `DB_NAME` | No | Nombre de la base. Por defecto `barberia`. |
| `SESSION_SECRET` | Sí | Secreto de sesión de al menos 32 caracteres. |
| `DB_CONNECTION_LIMIT` | No | Conexiones del pool. Por defecto `10`. |

## Pruebas automáticas

Con MySQL encendido:

```powershell
npm test
```

Incluye pruebas unitarias de disponibilidad y pruebas de integración de reservas, cancelación, bloqueos, reprogramación y permisos por rol.

Las pruebas usan una base separada llamada `barberia_test` (se puede cambiar con la variable `TEST_DB_NAME`). Cada archivo de prueba la recrea y carga el seed, así que **no uses ese nombre para datos reales**. Si MySQL no está disponible, las pruebas de integración se marcan como omitidas con un mensaje claro.

### Prueba de concurrencia

```powershell
npm run test:concurrency
```

Este script prepara `barberia_test` y lanza, en paralelo:

- 30 solicitudes a la misma hora y barbero: debe crearse exactamente 1 y rechazarse 29 con HTTP 409.
- 30 solicitudes a la misma hora con "cualquiera disponible": deben crearse 3, una por barbero, sin solapamientos, y rechazarse 27.
- 30 solicitudes a la misma hora repartidas entre 3 barberos: deben crearse 3 y rechazarse 27.

Muestra el resumen en consola y devuelve código de salida distinto de cero si falla.

## Despliegue en Hostinger (Node.js)

Los nombres y opciones pueden variar según el plan de Hostinger. Confirma cada paso en hPanel antes de continuar.

1. En hPanel, crea una base de datos MySQL y anota host, nombre, usuario, contraseña y puerto.
2. Entra a phpMyAdmin de esa base e importa `database/schema.sql`.
3. Sube el proyecto (ZIP o GitHub) al hosting y ejecuta `npm install` desde la terminal o el administrador de Node.js.
4. Configura las variables de entorno en hPanel (o en un `.env` fuera del directorio público):
   - `NODE_ENV=production`
   - `PORT` con el valor que indique Hostinger
   - `TZ=America/Bogota`
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `SESSION_SECRET` nuevo, largo y aleatorio
5. Define el comando de inicio `npm start` (o `node src/server.js`) y la carpeta raíz del proyecto.
6. Activa HTTPS. En producción la cookie de sesión es `Secure` y `SameSite=Lax`, y la app confía en el proxy de Hostinger (`trust proxy`).
7. Crea el administrador de producción con `npm run admin:create` desde la terminal del hosting.
8. Verifica el sitio público, la reserva, el login y una reserva de prueba. Revisa los logs del servidor si algo falla.

No subas `.env` al repositorio. En producción usa un `SESSION_SECRET` distinto al de local y una contraseña de base de datos robusta.

## Cómo adaptar el sitio a otro cliente

1. Entra al panel como administrador y abre **Configuración**.
2. Cambia nombre del negocio, eslogan, textos, teléfono, WhatsApp, dirección, mapa, redes sociales, métodos de pago, datos de transferencia, colores y reglas de reserva.
3. Ajusta servicios, precios, duraciones, barberos, horarios semanales y bloqueos desde sus secciones.
4. Reemplaza las imágenes de `public/img/` por las fotos reales (mantén los mismos nombres o actualiza las rutas desde el panel).
5. Opcionalmente cambia los datos de ejemplo en `database/seed.sql` y `scripts/seed.js` antes de instalar en el nuevo cliente.

Los colores se aplican mediante variables CSS generadas desde `settings`, por lo que no hace falta editar la hoja de estilos.

## Estructura del proyecto

```
database/        schema.sql y seed.sql
public/          sitio público, flujo de reserva, consulta y panel (HTML, CSS, JS, imágenes)
scripts/         init-db, seed, reset-db, create-admin, test-concurrency y utilidades
src/             servidor, configuración, rutas, controladores, servicios, middleware y utilidades
tests/           pruebas unitarias y de integración con node:test y supertest
views/           plantillas HTML del landing y del login
```

## Notas y decisiones

Las decisiones técnicas y los pendientes para una segunda versión están documentados en `NOTES.md`.

# Taroteame V2 — reservas reales

Esta versión añade:

- calendario/horarios reales consultados contra Supabase;
- bloqueo transaccional del hueco mediante una restricción de solapamiento de PostgreSQL;
- reserva pendiente de 15 minutos mientras se completa PayPal;
- confirmación automática tras captura de PayPal;
- email al cliente y aviso al propietario con Resend;
- panel privado para listar y cancelar citas;
- limpieza de reservas pendientes caducadas.

La arquitectura usa Supabase para Postgres/Auth/Edge Functions y Resend para email transaccional. Supabase ofrece Postgres, Auth y Edge Functions, y sus funciones pueden almacenar secretos como variables de entorno. Resend proporciona API/SDK para enviar correos desde Node/servidores. 

## 1. Crear Supabase
Crea un proyecto y copia:
- Project URL
- Publishable/anon key

Copia `config.example.js` a `config.js` y completa esos dos valores. `config.js` se usa en el navegador; NO pongas ninguna service-role key ahí.

## 2. Crear la base de datos
En Supabase → SQL Editor, ejecuta `supabase/migrations/001_taroteame.sql`.

## 3. Crear tu usuario de administración
En Supabase → Authentication → Users, crea el usuario con email y contraseña que usarás para entrar en `admin.html`.

Después ejecuta:
```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'TU_EMAIL_ADMIN';
```
Cambia el email por el tuyo.

## 4. Variables secretas de Edge Functions
Configura estos secretos en Supabase:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENV` = `sandbox` para pruebas o `production` para pagos reales
- `RESEND_API_KEY`
- `EMAIL_FROM` = por ejemplo `Taroteame <reservas@tudominio.com>`
- `OWNER_EMAIL` = tu email de avisos
- `CLEANUP_SECRET` = una cadena aleatoria larga
- `SUPABASE_SERVICE_ROLE_KEY` (si tu proyecto no la expone automáticamente en Functions)

No publiques estos valores en GitHub.

## 5. Email
Crea una cuenta en Resend, verifica tu dominio y crea una API key. La documentación de Resend muestra el envío de emails mediante API/SDK y recomienda usar la clave en el servidor. 

## 6. Desplegar Edge Functions
Con Supabase CLI:
```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy availability
supabase functions deploy create-order
supabase functions deploy capture-order
supabase functions deploy admin-list
supabase functions deploy admin-cancel
supabase functions deploy cleanup-expired
```
También puedes crear funciones desde el editor del Dashboard de Supabase.

## 7. Limpiar reservas pendientes
La función `cleanup_expired_bookings()` cambia las reservas pendientes vencidas a `expired`. Programa `cleanup-expired` cada 5 minutos usando un cron externo o la función de programación disponible en tu proyecto.

## 8. GitHub Pages
Sube:
- `index.html`
- `styles.css`
- `app-v2.js`
- `config.js`
- `admin.html`
- `admin.js`

GitHub Pages solo sirve el frontend estático. Las funciones de pago/reserva permanecen en Supabase.

## 9. PayPal
El Client ID que ya proporcionaste está integrado en `index.html`. El Client Secret no está incluido. Prueba primero con Sandbox. Para producción cambia `PAYPAL_ENV` a `production` y utiliza las credenciales Live correspondientes.

## Nota sobre el calendario
El sistema trabaja en hora local del negocio: 17:00–23:30. Los huecos se generan cada 30 minutos y la duración elegida determina hasta qué hora puede comenzar una cita. La base de datos impide que dos reservas activas se solapen en el mismo día.

## Nota sobre cancelaciones
La V2 cancela la cita desde el panel y libera el hueco. Si quieres reembolsos automáticos de PayPal al cancelar una cita pagada, hay que añadir una llamada a la API de reembolso y una política de cancelación.

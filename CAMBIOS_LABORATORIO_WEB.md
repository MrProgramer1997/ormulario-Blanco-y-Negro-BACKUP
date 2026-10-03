# Laboratorio: operaciones desde el navegador

Se incorpora `lab-maintenance.js` en `revision-2026/pruebas-pago.html`.

- Sincronizar una reserva de ensayo por su referencia numerica ePayco usando la sesion administrativa vigente. No crea pagos.
- Cambiar la contrasena de la cuenta autenticada usando Supabase Auth. No se persisten contrasenas ni se desactiva la reautenticacion. Si la sesion no existe o Supabase exige verificar de nuevo el acceso, se conserva el bloqueo.
- Se serializa la renovacion del token para que varios paneles no roten la misma sesion simultaneamente.
- CORS de `bn2026-webhook` restringido a los origenes declarados; las notificaciones mantienen su validacion de firma y la reconciliacion exige sesion y rol.
- Se incorpora al repositorio el codigo de consulta autenticada que ya estaba desplegado en el webhook.

Sin cambios en las llaves, las politicas RLS, el formulario principal ni las URL generales de ePayco. El laboratorio permanece en modo test.

Validacion de esta revision: 54 comprobaciones Node (45 existentes de confirmacion y 9 CORS) y 12 comprobaciones de navegador con servicios simulados. Se comprobo el rechazo de firmas falsas, respuestas incompletas, cambios no autorizados y la ausencia de un nuevo Checkout al sincronizar. No constituye una certificacion del cobro ni de la respuesta real de ePayco.

Pruebas CORS reproducibles: `node --test tests/browser-cors.test.mjs`.

La sesion se guarda en sessionStorage por pestana. Para reutilizarla, volver al laboratorio en la misma pestana donde se hizo el pago. No cerrar sesion ni borrar datos durante esta comprobacion.

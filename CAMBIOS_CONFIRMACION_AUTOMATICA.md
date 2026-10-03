# Confirmacion automatica durable - preparacion

## Estado de esta entrega
El codigo esta preparado. Se aplicaron las dos migraciones: cola y tarea cron DESACTIVADA. El intento de desplegar el nuevo webhook desde ChatGPT fue bloqueado por la herramienta. Por tanto, la automatizacion todavia NO esta activa ni verificada contra ePayco. La version anterior del webhook sigue atendiendo. No realizar un nuevo pago para validar esta entrega hasta completar despliegue y activacion.

## Arquitectura
El webhook valida la firma y guarda unicamente los campos firmados necesarios para contrastar la transaccion: comercio, referencia, transaccion, importe y moneda. La factura recibida es solo una pista: no autoriza cambios sobre una reserva. No se guardan firmas, tarjetas, claves ni el cuerpo completo del callback.

HTTP 200 significa recepcion persistida, NO pago aprobado. La consulta de ePayco se hace despues de responder. El proceso programado consulta trabajos vencidos cada minuto, con primer intento a partir de 60 segundos y reintentos espaciados 60, 120, 300, 600 y 900 segundos. Nunca crea otra sesion Checkout ni repite un cargo. Las verificaciones del detalle y las restricciones del inventario siguen vigentes.

La cola coalesce duplicados por comercio/referencia y no permite cambiar la prueba firmada. Reclama hasta dos trabajos con FOR UPDATE SKIP LOCKED; utiliza leases recuperables de 3 minutos. El resultado del pago y el cierre del trabajo comparten una transaccion. Se limita a 16 intentos o 24 horas antes de escalar a review. Un pago pendiente del proveedor se vuelve a consultar; no se confunde con una aprobacion.

La credencial del proceso programado se genera en el servidor y se guarda cifrada en Vault. No se muestra ni se copia a GitHub. Los RPC de la cola son exclusivamente service_role; el despachador solo puede ejecutarlo el propietario de la funcion. El estado administrativo de la cola requiere sesion y rol. El laboratorio sigue en modo test y las ventas comerciales deshabilitadas.

El sondeo visual del resultado y del laboratorio aumenta hasta 10 minutos; solo consulta estados. El trabajo de servidor no depende de mantener la pestaña abierta. La recuperacion del acceso al estado privado al abrir otra pestaña es un asunto distinto de esta cola.

## Despliegue pendiente
Desde la carpeta local del repositorio:

```powershell
git pull --ff-only
npx supabase functions deploy bn2026-webhook --project-ref cmrydhzpcuklfvigboka --use-api
```

Si git informa cambios locales, detenerse: no usar reset --hard ni sobreescribir archivos. No ejecutar db push: las migraciones ya estan aplicadas.

Despues de verificar el build bn-durable-confirmation-1, activar el job bn2026-confirmation-retries desde Supabase. La activacion no forma parte de esta entrega y debe validarse antes de otra prueba. Revisar cron.job_run_details, net._http_response (solo estado, nunca encabezados) y bn_confirmation_jobs para comprobar una ejecucion programada.

## Validacion realizada
28 pruebas unitarias con dependencias simuladas pasaron en Node 22.16.0:

```sh
node --experimental-transform-types --test tests/automatic-confirmation.test.mjs
```

En Supabase se ejecutaron comprobaciones dentro de una transaccion revertida: duplicado y conflicto de prueba, espera inicial, exclusividad de lease, reintento persistente, recuperacion de proceso interrumpido, limite de intentos y bloqueo de permisos. No se conservaron filas ficticias ni se modificaron reservas.

Se comprobo la sintaxis de los dos scripts de interfaz. No se ha probado el ciclo completo de un nuevo pago con esta automatizacion ni su ejecucion programada, porque falta publicar el webhook y activar la tarea. No se ejecutaron cargos.

## Limites antes de produccion
Dimensionar la concurrencia (dos trabajos por minuto es intencional en este laboratorio), establecer monitorizacion de incidencias review y probar una nueva aprobacion sin sincronizacion manual. La consulta HTTP actual utiliza una conexion de BD durante el tiempo de respuesta de ePayco. No relajar validaciones si el detalle permanece incompleto. Esta cola requiere recibir al menos una notificacion valida; una falta total de entrega del proveedor necesita una conciliacion complementaria.

Referencias: https://supabase.com/docs/guides/functions/schedule-functions y https://docs.epayco.com/docs/checkout-respuesta-y-confirmacion

# Fiesta Blanco y Negro 2026 — interfaz v2

## Novedades visuales de la versión 2

Negro carbón, blanco y detalles champán; botón de luna/sol en la cabecera para alternar entre modo claro y oscuro. Campos más amplios, pasos diferenciados, resumen de la reserva tipo entrada y controles de cantidad renovados. El administrador comparte la misma identidad visual.

No se reemplazó la publicación actual. Los pagos siguen desactivados en la vista previa. Los archivos de cálculo, API, configuración y backend son idénticos a los de la primera entrega; el alcance de esta revisión es visual.

**Abre VISTA-PREVIA.html** para el formulario o **ADMIN-DEMO.html** para el panel ficticio. El icono de la luna/sol está en la parte superior. Consulta **CAMBIOS_V2.md** y **VALIDACION.md**.

## Revisar ahora, sin instalar nada

Extrae el ZIP completo. Abre **VISTA-PREVIA.html** con Chrome o Edge. Es una vista interactiva independiente: puedes seleccionar la mesa, completar el grupo, registrar asistentes y revisar el total. No guarda reservas en Supabase ni inicia pagos.

Abre **ADMIN-DEMO.html** y pulsa **Ver demostración del administrador**. Los registros y valores son ficticios y están identificados como tal. No ingreses contraseñas reales en esta demostración.

También puedes abrir la carpeta en Visual Studio Code y usar Live Server sobre `revision-2026/index.html`, o ejecutar `npm start` si ya tienes Node.js. No se requiere `npm install` para el formulario, el servidor local ni las pruebas unitarias.

## Qué contiene

Formulario en cuatro pasos: mesa, grupo, asistentes y revisión/pago. Plano original con 45 mesas, filtros por Rialto y Lobby, plano ampliable, resumen de precios, autocompletado del responsable, control de datos faltantes y conservación de registros al cambiar cantidades.

Borrador opcional en sessionStorage con vencimiento de dos horas. No se guarda por defecto; no utilizar en equipos compartidos. El backend no recibe datos durante la vista previa.

Panel administrativo con resumen, solicitudes, mesas, exportación CSV, detalle y laboratorio de cuatro importes. Incluye el código de autenticación real, pero la cuenta administrativa todavía NO está creada. La exportación neutraliza valores interpretables como fórmulas de Excel.

Funciones de Supabase y migración SQL para la siguiente etapa de pruebas. Calculan el importe desde los asistentes, restringen el laboratorio a administradores y verifican pagos por firma y consulta al proveedor. No contienen llaves privadas.

## Estado exacto de la entrega

| Parte | Estado |
|---|---|
| Formulario y administrador visual | Implementados; recorridos comprobados en navegador local aislado |
| Lógica y apariencia | 33 pruebas unitarias aprobadas (27 anteriores y 6 de apariencia) |
| Interfaz v2 | 146 comprobaciones locales aprobadas; formulario de 320 a 1920 px, administrador de 320 a 1440 px; modo claro y oscuro |
| TypeScript de las Edge Functions | Sin cambios; esta revisión no repite la comprobación de tipos del backend |
| Migración del esquema nuevo | Preparada, NO aplicada; no se ejecutaron pruebas SQL |
| Edge Functions de ePayco | Código preparado, NO desplegado ni probado contra ePayco |
| Llaves ePayco | NO cargadas: continúan bajo custodia del usuario |
| Usuario real EventosyServicios | Pendiente de crear en Supabase Auth |
| Pagos y webhooks reales/de prueba | NO ejecutados |
| Publicación GitHub Pages actual | NO reemplazada ni modificada |
| Histórico | 24 registros originales conservados, sin reclasificar ni borrar |

Las pruebas del navegador v2 cargaron los HTML independientes en memoria. La lógica de apariencia también se probó con almacenamiento simulado disponible/no disponible. No son una prueba de red, de Supabase Auth, de un cobro ePayco o de concurrencia real. Ver `VALIDACION.md`.

## Antecedente de seguridad de la entrega v1 (no modificado en v2)

La documentación de la entrega v1 registra que se eliminó la lectura pública de los datos personales de `public.reservas`. Se comprobó que los roles `anon` y `authenticated` ya no tienen permiso SELECT sobre esa tabla. El backend mantiene acceso.

No se modificaron datos: permanecen las 24 reservas y las 36 mesas anteriores. El formulario anterior mantiene permiso para leer `mesas` y ejecutar `reserve_seats_v2`. El search_path de esta función se fijó vacío; sus referencias a tablas ya estaban calificadas.

Esto NO constituye una auditoría de seguridad completa. La función administrativa antigua basada en un código y el cierre del flujo 2025 deben revisarse al sustituir la publicación. No se hizo una reserva real para probar regresión.

## Publicar SOLO la revisión, sin reemplazar el formulario actual

Copia únicamente la carpeta `revision-2026` al nivel raíz del repositorio existente. No reemplaces su `index.html` principal. Mantén `preview: true` en `revision-2026/js/config.js`.

Después del despliegue de GitHub Pages, la revisión quedaría en:

```text
https://mrprogramer1997.github.io/Formulario-Blanco-y-Negro/revision-2026/
```

Esta dirección es la ruta prevista; esta entrega NO la ha publicado. No cargues el bloc de notas de las credenciales, archivos .env ni documentos de contraseñas al repositorio.

## Activar la siguiente etapa de pruebas

1. En el proyecto correcto de Supabase, abre **Edge Functions > Secrets**. Copia directamente desde tu bloc los valores de prueba con estos nombres exactos: `EPAYCO_P_CUST_ID_CLIENTE`, `EPAYCO_P_KEY`, `EPAYCO_PUBLIC_KEY`, `EPAYCO_PRIVATE_KEY`. No los envíes por chat. Añade `BN_PAYMENTS_MODE=test`. No cambies las URL generales de ePayco.
2. Revisar y ejecutar en SQL Editor la migración `supabase/migrations/202610020001_bn2026_test.sql`. Crea tablas `bn_*` con RLS y sin permisos públicos de lectura/escritura. Crea un evento de ensayo y otro comercial deshabilitado, cada uno con su propio inventario. No mueve ni borra tablas antiguas.
3. Desplegar `bn2026-api` y `bn2026-webhook`, incluyendo sus dependencias de `_shared`. `supabase/config.toml` desactiva la verificación JWT del gateway porque la API realiza autenticación propia por acción y el webhook verifica la firma del proveedor. No desactivar la autenticación implementada dentro de las funciones.
4. Crear al administrador en Supabase Auth con correo real de recuperación y contraseña fuerte. Ejecutar `ASIGNAR_ADMIN.sql` sustituyendo el correo. El usuario visible será **EventosyServicios**. No insertar contraseñas directamente en tablas ni en JavaScript.
5. Verificar catálogo, permisos, inicio de sesión y negativos de acceso. Solo entonces cambiar `preview` a `false` en la carpeta de revisión. El backend de esta versión admite exclusivamente ensayos administrativos. No habilita ventas reales.
6. Ejecutar ensayos autorizados, contrastar firma/campos reales de ePayco y comprobar aprobados, pendientes, rechazados, notificaciones repetidas e incidencias antes de considerar producción.

Para desplegar las funciones desde un equipo ya autenticado en Supabase CLI:

```sh
supabase functions deploy bn2026-api --project-ref cmrydhzpcuklfvigboka
supabase functions deploy bn2026-webhook --project-ref cmrydhzpcuklfvigboka
```

No ejecutes `db push` sin sincronizar antes el historial de migraciones remoto. Esta entrega incluye un cambio de seguridad aplicado desde el conector y SQL nuevo aún no aplicado.

## Límites que deben resolverse antes de producción

**Clasificación de socios.** Registrar un número de acción no prueba por sí mismo que el asistente tenga derecho a la tarifa de socio. Falta un padrón autorizado o regla de validación acordada con Eventos. La versión de pruebas no resuelve esa comprobación.

**Pagos pendientes y vencimiento.** La retención previa a crear Checkout tiene 15 minutos. Después de solicitar una sesión externa no se libera automáticamente la mesa: una respuesta tardía o un timeout no demuestra que no haya pago. Se requiere conciliación, reglas por medio de pago y recuperación de sesiones antes de ventas reales. Las incidencias no se resuelven desde un botón que simplemente libere cupos.

**Reversiones y reembolsos.** No se automatizan reembolsos. Un pago aprobado no se degrada por una notificación pendiente antigua. Los cambios posteriores requieren conciliación explícita. No se garantiza la llegada ni el tiempo de abono de dinero con una simulación.

**Impuestos y comisiones.** No se asumieron tarifas ni condiciones tributarias de la cuenta del Club. Deben confirmarse antes de operar con dinero real.

**Histórico.** Las reservas de 2025 y el registro creado en junio de 2026 permanecen en las tablas originales. La fecha de creación no demuestra el evento al que corresponden. No se incorporan a la ocupación 2026 nueva.

**Métricas.** El primer panel conectado lee hasta 500 solicitudes del evento de prueba; no usarlo como reporte de grandes volúmenes sin agregaciones/paginación del servidor. Los eventos no están mezclados, y los valores de ensayo no son recaudo.

**Seguridad operativa.** Antes de producción: revisar historial Git, roles, políticas, dependencias, pruebas de carga, protección contra abuso, recuperación administrativa y configuración real de ePayco. No se recopilan datos completos de tarjetas en esta aplicación.

## Estructura

```text
VISTA-PREVIA.html       Revisar el formulario sin servidor
ADMIN-DEMO.html         Revisar el administrador ficticio
revision-2026/          Frontend modular para publicar como revisión
supabase/              Migración, configuración y funciones del servidor
tests/                 Pruebas unitarias
tools/                 Servidor local y generador de vistas independientes
```

## Fuentes consultadas

Documentación oficial de ePayco: implementación Smart Checkout y páginas de respuesta/confirmación. Documentación oficial de Supabase: secretos de Edge Functions. Protocolo y plano 2026 suministrados por el usuario. Los importes, fechas y distribución se basan en esos materiales; la confirmación automática de ePayco es el cambio acordado durante esta conversación.

```text
https://docs.epayco.com/docs/checkout-implementacion
https://docs.epayco.com/docs/checkout-respuesta-y-confirmacion
https://supabase.com/docs/guides/functions/secrets
```

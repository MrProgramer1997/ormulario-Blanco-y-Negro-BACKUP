# Confirmacion de pruebas verificada - 3 octubre 2026

## Causa y cambio
La referencia numerica de ePayco era correcta. El contrato documentado de GET /transaction/detail requiere un cuerpo JSON con filter.referencePayco. La sustitucion por parametros de URL no devolvia detalle verificable. La consulta con el cuerpo documentado funciona desde el cliente HTTP de PostgreSQL de Supabase.

Se utiliza bn_epayco_detail_read, un RPC de destino y metodo fijos, ejecutable solamente por service_role. Las claves ePayco siguen en Secrets de Edge Functions. Solo se pasa un bearer temporal entre componentes del servidor; no se guarda ni retorna. El RPC no es un proxy abierto, tiene tiempos limite y filtra la respuesta para excluir datos de tarjeta/pagador.

Se mantienen las verificaciones de firma, comercio, referencia, transaccion, factura, monto, moneda y entorno. Una respuesta incompleta no confirma la reserva. Los datos del navegador no determinan el estado final. La interfaz aprobada y las URL generales de ePayco no se modificaron.

## Comprobacion sobre los intentos existentes
- Webhook desplegado: version 15, build bn-confirmation-documented-get-3.
- Las dos notificaciones anteriores se reprocesaron preservando sus firmas, sin crear sesiones de pago ni cobros.
- ePayco devolvio detalles autenticados coincidentes; ambas reservas de ensayo quedaron rechazadas y las mesas se liberaron.
- Repetir la notificacion devuelve HTTP 200 con duplicate=true, sin duplicar registros.
- Firma falsa: HTTP 401. Reconciliacion sin sesion administrativa: HTTP 401.
- El nuevo RPC no es ejecutable por anon ni authenticated.
- Comprobacion final: 45 mesas de ensayo disponibles; 2 reservas de ensayo conservadas; 24 reservas historicas conservadas; evento live deshabilitado.

## Pruebas reproducibles
53 pruebas locales de transporte y confirmacion, con datos controlados:

```sh
node --experimental-transform-types --test tests/epayco-confirmation.test.mjs tests/native-apify-transport.test.mjs
```

La comprobacion real de este cambio cubre consultas y rechazos de pagos simulados. Aun falta el recorrido de aprobacion con la tarjeta oficial de pruebas. No habilitar cobros reales basandose solo en estos resultados.

## Operacion y limite
La llamada HTTP ocupa una conexion de base de datos mientras consulta ePayco (hasta 9 segundos). Se mantiene el laboratorio limitado a administradores; revisar concurrencia y una cola de conciliacion antes de escalar o habilitar produccion.

Fuente del contrato: https://api.epayco.co/ (Transacciones / Detalle Transaccion). Supabase http: https://supabase.com/docs/guides/database/extensions/http

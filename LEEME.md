# Blanco y Negro 2026 - despliegue de pruebas

## Abrir sin mezclar con el proyecto

Extrae este ZIP en una carpeta aparte (por ejemplo, en Descargas). NO reemplaces archivos de tu formulario y NO subas este paquete a GitHub.

1. Abre `1-DESPLEGAR-PAGOS.cmd` con doble clic. No necesitas permisos de administrador de Windows.
2. La ventana informa el proyecto y pide confirmar con S.
3. Completa el inicio de sesion de Supabase en el navegador con la cuenta que tiene acceso a "Formulario Fiesta Blanco y Negro". Si la CLI solicita un codigo de verificacion, completa ese paso localmente. No es una llave ePayco.
4. El programa despliega las dos funciones y comprueba los endpoints. Al terminar genera `RESULTADO-DESPLIEGUE.json`.
5. Comparte ese JSON. Solo contiene estados y resultados de comprobacion; no contiene claves, tokens, contrasenas ni datos de asistentes.

Necesitas Node.js 20 o superior con npm/npx, conexion a Internet y permiso de despliegue en el proyecto. La CLI oficial de Supabase 2.x se descarga mediante npx si hace falta. La opcion --use-api evita necesitar Docker. No se cambian politicas de Windows ni se desactiva antivirus.

Si falla un comando, se detiene la secuencia. Los pasos que ya terminaron no se revierten automaticamente. Si ambos despliegues terminaron pero la verificacion falla, revisa el mensaje y ejecuta `2-VERIFICAR-DESPLIEGUE.cmd` para repetir SOLO la comprobacion cuando se haya resuelto la causa. No genera ni repite cobros.

## Cambios que autoriza el iniciador

Proyecto fijo: cmrydhzpcuklfvigboka.
Funciones: bn2026-api y bn2026-webhook.
Los archivos de las funciones y la configuracion son los de la entrega v2, sin cambios funcionales. El iniciador verifica su integridad antes de desplegar.

No ejecuta migraciones, db push, cambios de tablas, cambios de secretos, publicaciones GitHub ni operaciones de cobro. No crea usuarios administrativos. Las credenciales ePayco guardadas en Supabase son utilizadas por las funciones cuando corresponda, pero este iniciador no las pide, lee ni copia.

No ejecutes este paquete en modo produccion. Mantener BN_PAYMENTS_MODE=test en los Secrets. No modificar las URL generales de ePayco.

## Autenticacion de las funciones

La verificacion JWT del gateway esta desactivada en config.toml porque estas funciones implementan autenticacion propia:
- API: catalogo sin datos personales; consulta de estado por token de alta entropia; las acciones privadas verifican Supabase Auth y rol habilitado en bn_admin_users.
- Webhook: verifica firma ePayco, consulta los atributos en el proveedor y valida moneda, monto, comercio, referencia y entorno antes de escribir.

No quitar esa autenticacion ni abrir permisos RLS para hacer funcionar las pruebas.

## Que comprueba el iniciador

Catalogo de 45 mesas en modo test con campos publicos permitidos; bloqueo de admin/checkout sin sesion; rechazo de webhook sin firma y con firma falsa.

Estas verificaciones NO autentican las PUBLIC_KEY/PRIVATE_KEY ante ePayco, NO crean una sesion Checkout y NO demuestran un pago o ingreso de dinero. Falta crear el usuario real EventosyServicios con un correo controlado por el Club y ejecutar el recorrido simulado completo. Mantener preview:true hasta terminar la configuracion.

## Estado de esta entrega

La herramienta de ChatGPT bloqueo el intento de despliegue remoto antes de completarlo. Este paquete NO ha sido ejecutado contra Supabase desde el entorno de ChatGPT. El usuario decide y autoriza su ejecucion local. No se ha probado un cobro ni verificado la validez de sus llaves.

Se comprobaron localmente 18 pruebas del iniciador con procesos y respuestas HTTP simulados. Adicionalmente se repitieron 33 pruebas del proyecto original. Consulta VALIDACION.md.

## Referencias oficiales

- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/guides/functions/auth
- https://docs.epayco.com/docs/checkout-implementacion
- https://docs.epayco.com/docs/checkout-respuesta-y-confirmacion

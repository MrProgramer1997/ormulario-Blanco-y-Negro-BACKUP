# Validación de la interfaz v2

Fecha: 2 de octubre de 2026.

## Ejecutado en esta revisión

**33 pruebas unitarias: 33 aprobadas.** Se ejecutó `npm test`: los 27 casos existentes de cálculo, validación y seguridad, más 6 casos del nuevo control de apariencia. Estos últimos verifican el tema por defecto, restauración de la preferencia, etiqueta accesible, escritura exclusiva de la preferencia, almacenamiento bloqueado y clics ajenos al control.

**146 comprobaciones de interfaz: 146 aprobadas.** Se ejecutó `tests/ui-visual-v2.py` con Playwright/Chromium sobre los HTML independientes cargados en memoria. Resultados completos en `tests/ui-visual-v2.json`.

Se revisaron las 45 mesas, filtro de Lobby, plano ampliable, validaciones obligatorias, cálculos al cambiar socios/invitados, autocompletado del responsable, registro de ocho asistentes, documentos de invitado repetidos, persistencia de datos al volver o cambiar cantidades, aceptación de condiciones y mensaje de recorrido sin cobro.

En el administrador: indicadores de demostración, búsqueda, detalle ficticio, 45 mesas, cuatro importes de ensayo, histórico de demostración y salida al acceso.

El formulario se comprobó en anchos de 320, 360, 390, 620, 768, 900, 1024, 1440 y 1920 px. El administrador se comprobó en anchos de 320, 390, 768, 1024 y 1440 px, en sus cinco secciones. Se evaluaron las dos paletas. Las tablas administrativas y el plano ampliado conservan su desplazamiento interno intencional; no se detectó desbordamiento horizontal de la página.

**0 errores JavaScript y 0 solicitudes HTTP externas** durante los recorridos de las vistas previas. Se renderizaron capturas del formulario, grupo, asistentes y administrador para revisión visual.

## Integridad

Se compararon mediante SHA-256 los archivos de Supabase, API, reglas de cálculo, configuración, resultado de pago, plano, protocolo y exclusiones Git con el ZIP v1. Los archivos examinados son idénticos. Relación completa en `tests/integrity-v2.json`.

No se cambiaron importes, capacidades, coordenadas, reglas de pago, funciones de servidor, SQL ni políticas de acceso. No se añadieron llaves privadas.

## Alcance y límites

La ejecución del navegador utilizó contenido cargado en memoria, no un despliegue HTTP. No demuestra la configuración de GitHub Pages, Supabase Auth, permisos reales, secretos, funcionamiento de ePayco, webhooks, recaudo, concurrencia o latencia. No se realizaron cobros ni escrituras en la base de datos.

El almacenamiento persistente del tema se verificó con un almacenamiento simulado en las pruebas unitarias. En un navegador real se usa localStorage solo cuando está disponible. Si el navegador bloquea ese almacenamiento, el control sigue funcionando durante la página actual. La preferencia de apariencia no contiene datos de asistentes ni credenciales.

Las pruebas no constituyen una certificación WCAG ni una auditoría de seguridad completa. El modo de revisión sigue siendo `preview: true`; las comprobaciones de ePayco permanecen pendientes como en la v1.

## Reproducir

```sh
npm test
npm run build:preview
# Opcional; requiere Python, Playwright y Chromium instalados.
python tests/ui-visual-v2.py
```

El ejecutable del navegador se puede indicar con la variable de entorno `CHROMIUM_PATH`; las capturas se escriben en `tests/screenshots/` o en la ruta de `BN_SHOTS`. El informe anterior se conserva como `VALIDACION_V1.md`, y no representa nuevas pruebas del servidor en esta versión.

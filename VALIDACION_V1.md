# Validación de la entrega v1

Fecha: 2 de octubre de 2026.

## Resultado

- 27 pruebas unitarias aprobadas con `node --test`.
- 33 comprobaciones de interfaz aprobadas en Chromium, escritorio (1440 px) y móvil (390 px).
- Sin errores JavaScript en los recorridos comprobados.
- Sintaxis de los módulos JavaScript y utilidades comprobada con Node.
- TypeScript de ambas Edge Functions comprobado sin errores de tipos.
- Ambas vistas independientes HTML abrieron y ejecutaron sus controles en un render local sin recursos externos.

## Alcance y límites

El navegador se utilizó como motor local de render y de interacción. El entorno bloqueaba la navegación HTTP del navegador; por ello el HTML, CSS y JavaScript se cargaron en memoria, y las pruebas del borrador usaron un almacenamiento de sesión simulado. Las vistas independientes se comprobaron también con su propio código empaquetado.

No se ejecutó una transacción ePayco, no se comprobó un abono, no se creó un usuario de Supabase Auth y no se desplegaron las nuevas funciones. La migración del esquema 2026 no se ha ejecutado ni sometido a pruebas de SQL/concurrencia. No debe describirse esta entrega como un sistema de pagos validado de extremo a extremo.

## Seguridad verificada sobre el proyecto existente

Se aplicó la migración `restrict_public_access_to_legacy_reservation_personal_data`. La verificación posterior devolvió:

```json
{
  "reservas_conservadas": 24,
  "mesas_anteriores": 36,
  "anon_puede_leer_reservas": false,
  "authenticated_puede_leer_reservas": false,
  "backend_puede_leer_reservas": true,
  "formulario_anterior_puede_leer_mesas": true,
  "rpc_anterior_sigue_disponible": true
}
```

No se afirmó una prueba funcional de reserva real sobre la versión antigua; se comprobaron sus permisos y la preservación de registros.

## Comprobaciones de interfaz

1. 45 marcadores y 45 botones de mesa.
2. Sin datos personales guardados por defecto.
3. No permite continuar sin mesa.
4. Filtro Lobby muestra 12 mesas.
5. Seleccion de mesa actualiza resumen.
6. Plano ampliado abre.
7. Plano ampliado permite cambiar mesa y cerrar.
8. Valida responsable incompleto.
9. 5 socios y 3 invitados calculan 1680000.
10. Cambiar grupo conserva datos responsable.
11. Aumentar a 10 calcula 2040000.
12. Borrador solo se guarda por opcion explicita.
13. 8 tarjetas con el responsable incluido.
14. Contador de asistentes completos llega a 8.
15. Revision lista 8 asistentes.
16. Exige aceptar condiciones.
17. Vista previa nunca confirma reserva.
18. Cambiar distribucion y volver conserva invitados.
19. Inicio movil no desborda horizontalmente.
20. Paso grupo movil no desborda.
21. Campos movil tienen tamano legible.
22. Restauracion optativa de borrador conserva nombre.
23. Borrador vencido se elimina.
24. Panel demo identifica datos ficticios.
25. Panel presenta 4 metricas.
26. Panel permite consultar 12 registros demo.
27. Filtro admin encuentra responsable.
28. Detalle administrativo abre.
29. Administrador muestra las 45 mesas.
30. Laboratorio ofrece los 4 valores autorizados.
31. Caso de ensayo se envia por codigo.
32. Salir devuelve al acceso.
33. Sin errores JavaScript en recorridos probados.

## Reproducir pruebas unitarias

```sh
npm test
```

No requiere instalar dependencias. Las pruebas unitarias cubren importes, cambios de cantidad, conservación de datos, validaciones, duplicados de documentos, escape HTML, CSV, modo de prueba y comparación de firmas. No sustituyen las pruebas reales de autorización, SQL y webhooks.

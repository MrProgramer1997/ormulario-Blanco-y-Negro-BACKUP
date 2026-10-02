# Interfaz v2 - qué cambia y cómo revisarla

## Abrir

Extrae toda la carpeta. Abre **VISTA-PREVIA.html**. No necesitas instalar nada.

Abre **ADMIN-DEMO.html** y pulsa **Ver demostración del administrador**. No ingreses contraseñas reales.

El botón de la luna/sol en la parte superior cambia la apariencia.

## Cambios

- Paleta base: negro carbón `#171A20`, blanco `#FFFFFF` y champán `#D7BA87`. Modo claro y oscuro.
- Cabecera de evento con tipografía, fecha, artista y precios jerarquizados.
- Navegación por pasos con descripciones, estado actual destacado e iconos locales.
- Campos amplios, grupos de datos separados, botones de cantidad y tarjetas de asistentes renovados.
- Resumen de mesa tipo entrada; total fijo al pie en celular.
- Panel administrativo con la misma paleta, indicadores, pestañas y estados diferenciados.
- Sin fuentes o bibliotecas nuevas descargadas de servicios externos.

## Lo que no cambia

Importes, reglas de reservas, cantidad de asistentes, datos solicitados, plano y posiciones de mesas, validaciones, API y backend. Las pantallas de prueba siguen sin guardar reservas ni cobrar.

No se modificó la publicación actual, Supabase ni la configuración general de ePayco.

## Archivos

La implementación está en `revision-2026/`; los HTML de vista previa son versiones independientes generadas del mismo código. Para futuras ediciones, modifica la carpeta de implementación y ejecuta `npm run build:preview` para regenerarlas.

La configuración de cobros sigue pendiente. No pegues el bloc de notas de credenciales en esta carpeta ni lo subas a GitHub.

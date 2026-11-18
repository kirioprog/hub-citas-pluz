# Hub de citas · Pluz Energía
Prototipo navegable y responsivo, íntegramente en español. Datos ficticios y estado en memoria; recargar la página reinicia la demostración.

## Abrir
Abre index.html en un navegador. Para servirlo localmente desde esta carpeta:
python -m http.server 5173
Después visita http://localhost:5173.

## Demostración de principio a fin
1. Entra como Pluz con las credenciales ficticias precargadas.
2. En Simulador de cliente, selecciona Carlos Mendoza y pulsa Confirmo.
3. Cambia de rol a Contratista. En Cambios aparece la confirmación con Nuevo.
4. En Agenda, selecciona Contratista A y asigna Cuadrilla 1 a Carlos.
5. Cambia a Técnico (Contratista A, Cuadrilla 1), abre la visita y pulsa Voy en camino, Llegué y Guardar resultado.
6. Vuelve a Pluz > Citas y abre Carlos Mendoza para consultar el historial compartido.

También puedes reprogramar dentro del plazo de tres días, registrar representantes, cancelar, reenviar WhatsApp, enviar recordatorios y validar direcciones desde Pluz. Los estados y contadores se recalculan a partir de las ocho citas.

## Alcance
Sin backend ni almacenamiento persistente. El estado se comparte entre roles dentro de la misma pestaña, sin localStorage ni sincronización entre dispositivos. Llamadas, WhatsApp, Excel y mapas son simulados. DNI visible únicamente en el detalle de Pluz; no hay documentos reales. Los nueve estados están disponibles; ocho aparecen al inicio y Recordada se activa al enviar un recordatorio.

## Verificación
Sintaxis JavaScript verificada. Recorrido completo entre roles probado en navegador. Reprogramación y representante probados. Vista técnica revisada a 390 px sin desbordamiento horizontal. Sin errores de JavaScript observados.


## GitHub Pages
Este sitio está preparado para publicarse desde la rama main y la carpeta raíz. Los recursos usan rutas relativas para funcionar como sitio de proyecto.

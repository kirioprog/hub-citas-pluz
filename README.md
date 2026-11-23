# Hub de citas · Pluz Energía

Prototipo web navegable y responsivo de un hub de citas para las **visitas técnicas de factibilidad** de una distribuidora eléctrica (Pluz Energía, Perú). Está íntegramente en español.

Es un **prototipo de demostración**: no tiene backend, usa datos de ejemplo ficticios y guarda el estado compartido **solo en memoria** (sin `localStorage`). Si recargas la página, la demostración se reinicia.

## Abrir

Abre `index.html` en un navegador o sírvelo localmente:

```bash
python3 -m http.server 5173
```

Luego visita <http://localhost:5173>. También funciona en GitHub Pages: publica desde la rama `main`, carpeta raíz. Todas las rutas son relativas.

## Roles

| Rol | Pantallas | Qué ve |
|---|---|---|
| **Pluz** (escritorio) | Resumen, Citas, Alertas, Simulador de cliente, Agendamiento rápido | Todo, incluido el DNI (etiquetado «Solo visible para Pluz») |
| **Contratista** (escritorio o tablet) | Agenda, Cambios, Cuadrillas, Rutas | Nombre, teléfono, dirección, franja y estado. **Nunca ve el DNI** |
| **Técnico** (móvil, 390 px) | Ruta de hoy (lista y mapa), detalle de la visita | Su ruta optimizada. **Nunca ve el DNI** |
| **Cliente** (enlace único) | `#/c/<token>` | Su propia cita: confirmar, cambiar horario, registrar un representante o cancelar |

El botón **Cambiar de rol** está en todas las vistas y conserva el estado.

## Recorrido de la demostración

1. Ingresa como **Pluz** → **Simulador de cliente** → Carlos Mendoza → **Confirmo**.
2. **Cambiar de rol** → **Contratista** → **Cambios**: la confirmación aparece con la marca **Nuevo**.
3. La cuadrilla se asigna **automáticamente por zona**: la de Carlos (Cuadrilla 1, Santa Anita Oeste) está llena de 10:00 a 12:00, así que la apoya la vecina **Cuadrilla 2** (+13 min). Se ve en **Cambios** y en **Agenda**, donde el contratista puede cambiarla.
4. **Cambiar de rol** → **Técnico** (Contratista A · Cuadrilla 2): Carlos aparece en la ruta, en el orden óptimo. Ábrelo → **Voy en camino** → **Llegué** → resultado → **Guardar**.
5. **Cambiar de rol** → **Pluz** → **Citas** → Carlos: el estado y la línea de tiempo lo reflejan todo.

Otras demostraciones:

- **Varias cuadrillas**: hay 34 citas de ejemplo. Hoy, cada una de las 3 cuadrillas de cada contratista tiene una ruta de 4 o 5 visitas; mañana hay rutas de las Cuadrillas 1 y 3 (A) y 1 y 2 (B). En Contratista → Rutas → **Todas las cuadrillas** se ven las tres rutas a la vez, cada una de un color; en Técnico se puede elegir cualquiera de las 6 cuadrillas.
- **Evaluar reprogramación en la ruta**: Contratista B → Rutas → Día: mañana → Cuadrilla 1 → en «Evaluar reprogramación» elige *Mateo Vega* (cliente ausente; su día 4 es mañana). Su zona (Cuadrilla 3, Ate Sur) no tiene ruta mañana, pero la Cuadrilla 1 vecina puede **apoyar** en 10:00–12:00 porque cae dentro de su recorrido (pin azul en el mapa). En franjas fuera del recorrido se rechaza («afecta la ruta») y el técnico mantiene la visita. *Aplicar reprogramación* asigna la cuadrilla, avisa al cliente por WhatsApp y aparece como «Nuevo» en Cambios.
- **Regla del día 4**: Pluz → Alertas → «Clientes ausentes» → Mateo Vega → *Ver opciones*. El día 4 solo deja la franja que encaja en la ruta ya programada de la Cuadrilla 3; las demás aparecen como «Afecta la ruta».
- **Agendamiento rápido**: Pluz → Agendamiento rápido → *Rellenar ejemplo* → *Buscar horarios*. Se proponen los horarios más próximos con menor desvío de ruta. Al crear la cita se genera el enlace único.
- **Enlace único**: desde el detalle de una cita o desde el chat, *Abrir como cliente*. También funciona en otra pestaña, por ejemplo `…/index.html#/c/T6vN2m` (Mateo) o `#/c/c8Kx2Q` (Carlos).
- **Rutas con tráfico**: Contratista → Rutas → **Simular recorrido**. Activa la lluvia, la obra en Javier Prado o el accidente en Av. La Molina, cambia la hora de salida o los puntos A y B, toca un tramo para comparar caminos y elige «Escenario ampliado: 12 viviendas».

## Flujo de WhatsApp (simulado)

1. **Saludo**: «Hola {nombre}, te saluda Pluz Energía. Registramos tu solicitud {N°} de factibilidad técnica para {dirección}… La visita debe realizarse dentro de los 3 días siguientes a tu solicitud.»
2. **Propuesta**: «Te proponemos la visita para {día} entre las {inicio} y las {fin}. ¿Te queda bien?» Respuestas rápidas:
   - **Confirmo** → queda *Confirmada* y se envía el enlace único.
   - **Cambiar fecha u hora** → se ofrecen los 3 horarios libres más cercanos que caben en las rutas, más el enlace único.
   - **Me representará otra persona** → se piden el nombre y la relación; queda confirmada y se informa que debe mostrar su documento al técnico.
3. **Reenvío** si el cliente no responde. Tras 2 intentos sin respuesta, la cita aparece en Alertas.
4. **Recordatorio** el día de la visita (estado *Recordada*).
5. **Técnico en camino**, con la hora estimada de llegada calculada con la ruta y el tráfico.
6. **Resultado**: realizada, o cliente ausente con la opción de reprogramar según la regla del día 4.

## Asignación automática por zonas

- Cada contratista tiene 3 cuadrillas y cada cuadrilla trabaja una zona. **A**: Santa Anita Oeste, Santa Anita Este y Ate Vitarte. **B**: La Molina Norte, La Molina Sur y Ate Sur · Mayorazgo.
- Cuando una cita queda agendada (el cliente confirma, reprograma o registra un representante, o se agenda rápido), el sistema la asigna a la **cuadrilla de su zona**, que es la más cercana a la vivienda.
- Si esa cuadrilla **está llena** (2 visitas por franja o 5 por día) o no llegaría a tiempo, la **apoya la cuadrilla vecina** que menos se desvía, **sin alejarse mucho**: su zona debe estar a 5 km o menos de la visita y el desvío no puede superar 20 min. Se registra como «Apoyo» en el historial, en Cambios, en la Agenda y en el mapa.
- Si ninguna puede atenderla, la cita queda **sin cuadrilla** y aparece en **Pluz → Alertas** para reprogramarla.
- El contratista puede cambiar la cuadrilla a mano en la Agenda o volver a «Asignar automáticamente».
- En **Contratista → Cuadrillas** se ve la carga de cada cuadrilla (por ejemplo, 5 de 5: llena) y quién da o recibe apoyo. En **Rutas → Todas las cuadrillas**, las zonas aparecen como círculos de colores.

## Reglas de agenda

- Franjas: lunes a viernes 08:00–18:00 y sábado 08:00–14:00, en bloques de 2 horas. Los domingos no hay visitas.
- La visita debe ocurrir entre el **día 1 y el día 3** desde la solicitud.
- **Día 4 (excepción)**: solo si ya existe una ruta programada ese día para la cuadrilla, la franja cae dentro de ese recorrido, nadie llega tarde y el desvío no supera 25 minutos. Si afecta la ruta, **no se reprograma** y el técnico mantiene la visita.
- Capacidad: 2 visitas por cuadrilla y franja, y 5 por cuadrilla y día. Antes de aceptar un horario, se inserta la visita en la ruta y se verifica que el técnico llegue dentro de la franja sin retrasar a nadie.
- En riesgo: la cita sigue sin confirmar y le queda 1 día o menos de plazo.

## Mapa y optimización de rutas con grafos

**Mapa real estilo Google Maps.** Los mapas usan Leaflet con un mapa base vectorial de OpenFreeMap (dibujado con MapLibre), sin clave de API. Tienen un botón **Mapa / Satélite** (imágenes de Esri con los nombres de las calles), una ruta azul con chevrones de sentido, alternativas en gris, pines rojos en forma de gota con la hora de llegada, colores de tráfico verde, naranja y rojo, y los límites reales de Santa Anita, Ate y La Molina. Si el navegador no tiene WebGL o el mapa vectorial no carga, se usan los mosaicos de OpenStreetMap. Las citas, bases y sedes están ubicadas en calles reales; la numeración de las viviendas y las personas son ficticias. No se usan los mapas de Google, porque exigen una clave de API con facturación. Hay mapas en:

- **Contratista > Rutas**: mapa grande con pantalla completa, botón **Simular recorrido** (el motorizado avanza por las calles con el reloj de la ruta), vista de **una cuadrilla** o de **todas las cuadrillas** del día, comparación de caminos por tramo e indicaciones giro a giro.
- **Técnico > Mapa** y **Cómo llegar**: su ruta del día, la simulación y las indicaciones a la siguiente visita.
- **Pluz > Mapa de citas**: todas las solicitudes por estado. Además, hay un mapa pequeño en el detalle de cada cita y en el enlace del cliente.

Si no hay conexión a los mosaicos, el mapa dibuja la red vial propia como mapa base.

**Grafo vial real** (`js/geo-data.js`, generado con `tools/build_graph.py` desde OpenStreetMap):

- 6 800 intersecciones y 9 858 tramos con nombre, tipo de vía y **sentido de circulación** (se respetan las calles de un solo sentido).
- **Tráfico**: el tiempo de cada tramo es su tiempo a flujo libre multiplicado por un factor que depende de la hora (horas punta y mediodía), del tipo de vía (las avenidas se congestionan más) y de eventos activables: lluvia, obra en Av. Javier Prado Este, congestión en Av. Nicolás Ayllón (Carretera Central) y accidente en Av. La Molina.
- **Camino más rápido**: Dijkstra dependiente del tiempo, con montículo binario.
- **Rutas alternativas al mismo destino**: método de penalización (se encarecen los tramos de la ruta encontrada y se vuelve a buscar); se descartan las que se solapan más del 72 %.
- **Orden de visitas de A a B**: programación dinámica tipo Held–Karp con ventanas horarias y etiquetas Pareto. Primero minimiza los minutos fuera de franja, luego la hora de llegada a B y luego el tiempo de manejo. Se compara con el orden sin optimizar. El escenario ampliado tiene 12 viviendas.
- **Indicaciones giro a giro** calculadas con la geometría y los nombres de las calles.
- **En producción**: los tiempos podrían venir de un servicio con tráfico en tiempo real (por ejemplo, Google Routes API). Aquí el tráfico es un modelo simulado.

Para regenerar el grafo: descarga de Overpass las vías del recuadro `-12.100,-76.995,-12.018,-76.900` y los límites distritales (las consultas están en `tools/build_graph.py`) y ejecuta:

```bash
python3 tools/build_graph.py roads.json districts.json js/geo-data.js
```

## Estructura

```
index.html
css/styles.css
js/geo-data.js     red vial real (OpenStreetMap) y límites distritales
js/data.js         datos de ejemplo, decodificación del grafo, franjas
js/routing.js      tráfico, Dijkstra, alternativas, programación dinámica, indicaciones
js/store.js        estado compartido, reglas y flujo de WhatsApp
js/ui.js           íconos SVG y utilidades
js/map.js          mapas interactivos con Leaflet y animación del motorizado
vendor/leaflet/    Leaflet 1.9.4 (licencia BSD-2)
vendor/maplibre/   MapLibre GL JS 4.7.1 y puente para Leaflet (licencias BSD-3 e ISC)
tools/build_graph.py  genera geo-data.js desde OpenStreetMap
js/app.js          render, eventos, inicio de sesión y estructura
js/pluz.js         vista de Pluz
js/contratista.js  vista del contratista
js/tecnico.js      vista del técnico
js/cliente.js      enlace único del cliente
```

## Alcance y restricciones

Sin integraciones reales (Salesforce, SAP, WhatsApp, Google Maps), sin IA, sin datos reales y sin `localStorage`. Las llamadas, los mensajes de WhatsApp, «Cómo llegar» y la exportación a Excel son simulados. Las 34 citas, los nombres, los teléfonos, los DNI y la numeración de las viviendas son ficticios. Las calles y los límites distritales provienen de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL). Se muestra el banner permanente «Datos de ejemplo».

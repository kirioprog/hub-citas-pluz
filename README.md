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
3. **Agenda** → asigna **Cuadrilla 1** a Carlos.
4. **Cambiar de rol** → **Técnico** (Contratista A · Cuadrilla 1): Carlos aparece en la ruta, en el orden óptimo. Ábrelo → **Voy en camino** → **Llegué** → resultado → **Guardar**.
5. **Cambiar de rol** → **Pluz** → **Citas** → Carlos: el estado y la línea de tiempo lo reflejan todo.

Otras demostraciones:

- **Regla del día 4**: Pluz → Alertas → «Clientes ausentes» → Mateo Vega → *Ver opciones*. El día 4 solo deja la franja que encaja en la ruta ya programada de la Cuadrilla 3; las demás aparecen como «Afecta la ruta».
- **Agendamiento rápido**: Pluz → Agendamiento rápido → *Rellenar ejemplo* → *Buscar horarios*. Se proponen los horarios más próximos con menor desvío de ruta. Al crear la cita se genera el enlace único.
- **Enlace único**: desde el detalle de una cita o desde el chat, *Abrir como cliente*. También funciona en otra pestaña, por ejemplo `…/index.html#/c/T6vN2m` (Mateo) o `#/c/c8Kx2Q` (Carlos).
- **Rutas con tráfico**: Contratista → Rutas. Activa la lluvia, la obra en Javier Prado o la feria en Carretera Central, cambia la hora de salida o los puntos A y B y toca un tramo para ver las rutas alternativas.

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

## Reglas de agenda

- Franjas: lunes a viernes 08:00–18:00 y sábado 08:00–14:00, en bloques de 2 horas. Los domingos no hay visitas.
- La visita debe ocurrir entre el **día 1 y el día 3** desde la solicitud.
- **Día 4 (excepción)**: solo si ya existe una ruta programada ese día para la cuadrilla, la franja cae dentro de ese recorrido, nadie llega tarde y el desvío no supera 25 minutos. Si afecta la ruta, **no se reprograma** y el técnico mantiene la visita.
- Capacidad: 2 visitas por cuadrilla y franja. Antes de aceptar un horario, se inserta la visita en la ruta y se verifica que el técnico llegue dentro de la franja sin retrasar a nadie.
- En riesgo: la cita sigue sin confirmar y le queda 1 día o menos de plazo.

## Optimización de rutas con grafos (`js/routing.js`)

- **Grafo vial esquemático** de Santa Anita, Ate y La Molina: 35 intersecciones y tramos con tipo de vía (avenida, principal o calle) y distancia.
- **Tráfico**: el tiempo de cada tramo es su tiempo a flujo libre multiplicado por un factor que cambia según la hora (horas punta de mañana y tarde, y mediodía), el tipo de vía y los eventos (lluvia, obras, ferias).
- **Camino más rápido**: Dijkstra dependiente del tiempo; cada tramo se evalúa a la hora en que se recorre.
- **Rutas alternativas al mismo destino**: algoritmo de Yen (k caminos más cortos), descartando las que se solapan más del 70 %.
- **Orden de visitas del punto A al punto B**: programación dinámica tipo Held–Karp con ventanas horarias y etiquetas Pareto. Primero minimiza los minutos fuera de franja, luego la hora de llegada a B y luego el tiempo de manejo. Se compara con el orden sin optimizar.
- **En producción**: los tiempos por tramo podrían venir de un servicio con tráfico en tiempo real (por ejemplo, Google Routes API) y el mapa se podría dibujar con Google Maps. Este prototipo **no se conecta** a ningún servicio externo; el mapa es un recuadro esquemático de ejemplo.

## Estructura

```
index.html
css/styles.css
js/data.js         datos de ejemplo, grafo vial, franjas
js/routing.js      tráfico, Dijkstra, Yen, programación dinámica
js/store.js        estado compartido, reglas y flujo de WhatsApp
js/ui.js           íconos SVG y utilidades
js/map.js          mapa esquemático en SVG
js/app.js          render, eventos, inicio de sesión y estructura
js/pluz.js         vista de Pluz
js/contratista.js  vista del contratista
js/tecnico.js      vista del técnico
js/cliente.js      enlace único del cliente
```

## Alcance y restricciones

Sin integraciones reales (Salesforce, SAP, WhatsApp, Google Maps), sin mapa real, sin IA, sin datos reales y sin `localStorage`. Las llamadas, los mensajes de WhatsApp, «Cómo llegar» y la exportación a Excel son simulados. Las 8 citas, los nombres, los teléfonos y los DNI son ficticios. Se muestra el banner permanente «Datos de ejemplo».

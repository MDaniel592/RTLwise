---
title: "CDC: cuando dos relojes dejan de estar de acuerdo"
slug: cdc-cuando-los-relojes-no-acuerdan
excerpt: "Un clock crossing no se arregla poniendo dos flip-flops delante de cualquier bus: el circuito depende de si cruzas un bit, un pulso o una palabra completa."
category: RTL / FPGA
date: 2026-07-31
readTime: 7 min
image: /images/cdc.svg
imageAlt: "Una señal que cruza de un dominio de reloj a otro mediante un sincronizador"
tags: [cdc, clocks, verilog, metastabilidad]
---

## Contexto

Un *Clock Domain Crossing* aparece cada vez que una señal producida con `clk_a` se captura con `clk_b` y no existe una relación de fase que permita garantizar el tiempo de establecimiento y retención. El error no siempre aparece en simulación: puede depender de la fase exacta de dos relojes, de la temperatura o de una esquina de fabricación.

El problema físico es la metastabilidad. El flip-flop del dominio receptor puede necesitar más tiempo del previsto para decidir si ve un cero o un uno. Un buen CDC no elimina la probabilidad por completo; la reduce hasta un MTBF aceptable y mantiene la lógica de cada dominio coherente.

## Primero: clasifica lo que quieres cruzar

No existe un sincronizador universal. Antes de escribir RTL, identifica el tipo de información:

- **Nivel de un bit:** una condición que permanece estable varios ciclos.
- **Pulso:** un evento que puede durar menos de un ciclo del receptor.
- **Contador o estado pequeño:** un valor que cambia de forma controlada.
- **Bus de datos:** varias señales que deben conservar relación entre sí.
- **Flujo continuo:** muchas palabras con posible diferencia de frecuencia o ráfagas.

La elección del circuito depende más de esta clasificación que del número de líneas de código.

## El sincronizador de dos flip-flops

Para un nivel de un solo bit que permanece estable el tiempo suficiente, el patrón habitual es una cadena de dos flip-flops en el dominio destino. El primer registro es el que puede entrar en metastabilidad; el segundo recibe una versión con más tiempo para resolverla.

```systemverilog
(* ASYNC_REG = "TRUE" *) logic [1:0] sync_q;

always_ff @(posedge clk_b) begin
  sync_q <= {sync_q[0], signal_a};
end

assign signal_b = sync_q[1];
```

El atributo ayuda a que Vivado reconozca la intención y coloque los registros de forma adecuada. Dos flip-flops no convierten un pulso corto ni un bus entero en una transferencia segura: solo resuelven el caso de un nivel que puede esperar.

## Eventos y pulsos

Un pulso que dura un ciclo de `clk_a` puede desaparecer por completo entre dos flancos de `clk_b`. Para no perderlo, convierte el evento en un cambio de estado y sincroniza ese estado:

```systemverilog
// Dominio A: cada evento invierte el bit.
always_ff @(posedge clk_a) begin
  if (event_a)
    event_toggle_a <= ~event_toggle_a;
end

// Dominio B: sincroniza y detecta el cambio.
always_ff @(posedge clk_b) begin
  toggle_b1 <= event_toggle_a;
  toggle_b2 <= toggle_b1;
  toggle_bd <= toggle_b2;
end

assign event_b = toggle_b2 ^ toggle_bd;
```

Este patrón supone que no llegan nuevos eventos tan rápido como para que un cambio se pierda antes de ser observado. Si necesitas confirmar cada evento o aplicar backpressure, usa un handshake o una FIFO.

## Por qué un bus no se sincroniza bit a bit

Si sincronizas cada bit de un bus por separado, cada bit puede resolver la metastabilidad en un ciclo distinto. El receptor puede capturar una mezcla que nunca existió en el dominio origen. Para un bus estable puedes usar un protocolo de datos mantenidos con un `valid/ack`; para un flujo de palabras, la solución habitual es una FIFO asíncrona.

También hay CDC síncronos: dos relojes pueden derivar del mismo MMCM o PLL y tener una relación conocida, pero eso no significa que cualquier conexión entre ellos sea automáticamente segura. Si la relación de fase, el skew o la arquitectura no están controlados, el cruce debe tratarse como asíncrono y diseñarse como tal.

## Restricciones: necesarias, pero no curan el RTL

Vivado no puede confiar en el cálculo de slack de dos relojes sin relación de fase. En el XDC se pueden declarar grupos de relojes asíncronos o aplicar excepciones de timing cuando corresponda:

```tcl
set_clock_groups -asynchronous \
  -group [get_clocks clk_a] \
  -group [get_clocks clk_b]
```

La restricción evita que un camino asíncrono contamine el análisis como si fuera síncrono, pero no arregla una captura incorrecta. Primero existe el circuito CDC; después se describen sus relojes y excepciones. No conviene aplicar un `set_false_path` global para silenciar un bus que todavía no tiene sincronización.

## Referencia clásica

Para profundizar en sincronizadores, transferencia de pulsos, handshakes, buses y verificación CDC, merece la pena consultar el paper de Clifford E. Cummings presentado en SNUG Boston 2008:

- [Clock Domain Crossing (CDC) Design & Verification Techniques Using SystemVerilog (PDF)](http://www.sunburst-design.com/papers/CummingsSNUG2008Boston_CDC.pdf)
- [Ficha del paper en la Technical Library de Paradigm Works](https://www.paradigm-works.com/technical-library?term=clock+domain+crossing+%28cdc%29+design+%26+verification+techniques+using+systemverilog)

Es una referencia de fundamentos; para un flujo actual conviene combinarla con las restricciones y las comprobaciones CDC de la herramienta.

## Checklist

- ¿La señal es nivel, pulso, bus o flujo continuo?
- ¿La información puede esperar al receptor?
- ¿El receptor necesita confirmación o backpressure?
- ¿El bus conserva la coherencia de sus bits?
- ¿Los relojes están realmente relacionados o solo comparten una caja de IP?
- ¿El CDC está identificado en `report_cdc` y correctamente restringido?

Un CDC bien diseñado no es el que deja de dar errores en una simulación. Es el que tiene una historia clara para cada bit, cada evento y cada palabra que cruza de un reloj al otro.

La guía de AMD sobre [CDC asíncronos](https://docs.amd.com/r/en-US/ug903-vivado-using-constraints/Asynchronous-Clock-Domain-Crossings?contentId=tIOBNIURtFIIg9XHBYp01Q) y la sección de [Clock Domain Crossing en UG949](https://docs.amd.com/r/2024.2-English/ug949-vivado-design-methodology/Clock-Domain-Crossing) son buenas referencias para revisar el cierre.

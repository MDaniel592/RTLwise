---
title: "Reset con intención: cuándo limpiar un datapath"
slug: reset-con-intencion-datapath
excerpt: "En un AXI4-Stream, la integridad no depende de poner el payload a cero, sino de respetar el contrato de validez."
category: RTL / FPGA
date: 2026-08-03
readTime: 9 min
featured: true
image: /images/reset-datapath.svg
imageAlt: "Un reset conectado al control de un datapath y no a sus 256 bits de payload"
tags: [rtl, axi-stream, reset, fpga]
---

## Contexto

Resetear todo por costumbre parece una decisión inocente: poner cada registro a cero y empezar desde un estado conocido. En el control suele ser lo correcto. En un datapath ancho, en cambio, puede significar distribuir una señal de reset a cientos o miles de registros que todavía no tienen un significado arquitectónico.

La pregunta útil no es «¿puedo poner este registro a cero?», sino «¿hay alguien que pueda observarlo antes de que sea válido?». Si nadie puede hacerlo, el reset del dato puede sobrar.

## Pasos

### El contrato de AXI4-Stream

En un canal AXI4-Stream, `TVALID` indica que los campos de la carga útil (*payload*) —por ejemplo `TDATA`, `TLAST` o `TKEEP`— contienen una transferencia válida. La transferencia ocurre cuando ambas señales valen `1` en el mismo flanco. Mientras `TVALID=1` y `TREADY=0`, el productor debe mantener estable el payload hasta que el receptor acepte la palabra.

La consecuencia es clara: durante reset, `TVALID` debe permanecer a cero; mientras `TVALID` sea cero, el contenido de `TDATA` no representa una transferencia. No hace falta propagar el reset a los bits que nadie puede consumir. El contrato exacto y cualquier regla adicional de tu IP deben comprobarse en la integración; la [guía de AXI4-Stream](https://docs.amd.com/r/en-US/pg256-sdfec-integrated-block/AXI4-Stream-Interface) resume este handshake.

### Un ejemplo de 256 bits

Imagina una etapa que empaqueta una palabra de 256 bits:

```systemverilog
logic        m_axis_tvalid;
logic [255:0] m_axis_tdata;
logic        m_axis_tready;
logic        transfer;

assign transfer = m_axis_tvalid && m_axis_tready;
```

El control que decide si hay una palabra pendiente sí necesita arrancar en un valor conocido. El bus `m_axis_tdata`, por sí mismo, no: solo debe cargarse cuando hay una nueva palabra que presentar y mantenerse mientras la palabra esté bloqueada por `TREADY`.

El mismo razonamiento se aplica a una tubería. Si hay cuatro etapas de 256 bits, hay `4 × 256 = 1.024` flip-flops de datapath. El contenido puede quedar indefinido durante reset y seguir siendo seguro si cada etapa tiene su bit `valid` y nunca deja avanzar un dato sin validez.

### El cálculo orientativo

La cifra exacta depende de la FPGA, la biblioteca de celdas ASIC y las opciones del sintetizador. Lo que sí podemos contar sin herramientas es el alcance del reset:

- Una sola palabra de 256 bits: **256 receptores de reset** si se resetean todos sus registros.
- Cuatro etapas: **1.024 receptores de reset** para el payload.
- Cuatro etapas también necesitan solo **4 bits de `valid`** para marcar si hay una palabra utilizable, además del resto del control.
- El datapath no desaparece: siguen existiendo 1.024 registros; desaparece su dependencia del reset y la lógica/red asociada.

Para poner una cifra de área ilustrativa, supongamos una celda sin reset de `1,00` unidades y una celda con reset de `1,08` unidades. No es una promesa universal, solo una forma de ver la magnitud:

```text
1 etapa:
  con reset    = 256 × 1,08 = 276,48 unidades
  sin reset    = 256 × 1,00 = 256,00 unidades
  diferencia   = 20,48 unidades

4 etapas:
  con reset    = 1.024 × 1,08 = 1.105,92 unidades
  sin reset    = 1.024 × 1,00 = 1.024,00 unidades
  diferencia   = 81,92 unidades
```

En este modelo se evita aproximadamente un 8% del coste de las celdas de almacenamiento del datapath, además de 1.024 conexiones al árbol de reset. En una FPGA, el resultado puede verse menos como «menos LUTs» y más como menos fanout, menos congestión y menos problemas de *control set*. El informe de síntesis y *place and route* es el que manda; herramientas como Vivado pueden decidir si un reset se extrae al pin dedicado o se implementa en la lógica de datos según sus heurísticas y restricciones.

### Un patrón RTL más preciso

Separa el registro de validez del registro de datos. El control se resetea; el payload solo se actualiza cuando el productor puede reemplazar la palabra actual:

```systemverilog
logic         valid_q;
logic [255:0] data_q;
logic         slot_available;

assign m_axis_tvalid = valid_q;
assign m_axis_tdata  = data_q;
assign slot_available = !valid_q || m_axis_tready;

// El protocolo necesita conocer este estado después del reset.
always_ff @(posedge aclk or negedge aresetn) begin
  if (!aresetn) begin
    valid_q <= 1'b0;
  end else if (slot_available) begin
    valid_q <= source_valid;
  end
end

// El payload no necesita reset: nadie lo consume con valid_q a cero.
always_ff @(posedge aclk) begin
  if (slot_available && source_valid) begin
    data_q <= source_data;
  end
end
```

Si `valid_q=1` y `m_axis_tready=0`, `slot_available` es cero y `data_q` se conserva. Esa es la parte que protege la integridad del bus: no el valor de reset del payload, sino la relación entre `TVALID`, `TREADY` y la estabilidad del dato.

### ¿Y si escribimos `X`?

En algunos flujos se escribe lo siguiente para expresar un *don't care* al sintetizador:

```systemverilog
if (!aresetn) begin
  valid_q <= 1'b0;
  data_q  <= 'x;
end
```

Puede ayudar a que la herramienta vea que el valor de `data_q` durante reset no importa, pero no debe tratarse como una orden portable para eliminar el reset. El significado de `'x` durante simulación es un desconocido real: puede propagarse por la forma de onda y descubrir accesos incorrectos, pero también puede ocultar un problema si el testbench no comprueba el protocolo.

El patrón más determinista es no asignar reset al datapath y verificar la propiedad que lo hace seguro:

```systemverilog
assert property (@(posedge aclk)
  m_axis_tvalid && !m_axis_tready
  |=> m_axis_tvalid && $stable(m_axis_tdata));
```

Usa `'x` como ayuda de verificación y como *don't care* consciente del flujo, no como sustituto de mirar el reporte de síntesis. También revisa si tu IP exige que señales opcionales permanezcan estables aun con `TVALID=0`.

## Checklist

- Resetea `TVALID`, estados, contadores y punteros que definen el protocolo.
- No resetees `TDATA` solo porque el registro existe.
- Mantén `TDATA` y sidebands estables mientras `TVALID=1` y `TREADY=0`.
- Comprueba que ninguna lógica consume el payload cuando `TVALID=0`.
- Compara fanout, control sets, timing y área antes y después.
- Trata `'x` como una decisión de verificación/síntesis dependiente de herramienta.

Un reset debe dejar el sistema en un estado seguro, no necesariamente borrar cada bit que todavía no tiene significado. En datapaths anchos, esa diferencia se repite en cada etapa y termina siendo una decisión de arquitectura.

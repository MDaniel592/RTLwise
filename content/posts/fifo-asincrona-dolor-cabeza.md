---
title: "FIFO asíncrona: la frontera que evita dolores de cabeza"
slug: fifo-asincrona-dolor-cabeza
excerpt: "Cuando dos relojes no comparten fase y además quieres transportar un bus completo, una FIFO te ahorra capturas imposibles y backpressure improvisado."
category: RTL / FPGA
date: 2026-07-29
readTime: 7 min
image: /images/async-fifo.svg
imageAlt: "Una FIFO asíncrona separando los dominios de escritura y lectura"
tags: [fifo, cdc, xilinx, axi-stream]
---

## Contexto

Cruzar un bit entre relojes ya requiere cuidado. Cruzar un bus de datos, absorber una ráfaga y permitir que el productor y el consumidor tengan frecuencias distintas es otra escala del mismo problema.

Una FIFO asíncrona pone una frontera explícita entre los dominios: el lado de escritura solo conoce `wr_clk`, el lado de lectura solo conoce `rd_clk`, y la memoria intermedia conserva las palabras mientras los punteros y las banderas se sincronizan de forma controlada.

## Qué hay dentro

Una implementación típica tiene:

1. Una memoria dual-port accesible desde ambos relojes.
2. Un puntero de escritura en el dominio origen.
3. Un puntero de lectura en el dominio destino.
4. Copias sincronizadas de cada puntero en el dominio contrario.
5. Lógica `full` y `empty` calculada localmente.

Los punteros suelen viajar codificados en Gray para que solo cambie un bit por incremento. Así el dominio contrario no observa una transición de varios bits binarios a la vez. La FIFO no elimina la metastabilidad de los punteros; la encierra en sincronizadores de control y evita usar un bus de datos capturado a medias.

## La regla de uso

El lado de escritura solo escribe si la FIFO no está llena. El lado de lectura solo lee si no está vacía:

```systemverilog
assign do_write = wr_en && !full;
assign do_read  = rd_en && !empty;

always_ff @(posedge wr_clk) begin
  if (do_write)
    memory[wr_addr] <= din;
end

always_ff @(posedge rd_clk) begin
  if (do_read)
    dout <= memory[rd_addr];
end
```

El ejemplo muestra la intención, no una FIFO completa: faltan los punteros Gray, sus sincronizadores, la detección de `full/empty` y el tratamiento del reset. Para producción, una FIFO parametrizada o una XPM suele ser más segura que inventar la lógica desde cero.

## Un tamaño que se puede calcular

Supón una frontera AXI4-Stream con palabras de 256 bits y una capacidad de 1.024 palabras:

```text
capacidad = 1.024 palabras × 256 bits
          = 262.144 bits
          = 32 KiB de almacenamiento
```

Ese espacio no arregla una diferencia de tasa permanente: si el lado de escritura produce más rápido durante mucho tiempo, la FIFO acabará llena. Sí puede absorber una ráfaga, una pausa temporal del consumidor o la latencia de otro bloque sin convertir cada ciclo de `TREADY=0` en un problema de CDC.

En una FPGA de Xilinx/AMD, esa memoria puede mapearse a Block RAM, UltraRAM o lógica distribuida según la profundidad, el ancho y la configuración. La elección debe confirmarse en el informe de utilización, no asumirse por el nombre del IP.

## Con AXI4-Stream

Una frontera AXI4-Stream suele mapearse de forma natural:

```text
dominio A                         dominio B
-----------                       -----------
TVALID ──> wr_en       FIFO       rd_en <── TREADY
TDATA  ──> din       async       dout ──> TDATA
                         │
                    full / empty
```

En la entrada, `s_axis_tready` puede derivarse de `!full`. En la salida, `m_axis_tvalid` puede derivarse de `!empty`. Si el receptor baja `TREADY`, el lado de lectura deja de consumir y la FIFO conserva el dato hasta que vuelva a haber espacio. La interfaz sigue siendo válida porque la palabra no sale de la FIFO hasta que el handshake ocurre.

## Una XPM como punto de partida

Para un diseño Xilinx, el esqueleto de configuración puede empezar así:

```systemverilog
xpm_fifo_async #(
  .CDC_SYNC_STAGES  (2),
  .FIFO_MEMORY_TYPE ("auto"),
  .FIFO_WRITE_DEPTH (1024),
  .WRITE_DATA_WIDTH (256),
  .READ_DATA_WIDTH  (256),
  .READ_MODE        ("std")
) u_axis_fifo (
  .rst            (fifo_rst),
  .wr_clk         (wr_clk),
  .rd_clk         (rd_clk),
  .din            (s_axis_tdata),
  .wr_en          (s_axis_tvalid && s_axis_tready),
  .rd_en          (m_axis_tvalid && m_axis_tready),
  .dout           (m_axis_tdata),
  .full           (fifo_full),
  .empty          (fifo_empty)
  // Conecta también los puertos restantes según la versión de Vivado.
);
```

La señal de reset y las señales `wr_rst_busy`/`rd_rst_busy` deben integrarse con el arranque real del sistema. Los indicadores `full` y `empty` atraviesan lógica de sincronización: no aparecen en el dominio contrario exactamente en el mismo ciclo en que cambió el puntero. Esa latencia es normal y hay que tenerla en cuenta en el protocolo.

## Cuándo usar otra cosa

- Un único bit estable: dos flip-flops pueden ser suficientes.
- Un pulso aislado: un toggle o un handshake puede ser más pequeño.
- Un bus que cambia muy poco: un protocolo de datos mantenidos con `valid/ack` puede evitar la memoria.
- Un flujo con relojes independientes, ráfagas o backpressure: la FIFO suele ser la frontera más clara.

No uses una FIFO para ocultar una frecuencia mal calculada. Úsala para expresar que hay dos dominios independientes y que necesitas almacenar la diferencia temporal entre ellos.

## Checklist

- ¿Los relojes son independientes o solo tienen una relación conocida?
- ¿La profundidad absorbe la ráfaga máxima y la latencia de backpressure?
- ¿La palabra incluye todos los sidebands necesarios (`TLAST`, `TKEEP`, `TUSER`)?
- ¿Se respetan `full` y `empty` en sus dominios locales?
- ¿El reset libera ambos dominios de forma segura?
- ¿El informe confirma la memoria y los sincronizadores esperados?

La FIFO no es un parche. Es una declaración de arquitectura: entre estos dos relojes hay una frontera y la información debe esperar en una cola hasta que el otro lado pueda recibirla.

Para una implementación de bus, la guía de AMD recomienda una FIFO de reloj independiente para transportar buses entre dominios asíncronos; revisa la sección de [CDC asíncrono](https://docs.amd.com/r/en-US/ug574-ultrascale-clb/Asynchronous-Clock-Domain-Crossing) y las notas de [FIFO de reloj independiente](https://docs.amd.com/r/en-US/pg327-emb-fifo-gen/Simultaneous-Assertion-of-Full-and-Empty-Flag).

---
title: "XPM: configurar el hardware desde el propio RTL"
slug: xpm-configurar-hardware-desde-rtl
excerpt: "Los Xilinx Parameterized Macros permiten llevar la configuración de CDC, FIFOs y memorias al código, con menos artefactos generados y más facilidad para revisar cambios."
category: RTL / FPGA
date: 2026-07-27
readTime: 7 min
image: /images/xpm-rtl.svg
imageAlt: "Un wrapper RTL que parametriza una macro XPM mediante constantes de configuración"
tags: [xpm, xilinx, vivado, rtl]
---

## Contexto

Hay bloques que se pueden construir en RTL, pero que no merece la pena reinventar: un sincronizador, una FIFO dual-clock, una memoria dual-port o un reset synchronizer. El catálogo de IP de Vivado resuelve muchos de ellos con un asistente gráfico y un fichero `.xci`.

Los Xilinx Parameterized Macros (XPM) ofrecen otra vía: instanciar una macro soportada por Vivado directamente en el código, parametrizarla y conectar sus puertos en un módulo que vive junto al resto del diseño. La [guía UG974](https://docs.amd.com/r/en-US/ug974-vivado-ultrascale-libraries/Xilinx-Parameterized-Macros) agrupa macros de CDC, FIFO y memoria, además de otras primitivas de la arquitectura.

No es una solución universal ni RTL portable entre fabricantes. Es una forma de expresar en el fuente una configuración que, de otro modo, quedaría repartida entre una GUI, un `.xci` y artefactos generados.

## Qué ganas al llevarlo al código

- **Cambios revisables:** un diff muestra si la profundidad de la FIFO pasó de 512 a 1024 o si el sincronizador pasó de dos a tres etapas.
- **Variantes limpias:** un mismo wrapper puede generar una FIFO de 64 o 256 bits mediante parámetros.
- **Repetibilidad:** el flujo de proyecto, no-project o CI usa la misma fuente en lugar de depender de una configuración hecha a mano.
- **Integración local:** los puertos y las decisiones de reset quedan al lado del protocolo que los utiliza.
- **Menos ruido de generación:** para una macro pequeña no necesitas arrastrar un bloque de IP completo y sus ficheros auxiliares.

La contrapartida es el acoplamiento a AMD/Xilinx, a la familia FPGA y a la versión de Vivado que reconoce esa macro y esos parámetros. El código queda más limpio, pero no deja de ser código específico del fabricante.

## Ejemplo: un sincronizador parametrizado

En vez de escribir a mano una cadena de flip-flops o abrir un IP para un solo bit, encapsula `XPM_CDC_SINGLE` en un módulo con una interfaz propia:

```systemverilog
module cdc_single #(
  parameter int DEST_SYNC_FF = 2
) (
  input  logic src_clk,
  input  logic dest_clk,
  input  logic src_in,
  output logic dest_out
);

  xpm_cdc_single #(
    .DEST_SYNC_FF (DEST_SYNC_FF),
    .INIT_SYNC_FF (0),
    .SIM_ASSERT_CHK (1),
    .SRC_INPUT_REG (1)
  ) i_cdc_single (
    .dest_out (dest_out),
    .dest_clk (dest_clk),
    .src_clk  (src_clk),
    .src_in   (src_in)
  );

endmodule
```

El módulo de aplicación no tiene que conocer todos los parámetros de la macro. Solo decide lo que importa para su sistema:

```systemverilog
cdc_single #(
  .DEST_SYNC_FF (3) // más margen MTBF, más latencia
) u_irq_cdc (
  .src_clk  (peripheral_clk),
  .dest_clk (control_clk),
  .src_in   (irq_peripheral),
  .dest_out (irq_control)
);
```

El wrapper es importante. Evita que veinte módulos instancien XPM con combinaciones distintas de parámetros y deja una política común para reset, atributos y verificación.

## El mismo enfoque para una FIFO

Para una FIFO de reloj independiente, la configuración también puede vivir en el módulo:

```systemverilog
module data_fifo #(
  parameter int DATA_WIDTH = 256,
  parameter int FIFO_DEPTH = 1024
) (...);

  xpm_fifo_async #(
    .CDC_SYNC_STAGES  (2),
    .FIFO_MEMORY_TYPE ("auto"),
    .FIFO_WRITE_DEPTH (FIFO_DEPTH),
    .WRITE_DATA_WIDTH (DATA_WIDTH),
    .READ_DATA_WIDTH  (DATA_WIDTH),
    .READ_MODE        ("std")
  ) i_fifo (
    .rst      (fifo_rst),
    .wr_clk   (wr_clk),
    .rd_clk   (rd_clk),
    .din      (din),
    .wr_en    (wr_en),
    .rd_en    (rd_en),
    .dout     (dout),
    .full     (full),
    .empty    (empty)
    // Conecta los puertos restantes según la versión de Vivado.
  );

endmodule
```

La FIFO de 256 bits y 1024 palabras del ejemplo anterior se convierte en otra instancia del mismo módulo, no en otro proyecto de IP:

```systemverilog
data_fifo #(
  .DATA_WIDTH (256),
  .FIFO_DEPTH (1024)
) u_stream_fifo (...);
```

La forma concreta de los puertos y los parámetros disponibles debe copiarse de la plantilla de la versión instalada de Vivado. UG974 incluye plantillas de instanciación y macros como `XPM_FIFO_ASYNC`, `XPM_FIFO_AXIS`, `XPM_CDC_SINGLE` y `XPM_MEMORY_TDPRAM`.

## XPM frente a un IP del catálogo

### Elige XPM cuando

- El bloque es pequeño y la interfaz se entiende en unas pocas señales.
- Quieres que parámetros, clocks y reset estén en el mismo wrapper que el protocolo.
- Necesitas muchas variantes del mismo CDC, FIFO o memoria.
- Trabajas con un flujo no-project o quieres construir en CI desde fuentes y Tcl.

### Elige un IP completo cuando

- Necesitas una configuración extensa o una GUI que evita errores de integración.
- El bloque incluye lógica compleja, buses completos, transacciones, drivers o una interfaz física.
- El IP entrega generación de constraints, ejemplos, modelos de simulación o soporte específico que no quieres reconstruir.
- El equipo necesita una configuración gráfica estandarizada para usuarios que no editan RTL.

Un XPM tampoco elimina la necesidad de revisar el informe de síntesis y timing. Es una macro de proveedor que Vivado interpreta y mapea a los recursos adecuados; no es una caja negra mágica ni una garantía de que los parámetros elegidos sean válidos para cualquier familia.

## Flujo mínimo reproducible

1. Busca la macro en UG974 o en las plantillas de instanciación de Vivado.
2. Copia la plantilla en un wrapper propio y elimina los puertos que tu política no exponga solo después de entenderlos.
3. Parametriza lo que tenga significado arquitectónico: ancho, profundidad, número de etapas, modo de lectura y memoria.
4. Añade una simulación o una aserción para el contrato del wrapper.
5. Comprueba utilización, warnings, CDC y timing con la familia y la versión objetivo.
6. Documenta la versión de Vivado y la familia soportada junto al módulo.

En un flujo no-project, Vivado necesita reconocer las XPM mediante `auto_detect_xpm`; en el flujo de proyecto, al añadir los fuentes normalmente queda preparado para identificarlas. No des por hecho que un script que funciona en el IDE funciona igual en CI.

## Checklist

- ¿El bloque es realmente una macro pequeña o necesita la infraestructura de un IP completo?
- ¿El wrapper oculta los detalles de proveedor sin esconder las decisiones importantes?
- ¿Los parámetros tienen valores legales para la familia objetivo?
- ¿Se ha copiado la plantilla de la versión de Vivado que se va a usar?
- ¿El flujo no-project reconoce XPM con `auto_detect_xpm`?
- ¿Hay una prueba que compruebe `full/empty`, CDC, reset o el protocolo correspondiente?

La ventaja no es tener menos líneas. Es que la configuración deja de vivir en una ventana que alguien debe recordar abrir y pasa a formar parte del diseño que se revisa, versiona y construye.

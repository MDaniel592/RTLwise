---
title: "MTS en RFSoC: sincronizar tiles sin perseguir la latencia"
slug: mts-rfsoc-sincronizar-tiles
excerpt: "Qué resuelve Multi-Tile Synchronization en el RF Data Converter y cuál es la estructura mínima para ponerlo en marcha en Xilinx/AMD."
category: Hardware
date: 2026-08-02
readTime: 8 min
image: /images/mts-rfsoc.svg
imageAlt: "Tres tiles RF sincronizados por una señal SYSREF y una referencia común"
tags: [xilinx, rfsoc, mts, sysref]
---

## Contexto

En un RFSoC, cada tile de RF-ADC o RF-DAC tiene su propia infraestructura de reloj y datos. Dentro de un mismo tile la latencia está acotada por una infraestructura compartida, pero al combinar varios tiles aparece una pregunta más difícil: ¿todos los conversores entregan o consumen la muestra en el mismo instante relativo?

MTS (*Multi-Tile Synchronization*) es la función del RF Data Converter que busca una alineación relativa y determinista entre varios tiles —e incluso entre varios dispositivos—. No es un CDC genérico ni un sustituto de un buen diseño de reloj: es el mecanismo específico del IP de RFSoC para medir y ajustar las diferencias internas de latencia.

## Qué problema resuelve

Las FIFOs y los *gearboxes* que conectan la parte analógica con la lógica programable pueden introducir una latencia que no coincide entre tiles. La frecuencia puede ser correcta en todos ellos y, aun así, dos canales paralelos pueden estar desplazados algunas muestras.

MTS usa SYSREF, los relojes del sistema y las FIFOs internas para capturar la referencia, alinear fases y medir la latencia de cada camino. Después ajusta los offsets para que el grupo quede alineado. El objetivo es la latencia relativa y determinista; el número que devuelve el driver no debe interpretarse como la latencia absoluta completa del conversor.

## Estructura mínima en Xilinx/AMD

La implementación mínima tiene tres capas. Los nombres exactos de puertos y opciones cambian con la generación del RFSoC y la versión del IP, así que conviene revisar siempre la versión de PG269 que corresponde al dispositivo.

### 1. Configurar el RF Data Converter

En el IP de RF Data Converter, habilita Multi-Tile Synchronization para los tiles que pertenezcan al grupo. El tile 0 debe estar activo como referencia del grupo en las configuraciones habituales de RF-ADC y RF-DAC. Configura también los anchos de interfaz y las tasas de muestreo antes de sincronizar: cambiar esos parámetros después obliga a repetir el proceso.

### 2. Darle una referencia común

Los relojes analógicos y digitales deben estar activos y bloqueados antes de comenzar. El diseño necesita una señal PL clock y una SYSREF de usuario que lleguen a la estructura de MTS; para capturar SYSREF de forma fiable, la frecuencia del PL clock debe ser un múltiplo entero común de los relojes AXI4-Stream de los conversores del grupo.

Una estructura conceptual mínima es:

```text
clock generator ──┬──> RF Data Converter / Tile 0
                  ├──> RF Data Converter / Tile 1
PL clock ─────────┴──> fabric + MTS
SYSREF ─────────────────> MTS / RFDC
```

La colocación de los pines de PL clock y SYSREF es responsabilidad del diseño. No basta con conectar SYSREF: hay que comprobar que la red de reloj, el pinout y las restricciones del dispositivo permiten capturarla con el margen esperado.

### Nota de hardware: el reloj empieza en la placa

En una plataforma real, el reloj de los tiles suele partir de un origen común: un *clocking device* como un LMK, un LMX o una combinación de ambos. Dependiendo de la placa y de la generación del RFSoC, el LMK puede encargarse de limpiar y distribuir referencias y SYSREF, mientras que los LMX pueden generar los relojes RF o las referencias de los PLL internos de los tiles.

La distribución no es un detalle cosmético. Las salidas hacia los distintos tiles se enrutan como una red diferencial controlada, con longitudes y skew estudiados para que los relojes lleguen con una relación de fase reproducible. La misma atención se aplica a SYSREF y a su relación con `PL_SYSREF`: igualar longitudes ayuda, pero también hay que revisar impedancia, terminación, pérdidas, retorno de masa, jitter y el presupuesto de skew completo.

Una forma de pensar el árbol es:

```text
                 ┌──> RF-ADC / RF-DAC tile 0
LMK / LMX ───────┼──> RF-ADC / RF-DAC tile 1
origen común     ├──> RF-ADC / RF-DAC tile 2
                 └──> PL clock + PL_SYSREF
                 PCB: pares diferenciales y skew controlado
```

MTS puede medir y ajustar parte de la latencia digital de las FIFOs, pero no puede corregir cualquier error de distribución de reloj o una captura de SYSREF fuera de especificación. En placas de evaluación como ZCU111, la red combina LMK y LMX para generar las referencias y relojes del RF Data Converter; en un diseño propio, la arquitectura exacta debe salir del presupuesto de reloj y del layout, no copiarse sin más.

### 3. Lanzar la sincronización desde el driver

El driver RFdc inicializa una estructura por grupo y lanza la sincronización para RF-ADC o RF-DAC. Un esqueleto mínimo para sincronizar los tiles 0 y 1 de ADC es:

```c
XRFdc_MultiConverter_Sync_Config mts_cfg;
u32 status;

XRFdc_MultiConverter_Init(
    &mts_cfg,
    NULL,              // códigos PLL opcionales
    NULL,              // códigos T1 opcionales
    0                  // RefTile: tile 0
);

mts_cfg.Tiles = 0x3;  // tiles 0 y 1

status = XRFdc_MultiConverter_Sync(
    &rfdc,
    XRFDC_ADC_TILE,
    &mts_cfg
);
```

Para un grupo DAC se repite el flujo con el tipo correspondiente. En un proyecto real hay que comprobar `XRFDC_MTS_OK` y registrar el diagnóstico si aparece un timeout, un marker mismatch o un problema de soporte. La llamada `XRFdc_MultiConverter_Init` debe ejecutarse antes de `XRFdc_MultiConverter_Sync`.

Este fragmento es solo el esqueleto de la llamada: antes hay que inicializar el driver RFdc, configurar el dispositivo y asegurarse de que el bitstream expone la configuración de MTS esperada.

## Código C oficial para partir de algo real

AMD/Xilinx publica un ejemplo de aplicación que inicializa el driver RFdc y ejecuta una prueba MTS sobre un grupo de tiles. Es una referencia más completa que el fragmento anterior porque incluye la inicialización del dispositivo, la comprobación de factores de decimación/interpolación y el informe del resultado:

- [Ejemplo `xrfdc_mts_example.c`](https://xilinx.github.io/embeddedsw.github.io/rfdc/doc/html/api/xrfdc__mts__example_8c.html).
- [Implementación de las APIs MTS en `xrfdc_mts.c`](https://xilinx.github.io/embeddedsw.github.io/rfdc/doc/html/api/xrfdc__mts_8c.html).
- [Código fuente de `xrfdc_mts.c` en `Xilinx/embeddedsw`](https://github.com/Xilinx/embeddedsw/blob/master/XilinxProcessorIPLib/drivers/rfdc/src/xrfdc_mts.c).
- [Driver RFdc en `Xilinx/embeddedsw`](https://github.com/Xilinx/embeddedsw/tree/master/XilinxProcessorIPLib/drivers/rfdc).
- [Overlay oficial `Xilinx/RFSoC-MTS`](https://github.com/Xilinx/RFSoC-MTS), útil para ver un diseño completo sobre PYNQ y placas RFSoC compatibles.

El ejemplo C no sustituye a la configuración de Vivado ni al diseño de reloj de la placa. Sirve para conectar el bitstream con el flujo de software que llama a `Init` y `Sync`, y para ver qué estados y códigos de error conviene registrar.

## La latencia objetivo: medir una vez y fijar después

Hay un detalle del código oficial que conviene no pasar por alto: `Target_Latency` se maneja por defecto con `-1`. Es un valor útil durante la primera puesta en marcha, cuando todavía no conoces la latencia de tu combinación concreta de dispositivo, configuración del RF Data Converter, relojes y placa. En ese modo, MTS mide las latencias y calcula un objetivo a partir del resultado disponible.

Una vez que la ejecución termina correctamente, guarda el valor de latencia final reportado por el grupo —validando que los tiles participantes quedan alineados— y úsalo como `Target_Latency` en las siguientes ejecuciones. Es importante asignarlo después de `XRFdc_MultiConverter_Init` y antes de llamar a `XRFdc_MultiConverter_Sync`:

```c
/* Primera puesta en marcha: descubrir la latencia del sistema. */
XRFdc_MultiConverter_Init(&mts_cfg, NULL, NULL, XRFDC_TILE_ID0);
mts_cfg.Tiles = 0x3;
mts_cfg.Target_Latency = -1;

status = XRFdc_MultiConverter_Sync(&rfdc, XRFDC_ADC_TILE, &mts_cfg);
if (status == XRFDC_MTS_OK) {
    printf("ADC0 latency = %d T1\n", mts_cfg.Latency[0]);
    printf("ADC1 latency = %d T1\n", mts_cfg.Latency[1]);
    /* Tras validarlo, conservar el objetivo en la configuración del proyecto. */
}

/* Ejecuciones posteriores: usar el valor medido y validado, por ejemplo 384. */
XRFdc_MultiConverter_Init(&mts_cfg, NULL, NULL, XRFDC_TILE_ID0);
mts_cfg.Tiles = 0x3;
mts_cfg.Target_Latency = 384; /* unidades T1 del tile */

status = XRFdc_MultiConverter_Sync(&rfdc, XRFDC_ADC_TILE, &mts_cfg);
```

Fijar el objetivo hace que el arranque vuelva a perseguir la misma latencia de referencia en lugar de aceptar una nueva medida como base cada vez. Bajo la misma configuración de bitstream, reloj, SYSREF y alimentación, esto reduce variaciones difíciles de diagnosticar y evita perseguir fantasmas causados por haber dejado el valor de descubrimiento por descuido. Si cambia el rate, la interpolación/decimación, el ancho de interfaz, la red de reloj, el dispositivo o el estado de un tile, hay que repetir la caracterización: en ese caso el valor almacenado puede dejar de ser alcanzable y el driver puede avisar de que el objetivo es demasiado bajo.

## Qué ocurre durante MTS

El proceso puede resumirse así:

1. Se habilitan los relojes y los generadores de SYSREF.
2. Cada tile captura SYSREF y ajusta su retardo interno.
3. Un borde posterior de SYSREF alinea las fases de los divisores.
4. Se mide y ajusta la latencia de las FIFOs de cada tile.
5. Las funciones digitales que afectan a la alineación se actualizan usando eventos dinámicos sincronizados con SYSREF.

El IP y el driver automatizan buena parte de los pasos de captura, reset de divisores y ajuste de FIFOs. Eso no elimina la responsabilidad de arrancar el sistema con los relojes estables ni de volver a sincronizar después de cambiar una frecuencia, un ancho de interfaz o el estado de alimentación de un tile.

## Errores habituales

- Tratar MTS como si solo fuera conectar todos los `aclk` al mismo reloj.
- No incluir el tile de referencia en la máscara del grupo.
- Empezar la sincronización antes de que los relojes estén bloqueados.
- Confundir la latencia relativa reportada con la latencia absoluta del camino analógico completo.
- Cambiar el rate, el ancho de palabra o reiniciar un tile y seguir usando el resultado de la sincronización anterior.
- Dejar SYSREF libre durante una actualización que necesita una referencia controlada.

## Checklist

- ¿Los tiles que deben alinearse están habilitados en el mismo grupo MTS?
- ¿El tile 0 está presente como referencia?
- ¿PL clock, SYSREF y relojes RF están definidos y bloqueados?
- ¿Se ejecutan `Init` y `Sync` por separado para ADC y DAC cuando corresponde?
- ¿Se comprueba el código de retorno y se registran las latencias/offsets?
- ¿Se repite MTS después de una reconfiguración que afecte al camino?

MTS no hace que los relojes sean mágicamente iguales. Convierte una latencia interna variable en una latencia relativa que puedes medir, ajustar y volver a reproducir.

Consulta la sección oficial de [Multi-Tile Synchronization](https://docs.amd.com/r/en-US/pg269-rf-data-converter/Multi-Tile-Synchronization), los [pasos de sincronización](https://docs.amd.com/r/en-US/pg269-rf-data-converter/Synchronization-Steps), los [requisitos de SYSREF](https://docs.amd.com/r/en-US/pg269-rf-data-converter/SYSREF-Signal-Requirements) y la [aplicación práctica de MTS](https://docs.amd.com/r/en-US/xapp1349-rfdc-subsystems/Practical-Application-of-MTS) antes de trasladar este esqueleto a un dispositivo concreto.

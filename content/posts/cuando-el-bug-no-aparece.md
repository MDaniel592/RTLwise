---
title: "Cuando el bug no aparece: parar también es depurar"
slug: cuando-el-bug-no-aparece
excerpt: "Después de horas mirando la misma waveform, a veces la mejor herramienta de verificación es tomar distancia y volver a definir el problema."
category: Verificación
date: 2026-08-03
readTime: 7 min
image: /images/testbench-pausa.svg
imageAlt: "Una waveform compleja que se convierte en un caso mínimo de verificación"
tags: [verificacion, testbench, debug, rtl]
---

## Contexto

### El punto en el que seguir ya no es avanzar

Hay sesiones de depuración que empiezan con un fallo concreto y terminan con veinte ventanas abiertas, varias versiones de la waveform y una sensación incómoda: llevas horas mirando el problema, pero ya no sabes exactamente qué estás buscando.

En ese punto es fácil cambiar otra señal, añadir otro `display`, lanzar otra semilla y convencerte de que el siguiente intento será el bueno. A veces lo es. Muchas otras, solo estás repitiendo la misma hipótesis con pequeñas variaciones.

Parar no significa abandonar el bug. Significa dejar de alimentarlo con ruido.

## Pasos

### Primero: ¿qué estás validando realmente?

Antes de tocar el RTL o el testbench, escribe una frase que se pueda comprobar:

> «Cuando ocurre X, después de Y ciclos debe suceder Z».

Si no puedes completar esa frase, todavía no tienes una propiedad; tienes una intuición. La intuición es útil para empezar, pero no basta para decidir si el diseño falla.

Conviene responder también a estas preguntas:

- ¿Cuál es el contrato de la interfaz?
- ¿Qué evento inicia la operación?
- ¿En qué flanco puede cambiar cada señal?
- ¿Qué parte del comportamiento está observando el testbench?
- ¿El resultado inesperado pertenece al DUT o al modelo de referencia?

Muchas horas se pierden intentando explicar un valor que el protocolo todavía no considera válido. Un `data` puede cambiar mientras `valid=0`, una respuesta puede llegar un ciclo después de lo supuesto o un `ready` puede estar introduciendo backpressure correctamente.

### Haz el problema pequeño

Un test que cubre todo el sistema puede ser estupendo para encontrar que algo falla y pésimo para descubrir por qué. Cuando el error está localizado aproximadamente, reduce el escenario hasta que solo queden las piezas que pueden influir:

1. Conserva el estímulo más corto que reproduce el fallo.
2. Usa una semilla fija y anota la configuración exacta.
3. Sustituye los bloques no relevantes por modelos sencillos o transacciones directas.
4. Observa las interfaces entre módulos, no todas las señales internas a la vez.
5. Vuelve a añadir complejidad solo cuando el caso mínimo vuelva a pasar.

Este proceso no es hacer trampa. Es separar el problema de integración del problema del módulo. Un bloque que falla aislado necesita una solución RTL; un bloque que solo falla conectado a otro necesita probablemente revisar el contrato entre ambos.

### Comprueba que el testbench merece confianza

El testbench también puede tener un bug. Antes de aceptar su veredicto, revisa las piezas que más veces engañan:

- El reset termina en el momento esperado y todos los relojes están activos.
- El driver cambia señales en un instante que no introduce carreras con el DUT.
- El monitor muestrea después de que las asignaciones no bloqueantes se hayan actualizado.
- El scoreboard compara transacciones válidas, no buses que todavía están en tránsito.
- Las anchuras, los signos y las conversiones no están truncando el resultado.
- Los valores `X` y `Z` no se están convirtiendo silenciosamente en ceros.
- El modelo de referencia no está copiando exactamente el mismo error que el RTL.

Una comprobación especialmente útil es hacer que el protocolo sea explícito. Por ejemplo, en AXI4-Stream no tiene sentido comparar cada cambio de `TDATA`; la comparación debe ocurrir en una transferencia, cuando `TVALID && TREADY` valen `1`.

```systemverilog
always @(posedge aclk) begin
  if (aresetn && s_axis_tvalid && s_axis_tready) begin
    $display("transfer: data=%h last=%b", s_axis_tdata, s_axis_tlast);
  end
end
```

El objetivo de este tipo de trazas no es llenar la consola. Es comprobar que el testbench está mirando el mismo instante que el protocolo define como significativo.

### Cambia una hipótesis cada vez

Cuando se cambia el reset, el clocking, el scoreboard y el pipeline en la misma ejecución, el resultado deja de tener valor diagnóstico. Si el fallo desaparece, no sabes qué cambio lo ha resuelto; si persiste, tampoco sabes cuál de ellos era irrelevante.

Una sesión más lenta, pero mucho más informativa, puede seguir este orden:

- ¿El estímulo llega correctamente al DUT?
- ¿La primera interfaz conserva la transacción?
- ¿El módulo produce la salida esperada en su propia frontera?
- ¿El siguiente módulo la acepta cuando debe?
- ¿El error aparece en datos, en control o en la interpretación temporal?

Cada respuesta elimina una familia de hipótesis. Eso vale más que mirar cien señales adicionales en una waveform que ya no puedes leer.

### Volver a empezar también es una técnica

Después de una pausa, vuelve al último caso que sabías que funcionaba. Ejecuta una sola transacción, con una sola expectativa y una semilla determinista. Si pasa, añade el segundo caso. Si falla, ya tienes una superficie de búsqueda mucho más pequeña.

También ayuda escribir, antes de reabrir el editor:

- qué observaste;
- qué esperabas observar;
- qué hipótesis ya has descartado;
- qué cambio produjo cada resultado;
- cuál es la próxima comprobación concreta.

Ese pequeño registro evita volver a probar caminos descartados y convierte una sesión frustrante en información reutilizable. A veces la pausa permite ver que el supuesto inicial era incorrecto. Otras veces revela que el fallo no está en el algoritmo, sino en un reset que llega un ciclo tarde, un `ready` que nunca se acepta o una comparación con signo diferente.

### Parar no es abandonar

Hay un límite práctico a la atención. Tras muchas horas, el cerebro empieza a buscar confirmación de la primera explicación que se le ocurrió. Cambiar de habitación, dormir o simplemente alejarse un rato del editor no arregla el RTL, pero sí puede arreglar la forma de hacerle preguntas.

La depuración eficaz no consiste en aguantar más tiempo delante de una waveform. Consiste en diseñar un experimento que pueda distinguir entre hipótesis. Cuando ese experimento no está claro, tomar distancia y volver a plantear el problema suele ser el paso más técnico de toda la sesión.

## Checklist

### Para reiniciar una depuración

- ¿Puedo expresar el fallo como una relación entre evento, tiempo y resultado?
- ¿El caso de reproducción es mínimo y determinista?
- ¿Estoy observando solo transferencias válidas?
- ¿He comprobado el reset, los relojes y el orden temporal del testbench?
- ¿Estoy cambiando una sola hipótesis cada vez?
- ¿Puedo aislar el módulo o la frontera donde aparece el primer síntoma?
- ¿Sé qué resultado confirmaría o descartaría mi próxima prueba?

Si la respuesta a varias preguntas es «no», probablemente no necesitas otra hora de waveform. Necesitas una pausa y un testbench más pequeño.

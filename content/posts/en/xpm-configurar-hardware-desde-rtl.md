---
title: "XPM: configure hardware from RTL itself"
slug: xpm-configurar-hardware-desde-rtl
excerpt: "Xilinx Parameterized Macros bring CDC, FIFO, and memory configuration into the code, with fewer generated artifacts and easier review."
category: RTL / FPGA
date: 2026-07-27
readTime: 7 min
image: /images/xpm-rtl.svg
imageAlt: "An RTL wrapper that parameterizes an XPM macro through configuration constants"
tags: [xpm, xilinx, vivado, rtl]
---

Some blocks can be built in RTL, but are not worth reinventing: a synchronizer, a dual-clock FIFO, a dual-port memory, or a reset synchronizer. Vivado's IP catalog solves many of them with a graphical wizard and an `.xci` file.

Xilinx Parameterized Macros (XPM) offer another path: instantiate a Vivado-supported macro directly in the code, parameterize it, and connect its ports in a module that lives beside the rest of the design. The [UG974 guide](https://docs.amd.com/r/en-US/ug974-vivado-ultrascale-libraries/Xilinx-Parameterized-Macros) groups CDC, FIFO, and memory macros alongside other architectural primitives.

This is not a universal solution or portable RTL between vendors. It is a way to express in source a configuration that would otherwise be split between a GUI, an `.xci`, and generated artifacts.

## What you gain by keeping it in code

- **Reviewable changes:** a diff shows whether FIFO depth changed from 512 to 1024 or the synchronizer went from two to three stages.
- **Clean variants:** one wrapper can generate a 64-bit or 256-bit FIFO through parameters.
- **Repeatability:** project, non-project, or CI flows use the same source instead of relying on a hand-built configuration.
- **Local integration:** ports and reset decisions stay beside the protocol that uses them.
- **Less generated noise:** a small macro does not need a complete IP block and all its auxiliary files.

The trade-off is coupling to AMD/Xilinx, the FPGA family, and the Vivado version that recognizes the macro and its parameters. The code is cleaner, but it remains vendor-specific code.

## Example: a parameterized synchronizer

Instead of writing a flip-flop chain by hand or opening an IP for one bit, wrap `XPM_CDC_SINGLE` in a module with your own interface:

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

The application module does not need to know every macro parameter. It only decides what matters to its system:

```systemverilog
cdc_single #(
  .DEST_SYNC_FF (3) // more MTBF margin, more latency
) u_irq_cdc (
  .src_clk  (peripheral_clk),
  .dest_clk (control_clk),
  .src_in   (irq_peripheral),
  .dest_out (irq_control)
);
```

The wrapper matters. It prevents twenty modules from instantiating XPM with different parameter combinations and establishes a shared policy for reset, attributes, and verification.

## The same approach for a FIFO

For an independent-clock FIFO, configuration can live in the module too:

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
    // Connect the remaining ports according to the Vivado version.
  );

endmodule
```

The 256-bit, 1024-word FIFO from the previous example becomes another instance of the same module, not another IP project:

```systemverilog
data_fifo #(
  .DATA_WIDTH (256),
  .FIFO_DEPTH (1024)
) u_stream_fifo (...);
```

The exact ports and available parameters must be copied from the template in the installed Vivado version. UG974 includes instantiation templates and macros such as `XPM_FIFO_ASYNC`, `XPM_FIFO_AXIS`, `XPM_CDC_SINGLE`, and `XPM_MEMORY_TDPRAM`.

## XPM versus a catalog IP

### Choose XPM when

- The block is small and its interface fits in a few signals.
- You want parameters, clocks, and reset in the same wrapper as the protocol.
- You need many variants of the same CDC, FIFO, or memory.
- You use a non-project flow or want to build from sources and Tcl in CI.

### Choose a complete IP when

- You need extensive configuration or a GUI that avoids integration mistakes.
- The block includes complex logic, full buses, transactions, drivers, or a physical interface.
- The IP supplies constraints, simulation examples, or specific support you do not want to rebuild.
- The team needs a standardized graphical configuration for users who do not edit RTL.

An XPM does not remove the need to review synthesis and timing reports. It is a vendor macro that Vivado interprets and maps to the right resources; it is not a magic black box or a guarantee that the selected parameters are valid for every family.

## A minimal reproducible flow

1. Find the macro in UG974 or in Vivado's instantiation templates.
2. Copy the template into your own wrapper and remove ports from your public policy only after understanding them.
3. Parameterize what has architectural meaning: width, depth, stage count, read mode, and memory.
4. Add a simulation or assertion for the wrapper contract.
5. Check utilization, warnings, CDC, and timing for the target family and version.
6. Document the Vivado version and supported family next to the module.

In a non-project flow, Vivado needs to recognize XPMs through `auto_detect_xpm`; in a project flow, adding the sources normally prepares them for identification. Do not assume that a script working in the IDE behaves identically in CI.

## Checklist

- Is the block really a small macro, or does it need a complete IP's infrastructure?
- Does the wrapper hide vendor details without hiding important decisions?
- Are the parameters legal for the target family?
- Was the template copied from the Vivado version that will be used?
- Does the non-project flow recognize XPM through `auto_detect_xpm`?
- Is there a test for `full/empty`, CDC, reset, or the relevant protocol?

The advantage is not fewer lines. It is that configuration stops living in a window someone must remember to open and becomes part of the design that is reviewed, versioned, and built.

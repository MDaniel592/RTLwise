---
title: "Asynchronous FIFO: the boundary that prevents headaches"
slug: fifo-asincrona-dolor-cabeza
excerpt: "When two clocks do not share a phase and you need to carry a complete bus, a FIFO saves you from impossible captures and improvised backpressure."
category: RTL / FPGA
date: 2026-07-29
readTime: 7 min
image: /images/async-fifo.svg
imageAlt: "An asynchronous FIFO separating the write and read domains"
tags: [fifo, cdc, xilinx, axi-stream]
---

## Context

Crossing one bit between clocks already requires care. Crossing a data bus, absorbing a burst, and allowing producer and consumer to run at different frequencies is the same problem at another scale.

An asynchronous FIFO creates an explicit boundary between the domains: the write side only knows `wr_clk`, the read side only knows `rd_clk`, and the buffer keeps the words while pointers and flags are synchronized in a controlled way.

## What is inside

A typical implementation has:

1. A dual-port memory accessible from both clocks.
2. A write pointer in the source domain.
3. A read pointer in the destination domain.
4. Synchronized copies of each pointer in the opposite domain.
5. Locally computed `full` and `empty` logic.

Pointers usually travel encoded in Gray code so that only one bit changes per increment. That way, the opposite domain never sees several binary bits transition at once. The FIFO does not remove pointer metastability; it confines it to control synchronizers and avoids using a half-captured data bus.

## The usage rule

The write side only writes when the FIFO is not full. The read side only reads when it is not empty:

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

The example shows the intent, not a complete FIFO: Gray pointers, their synchronizers, `full/empty` detection, and reset handling are still missing. For production, a parameterized FIFO or an XPM is usually safer than inventing the logic from scratch.

## A size you can calculate

Suppose an AXI4-Stream boundary carries 256-bit words and has a capacity of 1,024 words:

```text
capacity = 1,024 words × 256 bits
         = 262,144 bits
         = 32 KiB of storage
```

That space does not fix a permanent rate mismatch: if the write side produces faster for long enough, the FIFO will eventually fill. It can absorb a burst, a temporary consumer pause, or another block's latency without turning every `TREADY=0` cycle into a CDC problem.

In a Xilinx/AMD FPGA, that memory can map to Block RAM, UltraRAM, or distributed logic depending on depth, width, and configuration. Confirm the choice in the utilization report instead of assuming it from the IP name.

## With AXI4-Stream

An AXI4-Stream boundary often maps naturally:

```text
domain A                         domain B
-----------                      -----------
TVALID ──> wr_en       FIFO      rd_en <── TREADY
TDATA  ──> din       async       dout ──> TDATA
                         │
                    full / empty
```

At the input, `s_axis_tready` can be derived from `!full`. At the output, `m_axis_tvalid` can be derived from `!empty`. If the receiver lowers `TREADY`, the read side stops consuming and the FIFO keeps the data until space is available again. The interface remains valid because the word does not leave the FIFO until the handshake occurs.

## An XPM starting point

For a Xilinx design, the configuration skeleton can start like this:

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
  // Connect the remaining ports according to the Vivado version.
);
```

The reset signal and `wr_rst_busy`/`rd_rst_busy` signals must be integrated with the system's real startup. `full` and `empty` indicators pass through synchronization logic: they do not appear in the opposite domain in the exact cycle when the pointer changed. That latency is normal and must be considered in the protocol.

## When to use something else

- A single stable bit: two flip-flops may be enough.
- An isolated pulse: a toggle or handshake may be smaller.
- A bus that changes very little: a held-data protocol with `valid/ack` may avoid the memory.
- A stream with independent clocks, bursts, or backpressure: a FIFO is usually the clearest boundary.

Do not use a FIFO to hide a miscalculated frequency. Use it to express that there are two independent domains and that you need to store their timing difference.

## Checklist

- Are the clocks independent, or do they only have a known relationship?
- Does the depth absorb the maximum burst and backpressure latency?
- Does the word include every required sideband (`TLAST`, `TKEEP`, `TUSER`)?
- Are `full` and `empty` respected in their local domains?
- Does reset release both domains safely?
- Does the report confirm the expected memory and synchronizers?

The FIFO is not a patch. It is an architectural statement: there is a boundary between these two clocks, and information must wait in a queue until the other side can receive it.

For a bus implementation, AMD's guide recommends an independent-clock FIFO for carrying buses between asynchronous domains; review the [asynchronous CDC](https://docs.amd.com/r/en-US/ug574-ultrascale-clb/Asynchronous-Clock-Domain-Crossing) section and the [independent-clock FIFO](https://docs.amd.com/r/en-US/pg327-emb-fifo-gen/Simultaneous-Assertion-of-Full-and-Empty-Flag) notes.

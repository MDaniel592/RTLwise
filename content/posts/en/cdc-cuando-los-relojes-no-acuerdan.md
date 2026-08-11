---
title: "CDC: when two clocks stop agreeing"
slug: cdc-cuando-los-relojes-no-acuerdan
excerpt: "A clock crossing is not fixed by putting two flip-flops in front of any bus: the circuit depends on whether you are crossing a bit, a pulse, or a complete word."
category: RTL / FPGA
date: 2026-07-31
readTime: 7 min
image: /images/cdc.svg
imageAlt: "A signal crossing from one clock domain to another through a synchronizer"
tags: [cdc, clocks, verilog, metastability]
---

## Context

A *Clock Domain Crossing* appears whenever a signal produced with `clk_a` is captured with `clk_b` and there is no phase relationship that guarantees setup and hold time. The error does not always appear in simulation: it may depend on the exact phase of two clocks, temperature, or a manufacturing corner.

The physical problem is metastability. A flip-flop in the receiving domain may need more time than expected to decide whether it sees a zero or a one. Good CDC design does not remove the probability completely; it reduces it to an acceptable MTBF and keeps the logic in each domain coherent.

## First: classify what you want to cross

There is no universal synchronizer. Before writing RTL, identify the kind of information:

- **One-bit level:** a condition that remains stable for several cycles.
- **Pulse:** an event that may last less than one receiver cycle.
- **Counter or small state:** a value that changes in a controlled way.
- **Data bus:** several signals that must preserve their relationship.
- **Continuous stream:** many words with a possible frequency difference or bursts.

The circuit choice depends more on this classification than on the number of lines of code.

## The two-flop synchronizer

For a single-bit level that remains stable long enough, the usual pattern is a chain of two flip-flops in the destination domain. The first register may enter metastability; the second receives a version with more time to resolve.

```systemverilog
(* ASYNC_REG = "TRUE" *) logic [1:0] sync_q;

always_ff @(posedge clk_b) begin
  sync_q <= {sync_q[0], signal_a};
end

assign signal_b = sync_q[1];
```

The attribute helps Vivado recognize the intent and place the registers appropriately. Two flip-flops do not turn a short pulse or an entire bus into a safe transfer: they only solve the case of a level that can wait.

## Events and pulses

A pulse lasting one `clk_a` cycle can disappear completely between two `clk_b` edges. To avoid losing it, turn the event into a state change and synchronize that state:

```systemverilog
// Domain A: toggle the bit on every event.
always_ff @(posedge clk_a) begin
  if (event_a)
    event_toggle_a <= ~event_toggle_a;
end

// Domain B: synchronize and detect the change.
always_ff @(posedge clk_b) begin
  toggle_b1 <= event_toggle_a;
  toggle_b2 <= toggle_b1;
  toggle_bd <= toggle_b2;
end

assign event_b = toggle_b2 ^ toggle_bd;
```

This pattern assumes new events do not arrive so quickly that one change is missed before it can be observed. If every event needs confirmation or backpressure, use a handshake or a FIFO.

## Why a bus is not synchronized bit by bit

If you synchronize every bit of a bus separately, each bit may resolve metastability in a different cycle. The receiver can capture a mixture that never existed in the source domain. For a stable bus, use a held-data protocol with `valid/ack`; for a stream of words, the usual solution is an asynchronous FIFO.

There are also synchronous CDCs: two clocks may come from the same MMCM or PLL and have a known relationship, but that does not mean every connection between them is automatically safe. If phase relationship, skew, or architecture are not controlled, the crossing must be treated as asynchronous and designed accordingly.

## Constraints are necessary, but they do not cure RTL

Vivado cannot trust the slack calculation for two clocks without a phase relationship. In XDC, asynchronous clock groups or timing exceptions can be declared when appropriate:

```tcl
set_clock_groups -asynchronous \
  -group [get_clocks clk_a] \
  -group [get_clocks clk_b]
```

The constraint keeps an asynchronous path from polluting analysis as if it were synchronous, but it does not fix an incorrect capture. The CDC circuit comes first; its clocks and exceptions are described afterward. Do not apply a global `set_false_path` just to silence a bus that still has no synchronizer.

## A classic reference

For a deeper look at synchronizers, pulse transfers, handshakes, buses, and CDC verification, Clifford E. Cummings' paper presented at SNUG Boston 2008 is worth reading:

- [Clock Domain Crossing (CDC) Design & Verification Techniques Using SystemVerilog (PDF)](http://www.sunburst-design.com/papers/CummingsSNUG2008Boston_CDC.pdf)
- [Paper listing in Paradigm Works' Technical Library](https://www.paradigm-works.com/technical-library?term=clock+domain+crossing+%28cdc%29+design+%26+verification+techniques+using+systemverilog)

It is a fundamentals reference; for a current flow, combine it with your tool's constraints and CDC checks.

## Checklist

- Is the signal a level, pulse, bus, or continuous stream?
- Can the information wait for the receiver?
- Does the receiver need confirmation or backpressure?
- Does the bus preserve the coherence of its bits?
- Are the clocks truly related, or do they merely share an IP block?
- Is the CDC identified in `report_cdc` and correctly constrained?

A well-designed CDC is not one that simply stops producing simulation errors. It is one with a clear story for every bit, event, and word crossing from one clock to another.

AMD's guide to [asynchronous CDCs](https://docs.amd.com/r/en-US/ug903-vivado-using-constraints/Asynchronous-Clock-Domain-Crossings?contentId=tIOBNIURtFIIg9XHBYp01Q) and the [Clock Domain Crossing section in UG949](https://docs.amd.com/r/2024.2-English/ug949-vivado-design-methodology/Clock-Domain-Crossing) are good references for reviewing timing closure.

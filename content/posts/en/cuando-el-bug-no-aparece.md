---
title: "When the bug does not appear: stopping is debugging too"
slug: cuando-el-bug-no-aparece
excerpt: "After hours of staring at the same waveform, the best verification tool can be stepping back and defining the problem again."
category: Verification
date: 2026-08-03
readTime: 7 min
image: /images/testbench-pausa.svg
imageAlt: "A complex waveform reduced to a minimal verification case"
tags: [verification, testbench, debug, rtl]
---

## Context

### The point where continuing is no longer progress

Some debugging sessions begin with a concrete failure and end with twenty windows open, several waveform versions, and an uncomfortable feeling: you have been looking at the problem for hours, but you no longer know exactly what you are looking for.

At that point it is easy to change another signal, add another `display`, launch another seed, and convince yourself that the next attempt will be the one. Sometimes it is. More often, you are repeating the same hypothesis with small variations.

Stopping does not mean abandoning the bug. It means stopping the noise that feeds it.

## Steps

### First: what are you really validating?

Before touching the RTL or testbench, write a sentence that can be checked:

> “When X happens, Z must happen after Y cycles.”

If you cannot complete that sentence, you do not have a property yet; you have an intuition. Intuition is useful for getting started, but it is not enough to decide whether the design fails.

It is also worth answering these questions:

- What is the interface contract?
- Which event starts the operation?
- On which edge can each signal change?
- Which part of the behavior is the testbench observing?
- Does the unexpected result belong to the DUT or the reference model?

Many hours are lost trying to explain a value that the protocol does not consider valid yet. `data` can change while `valid=0`, a response can arrive one cycle later than expected, or `ready` can be introducing backpressure correctly.

### Make the problem small

A test that covers the entire system can be excellent for finding that something fails and terrible for discovering why. Once the error is roughly located, reduce the scenario until only the pieces that can affect it remain:

1. Keep the shortest stimulus that reproduces the failure.
2. Use a fixed seed and record the exact configuration.
3. Replace irrelevant blocks with simple models or direct transactions.
4. Watch interfaces between modules, not every internal signal at once.
5. Add complexity back only when the minimal case passes again.

This is not cheating. It separates the integration problem from the module problem. A block that fails in isolation needs an RTL fix; a block that only fails when connected to another probably needs the contract between them reviewed.

### Check that the testbench deserves your trust

The testbench can have a bug too. Before accepting its verdict, review the parts that most often mislead us:

- Reset ends when expected and all clocks are active.
- The driver changes signals at a point that does not create races with the DUT.
- The monitor samples after non-blocking assignments have updated.
- The scoreboard compares valid transactions, not buses still in flight.
- Widths, signs, and conversions are not truncating the result.
- `X` and `Z` values are not silently becoming zeroes.
- The reference model is not copying exactly the same mistake as the RTL.

One especially useful check is to make the protocol explicit. For example, on AXI4-Stream it makes no sense to compare every `TDATA` change; comparison should happen on a transfer, when `TVALID && TREADY` are both `1`.

```systemverilog
always @(posedge aclk) begin
  if (aresetn && s_axis_tvalid && s_axis_tready) begin
    $display("transfer: data=%h last=%b", s_axis_tdata, s_axis_tlast);
  end
end
```

The goal of this kind of trace is not to fill the console. It is to confirm that the testbench is looking at the same instant the protocol defines as meaningful.

### Change one hypothesis at a time

When reset, clocking, scoreboard, and pipeline all change in the same run, the result loses diagnostic value. If the failure disappears, you do not know which change fixed it; if it persists, you still do not know which one was irrelevant.

A slower but much more informative session can follow this order:

- Does the stimulus reach the DUT correctly?
- Does the first interface preserve the transaction?
- Does the module produce the expected output at its own boundary?
- Does the next module accept it when it should?
- Does the error appear in the data, the control, or the timing interpretation?

Each answer removes a family of hypotheses. That is worth more than looking at a hundred extra signals in a waveform you can no longer read.

### Starting over is also a technique

After a pause, return to the last case you knew worked. Run one transaction, with one expectation and a deterministic seed. If it passes, add the second case. If it fails, you now have a much smaller search surface.

It also helps to write down, before reopening the editor:

- what you observed;
- what you expected to observe;
- which hypotheses you have already ruled out;
- which change produced each result;
- what the next concrete check is.

That small record prevents you from retrying discarded paths and turns a frustrating session into reusable information. Sometimes a pause reveals that the initial assumption was wrong. Other times it shows that the failure is not in the algorithm but in a reset arriving one cycle late, a `ready` that is never accepted, or a comparison with a different sign.

### Stopping is not giving up

Attention has a practical limit. After many hours, the brain starts looking for confirmation of the first explanation it came up with. Changing rooms, sleeping, or simply stepping away from the editor will not fix the RTL, but it can fix the way you ask questions of it.

Effective debugging is not about spending more time in front of a waveform. It is about designing an experiment that distinguishes between hypotheses. When that experiment is unclear, stepping back and reframing the problem is often the most technical step in the whole session.

## Checklist

### To restart a debugging session

- Can I express the failure as a relationship between event, time, and result?
- Is the reproduction case minimal and deterministic?
- Am I observing only valid transfers?
- Have I checked reset, clocks, and the testbench's temporal ordering?
- Am I changing only one hypothesis at a time?
- Can I isolate the module or boundary where the first symptom appears?
- Do I know which result would confirm or reject my next test?

If the answer to several questions is “no”, you probably do not need another hour of waveform. You need a pause and a smaller testbench.

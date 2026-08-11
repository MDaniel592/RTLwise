---
title: "MTS on RFSoC: synchronize tiles without chasing latency"
slug: mts-rfsoc-sincronizar-tiles
excerpt: "What Multi-Tile Synchronization solves in the RF Data Converter and the minimum structure needed to bring it up on Xilinx/AMD."
category: Hardware
date: 2026-08-02
readTime: 8 min
image: /images/mts-rfsoc.svg
imageAlt: "Three RF tiles synchronized by a SYSREF signal and a shared reference"
tags: [xilinx, rfsoc, mts, sysref]
---

## Context

In an RFSoC, each RF-ADC or RF-DAC tile has its own clock and data infrastructure. Within one tile, latency is bounded by shared infrastructure, but combining several tiles raises a harder question: do all converters deliver or consume the sample at the same relative instant?

MTS (*Multi-Tile Synchronization*) is the RF Data Converter feature that seeks relative, deterministic alignment across several tiles — and even across several devices. It is not generic CDC or a replacement for good clock design: it is the RFSoC IP mechanism for measuring and adjusting internal latency differences.

## What problem does it solve?

FIFOs and gearboxes connecting the analog side to programmable logic can introduce latency that differs between tiles. The frequency can be correct on all of them and, even so, two parallel channels may be shifted by a few samples.

MTS uses SYSREF, system clocks, and internal FIFOs to capture the reference, align phases, and measure the latency of each path. It then adjusts offsets so the group is aligned. The goal is relative, deterministic latency; the number returned by the driver should not be interpreted as the converter's complete absolute latency.

## Minimum Xilinx/AMD structure

The minimum implementation has three layers. Exact port and option names change with RFSoC generation and IP version, so always check the PG269 version for the device.

### 1. Configure the RF Data Converter

In the RF Data Converter IP, enable Multi-Tile Synchronization for the tiles that belong to the group. Tile 0 should be active as the group reference in the usual RF-ADC and RF-DAC configurations. Configure interface widths and sample rates before synchronizing: changing those parameters afterward requires repeating the process.

### 2. Give it a shared reference

Analog and digital clocks must be active and locked before starting. The design needs a PL clock and a user SYSREF signal reaching the MTS structure; to capture SYSREF reliably, the PL clock frequency must be a common integer multiple of the converters' AXI4-Stream clocks in the group.

A minimal conceptual structure is:

```text
clock generator ──┬──> RF Data Converter / Tile 0
                  ├──> RF Data Converter / Tile 1
PL clock ─────────┴──> fabric + MTS
SYSREF ─────────────────> MTS / RFDC
```

The placement of PL clock and SYSREF pins is the design's responsibility. Connecting SYSREF is not enough: check that the clock network, pinout, and device constraints allow it to be captured with the expected margin.

### Hardware note: the clock starts on the board

On a real platform, tile clocks usually come from a shared source: a clocking device such as an LMK, an LMX, or a combination of both. Depending on the board and RFSoC generation, the LMK may clean and distribute references and SYSREF, while LMX devices may generate RF clocks or references for the tiles' internal PLLs.

Distribution is not cosmetic. Outputs to the different tiles are routed as a controlled differential network, with lengths and skew studied so clocks arrive with a reproducible phase relationship. The same care applies to SYSREF and its relationship to `PL_SYSREF`: matching lengths helps, but impedance, termination, loss, ground return, jitter, and the complete skew budget also need review.

One way to picture the tree is:

```text
                 ┌──> RF-ADC / RF-DAC tile 0
LMK / LMX ───────┼──> RF-ADC / RF-DAC tile 1
shared source    ├──> RF-ADC / RF-DAC tile 2
                 └──> PL clock + PL_SYSREF
                 PCB: controlled differential pairs and skew
```

MTS can measure and adjust part of the FIFOs' digital latency, but it cannot correct every clock-distribution error or a SYSREF capture outside the specification. On evaluation boards such as ZCU111, the network combines LMK and LMX devices to generate RF Data Converter references and clocks; in a custom board, the exact architecture must come from the clock budget and layout rather than being copied blindly.

### 3. Launch synchronization from the driver

The RFdc driver initializes a per-group structure and launches synchronization for RF-ADC or RF-DAC. A minimal skeleton for synchronizing ADC tiles 0 and 1 is:

```c
XRFdc_MultiConverter_Sync_Config mts_cfg;
u32 status;

XRFdc_MultiConverter_Init(
    &mts_cfg,
    NULL,              // optional PLL codes
    NULL,              // optional T1 codes
    0                  // RefTile: tile 0
);

mts_cfg.Tiles = 0x3;  // tiles 0 and 1

status = XRFdc_MultiConverter_Sync(
    &rfdc,
    XRFDC_ADC_TILE,
    &mts_cfg
);
```

For a DAC group, repeat the flow with the corresponding type. In a real project, check `XRFDC_MTS_OK` and record diagnostics if a timeout, marker mismatch, or support issue appears. `XRFdc_MultiConverter_Init` must run before `XRFdc_MultiConverter_Sync`.

This fragment is only the call skeleton: the RFdc driver must be initialized, the device configured, and the bitstream must expose the expected MTS configuration first.

## Official C code to start from

AMD/Xilinx publishes an application example that initializes the RFdc driver and runs an MTS test over a tile group. It is more complete than the fragment above because it includes device initialization, decimation/interpolation factor checks, and result reporting:

- [`xrfdc_mts_example.c` example](https://xilinx.github.io/embeddedsw.github.io/rfdc/doc/html/api/xrfdc__mts__example_8c.html).
- [MTS API implementation in `xrfdc_mts.c`](https://xilinx.github.io/embeddedsw.github.io/rfdc/doc/html/api/xrfdc__mts_8c.html).
- [`xrfdc_mts.c` source in `Xilinx/embeddedsw`](https://github.com/Xilinx/embeddedsw/blob/master/XilinxProcessorIPLib/drivers/rfdc/src/xrfdc_mts.c).
- [RFdc driver in `Xilinx/embeddedsw`](https://github.com/Xilinx/embeddedsw/tree/master/XilinxProcessorIPLib/drivers/rfdc).
- [Official `Xilinx/RFSoC-MTS` overlay](https://github.com/Xilinx/RFSoC-MTS), useful for a complete design on PYNQ and compatible RFSoC boards.

The C example does not replace Vivado configuration or the board clock design. It connects the bitstream to the software flow that calls `Init` and `Sync`, and shows which states and error codes are worth logging.

## The target latency: measure once, then fix it

One detail in the official code deserves attention: `Target_Latency` defaults to `-1`. That is useful during first bring-up, when you do not yet know the latency for the exact device, RF Data Converter configuration, clocks, and board. In that mode, MTS measures latency and calculates a target from the available result.

Once the run completes successfully, save the final latency reported by the group — after validating that the participating tiles are aligned — and use it as `Target_Latency` in later runs. Assign it after `XRFdc_MultiConverter_Init` and before calling `XRFdc_MultiConverter_Sync`:

```c
/* First bring-up: discover the system latency. */
XRFdc_MultiConverter_Init(&mts_cfg, NULL, NULL, XRFDC_TILE_ID0);
mts_cfg.Tiles = 0x3;
mts_cfg.Target_Latency = -1;

status = XRFdc_MultiConverter_Sync(&rfdc, XRFDC_ADC_TILE, &mts_cfg);
if (status == XRFDC_MTS_OK) {
    printf("ADC0 latency = %d T1\n", mts_cfg.Latency[0]);
    printf("ADC1 latency = %d T1\n", mts_cfg.Latency[1]);
    /* After validation, keep the target in the project configuration. */
}

/* Later runs: use the measured and validated value, for example 384. */
XRFdc_MultiConverter_Init(&mts_cfg, NULL, NULL, XRFDC_TILE_ID0);
mts_cfg.Tiles = 0x3;
mts_cfg.Target_Latency = 384; /* tile T1 units */

status = XRFdc_MultiConverter_Sync(&rfdc, XRFDC_ADC_TILE, &mts_cfg);
```

Fixing the target makes startup pursue the same reference latency instead of accepting a new measurement as the baseline every time. With the same bitstream, clock, SYSREF, and power configuration, this reduces hard-to-diagnose variation and prevents chasing ghosts caused by leaving discovery mode enabled. If rate, interpolation/decimation, interface width, clock network, device, or tile state changes, characterize again: the stored value may no longer be reachable and the driver may report that the target is too low.

## What happens during MTS

The process can be summarized as:

1. Enable clocks and SYSREF generators.
2. Each tile captures SYSREF and adjusts its internal delay.
3. A later SYSREF edge aligns divider phases.
4. Measure and adjust each tile's FIFO latency.
5. Update digital functions that affect alignment using dynamic events synchronized to SYSREF.

The IP and driver automate much of divider capture, reset, and FIFO adjustment. That does not remove the responsibility to start with stable clocks or to synchronize again after changing a frequency, interface width, or tile power state.

## Common mistakes

- Treating MTS as if it only meant connecting every `aclk` to the same clock.
- Leaving the reference tile out of the group mask.
- Starting synchronization before clocks are locked.
- Confusing reported relative latency with the full absolute latency of the analog path.
- Changing rate, word width, or a tile reset and continuing to use the previous synchronization result.
- Leaving SYSREF free-running during an update that needs a controlled reference.

## Checklist

- Are the tiles that must align enabled in the same MTS group?
- Is tile 0 present as the reference?
- Are PL clock, SYSREF, and RF clocks defined and locked?
- Are `Init` and `Sync` run separately for ADC and DAC when needed?
- Is the return code checked and latency/offset data recorded?
- Is MTS repeated after a reconfiguration that affects the path?

MTS does not make clocks magically identical. It turns variable internal latency into relative latency that you can measure, adjust, and reproduce.

Review the official [Multi-Tile Synchronization](https://docs.amd.com/r/en-US/pg269-rf-data-converter/Multi-Tile-Synchronization), [synchronization steps](https://docs.amd.com/r/en-US/pg269-rf-data-converter/Synchronization-Steps), [SYSREF requirements](https://docs.amd.com/r/en-US/pg269-rf-data-converter/SYSREF-Signal-Requirements), and [practical MTS application](https://docs.amd.com/r/en-US/xapp1349-rfdc-subsystems/Practical-Application-of-MTS) before moving this skeleton to a specific device.

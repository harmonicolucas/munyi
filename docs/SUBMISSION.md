# Submission text

Confirm the live form before sending. Deadline published by the organizers: 4 November 2026, 9:00 PM ET.

Suggested title: **MUNYI — From the first evidence to inclusive evacuation**

Theme: **Build for Your World**

Track: **Indie**

Contact: harmonicolucas@gmail.com

Repository: https://github.com/harmonicolucas/munyi

Demo: https://harmonicolucas.github.io/munyi/

## Short description

MUNYI lets a person report a flood by text, photograph, or voice. Muse Spark reads the report. SAM 3.1 can outline visible water. Deterministic rules stop the system from inventing coordinates, estimating depth, or calling any road safe. Similar reports are grouped, not deleted. A test map around Maputo shows excluded segments and a clearly labelled demonstration path. Alerts use plain language, large controls, contrast, and speech.

## Problem

In a flood, the first evidence is often a citizen photo or a voice note. People still need to know what to do, and two neighbours may describe the same street differently. A model should help read that evidence. It should not pretend that a picture proves a road is passable.

## How Meta models are used

- `muse-spark-1.3` on `POST /v1/responses` turns a report, and an optional image, into JSON. Coordinates from the device are not sent to the model.
- `sam-3.1` segments the noun phrase `water` or `mud`. The product states that the mask is not a depth.
- `muse-voice-transcribe-1.0` transcribes a 16-bit mono WAV. Browser dictation is a separate path and must be reread before sending.
- The API key stays in `backend/.env`. The GitHub Pages demo runs the same safety rules in the browser and labels that mode.

## What to attach

- This public repository, including `LICENSE`
- The GitHub Pages URL
- A public YouTube or Vimeo video of 3 minutes or less (`docs/DEMO.md` has the script)
- The four scenarios and the test file as evidence. Do not add an accuracy percentage.

The form itself has to be submitted in the hackathon portal with the account that was accepted into the event. This repository cannot send that form.

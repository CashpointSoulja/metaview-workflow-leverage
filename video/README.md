# Demo walkthrough source

**Status: local draft, not public footage.** The app is not deployed yet, so the walkthrough is recorded against a local `wrangler dev` server. It must not be described as a public-demo video until it has been re-recorded against the approved public URL.

What it is:

- Real footage of the running app: every frame is a screenshot of the live page while real clicks and form entries happen. No staged screens, no slides.
- A visible pointer that follows real mouse events and turns yellow on press.
- Free offline narration (Piper TTS, voice `en_GB-alba-medium`), one clip per sentence, each placed at the moment its scene starts. Captions are timed to each clip, with hand-placed line breaks (`caption-breaks.json`).
- Fixed framing, no zooms.

The scene-by-scene flow with timings is in [script.md](script.md).

## Rebuild

```bash
npm run dev                                        # in one terminal
PIPER_VOICE=/path/to/en_GB-alba-medium.onnx ./video/tts.sh
APP_URL=http://127.0.0.1:8787 node video/record.mjs
python3 video/compose.py                           # writes video/work/demo.mp4 and video/demo.srt
```

For the public version, set `APP_URL` to the deployed URL and re-run the last two steps.

Requirements: Python 3 with `piper-tts` and `fontTools`, ffmpeg with libass, Playwright Chromium.

## Script

The narration is in `narration.json`, first person. `demo.srt` holds the captions with their timings.

## Caveats

- Narration is synthetic speech, not a human voice.
- Every company, person and number shown is synthetic.
- Not an official Metaview video.

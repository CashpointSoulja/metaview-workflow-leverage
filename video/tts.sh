#!/usr/bin/env bash
# Free offline narration: Piper TTS, voice en_GB-alba-medium.
# Usage: PIPER_VOICE=path/to/en_GB-alba-medium.onnx ./video/tts.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p work/vo
python3 - <<'PY'
import json, subprocess, os
voice = os.environ['PIPER_VOICE']
for s in json.load(open('narration.json')):
    for i, line in enumerate(s['lines']):
        raw = f"work/vo/{s['scene']}-{i}.raw.wav"; out = f"work/vo/{s['scene']}-{i}.wav"
        subprocess.run(['python3', '-m', 'piper', '-m', voice, '--length_scale', '0.95', '-f', raw], input=line.encode(), check=True, capture_output=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-ar', '48000', '-ac', '1', out], check=True)
        os.remove(raw)
PY
for f in work/vo/*.wav; do printf '%s %s\n' "$(basename "$f" .wav)" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"; done > work/vo/durations.txt
cat work/vo/durations.txt

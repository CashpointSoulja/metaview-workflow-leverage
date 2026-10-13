"""Assembles the recorded frames, per-line narration and captions into video/work/demo.mp4.

Frames are the real screenshots from record.mjs, each held for its measured duration.
Each narration WAV starts at its logged line start; each caption is timed to its WAV.
Usage: python3 video/compose.py
"""
import json, os, subprocess
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.join(HERE, 'work')
log = json.load(open(os.path.join(W, 'timeline.json')))
dur = dict(l.split() for l in open(os.path.join(W, 'vo', 'durations.txt')).read().strip().splitlines())

fonts = os.path.join(W, 'fonts'); os.makedirs(fonts, exist_ok=True)
ttf = os.path.join(fonts, 'Figtree-SemiBold.ttf')
if not os.path.exists(ttf):
    f = TTFont(os.path.join(HERE, '..', 'node_modules/@fontsource/figtree/files/figtree-latin-600-normal.woff')); f.flavor = None; f.save(ttf)

# Hand-placed caption breaks: "|" splits a line into two caption rows.
BREAKS = json.load(open(os.path.join(HERE, 'caption-breaks.json')))

frames = log['frames']
with open(os.path.join(W, 'frames.txt'), 'w') as fh:
    for i, fr in enumerate(frames):
        nxt = frames[i + 1]['t'] if i + 1 < len(frames) else log['end']
        fh.write(f"file 'frames/{fr['file']}'\nduration {max(nxt - fr['t'], 0.01):.4f}\n")
    fh.write(f"file 'frames/{frames[-1]['file']}'\n")

def ts(s):
    h, s = divmod(s, 3600); m, s = divmod(s, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"

ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "", "[V4+ Styles]",
       "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
       "Style: Cap,Figtree SemiBold,40,&H00F4F8FB,&H00F4F8FB,&H00191F0A,&H00191F0A,0,0,0,0,100,100,0,0,1,0,0,2,120,120,22,1",
       "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
srt = []
for i, l in enumerate(log['lines']):
    start, end = l['start'], l['start'] + float(dur[l['key']])
    text = BREAKS.get(l['key'], l['text'])
    ass.append(f"Dialogue: 0,{ts(start)},{ts(end + 0.15)},Cap,,0,0,0,,{text.replace('|', chr(92) + 'N')}")
    srt.append(f"{i + 1}\n{ts(start).replace('.', ',')}0 --> {ts(end + 0.15).replace('.', ',')}0\n{text.replace('|', chr(10))}\n")
open(os.path.join(W, 'captions.ass'), 'w').write('\n'.join(ass) + '\n')
open(os.path.join(HERE, 'demo.srt'), 'w').write('\n'.join(srt))

inputs, delays = [], []
for i, l in enumerate(log['lines']):
    inputs += ['-i', os.path.join(W, 'vo', f"{l['key']}.wav")]
    delays.append(f"[{i}]adelay={int(l['start'] * 1000)}:all=1[a{i}]")
mix = ';'.join(delays) + ';' + ''.join(f'[a{i}]' for i in range(len(log['lines']))) + f"amix=inputs={len(log['lines'])}:normalize=0,apad=whole_dur={log['end']:.2f}[out]"
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', mix, '-map', '[out]', '-t', f"{log['end']:.2f}", '-ar', '48000', os.path.join(W, 'narration.wav')], check=True)

vf = (f"scale=1632:918:flags=lanczos,pad=1920:1080:144:14:color=0x0A2119,"
      f"drawbox=x=143:y=13:w=1634:h=920:color=0x7AFFB4@0.35:t=1,"
      f"ass={os.path.join(W, 'captions.ass')}:fontsdir={fonts},format=yuv420p")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(W, 'frames.txt'), '-i', os.path.join(W, 'narration.wav'),
                '-vf', vf, '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart',
                os.path.join(W, 'demo.mp4')], check=True)
print('wrote', os.path.join('video', 'work', 'demo.mp4'), f"{log['end']:.1f}s")

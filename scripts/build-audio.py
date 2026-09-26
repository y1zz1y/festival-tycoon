"""Cut, loop, level and encode the CC0 sources of docs/audio.md into public/sfx and public/music.

Usage: python scripts/build-audio.py <raw-folder>

<raw-folder> holds the downloads as listed in docs/audio.md (Quellen): the Kenney and
rubberduck zips unpacked to x-impact, x-interface, x-scifi and x-loops, the BigSoundBank
files as bsb/<id>.ogg and the music as music/<genre>.<ext>. Needs ffmpeg with libvorbis.
Raw downloads stay out of the repository; only the encoded results are committed.
"""
import os
import re
import subprocess
import sys

RAW = sys.argv[1].replace('\\', '/')
TMP = RAW + '/work'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
os.makedirs(TMP, exist_ok=True)
os.makedirs(OUT + '/sfx', exist_ok=True)
os.makedirs(OUT + '/music', exist_ok=True)


def ff(args):
    result = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-y', *args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-2000:])
    return result.stderr


def cut(start=None, end=None, extra='', channels=1):
    """Plain cut with short edge fades (one-shots)."""
    chain = []
    if start is not None or end is not None:
        chain.append(f"atrim={start or 0}:{end}" if end is not None else f"atrim=start={start}")
        chain.append('asetpts=PTS-STARTPTS')
    if extra:
        chain.append(extra)
    return f"[0:a]{','.join(chain) or 'anull'},aresample=44100,pan={'mono|c0=0.5*c0+0.5*c1' if channels == 1 else 'stereo|c0=c0|c1=c1'}[out]"


def loop(start, length, fade, extra='', channels=1):
    """A seamless loop of `length` s: the tail after `length` is crossfaded (equal power) into the head."""
    pan = 'mono|c0=0.5*c0+0.5*c1' if channels == 1 else 'stereo|c0=c0|c1=c1'
    pre = f"atrim={start}:{start + length + fade},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,pan={pan}"
    if extra:
        pre += ',' + extra
    return (f"[0:a]{pre},asplit=3[a][b][c];"
            f"[a]atrim={length}:{length + fade},asetpts=PTS-STARTPTS,afade=t=out:d={fade}:curve=qsin[t];"
            f"[b]atrim=0:{fade},asetpts=PTS-STARTPTS,afade=t=in:d={fade}:curve=qsin[h];"
            f"[t][h]amix=inputs=2:normalize=0[x];"
            f"[c]atrim={fade}:{length},asetpts=PTS-STARTPTS[m];"
            f"[x][m]concat=n=2:v=0:a=1[out]")


def levels(path):
    log = ff(['-i', path, '-af', 'ebur128=framelog=quiet,volumedetect', '-f', 'null', '-'])
    loudness = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', log)[-1])
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', log).group(1))
    return loudness, peak


def build(name, sources, graph, target, quality, folder):
    work = f'{TMP}/{name}.wav'
    inputs = []
    for source in sources:
        inputs += ['-i', f'{RAW}/{source}']
    ff([*inputs, '-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_s16le', work])
    loudness, peak = levels(work)
    gain = min(target - loudness, -1.0 - peak)
    out = f'{OUT}/{folder}/{name}.ogg'
    ff(['-i', work, '-af', f'volume={gain:.2f}dB', '-c:a', 'libvorbis', '-q:a', str(quality), out])
    hours, minutes, seconds = re.search(r'Duration: (\d+):(\d+):([\d.]+)', ff(['-i', out, '-f', 'null', '-'])).groups()
    duration = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    print(f'{folder}/{name}.ogg  {os.path.getsize(out) / 1024:.0f} KB  {duration:.2f}s  I {loudness:.1f} -> {loudness + gain:.1f} LUFS')


ONE_SHOT, AMBIENT, MUSIC = -18, -24, -18
K = 'x-impact/Audio'
I = 'x-interface/Audio'

# One-shots.
build('oneshot-place', [f'{K}/impactPlank_medium_000.ogg'], cut(None, None, 'afade=t=out:st=0.68:d=0.1'), ONE_SHOT, 3, 'sfx')
build('oneshot-demolish', [f'{K}/impactWood_heavy_001.ogg', f'{K}/impactPlate_heavy_002.ogg'],
      "[0:a]aresample=44100,pan=mono|c0=0.5*c0+0.5*c1[a];[1:a]aresample=44100,pan=mono|c0=0.5*c0+0.5*c1,adelay=60[b];[a][b]amix=inputs=2:normalize=0:duration=longest[out]",
      ONE_SHOT, 3, 'sfx')
build('oneshot-ui-click', [f'{I}/click_001.ogg'], cut(None, None, 'afade=t=out:st=0.06:d=0.03'), ONE_SHOT, 3, 'sfx')
build('oneshot-incident', ['x-loops/alarm_02.ogg'], cut(0, 1.3, 'afade=t=out:st=0.9:d=0.4'), ONE_SHOT, 3, 'sfx')
build('oneshot-cheer', ['bsb/0236.ogg'], cut(0.1, 3.0, 'afade=t=in:d=0.05,afade=t=out:st=2.1:d=0.8'), ONE_SHOT, 3, 'sfx')
build('oneshot-scream', ['bsb/1456.ogg'], cut(15.3, 18.3, 'afade=t=in:d=0.15,afade=t=out:st=2.4:d=0.6'), ONE_SHOT, 3, 'sfx')
build('oneshot-medical', ['bsb/1464.ogg'], cut(0, 3.0, 'afade=t=out:st=2.4:d=0.6'), ONE_SHOT, 3, 'sfx')
build('oneshot-bus-hiss', ['bsb/1490.ogg'], cut(0.1, 1.1, 'afade=t=out:st=0.7:d=0.3'), ONE_SHOT, 3, 'sfx')
build('oneshot-waste-truck', ['bsb/3577.ogg'], cut(9.5, 13.0, 'afade=t=in:d=0.4,afade=t=out:st=2.5:d=1.0'), ONE_SHOT, 3, 'sfx')
build('oneshot-coaster-launch', ['x-scifi/Audio/thrusterFire_000.ogg'], cut(0, 1.5, 'afade=t=out:st=0.9:d=0.6'), ONE_SHOT, 3, 'sfx')

# Ambient loops.
build('ambient-concert', ['bsb/0021.ogg'], loop(4, 12, 1.5), AMBIENT, 2, 'sfx')
build('ambient-crowd', ['bsb/3096.ogg'], loop(20, 24, 2), AMBIENT, 2, 'sfx')
build('ambient-camp', ['bsb/0110.ogg'], loop(25, 20, 2), AMBIENT, 2, 'sfx')
build('ambient-water', ['bsb/3132.ogg'], loop(10, 15, 2), AMBIENT, 2, 'sfx')
build('ambient-woods', ['bsb/0100.ogg'], loop(3, 22, 2), AMBIENT, 2, 'sfx')
build('ambient-backstage', ['bsb/0125.ogg'], loop(1, 7, 1, 'asetrate=35280,aresample=44100'), AMBIENT, 2, 'sfx')
build('ambient-coaster', ['x-loops/rolling.ogg'], cut(), AMBIENT, 2, 'sfx')

# Music: stages are heard through a panner, so mono; the title theme stays stereo.
build('rock', ['music/rock.mp3'], loop(0, 38, 2.5), MUSIC, 2, 'music')
build('indie', ['music/indie.mp3'], loop(0, 42, 2.5), MUSIC, 2, 'music')
build('electro', ['music/electro.mp3'], loop(0, 30, 1.5), MUSIC, 2, 'music')
build('dance', ['music/dance.mp3'], loop(0, 33.4, 1.5), MUSIC, 2, 'music')
build('pop', ['music/pop.mp3'], loop(0, 25.8, 1.5), MUSIC, 2, 'music')
build('soul', ['music/soul.mp3'], cut(), MUSIC, 2, 'music')
build('folk', ['music/folk.mp3'], cut(), MUSIC, 2, 'music')
build('metal', ['music/metal.ogg'], loop(30, 70, 3), MUSIC, 2, 'music')
build('title', ['music/title.mp3'], loop(1.3, 45, 3, channels=2), MUSIC, 3, 'music')

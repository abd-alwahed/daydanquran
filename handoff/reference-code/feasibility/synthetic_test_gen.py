import numpy as np, soundfile as sf, librosa, subprocess, json
rng=np.random.default_rng(7); SR=16000
def voice(dur, seed):
    r=np.random.default_rng(seed); t=np.arange(int(dur*SR))/SR
    f0=r.uniform(100,220)+20*np.sin(2*np.pi*r.uniform(.2,1)*t)
    ph=2*np.pi*np.cumsum(f0)/SR
    sig=sum((1/k)*np.sin(k*ph+r.uniform(0,6)) for k in range(1,12))
    # syllable-like amplitude envelope + random formant via filtering noise burst
    env=np.clip(np.sin(2*np.pi*r.uniform(2,5)*t+r.uniform(0,6)),0,None)**.5
    sig=sig*env+0.05*r.standard_normal(len(t))*env
    return (0.3*sig/np.abs(sig).max()).astype(np.float32)
mp3=lambda w,p,br: (sf.write('/tmp/x.wav',w,SR), subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/x.wav','-b:a',br,p]))
ayahs={i:voice(rng.uniform(4,9),i) for i in range(1,6)}
taf={k:voice(rng.uniform(8,20),100+int(k)) for k in ['1','23','4','5']}
for i,w in ayahs.items(): mp3(w,f'ayahs/067{i:03d}.mp3','128k')
sil=lambda s: np.zeros(int(s*SR),np.float32)
seq=[('intro',voice(3,999)),('a1',ayahs[1]),('t1',taf['1']),('a2',ayahs[2]),('gap',sil(.5)),('a3',ayahs[3]),('t23',taf['23']),('a4',ayahs[4]),('t4',taf['4']),('a5',ayahs[5]),('t5',taf['5'])]
truth={};pos=0
for n,w in seq: truth[n]=[round(pos/SR,2),round((pos+len(w))/SR,2)]; pos+=len(w)
comb=np.concatenate([w for _,w in seq])*0.8+0.01*rng.standard_normal(pos).astype(np.float32)
mp3(comb,'combined.mp3','64k')
json.dump(truth,open('truth.json','w'))
# "different recording": same ayahs time-stretched + pitch-shifted
import os; os.makedirs('ayahs_other',exist_ok=True)
for i,w in ayahs.items(): mp3(librosa.effects.pitch_shift(librosa.effects.time_stretch(w,rate=0.9),sr=SR,n_steps=1.5),f'ayahs_other/067{i:03d}.mp3','128k')

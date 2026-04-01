import { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';

interface Props {
  audios: string[];
  onChange: (audios: string[]) => void;
  disabled?: boolean;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function AudioRecorder({ audios, onChange, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<number | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRefs = useRef<HTMLAudioElement[]>([]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
  }, []);

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const base64 = await blobToBase64(blob);
        onChange([...audios, base64]);
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setSeconds(0);
      };

      mr.start(250);
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('Sem acesso ao microfone. Verifique as permissões.');
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
  }

  function removeAudio(idx: number) {
    onChange(audios.filter((_, i) => i !== idx));
  }

  function togglePlay(idx: number) {
    const el = audioRefs.current[idx];
    if (!el) return;
    if (playing === idx) {
      el.pause();
      setPlaying(null);
    } else {
      audioRefs.current.forEach((a, i) => { if (i !== idx) a?.pause(); });
      el.play();
      setPlaying(idx);
      el.onended = () => setPlaying(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Recorded list */}
      {audios.map((src, idx) => (
        <div key={idx} className="flex items-center gap-3 bg-stone-800 rounded-xl px-3 py-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio ref={(el) => { if (el) audioRefs.current[idx] = el; }} src={src} className="hidden" />
          <button
            type="button"
            onClick={() => togglePlay(idx)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex-shrink-0"
          >
            {playing === idx ? '⏸' : '▶'}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-stone-300">Áudio {idx + 1}</p>
            <div className="h-1 bg-stone-700 rounded-full mt-1">
              <div className="h-1 bg-amber-500 rounded-full w-0" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeAudio(idx)}
            className="text-stone-500 hover:text-red-400 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}

      {/* Record button */}
      {!disabled && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors',
              recording
                ? 'bg-red-900/40 border-red-500/60 text-red-300 hover:bg-red-900/60'
                : 'bg-stone-800 border-stone-600 text-stone-300 hover:border-stone-500'
            )}
          >
            <span className={cn(
              'w-2.5 h-2.5 rounded-full',
              recording ? 'bg-red-400 animate-pulse' : 'bg-stone-400'
            )} />
            {recording ? `Parar (${formatDuration(seconds)})` : '🎙 Gravar áudio'}
          </button>

          {recording && (
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-400 rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.sin(Date.now() / 200 + i) * 6}px`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

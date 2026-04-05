import { useState, useRef } from 'react';

interface Props {
  onRecorded: (blob: Blob) => void;
  onClear: () => void;
  recorded: Blob | null;
}

export function AudioRecorder({ onRecorded, onClear, recorded }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      onRecorded(blob);
      stream.getTracks().forEach((t) => t.stop());
    };
    mr.start();
    mediaRef.current = mr;
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setIsRecording(false);
  }

  if (recorded) {
    return (
      <div className="flex items-center gap-3 bg-stone-800 rounded-lg px-3 py-2">
        <audio controls src={URL.createObjectURL(recorded)} className="h-8 flex-1" />
        <button
          type="button"
          onClick={onClear}
          className="text-stone-400 hover:text-red-400 text-xs transition-colors"
        >
          Remover
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full justify-center ${
        isRecording
          ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
          : 'bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-700'
      }`}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z"/>
      </svg>
      {isRecording ? 'Parar gravação' : 'Gravar áudio'}
    </button>
  );
}

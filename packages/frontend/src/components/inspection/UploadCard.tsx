import { useRef } from 'react';
import { cn } from '@/utils/cn';

interface UploadCardProps {
  label: string;
  icon?: string;
  accept?: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = url;
  });
}

export function UploadCard({ label, icon = '📷', accept = 'image/*', value, onChange, className }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file);
      onChange(compressed);
    } else {
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  return (
    <div className={cn('relative', className)}>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-stone-700 group">
          {value.startsWith('data:image') || value.startsWith('http') ? (
            <img src={value} alt={label} className="w-full h-28 object-cover" />
          ) : (
            <div className="w-full h-28 flex items-center justify-center bg-stone-800 text-stone-400 text-sm">
              Arquivo anexado
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs px-3 py-1.5 bg-stone-800 border border-stone-600 rounded-lg text-stone-200 hover:bg-stone-700"
            >
              Trocar
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs px-3 py-1.5 bg-red-900/80 border border-red-700 rounded-lg text-red-200 hover:bg-red-800"
            >
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-700 bg-stone-800/40 hover:border-stone-600 hover:bg-stone-800/70 transition-colors"
        >
          <span className="text-2xl">{icon}</span>
          <span className="text-xs text-stone-400 font-medium text-center px-2 leading-snug">{label}</span>
        </button>
      )}
    </div>
  );
}

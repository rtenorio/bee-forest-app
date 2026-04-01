import { useRef } from 'react';

const MAX_PX = 1280;
const QUALITY = 0.82;

interface Props {
  photos: string[];
  onChange: (photos: string[]) => void;
  disabled?: boolean;
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', QUALITY));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function PhotoCapture({ photos, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const compressed = await Promise.all(files.map(compressImage));
    onChange([...photos, ...compressed]);
    e.target.value = '';
  }

  function removePhoto(idx: number) {
    onChange(photos.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((src, idx) => (
            <div key={idx} className="relative group">
              <img
                src={src}
                alt={`Foto ${idx + 1}`}
                className="w-20 h-20 object-cover rounded-xl border border-stone-700"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture / upload button */}
      {!disabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-stone-800 border border-stone-600 text-stone-300 hover:border-stone-500 transition-colors"
          >
            📷 {photos.length > 0 ? `Adicionar foto (${photos.length})` : 'Tirar / anexar foto'}
          </button>
        </>
      )}
    </div>
  );
}

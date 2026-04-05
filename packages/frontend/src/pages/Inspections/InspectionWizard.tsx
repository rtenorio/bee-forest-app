import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useCreateInspection } from '@/hooks/useInspections';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import {
  useInstructions,
  useUpdateInstructionStatus,
  useCreateInstruction,
  useCreateInstructionResponse,
  requestAudioUploadUrl,
  uploadAudioToR2,
} from '@/hooks/useInstructions';
import type { Instruction } from '@bee-forest/shared';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { AudioRecorder } from '@/components/inspection/AudioRecorder';
import { PhotoCapture } from '@/components/inspection/PhotoCapture';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { nowISO, todayISO } from '@/utils/dates';
import { InspectionCreateSchema } from '@bee-forest/shared';
import type { InspectionChecklist, InspectionTask, SkyCondition } from '@bee-forest/shared';

// ─── Open-Meteo weather fetch ─────────────────────────────────────────────────

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    cloud_cover: number;
  };
}

function cloudCoverToSky(pct: number): SkyCondition {
  if (pct <= 25) return 'sunny';
  if (pct <= 65) return 'partly_cloudy';
  return 'cloudy';
}

async function fetchWeather(lat: number, lon: number): Promise<{
  temperature_c: number;
  humidity_pct: number;
  precipitation_mm: number;
  sky_condition: SkyCondition;
} | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover` +
      `&timezone=America%2FRecife`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data: OpenMeteoResponse = await res.json();
    const c = data.current;
    return {
      temperature_c: Math.round(c.temperature_2m * 10) / 10,
      humidity_pct: c.relative_humidity_2m,
      precipitation_mm: c.precipitation,
      sky_condition: cloudCoverToSky(c.cloud_cover),
    };
  } catch {
    return null;
  }
}

// ─── Wizard data ──────────────────────────────────────────────────────────────

interface WizardData {
  // Step 0 – Identificação
  hive_local_id: string;
  inspected_at: string;
  inspector_name: string;

  // Step 1 – Condições Climáticas
  temperature_c: string;
  humidity_pct: string;
  precipitation_mm: string;
  sky_condition: SkyCondition | '';

  // Step 2 – Colônia
  colony_strength: 'strong' | 'medium' | 'weak';
  brood_present: boolean;
  agitation_level: 'calm' | 'agitated' | 'defensive' | null;
  ready_for_split: boolean;
  honey_ready_for_harvest: boolean;
  intruder_species: boolean;

  // Step 3 – Alimentação
  honey_stores: 'low' | 'adequate' | 'abundant';
  pollen_stores: 'low' | 'adequate' | 'abundant';
  propolis_quality: 'poor' | 'normal' | 'good' | null;
  needs_syrup: boolean;
  syrup_urgency: 'normal' | 'urgent';
  needs_pollen_ball: boolean;
  needs_wax: boolean;

  // Step 4 – Sanidade
  ants: 'none' | 'few' | 'infested';
  phorid_flies: 'none' | 'few' | 'infested';
  wax_moths: boolean;
  beetles: boolean;
  caterpillar: boolean;
  other_pests_text: string;
  strange_odor: boolean;
  diseases_observed: string[];

  // Step 5 – Caixa
  propolis_seal_intact: boolean | null;
  entrance_blocked: boolean;
  moisture_infiltration: boolean;
  needs_box_replacement: boolean;
  box_condition: 'poor' | 'fair' | 'good' | null;
  weight_kg: string;

  // Step 6 – Tarefas e finalização
  tasks: InspectionTask[];
  next_inspection_due: string;
  notes: string;

  // Mídia por etapa
  stepPhotos: string[][];
  stepAudio: string[][];
}

function makeDefault(inspector: string, hiveId: string): WizardData {
  return {
    hive_local_id: hiveId,
    inspected_at: nowISO().slice(0, 16),
    inspector_name: inspector,
    temperature_c: '', humidity_pct: '', precipitation_mm: '', sky_condition: '',
    colony_strength: 'medium',
    brood_present: true,
    agitation_level: null,
    ready_for_split: false,
    honey_ready_for_harvest: false,
    intruder_species: false,
    honey_stores: 'adequate', pollen_stores: 'adequate', propolis_quality: null,
    needs_syrup: false, syrup_urgency: 'normal', needs_pollen_ball: false, needs_wax: false,
    ants: 'none', phorid_flies: 'none',
    wax_moths: false, beetles: false, caterpillar: false,
    other_pests_text: '', strange_odor: false, diseases_observed: [],
    propolis_seal_intact: null,
    entrance_blocked: false, moisture_infiltration: false, needs_box_replacement: false,
    box_condition: null, weight_kg: '',
    tasks: [], next_inspection_due: '', notes: '',
    stepPhotos: [[], [], [], [], [], [], [], []],
    stepAudio:  [[], [], [], [], [], [], [], []],
  };
}

// ─── Reusable UI pieces ───────────────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-stone-300 mb-2">{children}</p>;
}

function Tri<T extends string | null>({
  label, options, value, onChange,
}: {
  label: string;
  options: { v: T; label: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <SLabel>{label}</SLabel>
      <div className="flex gap-2">
        {options.map((o) => (
          <button key={String(o.v)} type="button"
            onClick={() => onChange(value === o.v ? (null as T) : o.v)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors',
              value === o.v
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}
          >
            {o.icon && <span className="text-xl">{o.icon}</span>}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  icon, label, desc, active, onClick, colorActive = 'amber',
}: {
  icon: string; label: string; desc?: string; active: boolean;
  onClick: () => void; colorActive?: 'amber' | 'emerald' | 'red';
}) {
  const cls = {
    amber: 'bg-amber-500/20 border-amber-500/60 text-amber-300',
    emerald: 'bg-emerald-900/30 border-emerald-600/50 text-emerald-300',
    red: 'bg-red-900/30 border-red-600/50 text-red-300',
  }[colorActive];
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors w-full',
        active ? cls : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
      )}
    >
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs opacity-70">{desc}</p>}
      </div>
      <span className={cn('text-base', active ? '' : 'text-stone-600')}>{active ? '✓' : '○'}</span>
    </button>
  );
}

function LevelPicker({
  label, value, onChange,
}: { label: string; value: 'low' | 'adequate' | 'abundant'; onChange: (v: 'low' | 'adequate' | 'abundant') => void }) {
  return (
    <div>
      <SLabel>{label}</SLabel>
      <div className="flex gap-2">
        {(['low', 'adequate', 'abundant'] as const).map((v) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm border transition-colors',
              value === v ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}
          >
            {v === 'low' ? '🟥 Baixa' : v === 'adequate' ? '🟨 Adequada' : '🟩 Abundante'}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfestationPicker({
  label, icon, value, onChange,
}: {
  label: string; icon: string;
  value: 'none' | 'few' | 'infested';
  onChange: (v: 'none' | 'few' | 'infested') => void;
}) {
  return (
    <div>
      <SLabel>{icon} {label}</SLabel>
      <div className="flex gap-2">
        {([
          { v: 'none', label: 'Nenhum', cls: 'bg-emerald-900/30 border-emerald-600/50 text-emerald-300' },
          { v: 'few', label: 'Poucos', cls: 'bg-amber-500/20 border-amber-500/60 text-amber-300' },
          { v: 'infested', label: 'Infestado', cls: 'bg-red-900/40 border-red-600/60 text-red-300' },
        ] as const).map(({ v, label: l, cls }) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs border font-medium transition-colors',
              value === v ? cls : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function DiseaseChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm border transition-colors',
        active ? 'bg-red-900/50 border-red-500/60 text-red-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
      )}
    >{label}</button>
  );
}

// ─── Media section (collapsible) ─────────────────────────────────────────────

function MediaSection({ stepIdx, data, update }: { stepIdx: number; data: WizardData; update: (p: Partial<WizardData>) => void }) {
  const [open, setOpen] = useState(false);
  const setPhotos = (photos: string[]) => { const s = [...data.stepPhotos]; s[stepIdx] = photos; update({ stepPhotos: s }); };
  const setAudio  = (audios: string[]) => { const s = [...data.stepAudio];  s[stepIdx] = audios; update({ stepAudio: s }); };
  const photoCount = data.stepPhotos[stepIdx]?.length ?? 0;
  const audioCount = data.stepAudio[stepIdx]?.length ?? 0;
  return (
    <div className="border border-stone-700 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-stone-400 hover:bg-stone-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>📎 Fotos e Áudio</span>
          {(photoCount > 0 || audioCount > 0) && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">
              {photoCount > 0 && `${photoCount} foto${photoCount > 1 ? 's' : ''}`}
              {photoCount > 0 && audioCount > 0 && ' · '}
              {audioCount > 0 && `${audioCount} áudio${audioCount > 1 ? 's' : ''}`}
            </span>
          )}
        </span>
        <span className={cn('transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-stone-700">
          <div className="pt-3">
            <p className="text-xs text-stone-500 mb-2">Fotos</p>
            <PhotoCapture photos={data.stepPhotos[stepIdx] ?? []} onChange={setPhotos} />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-2">Áudio</p>
            <AudioRecorder audios={data.stepAudio[stepIdx] ?? []} onChange={setAudio} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tasks step ───────────────────────────────────────────────────────────────

const PREDEFINED_TASKS: { key: string; label: string; icon: string }[] = [
  { key: 'fornecer_xarope',       label: 'Fornecer xarope',          icon: '🍬' },
  { key: 'fornecer_pollen',       label: 'Fornecer bombom de pólen',  icon: '🌼' },
  { key: 'fornecer_cera',         label: 'Fornecer cera',             icon: '🕯️' },
  { key: 'aplicar_formicida',     label: 'Aplicar formicida',         icon: '🐜' },
  { key: 'combater_forideos',     label: 'Combater forídeos',         icon: '🪰' },
  { key: 'acrescentar_modulo',    label: 'Acrescentar módulo',        icon: '📦' },
  { key: 'retirar_modulo',        label: 'Retirar módulo',            icon: '📤' },
  { key: 'trocar_acetato',        label: 'Trocar acetato',            icon: '🔄' },
  { key: 'trocar_fitas',          label: 'Trocar fitas',              icon: '🩹' },
  { key: 'agendar_divisao',       label: 'Agendar divisão',           icon: '✂️' },
  { key: 'colher_mel',            label: 'Colher mel',                icon: '🍯' },
  { key: 'trocar_caixa',          label: 'Trocar caixa',              icon: '📦' },
];

function TaskCard({
  task,
  onChange,
  onRemove,
}: {
  task: InspectionTask;
  onChange: (t: InspectionTask) => void;
  onRemove: () => void;
}) {
  const predefined = PREDEFINED_TASKS.find((p) => p.key === task.label);
  const displayLabel = predefined
    ? `${predefined.icon} ${predefined.label}`
    : task.custom_text || '✏️ Tarefa personalizada';

  return (
    <div className="border border-stone-700 rounded-xl p-3 space-y-3 bg-stone-800/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-200">{displayLabel}</p>
        <button type="button" onClick={onRemove}
          className="text-stone-500 hover:text-red-400 transition-colors text-xs px-2 py-1"
        >✕</button>
      </div>
      {task.label === 'custom' && (
        <Input
          label="Descrição da tarefa"
          value={task.custom_text}
          onChange={(e) => onChange({ ...task, custom_text: e.target.value })}
          placeholder="Descreva a tarefa..."
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Prazo"
          type="date"
          value={task.due_date ?? ''}
          onChange={(e) => onChange({ ...task, due_date: e.target.value || null })}
        />
        <Input
          label="Responsável"
          value={task.assignee_name}
          onChange={(e) => onChange({ ...task, assignee_name: e.target.value })}
          placeholder="Nome"
        />
      </div>
      <div className="flex gap-2">
        {(['normal', 'urgent'] as const).map((p) => (
          <button key={p} type="button"
            onClick={() => onChange({ ...task, priority: p })}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs border font-medium transition-colors',
              task.priority === p
                ? p === 'urgent'
                  ? 'bg-red-900/40 border-red-600/60 text-red-300'
                  : 'bg-stone-700 border-stone-600 text-stone-200'
                : 'bg-stone-800 border-stone-700 text-stone-500 hover:border-stone-600'
            )}
          >
            {p === 'normal' ? 'Normal' : '⚠️ Urgente'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Orientações step components ─────────────────────────────────────────────

function useBlobRecorder() {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      setBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
    };
    mr.start();
    mediaRef.current = mr;
    setRecording(true);
  }

  function stop() { mediaRef.current?.stop(); }
  function clear() { setBlob(null); }

  return { recording, blob, start, stop, clear };
}

function BigRecordButton({
  recording, blob, onStart, onStop, onClear,
}: { recording: boolean; blob: Blob | null; onStart: () => void; onStop: () => void; onClear: () => void }) {
  if (blob) {
    return (
      <div className="space-y-2">
        <audio controls src={URL.createObjectURL(blob)} className="w-full" style={{ height: '48px' }} />
        <button type="button" onClick={onClear}
          className="w-full py-2 rounded-xl bg-stone-700 text-stone-400 text-sm transition-colors hover:bg-stone-600"
        >
          Regravar
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={recording ? onStop : onStart}
      className={cn(
        'w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-lg font-bold transition-colors',
        recording
          ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
          : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white'
      )}
    >
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z"/>
      </svg>
      {recording ? 'Parar gravação' : '🎙 Gravar áudio'}
    </button>
  );
}

function OrientacaoCard({ instruction }: { instruction: Instruction }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [uploading, setUploading] = useState(false);
  const { recording, blob, start, stop, clear } = useBlobRecorder();
  const markDone = useUpdateInstructionStatus();
  const createResponse = useCreateInstructionResponse(instruction.local_id);

  async function sendReply() {
    if (!replyText.trim() && !blob) return;
    setUploading(true);
    try {
      let audioUrl: string | null = null;
      if (blob) {
        const { uploadUrl, publicUrl } = await requestAudioUploadUrl(`reply-${Date.now()}.webm`, 'audio/webm');
        await uploadAudioToR2(uploadUrl, blob);
        audioUrl = publicUrl;
      }
      await createResponse.mutateAsync({ local_id: uuidv4(), text_content: replyText.trim() || null, audio_url: audioUrl });
      await markDone.mutateAsync({ localId: instruction.local_id, status: 'done' });
      setReplyOpen(false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-stone-800 border border-amber-600/50 rounded-2xl overflow-hidden">
      <div className="p-4 space-y-3">
        {instruction.text_content && (
          <p className="text-lg text-stone-100 leading-relaxed">{instruction.text_content}</p>
        )}
        {instruction.audio_url && (
          <div className="space-y-1">
            <p className="text-xs text-stone-400 uppercase tracking-wide">Orientação em áudio</p>
            <audio controls src={instruction.audio_url} className="w-full" style={{ height: '48px' }} />
          </div>
        )}
        <p className="text-xs text-stone-500">De: {instruction.author_name}</p>
      </div>

      {!replyOpen ? (
        <div className="px-4 pb-4 flex flex-col gap-2">
          <button type="button" onClick={() => setReplyOpen(true)}
            className="w-full flex items-center justify-center gap-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-lg font-bold rounded-2xl py-5 transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z"/>
            </svg>
            Gravar resposta
          </button>
          <button type="button"
            onClick={() => markDone.mutate({ localId: instruction.local_id, status: 'done' })}
            disabled={markDone.isPending}
            className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-lg font-bold rounded-2xl py-4 transition-colors"
          >
            ✅ Marcar como concluído
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-3 border-t border-stone-700 pt-3">
          <textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escreva uma resposta (opcional)..."
            className="w-full bg-stone-900 border border-stone-600 text-stone-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 resize-none"
          />
          <BigRecordButton recording={recording} blob={blob} onStart={start} onStop={stop} onClear={clear} />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setReplyOpen(false); setReplyText(''); clear(); }}
              className="flex-1 py-4 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-300 text-base font-medium transition-colors"
            >Cancelar</button>
            <button type="button" onClick={sendReply}
              disabled={uploading || (!replyText.trim() && !blob)}
              className="flex-1 py-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-base font-bold transition-colors"
            >{uploading ? 'Enviando...' : 'Enviar'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrientacoesStep({ hiveLocalId, apiaryLocalId }: { hiveLocalId: string; apiaryLocalId: string }) {
  const { data: hiveInstructions = [] } = useInstructions({ hive_local_id: hiveLocalId || undefined, status: 'pending' });
  const { data: apiaryAll = [] } = useInstructions({ apiary_local_id: apiaryLocalId || undefined, status: 'pending' });
  const apiaryLevel = apiaryAll.filter((i) => !i.hive_local_id);
  const allInstructions: Instruction[] = [
    ...hiveInstructions,
    ...apiaryLevel.filter((a) => !hiveInstructions.find((h) => h.local_id === a.local_id)),
  ];

  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSent, setMsgSent] = useState(false);
  const [msgSending, setMsgSending] = useState(false);
  const { recording, blob: msgBlob, start, stop, clear } = useBlobRecorder();
  const createInstruction = useCreateInstruction();

  async function sendMessage() {
    if (!msgText.trim() && !msgBlob) return;
    setMsgSending(true);
    try {
      let audioUrl: string | null = null;
      if (msgBlob) {
        const { uploadUrl, publicUrl } = await requestAudioUploadUrl(`msg-${Date.now()}.webm`, 'audio/webm');
        await uploadAudioToR2(uploadUrl, msgBlob);
        audioUrl = publicUrl;
      }
      await createInstruction.mutateAsync({
        local_id: uuidv4(),
        apiary_local_id: apiaryLocalId,
        hive_local_id: hiveLocalId || null,
        text_content: msgText.trim() || null,
        audio_url: audioUrl,
      });
      setMsgSent(true);
      setMsgOpen(false);
      setMsgText('');
      clear();
    } finally {
      setMsgSending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* BLOCO 1 — Orientações pendentes */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-stone-200">
          Orientações do técnico
          {allInstructions.length > 0 && (
            <span className="ml-2 bg-amber-500 text-stone-950 text-xs font-bold rounded-full px-2 py-0.5">
              {allInstructions.length}
            </span>
          )}
        </h3>

        {allInstructions.length === 0 ? (
          <div className="bg-stone-800 border border-stone-700 rounded-2xl px-4 py-6 text-center">
            <p className="text-stone-400 text-base">Nenhuma orientação pendente para esta caixa</p>
          </div>
        ) : (
          allInstructions.map((inst) => (
            <OrientacaoCard key={inst.local_id} instruction={inst} />
          ))
        )}
      </div>

      {/* BLOCO 2 — Enviar mensagem ao orientador */}
      <div className="border-t border-stone-700 pt-5 space-y-3">
        <h3 className="text-base font-semibold text-stone-200">Enviar mensagem ao orientador</h3>

        {msgSent && (
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl px-4 py-3 text-center">
            <p className="text-emerald-400 text-base font-medium">Mensagem enviada ao orientador ✅</p>
          </div>
        )}

        {!msgOpen ? (
          <button type="button" onClick={() => setMsgOpen(true)}
            className="w-full flex items-center justify-center gap-3 bg-stone-700 hover:bg-stone-600 active:bg-stone-800 text-amber-400 text-lg font-bold rounded-2xl py-5 border border-stone-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z"/>
            </svg>
            Enviar mensagem ao orientador
          </button>
        ) : (
          <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 space-y-3">
            <textarea rows={3} value={msgText} onChange={(e) => setMsgText(e.target.value)}
              placeholder="Escreva sua dúvida ou observação (opcional)..."
              className="w-full bg-stone-900 border border-stone-600 text-stone-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 resize-none"
            />
            <BigRecordButton recording={recording} blob={msgBlob} onStart={start} onStop={stop} onClear={clear} />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setMsgOpen(false); setMsgText(''); clear(); }}
                className="flex-1 py-4 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-300 text-base font-medium transition-colors"
              >Cancelar</button>
              <button type="button" onClick={sendMessage}
                disabled={msgSending || (!msgText.trim() && !msgBlob)}
                className="flex-1 py-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-base font-bold transition-colors"
              >{msgSending ? 'Enviando...' : 'Enviar mensagem'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Identificação',  icon: '📋', desc: 'Caixa, data e responsável pela inspeção' },
  { id: 2, label: 'Clima',          icon: '🌤️', desc: 'Condições climáticas no momento da visita' },
  { id: 3, label: 'Colônia',        icon: '🐝', desc: 'Força, saúde e estado geral da colônia' },
  { id: 4, label: 'Alimentação',    icon: '🌺', desc: 'Reservas e necessidades de suplementação' },
  { id: 5, label: 'Sanidade',       icon: '🔬', desc: 'Pragas, doenças e odores' },
  { id: 6, label: 'Caixa',          icon: '🏠', desc: 'Estado físico e estrutural da caixa' },
  { id: 7, label: 'Orientações',    icon: '💬', desc: 'Orientações do técnico e mensagens' },
  { id: 8, label: 'Tarefas',        icon: '✅', desc: 'Tarefas pendentes, notas e próxima visita' },
];

const DISEASE_OPTIONS = [
  { id: 'podridao_cria',   label: '💀 Podridão de cria' },
  { id: 'nosemose',        label: 'Nosemose' },
  { id: 'mal_de_maio',     label: 'Mal de maio' },
  { id: 'pillagem',        label: '🏴‍☠️ Pilhagem' },
  { id: 'cria_seca',       label: 'Cria seca' },
  { id: 'fungo',           label: '🍄 Fungo' },
];

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function InspectionWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user)!;
  const { inspectorName } = useUIStore();
  const { data: hives = [], isLoading: hivesLoading } = useHives();
  const { data: apiaries = [] } = useApiaries();
  const createInspection = useCreateInspection();

  const defaultHiveId = searchParams.get('hive') ?? '';

  const accessibleHives = user.role === 'tratador'
    ? hives.filter((h) => user.hive_local_ids.includes(h.local_id) && h.status === 'active')
    : hives.filter((h) => h.status === 'active');

  const hiveOptions = [
    { value: '', label: 'Selecionar caixa...' },
    ...accessibleHives.map((h) => ({ value: h.local_id, label: h.code })),
  ];

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => makeDefault(inspectorName, defaultHiveId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherFetched, setWeatherFetched] = useState(false);

  const update = useCallback((patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch })), []);

  // Auto-fetch weather when entering step 1 (climate)
  useEffect(() => {
    if (step !== 1 || weatherFetched || !data.hive_local_id) return;
    const hive = hives.find((h) => h.local_id === data.hive_local_id);
    if (!hive) return;
    const apiary = apiaries.find((a) => a.local_id === hive.apiary_local_id);
    if (!apiary?.latitude || !apiary?.longitude) return;

    setWeatherLoading(true);
    fetchWeather(apiary.latitude, apiary.longitude).then((w) => {
      setWeatherLoading(false);
      if (w) {
        update({
          temperature_c: String(w.temperature_c),
          humidity_pct: String(w.humidity_pct),
          precipitation_mm: String(w.precipitation_mm),
          sky_condition: w.sky_condition,
        });
        setWeatherFetched(true);
      }
    });
  }, [step, weatherFetched, data.hive_local_id, hives, apiaries, update]);

  // Validation per step
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!data.hive_local_id) errs.hive_local_id = 'Selecione a caixa';
      if (!data.inspected_at) errs.inspected_at = 'Informe a data';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo(0, 0);
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo(0, 0);
  }

  // Tasks helpers
  function addTask(label: string) {
    const newTask: InspectionTask = {
      id: uuidv4(), label,
      custom_text: '', due_date: null, assignee_name: '', priority: 'normal',
    };
    update({ tasks: [...data.tasks, newTask] });
  }

  function updateTask(id: string, patch: InspectionTask) {
    update({ tasks: data.tasks.map((t) => (t.id === id ? patch : t)) });
  }

  function removeTask(id: string) {
    update({ tasks: data.tasks.filter((t) => t.id !== id) });
  }

  // Build colony_strength → population_strength mapping for backward compat
  const populationStrengthMap: Record<string, 1 | 2 | 3 | 4 | 5> = {
    weak: 1, medium: 3, strong: 5,
  };

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const checklist: InspectionChecklist = {
        colony_strength: data.colony_strength,
        population_strength: populationStrengthMap[data.colony_strength], // backward compat
        brood_present: data.brood_present,
        agitation_level: data.agitation_level,
        ready_for_split: data.ready_for_split,
        honey_ready_for_harvest: data.honey_ready_for_harvest,
        intruder_species: data.intruder_species,
        honey_stores: data.honey_stores,
        pollen_stores: data.pollen_stores,
        propolis_quality: data.propolis_quality,
        needs_syrup: data.needs_syrup,
        syrup_urgency: data.syrup_urgency,
        needs_pollen_ball: data.needs_pollen_ball,
        needs_wax: data.needs_wax,
        ants: data.ants,
        phorid_flies: data.phorid_flies,
        wax_moths: data.wax_moths,
        beetles: data.beetles,
        caterpillar: data.caterpillar,
        other_pests_text: data.other_pests_text,
        strange_odor: data.strange_odor,
        diseases_observed: data.diseases_observed,
        // legacy field so pests_observed is populated
        pests_observed: [
          ...(data.ants !== 'none' ? ['ants'] : []),
          ...(data.phorid_flies !== 'none' ? ['phorid_flies'] : []),
          ...(data.wax_moths ? ['wax_moths'] : []),
          ...(data.beetles ? ['beetles'] : []),
          ...(data.caterpillar ? ['caterpillar'] : []),
        ],
        propolis_seal_intact: data.propolis_seal_intact,
        entrance_blocked: data.entrance_blocked,
        moisture_infiltration: data.moisture_infiltration,
        needs_box_replacement: data.needs_box_replacement,
        box_condition: data.box_condition,
        tasks: data.tasks,
        // legacy
        needs_feeding: data.needs_syrup || data.needs_pollen_ball,
        needs_space_expansion: false,
      };

      const payload = InspectionCreateSchema.parse({
        hive_local_id: data.hive_local_id,
        inspected_at: new Date(data.inspected_at).toISOString(),
        inspector_name: data.inspector_name,
        checklist,
        weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
        temperature_c: data.temperature_c ? parseFloat(data.temperature_c) : null,
        humidity_pct: data.humidity_pct ? parseFloat(data.humidity_pct) : null,
        precipitation_mm: data.precipitation_mm ? parseFloat(data.precipitation_mm) : null,
        sky_condition: data.sky_condition || null,
        notes: data.notes,
        photos: data.stepPhotos.flat(),
        audio_notes: data.stepAudio.flat(),
        next_inspection_due: data.next_inspection_due || null,
      });

      await createInspection.mutateAsync(payload);
      navigate(`/hives/${data.hive_local_id}`, { replace: true });
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Erro ao salvar' });
      setSubmitting(false);
    }
  }

  if (hivesLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const currentHive = hives.find((h) => h.local_id === data.hive_local_id);
  const currentApiary = currentHive
    ? apiaries.find((a) => a.local_id === currentHive.apiary_local_id)
    : null;
  const stepInfo = STEPS[step];

  // ── Step content ────────────────────────────────────────────────────────────

  const stepContent: React.ReactNode[] = [

    // ── Step 0: Identificação ───────────────────────────────────────────────
    <div className="space-y-5" key="s0">
      <Select
        label="Caixa *"
        options={hiveOptions}
        value={data.hive_local_id}
        onChange={(e) => { update({ hive_local_id: e.target.value }); setWeatherFetched(false); }}
        error={errors.hive_local_id}
      />
      {currentApiary && (
        <p className="text-xs text-stone-500 -mt-3">
          📍 {currentApiary.name}{currentApiary.location ? ` · ${currentApiary.location}` : ''}
        </p>
      )}
      <Input
        label="Data e Hora *"
        type="datetime-local"
        value={data.inspected_at}
        onChange={(e) => update({ inspected_at: e.target.value })}
        error={errors.inspected_at}
      />
      <Input
        label="Responsável pela inspeção"
        value={data.inspector_name}
        onChange={(e) => update({ inspector_name: e.target.value })}
        placeholder="Nome do tratador ou responsável"
      />
      <MediaSection stepIdx={0} data={data} update={update} />
    </div>,

    // ── Step 1: Condições Climáticas ────────────────────────────────────────
    <div className="space-y-5" key="s1">
      {weatherLoading ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-900/20 border border-sky-800/50 text-sky-300 text-sm">
          <Spinner />
          <span>Buscando dados climáticos da Open-Meteo...</span>
        </div>
      ) : weatherFetched ? (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900/20 border border-emerald-800/50 text-emerald-400 text-xs">
          ✅ Dados obtidos automaticamente — você pode editar abaixo.
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-500 text-xs">
          {!data.hive_local_id
            ? '⚠️ Selecione uma caixa para buscar o clima automaticamente.'
            : !currentApiary?.latitude
            ? '📍 Meliponário sem coordenadas cadastradas — preencha manualmente.'
            : '📡 Sem conexão — preencha os dados manualmente.'}
        </div>
      )}

      <div>
        <SLabel>Condição do céu</SLabel>
        <div className="flex gap-2">
          {([
            { v: 'sunny',        icon: '☀️',  label: 'Ensolarado' },
            { v: 'partly_cloudy', icon: '⛅',  label: 'Parcialmente nublado' },
            { v: 'cloudy',       icon: '☁️',  label: 'Nublado' },
          ] as { v: SkyCondition; icon: string; label: string }[]).map((opt) => (
            <button key={opt.v} type="button"
              onClick={() => update({ sky_condition: data.sky_condition === opt.v ? '' : opt.v })}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-colors',
                data.sky_condition === opt.v
                  ? 'bg-sky-900/30 border-sky-600/60 text-sky-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
              )}
            >
              <span className="text-2xl">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Temperatura (°C)"
          type="number" step="0.1"
          value={data.temperature_c}
          onChange={(e) => update({ temperature_c: e.target.value })}
          placeholder="ex: 29.5"
        />
        <Input
          label="Umidade do ar (%)"
          type="number" step="1" min="0" max="100"
          value={data.humidity_pct}
          onChange={(e) => update({ humidity_pct: e.target.value })}
          placeholder="ex: 75"
        />
      </div>

      <div>
        <SLabel>Chuva</SLabel>
        <div className="flex gap-3">
          <button type="button"
            onClick={() => update({ precipitation_mm: data.precipitation_mm === '0' ? '' : '0' })}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-colors',
              data.precipitation_mm === '0' || data.precipitation_mm === ''
                ? 'bg-sky-900/20 border-sky-700/50 text-sky-300'
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}
          >
            <span className="text-2xl">🌤️</span>
            Sem chuva
          </button>
          <div className="flex-1">
            <Input
              label="Chuva (mm)"
              type="number" step="0.1" min="0"
              value={data.precipitation_mm === '0' ? '' : data.precipitation_mm}
              onChange={(e) => update({ precipitation_mm: e.target.value })}
              placeholder="ex: 2.5"
            />
          </div>
        </div>
      </div>
    </div>,

    // ── Step 2: Colônia ─────────────────────────────────────────────────────
    <div className="space-y-6" key="s2">
      <div>
        <SLabel>Força da colônia</SLabel>
        <div className="flex gap-2">
          {([
            { v: 'strong', icon: '🐝🐝🐝', label: 'Forte',  desc: 'Boa população, ativa' },
            { v: 'medium', icon: '🐝🐝',   label: 'Média',  desc: 'População regular' },
            { v: 'weak',   icon: '🐝',     label: 'Fraca',  desc: 'Pouquíssimas abelhas' },
          ] as { v: 'strong' | 'medium' | 'weak'; icon: string; label: string; desc: string }[]).map((opt) => (
            <button key={opt.v} type="button"
              onClick={() => update({ colony_strength: opt.v })}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-colors',
                data.colony_strength === opt.v
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
              )}
            >
              <span className="text-xl">{opt.icon}</span>
              <span className="text-sm">{opt.label}</span>
              <span className="text-xs opacity-60">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <Tri
        label="Nível de agitação"
        options={[
          { v: 'calm',       label: 'Calmas',     icon: '😌' },
          { v: 'agitated',   label: 'Agitadas',   icon: '😬' },
          { v: 'defensive',  label: 'Defensivas', icon: '😤' },
        ]}
        value={data.agitation_level}
        onChange={(v) => update({ agitation_level: v })}
      />

      <div className="grid grid-cols-1 gap-2">
        <Toggle icon="🥚" label="Cria presente e saudável"
          active={data.brood_present} onClick={() => update({ brood_present: !data.brood_present })}
          colorActive="emerald"
        />
        <Toggle icon="✂️" label="Pronta para divisão"
          desc="Colônia forte o suficiente para ser dividida"
          active={data.ready_for_split} onClick={() => update({ ready_for_split: !data.ready_for_split })}
          colorActive="emerald"
        />
        <Toggle icon="🍯" label="Mel disponível para colheita"
          active={data.honey_ready_for_harvest} onClick={() => update({ honey_ready_for_harvest: !data.honey_ready_for_harvest })}
          colorActive="amber"
        />
        <Toggle icon="🐞" label="Presença de intrusos (outras espécies)"
          active={data.intruder_species} onClick={() => update({ intruder_species: !data.intruder_species })}
          colorActive="red"
        />
      </div>
      <MediaSection stepIdx={2} data={data} update={update} />
    </div>,

    // ── Step 3: Alimentação ─────────────────────────────────────────────────
    <div className="space-y-6" key="s3">
      <LevelPicker label="Reserva de mel 🍯" value={data.honey_stores} onChange={(v) => update({ honey_stores: v })} />
      <LevelPicker label="Reserva de pólen 🌼" value={data.pollen_stores} onChange={(v) => update({ pollen_stores: v })} />
      <Tri
        label="Qualidade da própolis"
        options={[
          { v: 'poor',   label: 'Ruim',   icon: '🔴' },
          { v: 'normal', label: 'Normal', icon: '🟡' },
          { v: 'good',   label: 'Boa',    icon: '🟢' },
        ]}
        value={data.propolis_quality}
        onChange={(v) => update({ propolis_quality: v })}
      />

      <div className="border-t border-stone-700 pt-4">
        <SLabel>Necessidades de suplementação</SLabel>
        <div className="space-y-2">
          <Toggle icon="🍬" label="Precisa de xarope"
            active={data.needs_syrup} onClick={() => update({ needs_syrup: !data.needs_syrup })}
            colorActive="amber"
          />
          {data.needs_syrup && (
            <div className="ml-10 flex gap-2">
              {(['normal', 'urgent'] as const).map((u) => (
                <button key={u} type="button"
                  onClick={() => update({ syrup_urgency: u })}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs border font-medium transition-colors',
                    data.syrup_urgency === u
                      ? u === 'urgent'
                        ? 'bg-red-900/40 border-red-600/60 text-red-300'
                        : 'bg-stone-700 border-stone-600 text-stone-200'
                      : 'bg-stone-800 border-stone-700 text-stone-500'
                  )}
                >
                  {u === 'normal' ? 'Normal' : '⚠️ Urgente'}
                </button>
              ))}
            </div>
          )}
          <Toggle icon="🌼" label="Precisa de bombom de pólen"
            active={data.needs_pollen_ball} onClick={() => update({ needs_pollen_ball: !data.needs_pollen_ball })}
            colorActive="amber"
          />
          <Toggle icon="🕯️" label="Precisa de cera"
            active={data.needs_wax} onClick={() => update({ needs_wax: !data.needs_wax })}
            colorActive="amber"
          />
        </div>
      </div>
      <MediaSection stepIdx={3} data={data} update={update} />
    </div>,

    // ── Step 4: Sanidade ────────────────────────────────────────────────────
    <div className="space-y-5" key="s4">
      <InfestationPicker label="Formigas"   icon="🐜" value={data.ants}         onChange={(v) => update({ ants: v })} />
      <InfestationPicker label="Forídeos"   icon="🪰" value={data.phorid_flies} onChange={(v) => update({ phorid_flies: v })} />

      <div>
        <SLabel>Outras pragas</SLabel>
        <div className="grid grid-cols-2 gap-2">
          <Toggle icon="🦋" label="Traças"    active={data.wax_moths}   onClick={() => update({ wax_moths: !data.wax_moths })}   colorActive="red" />
          <Toggle icon="🪲" label="Besouros"  active={data.beetles}     onClick={() => update({ beetles: !data.beetles })}        colorActive="red" />
          <Toggle icon="🐛" label="Lagarta"   active={data.caterpillar} onClick={() => update({ caterpillar: !data.caterpillar })} colorActive="red" />
          <Toggle icon="👃" label="Odor estranho" active={data.strange_odor} onClick={() => update({ strange_odor: !data.strange_odor })} colorActive="red" />
        </div>
      </div>

      <div>
        <SLabel>Outras pragas (descrição livre)</SLabel>
        <Textarea
          label=""
          value={data.other_pests_text}
          onChange={(e) => update({ other_pests_text: e.target.value })}
          placeholder="Descreva outras pragas ou problemas observados..."
          rows={2}
        />
      </div>

      <div>
        <SLabel>Doenças observadas</SLabel>
        <div className="flex flex-wrap gap-2">
          {DISEASE_OPTIONS.map(({ id, label }) => (
            <DiseaseChip key={id} label={label}
              active={data.diseases_observed.includes(id)}
              onClick={() => {
                const cur = data.diseases_observed;
                update({ diseases_observed: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
              }}
            />
          ))}
        </div>
        {data.diseases_observed.length === 0 && (
          <p className="text-xs text-stone-500 mt-2">✅ Nenhuma doença marcada</p>
        )}
      </div>
      <MediaSection stepIdx={4} data={data} update={update} />
    </div>,

    // ── Step 5: Caixa ───────────────────────────────────────────────────────
    <div className="space-y-5" key="s5">
      <Tri
        label="Estado geral da caixa"
        options={[
          { v: 'poor', label: 'Ruim',    icon: '🔴' },
          { v: 'fair', label: 'Regular', icon: '🟡' },
          { v: 'good', label: 'Bom',     icon: '🟢' },
        ]}
        value={data.box_condition}
        onChange={(v) => update({ box_condition: v })}
      />
      <Tri
        label="Batume (propolis seal)"
        options={[
          { v: true as unknown as string,  label: 'Íntegro',   icon: '✅' },
          { v: false as unknown as string, label: 'Danificado', icon: '⚠️' },
        ]}
        value={data.propolis_seal_intact === null ? null : String(data.propolis_seal_intact)}
        onChange={(v) => update({ propolis_seal_intact: v === null ? null : v === 'true' })}
      />

      <div className="grid grid-cols-1 gap-2">
        <Toggle icon="🚪" label="Entrada obstruída"
          active={data.entrance_blocked} onClick={() => update({ entrance_blocked: !data.entrance_blocked })}
          colorActive="red"
        />
        <Toggle icon="💧" label="Umidade ou infiltração"
          active={data.moisture_infiltration} onClick={() => update({ moisture_infiltration: !data.moisture_infiltration })}
          colorActive="red"
        />
        <Toggle icon="🔁" label="Necessita troca de caixa"
          active={data.needs_box_replacement} onClick={() => update({ needs_box_replacement: !data.needs_box_replacement })}
          colorActive="red"
        />
      </div>

      <Input
        label="Peso da caixa (kg)"
        type="number" step="0.01"
        value={data.weight_kg}
        onChange={(e) => update({ weight_kg: e.target.value })}
        placeholder="ex: 4.50"
      />
      <MediaSection stepIdx={5} data={data} update={update} />
    </div>,

    // ── Step 6: Orientações ──────────────────────────────────────────────────
    <OrientacoesStep key="s6" hiveLocalId={data.hive_local_id} apiaryLocalId={currentHive?.apiary_local_id ?? ''} />,

    // ── Step 7: Tarefas e Ações ─────────────────────────────────────────────
    <div className="space-y-5" key="s7">
      {/* Predefined task selector */}
      <div>
        <SLabel>Adicionar tarefas à inspeção</SLabel>
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_TASKS.map((pt) => {
            const already = data.tasks.some((t) => t.label === pt.key);
            return (
              <button key={pt.key} type="button"
                disabled={already}
                onClick={() => addTask(pt.key)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm border transition-colors',
                  already
                    ? 'bg-emerald-900/30 border-emerald-600/50 text-emerald-400 cursor-default'
                    : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-600/50 hover:text-amber-400'
                )}
              >
                {pt.icon} {pt.label}
              </button>
            );
          })}
          <button type="button" onClick={() => addTask('custom')}
            className="px-3 py-1.5 rounded-full text-sm border border-stone-700 bg-stone-800 text-stone-400 hover:border-amber-600/50 hover:text-amber-400 transition-colors"
          >
            ✏️ Personalizada
          </button>
        </div>
      </div>

      {/* Task cards */}
      {data.tasks.length > 0 && (
        <div className="space-y-2">
          {data.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onChange={(t) => updateTask(task.id, t)}
              onRemove={() => removeTask(task.id)}
            />
          ))}
        </div>
      )}

      {/* Final fields */}
      <div className="border-t border-stone-700 pt-4 space-y-4">
        <Input
          label="Próxima inspeção prevista"
          type="date"
          value={data.next_inspection_due}
          onChange={(e) => update({ next_inspection_due: e.target.value })}
        />
        <Textarea
          label="Observações gerais"
          value={data.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Notas adicionais sobre a inspeção..."
          rows={4}
        />
        <MediaSection stepIdx={6} data={data} update={update} />
      </div>

      {errors.submit && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
          {errors.submit}
        </p>
      )}
    </div>,
  ];

  // ── Summary badge counts ────────────────────────────────────────────────────
  const totalPhotos = data.stepPhotos.flat().length;
  const totalAudio  = data.stepAudio.flat().length;
  const taskCount   = data.tasks.length;

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-stone-900 border-b border-stone-800">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)}
            className="text-stone-400 hover:text-stone-100 transition-colors p-1" title="Cancelar"
          >✕</button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-100 truncate">
              {currentHive ? `Inspeção · ${currentHive.code}` : 'Nova Inspeção'}
            </p>
            <p className="text-xs text-stone-500">{stepInfo.icon} {stepInfo.label}</p>
          </div>
          <div className="flex gap-2 text-xs text-stone-500">
            {totalPhotos > 0 && <span>📷 {totalPhotos}</span>}
            {totalAudio  > 0 && <span>🎙 {totalAudio}</span>}
            {taskCount   > 0 && <span className="text-amber-400">✅ {taskCount}</span>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <button key={s.id} type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                title={s.label}
              >
                <div className={cn(
                  'h-full w-full rounded-full',
                  i < step ? 'bg-amber-500' : i === step ? 'bg-amber-400' : 'bg-stone-700'
                )} />
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500 mt-1.5 text-right">
            Etapa {step + 1} de {STEPS.length}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-stone-100">{stepInfo.icon} {stepInfo.label}</h2>
          <p className="text-stone-500 text-sm mt-0.5">{stepInfo.desc}</p>
        </div>
        {stepContent[step]}
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 bg-stone-900 border-t border-stone-800 px-4 py-3 flex gap-3">
        {step > 0 ? (
          <Button variant="secondary" onClick={back} className="flex-1">← Voltar</Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate(-1)} className="flex-1">Cancelar</Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={next} className="flex-1">Próxima →</Button>
        ) : (
          <Button onClick={submit} loading={submitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500"
          >
            ✓ Finalizar Inspeção
          </Button>
        )}
      </footer>
    </div>
  );
}

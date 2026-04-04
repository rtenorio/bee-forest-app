import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCreateUser, useUpdateUser, type ManagedUser, type CreateUserPayload } from '@/hooks/useUsers';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { Button } from '@/components/ui/Button';
import { ROLE_LABELS, creatableRoles } from '@bee-forest/shared';
import type { UserRole } from '@bee-forest/shared';

interface Props {
  initial?: ManagedUser;
  onSuccess: () => void;
  onCancel: () => void;
}

const ROLE_BADGE: Record<UserRole, string> = {
  master_admin: 'text-violet-300',
  socio:        'text-amber-300',
  responsavel:  'text-blue-300',
  tratador:     'text-emerald-300',
};

export function UserForm({ initial, onSuccess, onCancel }: Props) {
  const actorRole = useAuthStore((s) => s.user!.role);
  const isEdit = !!initial;

  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [role, setRole] = useState<UserRole>(initial?.role ?? creatableRoles(actorRole)[0]);
  const [observations, setObservations] = useState(initial?.observations ?? '');
  const [selectedApiaryIds, setSelectedApiaryIds] = useState<string[]>(initial?.apiary_local_ids ?? []);
  const [selectedHiveIds, setSelectedHiveIds] = useState<string[]>(initial?.hive_local_ids ?? []);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: apiaries = [] } = useApiaries();
  const { data: hives = [] } = useHives();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const allowedRoles = creatableRoles(actorRole);
  const isSubmitting = createUser.isPending || updateUser.isPending;

  const toggleApiary = (id: string) => {
    setSelectedApiaryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleHive = (id: string) => {
    setSelectedHiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('Nome e e-mail são obrigatórios.');
      return;
    }

    try {
      if (isEdit) {
        await updateUser.mutateAsync({
          id: initial!.id,
          data: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || undefined,
            observations: observations.trim(),
            apiary_local_ids: role === 'responsavel' ? selectedApiaryIds : undefined,
            hive_local_ids: role === 'tratador' ? selectedHiveIds : undefined,
          },
        });
        onSuccess();
      } else {
        const payload: CreateUserPayload = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          role,
          observations: observations.trim() || undefined,
          apiary_local_ids: role === 'responsavel' ? selectedApiaryIds : [],
          hive_local_ids: role === 'tratador' ? selectedHiveIds : [],
        };
        const result = await createUser.mutateAsync(payload);
        setGeneratedPassword(result.generated_password);
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao salvar usuário.');
    }
  };

  const copyPassword = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Se a senha foi gerada, mostra o card de sucesso
  if (generatedPassword) {
    return (
      <div className="space-y-5 py-2">
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-5 text-center space-y-3">
          <div className="text-3xl">✅</div>
          <p className="text-emerald-300 font-semibold">Usuário criado com sucesso!</p>
          <p className="text-stone-400 text-sm">Compartilhe a senha gerada com o usuário:</p>
          <div className="bg-stone-900 border border-stone-700 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <code className="text-amber-300 font-mono text-lg tracking-widest">{generatedPassword}</code>
            <button
              onClick={copyPassword}
              className="text-xs text-stone-400 hover:text-stone-200 transition-colors whitespace-nowrap"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-stone-600 text-xs">
            Esta senha é exibida apenas uma vez. O usuário poderá alterá-la após o primeiro acesso.
          </p>
        </div>
        <Button className="w-full" onClick={onSuccess}>Fechar</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nome */}
        <div className="sm:col-span-2">
          <label className="text-xs text-stone-400 block mb-1">Nome *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
            required
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* E-mail */}
        <div>
          <label className="text-xs text-stone-400 block mb-1">E-mail *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@email.com"
            required
            disabled={isEdit}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
        </div>

        {/* Telefone */}
        <div>
          <label className="text-xs text-stone-400 block mb-1">Telefone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Perfil (somente no cadastro) */}
        {!isEdit && allowedRoles.length > 0 && (
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-400 block mb-1">Perfil *</label>
            <div className="flex flex-wrap gap-2">
              {allowedRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    role === r
                      ? `border-amber-500 bg-amber-500/10 ${ROLE_BADGE[r]}`
                      : 'border-stone-700 text-stone-400 hover:border-stone-600'
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Meliponários (Responsável) */}
      {(isEdit ? initial?.role === 'responsavel' : role === 'responsavel') && apiaries.length > 0 && (
        <div>
          <label className="text-xs text-stone-400 block mb-2">Meliponários vinculados</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {apiaries.map((a) => (
              <label
                key={a.local_id}
                className="flex items-center gap-2 cursor-pointer hover:bg-stone-800 px-2 py-1.5 rounded-lg transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedApiaryIds.includes(a.local_id)}
                  onChange={() => toggleApiary(a.local_id)}
                  className="accent-amber-500 w-4 h-4"
                />
                <span className="text-sm text-stone-300 truncate">{a.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Caixas de abelha (Tratador) */}
      {(isEdit ? initial?.role === 'tratador' : role === 'tratador') && hives.length > 0 && (
        <div>
          <label className="text-xs text-stone-400 block mb-2">Caixas de abelha vinculadas</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-48 overflow-y-auto border border-stone-800 rounded-lg p-2">
            {hives.map((h) => (
              <label
                key={h.local_id}
                className="flex items-center gap-1.5 cursor-pointer hover:bg-stone-800 px-1.5 py-1 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedHiveIds.includes(h.local_id)}
                  onChange={() => toggleHive(h.local_id)}
                  className="accent-amber-500 w-3.5 h-3.5"
                />
                <span className="text-xs text-stone-300 font-mono">{h.qr_code ?? h.code}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Observações */}
      <div>
        <label className="text-xs text-stone-400 block mb-1">Observações</label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={2}
          placeholder="Informações adicionais sobre este usuário..."
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 placeholder-stone-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
        />
      </div>

      {/* Ações */}
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Usuário'}
        </Button>
      </div>
    </form>
  );
}

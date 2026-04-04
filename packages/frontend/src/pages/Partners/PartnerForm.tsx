import { useState } from 'react';
import { useCreatePartner, useUpdatePartner } from '@/hooks/usePartners';
import { Button } from '@/components/ui/Button';
import type { Partner, PartnerCreate } from '@bee-forest/shared';

interface Props {
  initial?: Partner;
  onSuccess: () => void;
  onCancel: () => void;
}

type Tab = 'personal' | 'bank' | 'notes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'personal', label: 'Dados pessoais' },
  { id: 'bank', label: 'Dados bancários' },
  { id: 'notes', label: 'Observações' },
];

export function PartnerForm({ initial, onSuccess, onCancel }: Props) {
  const [tab, setTab] = useState<Tab>('personal');
  const [form, setForm] = useState<Partial<PartnerCreate>>({
    full_name: initial?.full_name ?? '',
    document: initial?.document ?? '',
    address: initial?.address ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    phone: initial?.phone ?? '',
    whatsapp: initial?.whatsapp ?? '',
    email: initial?.email ?? '',
    bank_name: initial?.bank_name ?? '',
    bank_agency: initial?.bank_agency ?? '',
    bank_account: initial?.bank_account ?? '',
    pix_key: initial?.pix_key ?? '',
    partnership_start_date: initial?.partnership_start_date ?? '',
    status: initial?.status ?? 'active',
    max_purchase_pct: initial?.max_purchase_pct ?? 70,
    notes: initial?.notes ?? '',
  });

  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner(initial?.local_id ?? '');
  const isPending = createPartner.isPending || updatePartner.isPending;

  function set(key: keyof PartnerCreate, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (initial) {
        await updatePartner.mutateAsync(form);
      } else {
        await createPartner.mutateAsync(form as PartnerCreate);
      }
      onSuccess();
    } catch {
      // errors shown via mutation state
    }
  }

  const error = createPartner.error?.message ?? updatePartner.error?.message;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'personal' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-400 block mb-1">Nome completo *</label>
            <input
              required
              value={form.full_name ?? ''}
              onChange={(e) => set('full_name', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">CPF / CNPJ</label>
            <input
              value={form.document ?? ''}
              onChange={(e) => set('document', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">E-mail</label>
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Telefone</label>
            <input
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">WhatsApp</label>
            <input
              value={form.whatsapp ?? ''}
              onChange={(e) => set('whatsapp', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-400 block mb-1">Endereço</label>
            <input
              value={form.address ?? ''}
              onChange={(e) => set('address', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Cidade</label>
            <input
              value={form.city ?? ''}
              onChange={(e) => set('city', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Estado (UF)</label>
            <input
              maxLength={2}
              value={form.state ?? ''}
              onChange={(e) => set('state', e.target.value.toUpperCase())}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Início da parceria</label>
            <input
              type="date"
              value={form.partnership_start_date ?? ''}
              onChange={(e) => set('partnership_start_date', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">% máx. de compra</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.max_purchase_pct ?? 70}
              onChange={(e) => set('max_purchase_pct', Number(e.target.value))}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Status</label>
            <select
              value={form.status ?? 'active'}
              onChange={(e) => set('status', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="suspended">Suspenso</option>
            </select>
          </div>
        </div>
      )}

      {tab === 'bank' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-stone-400 block mb-1">Banco</label>
            <input
              value={form.bank_name ?? ''}
              onChange={(e) => set('bank_name', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Agência</label>
            <input
              value={form.bank_agency ?? ''}
              onChange={(e) => set('bank_agency', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Conta</label>
            <input
              value={form.bank_account ?? ''}
              onChange={(e) => set('bank_account', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Chave PIX</label>
            <input
              value={form.pix_key ?? ''}
              onChange={(e) => set('pix_key', e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <label className="text-xs text-stone-400 block mb-1">Observações</label>
          <textarea
            rows={6}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : initial ? 'Salvar alterações' : 'Cadastrar parceiro'}
        </Button>
      </div>
    </form>
  );
}

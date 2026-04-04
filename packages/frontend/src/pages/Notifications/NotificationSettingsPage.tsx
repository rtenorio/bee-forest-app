import { useState, useEffect } from 'react';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  useVapidPublicKey,
  useSubscribePush,
  useUnsubscribePush,
} from '@/hooks/useNotifications';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none py-2">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div
          onClick={() => onChange(!checked)}
          className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${checked ? 'bg-amber-500' : 'bg-stone-700'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </div>
      <div>
        <p className="text-sm text-stone-200">{label}</p>
        {hint && <p className="text-xs text-stone-500 mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

export function NotificationSettingsPage() {
  const { data: settings, isLoading } = useNotificationSettings();
  const { data: vapid } = useVapidPublicKey();
  const updateSettings = useUpdateNotificationSettings();
  const subscribePush = useSubscribePush();
  const unsubscribePush = useUnsubscribePush();

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Detect current push subscription state
  useEffect(() => {
    async function check() {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(!!sub);
    }
    check();
  }, []);

  useEffect(() => {
    if (settings?.whatsapp_phone) setWhatsappPhone(settings.whatsapp_phone);
  }, [settings]);

  if (isLoading) return <div className="text-stone-500 text-center py-12">Carregando...</div>;
  if (!settings) return null;

  const vapidAvailable = !!vapid?.key;

  async function handleTogglePush() {
    if (!vapid?.key) return;
    if (pushSubscribed) {
      await unsubscribePush.mutateAsync();
      setPushSubscribed(false);
      await updateSettings.mutateAsync({ web_push_enabled: false });
    } else {
      await subscribePush.mutateAsync(vapid.key);
      setPushSubscribed(true);
      await updateSettings.mutateAsync({ web_push_enabled: true });
    }
  }

  async function handleSaveWhatsApp() {
    setPhoneError('');
    const phone = whatsappPhone.trim();
    if (settings!.whatsapp_enabled && phone && !/^\+\d{10,15}$/.test(phone)) {
      setPhoneError('Use o formato internacional: +55119xxxxxxxx');
      return;
    }
    await updateSettings.mutateAsync({ whatsapp_phone: phone || null });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Configurações de Notificações</h1>
        <p className="text-stone-500 text-sm">Gerencie como e quando você recebe notificações</p>
      </div>

      {/* Web Push */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações Push (Navegador)</CardTitle>
          {vapidAvailable
            ? <Badge variant={pushSubscribed ? 'success' : 'default'}>{pushSubscribed ? 'Ativo' : 'Inativo'}</Badge>
            : <Badge variant="default">Não configurado</Badge>
          }
        </CardHeader>

        {!vapidAvailable ? (
          <p className="text-sm text-stone-500">
            As notificações push não estão configuradas nesta instância. Configure as variáveis VAPID no servidor.
          </p>
        ) : !('serviceWorker' in navigator) ? (
          <p className="text-sm text-stone-500">Seu navegador não suporta notificações push.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone-400">
              Receba alertas em tempo real no navegador, mesmo com o app fechado.
            </p>
            <Button
              onClick={handleTogglePush}
              loading={subscribePush.isPending || unsubscribePush.isPending}
              variant={pushSubscribed ? 'secondary' : 'primary'}
              size="sm"
            >
              {pushSubscribed ? 'Cancelar inscrição' : 'Ativar notificações push'}
            </Button>
          </div>
        )}
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações por WhatsApp</CardTitle>
          <Badge variant={settings.whatsapp_enabled ? 'success' : 'default'}>
            {settings.whatsapp_enabled ? 'Ativo' : 'Inativo'}
          </Badge>
        </CardHeader>
        <div className="space-y-4">
          <Toggle
            checked={settings.whatsapp_enabled}
            onChange={(v) => updateSettings.mutate({ whatsapp_enabled: v })}
            label="Receber via WhatsApp"
            hint="Requer número cadastrado abaixo"
          />
          <Input
            label="Número WhatsApp"
            value={whatsappPhone}
            onChange={(e) => setWhatsappPhone(e.target.value)}
            placeholder="+5511999999999"
            hint="Formato internacional com código do país"
            error={phoneError}
          />
          <Button size="sm" variant="secondary" onClick={handleSaveWhatsApp} loading={updateSettings.isPending}>
            Salvar número
          </Button>
        </div>
      </Card>

      {/* Per-event toggles */}
      <Card>
        <CardHeader><CardTitle>Tipos de Alertas</CardTitle></CardHeader>
        <div className="divide-y divide-stone-800">
          <Toggle
            checked={settings.notify_inspection_overdue}
            onChange={(v) => updateSettings.mutate({ notify_inspection_overdue: v })}
            label="Inspeção atrasada"
            hint="Caixas sem inspeção há mais de 14 dias"
          />
          <Toggle
            checked={settings.notify_task_overdue}
            onChange={(v) => updateSettings.mutate({ notify_task_overdue: v })}
            label="Tarefa vencida"
            hint="Tarefas de inspeção com prazo expirado"
          />
          <Toggle
            checked={settings.notify_batch_risk}
            onChange={(v) => updateSettings.mutate({ notify_batch_risk: v })}
            label="Risco de fermentação em lotes"
            hint="Lotes com umidade alta ou sinais de fermentação"
          />
          <Toggle
            checked={settings.notify_batch_stalled}
            onChange={(v) => updateSettings.mutate({ notify_batch_stalled: v })}
            label="Lote sem movimentação"
            hint="Lotes em processamento sem atualização há 7+ dias"
          />
        </div>
      </Card>
    </div>
  );
}

import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN ?? 'https://893aec86cb59f401043ef7792d25c879@o4511185840766976.ingest.us.sentry.io/4511185861148672',
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
});

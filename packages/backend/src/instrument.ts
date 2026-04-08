import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN_BACKEND ?? 'https://a31cc08a17c3f3f5171d3fa5785061f1@o4511185840766976.ingest.us.sentry.io/4511185845026816',
  environment: process.env.NODE_ENV ?? 'development',
  sendDefaultPii: false,
});

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://beeforest:beeforest@localhost:5432/beeforest',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'bee-forest-dev-secret-change-in-production',
  jwtExpiresIn: '7d' as const,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  vapidEmail: process.env.VAPID_EMAIL ?? 'mailto:admin@beeforest.com',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
};

import { Router } from 'express';
import Stripe from 'stripe';

const router = Router();

interface CheckoutItem {
  id:  string;
  qty: number;
}

// Product catalog — prices in cents (BRL)
// Keep in sync with data/products.json in bee-forest-site
const PRODUCT_PRICES: Record<string, { name: string; priceInCents: number; imagem?: string }> = {
  'golden-drops':  { name: 'Golden Drops Sérum 30ml',     priceInCents: 18900 },
  'mel-urucu-100g':{ name: 'Mel de Uruçu 100g',           priceInCents:  7900 },
  'glow-defense':  { name: 'Glow Defense FPS 50 · 40g',   priceInCents: 14900 },
  'nectar-balm':   { name: 'Nectar Balm · 60ml',          priceInCents: 12900 },
};

// POST /api/checkout — create Stripe Checkout Session
router.post('/', async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({ message: 'Pagamento não disponível no momento.' });
  }

  const { items, success_url, cancel_url } = req.body ?? {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Carrinho vazio.' });
  }

  // Validate URLs to prevent open redirect
  const allowedOrigins = [
    'https://beeforest.com.br',
    'https://www.beeforest.com.br',
    'http://localhost',
    'http://127.0.0.1',
  ];

  function isAllowedUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return allowedOrigins.some(o => url.startsWith(o)) || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    } catch { return false; }
  }

  if (!isAllowedUrl(success_url) || !isAllowedUrl(cancel_url)) {
    return res.status(400).json({ message: 'URL inválida.' });
  }

  const stripe = new Stripe(stripeKey);

  try {
    const line_items = [];

    for (const item of items as CheckoutItem[]) {
      const product = PRODUCT_PRICES[item.id];
      if (!product) continue;

      const qty = Math.max(1, Math.min(99, Math.floor(item.qty)));

      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'brl',
          unit_amount: product.priceInCents,
          product_data: { name: product.name },
        },
      });
    }

    if (!line_items.length) {
      return res.status(400).json({ message: 'Nenhum produto válido no carrinho.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode:    'payment',
      line_items,
      payment_method_types: ['card'],
      success_url,
      cancel_url,
      locale: 'pt-BR',
      metadata: { source: 'bee-forest-site' },
    } as Parameters<typeof stripe.checkout.sessions.create>[0]);

    res.json({ sessionId: session.id });
  } catch (err) {
    console.error('[checkout] Stripe error:', err);
    res.status(500).json({ message: 'Erro ao criar sessão de pagamento.' });
  }
});

export default router;

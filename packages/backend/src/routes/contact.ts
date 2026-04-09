import { Router } from 'express';
import { Resend } from 'resend';

const router = Router();

// POST /api/contact — form submission from bee-forest-site
router.post('/', async (req, res) => {
  const { nome, email, assunto, mensagem } = req.body ?? {};

  if (!nome || !email || !assunto || !mensagem) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'E-mail inválido.' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // Log but don't expose key absence to client
    console.error('[contact] RESEND_API_KEY not set');
    return res.status(200).json({ message: 'Mensagem recebida.' });
  }

  try {
    const resend = new Resend(resendKey);
    const toEmail = process.env.CONTACT_TO_EMAIL ?? 'contato@beeforest.com.br';

    await resend.emails.send({
      from:    'Bee Forest Site <noreply@beeforest.com.br>',
      to:      [toEmail],
      replyTo: email,
      subject: `[Contato Site] ${assunto} — ${nome}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#C9A84C;border-bottom:1px solid #eee;padding-bottom:12px">
            Nova mensagem via site
          </h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#666;width:100px">Nome:</td>
                <td style="padding:8px 0;font-weight:600">${nome}</td></tr>
            <tr><td style="padding:8px 0;color:#666">E-mail:</td>
                <td style="padding:8px 0"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#666">Assunto:</td>
                <td style="padding:8px 0">${assunto}</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#f5f5f5;border-radius:6px">
            <p style="color:#333;white-space:pre-wrap;line-height:1.6">${mensagem}</p>
          </div>
          <p style="margin-top:24px;font-size:12px;color:#999">
            Enviado via beeforest.com.br em ${new Date().toLocaleString('pt-BR')}
          </p>
        </div>
      `,
    });

    // Auto-reply to sender
    await resend.emails.send({
      from:    'Bee Forest <noreply@beeforest.com.br>',
      to:      [email],
      subject: 'Recebemos sua mensagem — Bee Forest 🐝',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#C9A84C">Obrigado, ${nome}!</h2>
          <p style="color:#555;line-height:1.7">
            Recebemos sua mensagem sobre <strong>${assunto}</strong> e responderemos em até 24 horas úteis.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="font-size:12px;color:#999">Bee Forest · Meliponicultura & Cosméticos Naturais</p>
        </div>
      `,
    });

    res.json({ message: 'Mensagem enviada com sucesso.' });
  } catch (err) {
    console.error('[contact] Resend error:', err);
    res.status(500).json({ message: 'Erro ao enviar mensagem. Tente novamente.' });
  }
});

export default router;

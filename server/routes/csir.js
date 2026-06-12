const express = require('express');
const rateLimit = require('express-rate-limit');
const csirData = require('../lib/csirData');
const publicSiteStats = require('../lib/publicSiteStats');
const csirLeadsStore = require('../lib/csirLeadsStore');
const contactMail = require('../lib/contactMail');
const doubtAssistant = require('../lib/doubtAssistant');
const hcaptchaPolicy = require('../lib/hcaptchaPolicy');

const router = express.Router();
const jsonParser = express.json({ limit: '64kb' });

const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' }
});

const doubtLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many doubt requests. Try again later.' }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteOrigin() {
  const raw = (process.env.SITE_URL || '').trim();
  if (raw) return raw.replace(/\/$/, '');
  return '';
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'derived-csir', timestamp: new Date().toISOString() });
});

router.get('/site/public', (_req, res) => {
  const siteKey = (process.env.HCAPTCHA_SITE_KEY || '').trim();
  res.json({
    hcaptchaSiteKey: siteKey || null
  });
});

router.get('/goal/stats', (_req, res) => {
  res.json(publicSiteStats.build());
});

router.get('/subjects', (_req, res) => {
  res.json(csirData.subjects);
});

router.get('/subjects/:slug', (req, res) => {
  const subject = csirData.subjects.find((s) => s.slug === req.params.slug);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  res.json(subject);
});

router.get('/educators', (req, res) => {
  const { subject } = req.query;
  let list = csirData.educators;
  if (subject) {
    const q = String(subject).toLowerCase();
    list = list.filter((e) => e.subject.toLowerCase().includes(q));
  }
  res.json(list);
});

router.get('/educators/:id', (req, res) => {
  const educator = csirData.educators.find((e) => e.id === Number(req.params.id));
  if (!educator) return res.status(404).json({ error: 'Educator not found' });
  res.json(educator);
});

router.get('/plans', (_req, res) => {
  res.json(csirData.plans);
});

router.get('/plans/:id', (req, res) => {
  const plan = csirData.plans.find((p) => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json(plan);
});

router.get('/testimonials', (_req, res) => {
  res.json(csirData.testimonials);
});

router.get('/faqs', (_req, res) => {
  res.json(csirData.faqs);
});

async function handleContactSubmit(req, res) {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = body.phone != null ? String(body.phone).trim() : '';
  const subject = body.subject != null ? String(body.subject).trim() : 'General inquiry';
  const message = String(body.message || '').trim();
  const privacyAccepted =
    body.privacyAccepted === true || body.privacy === true || body.privacy === 'on';

  if (!privacyAccepted) {
    return res.status(400).json({ error: 'Please accept the Privacy Policy to continue.' });
  }

  if (!(await hcaptchaPolicy.enforce(body, res))) return;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (!message || message.length < 10) {
    return res.status(400).json({ error: 'Message is required (at least 10 characters).' });
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message is too long (max 5000 characters).' });
  }

  const leads = csirLeadsStore.readLeads();
  const entry = {
    id: leads.length ? Math.max(...leads.map((l) => l.id)) + 1 : 1,
    type: 'contact',
    name,
    email,
    phone: phone || null,
    subject: subject || 'General inquiry',
    message,
    createdAt: new Date().toISOString()
  };

  leads.push(entry);
  csirLeadsStore.writeLeads(leads);

  let emailResult = { sent: false };
  try {
    emailResult = await contactMail.sendContactEmail(entry);
  } catch (err) {
    console.error('[contact] Email send failed:', err.message);
    emailResult = { sent: false, reason: 'send_failed' };
  }

  const storedNote = emailResult.sent
    ? 'We emailed your message to our team.'
    : contactMail.smtpConfigured()
      ? 'Message saved; email could not be sent right now.'
      : 'Message saved. Configure SMTP in .env to receive emails in Gmail.';

  res.status(201).json({
    message: 'Thank you! Your message was sent successfully.',
    contact: { id: entry.id },
    emailSent: Boolean(emailResult.sent),
    redirectUrl: '/contact-thanks.html'
  });
}

router.post('/contact', postLimiter, jsonParser, (req, res) => {
  handleContactSubmit(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Could not submit contact form.' });
  });
});

router.post('/leads', postLimiter, jsonParser, (req, res) => {
  handleContactSubmit(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Could not submit contact form.' });
  });
});

router.post('/subscribe', postLimiter, jsonParser, (req, res) => {
  const email = String((req.body || {}).email || '')
    .trim()
    .toLowerCase();
  const planId = String((req.body || {}).planId || '').trim();

  if (!email || !planId) {
    return res.status(400).json({ error: 'email and planId required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const plan = csirData.plans.find((p) => p.id === planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const orderId = `DRV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const origin = siteOrigin();
  const checkoutPath = `/pricing.html?plan=${encodeURIComponent(plan.id)}&order=${encodeURIComponent(orderId)}`;

  res.json({
    message: 'Order created. Proceed to payment.',
    orderId,
    plan: { id: plan.id, name: plan.name, price: plan.price, period: plan.period },
    paymentGateway: 'razorpay',
    checkoutUrl: origin ? `${origin}${checkoutPath}` : checkoutPath
  });
});

router.post('/doubts', doubtLimiter, jsonParser, async (req, res) => {
  const body = req.body || {};
  if (!(await hcaptchaPolicy.enforce(body, res))) return;

  const question = String(body.question || '').trim();
  const subject = String(body.subject || 'General').trim();

  if (!question || question.length < 3) {
    return res.status(400).json({ error: 'Please enter a question (at least 3 characters).' });
  }
  if (question.length > 2000) {
    return res.status(400).json({ error: 'Question is too long (max 2000 characters).' });
  }

  doubtAssistant
    .answerDoubt({ question, subject })
    .then((result) => {
      res.json({
        question,
        subject: subject || 'General',
        answer: result.answer,
        responseTime: result.responseTime
      });
    })
    .catch((err) => {
      console.error('[doubts]', err);
      res.status(500).json({ error: 'Could not get an answer right now. Please try again.' });
    });
});

module.exports = router;

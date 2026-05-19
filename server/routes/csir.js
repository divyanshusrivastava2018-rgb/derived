const express = require('express');
const rateLimit = require('express-rate-limit');
const csirData = require('../lib/csirData');
const csirLeadsStore = require('../lib/csirLeadsStore');

const router = express.Router();
const jsonParser = express.json({ limit: '64kb' });

const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' }
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

router.get('/goal/stats', (_req, res) => {
  res.json(csirData.goalStats());
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

router.post('/leads', postLimiter, jsonParser, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = body.phone != null ? String(body.phone).trim() : null;
  const subject = body.subject != null ? String(body.subject).trim() : null;
  const plan = body.plan != null ? String(body.plan).trim() : 'free';

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const leads = csirLeadsStore.readLeads();
  const exists = leads.find((l) => l.email === email);
  if (exists) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const lead = {
    id: leads.length ? Math.max(...leads.map((l) => l.id)) + 1 : 1,
    name,
    email,
    phone: phone || null,
    subject: subject || null,
    plan: plan || 'free',
    createdAt: new Date().toISOString()
  };

  leads.push(lead);
  csirLeadsStore.writeLeads(leads);

  res.status(201).json({
    message: 'Registered successfully! Welcome to Derived.',
    lead: { id: lead.id, plan: lead.plan }
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

router.post('/doubts', postLimiter, jsonParser, (req, res) => {
  const question = String((req.body || {}).question || '').trim();
  const subject = String((req.body || {}).subject || 'General').trim();

  if (!question || question.length > 2000) {
    return res.status(400).json({ error: 'question is required (max 2000 characters)' });
  }

  res.json({
    question,
    subject: subject || 'General',
    answer: `This is a placeholder AI answer for: "${question}". In production, connect this endpoint to your LLM provider for detailed explanations.`,
    sources: [],
    responseTime: '< 1s'
  });
});

module.exports = router;

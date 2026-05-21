/**
 * CSIR NET study assistant — runs on the server only (no provider/model exposed to clients).
 * Set OPENAI_API_KEY (or AI_API_KEY) in .env for live AI answers.
 */

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE = 'https://api.openai.com/v1';

function apiKey() {
  return (process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '').trim();
}

function isConfigured() {
  return Boolean(apiKey());
}

function systemPrompt(subject) {
  return (
    'You are Researchium Study Assistant, an expert tutor for CSIR UGC NET (JRF and Lectureship) in India. ' +
    `The student's stream is: ${subject || 'General'}. ` +
    'Give clear, accurate, exam-focused answers in plain English. Use short paragraphs or bullet points when helpful. ' +
    'Do not mention OpenAI, ChatGPT, GPT, or any AI vendor. Do not say you are an AI model. ' +
    'If unsure, say what is generally accepted for CSIR NET and suggest what to revise. ' +
    'Keep answers under 400 words unless the question needs a brief derivation.'
  );
}

async function callChatApi(question, subject) {
  const key = apiKey();
  const base = (process.env.OPENAI_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const model = (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt(subject) },
          { role: 'user', content: question }
        ]
      }),
      signal: controller.signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error?.message || res.statusText || 'Assistant request failed';
      throw new Error(errMsg);
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty assistant response');
    return sanitizeAnswer(text);
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeAnswer(text) {
  return String(text)
    .replace(/\b(OpenAI|ChatGPT|GPT-4|GPT-3|Claude|Gemini|LLM provider)\b/gi, 'Researchium')
    .trim();
}

function fallbackAnswer(question, subject) {
  const sub = subject || 'General';
  const q = question.toLowerCase();

  if (/\bjrf\b|junior research/.test(q)) {
    return (
      'JRF (Junior Research Fellowship) through CSIR UGC NET is for candidates who score above the JRF cutoff in their subject. ' +
      'It supports PhD research with a fellowship. Lectureship eligibility uses a separate cutoff. ' +
      'Prepare with syllabus-wise notes, Part A aptitude, and full-length mocks under exam timing.'
    );
  }
  if (/\bnet\b|csir|ugc/.test(q) && /what|explain|define/.test(q)) {
    return (
      'CSIR UGC NET is a national eligibility test for JRF and Assistant Professor/Lectureship in science subjects. ' +
      'Paper pattern: subject-specific sections plus General Aptitude (Part A). ' +
      'Build concept clarity, solve previous years, and track weak topics from mock analytics.'
    );
  }
  if (/part a|aptitude|reasoning/.test(q)) {
    return (
      'Part A (General Aptitude) covers logical reasoning, quantitative aptitude, data interpretation, and general science awareness. ' +
      'Practice daily timed sets and learn shortcut methods for charts and puzzles. ' +
      'Aim for accuracy first, then speed — it carries significant weight in your final score.'
    );
  }

  return (
    `Here is a focused way to tackle your ${sub} doubt:\n\n` +
    `1. Pinpoint the core idea in your question and recall its definition or governing principle.\n` +
    `2. Write one formula, reaction, or pathway step that applies (where relevant).\n` +
    `3. Check with one previous-year CSIR NET MCQ on the same topic.\n\n` +
    `Regarding “${question.length > 120 ? question.slice(0, 117) + '…' : question}”: ` +
    `break the problem into given data, required output, and the theorem or concept that links them. ` +
    `Revise from your class notes, then retry the question without looking. ` +
    `For personalised mentoring, use the contact form on this page.`
  );
}

async function answerDoubt({ question, subject }) {
  const started = Date.now();
  const sub = String(subject || 'General').trim() || 'General';

  if (isConfigured()) {
    try {
      const answer = await callChatApi(question, sub);
      return {
        answer,
        responseTime: `${((Date.now() - started) / 1000).toFixed(1)}s`
      };
    } catch (err) {
      console.error('[doubtAssistant]', err.message);
      return {
        answer: fallbackAnswer(question, sub),
        responseTime: `${((Date.now() - started) / 1000).toFixed(1)}s`
      };
    }
  }

  return {
    answer: fallbackAnswer(question, sub),
    responseTime: '< 1s'
  };
}

module.exports = {
  isConfigured,
  answerDoubt
};

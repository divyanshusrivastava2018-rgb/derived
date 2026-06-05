const { execFileSync } = require('child_process');

function extractPdfText(pdfPath, maxPages) {
  try {
    const args = maxPages ? ['-l', String(maxPages), pdfPath, '-'] : [pdfPath, '-'];
    const text = execFileSync('pdftotext', args, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    });
    return String(text || '').replace(/\r/g, '').trim();
  } catch {
    return '';
  }
}

function cleanLine(line) {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .replace(/^\d+\s*$/, '')
    .trim();
}

function parseMcqsFromText(text, meta) {
  if (!text || text.length < 40) return [];
  const out = [];
  const blocks = text.split(/\n(?=\s*(?:Q(?:uestion)?\.?\s*)?\d+[\.\):]|^\(\d+\))/gim);

  blocks.forEach((block, bi) => {
    const lines = block
      .split('\n')
      .map(cleanLine)
      .filter(Boolean);
    if (lines.length < 3) return;

    const optRe = /^\(?([a-dA-D1-4ivxIVX])[\)\.\:]\s*(.+)$/;
    const options = [];
    const questionLines = [];
    let answerIndex = -1;

    lines.forEach((line) => {
      const m = line.match(optRe);
      if (m && options.length < 4) {
        options.push(m[2].trim());
        return;
      }
      if (/^answer\s*[:\-]/i.test(line)) {
        const ans = line.replace(/^answer\s*[:\-]\s*/i, '').trim();
        const letter = ans.match(/^([a-dA-D1-4])/);
        if (letter) {
          const map = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
          answerIndex = map[letter[1].toLowerCase()] ?? -1;
        }
        return;
      }
      if (!/^(scanned by camscanner)$/i.test(line)) questionLines.push(line);
    });

    const textQ = questionLines.join(' ').replace(/^(Q(?:uestion)?\.?\s*)?\d+[\.\):]\s*/i, '').trim();
    if (textQ.length < 12) return;
    if (options.length < 4) return;

    out.push({
      id: `${meta.slug}-${meta.index}-${bi}`,
      type: 'MCQ',
      marks: 2,
      negativeMarks: 0.5,
      text: textQ.slice(0, 1200),
      options: options.slice(0, 4),
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      sourcePdf: meta.sourcePdf,
      topic: meta.topic,
      extracted: true
    });
  });

  return out;
}

function topicFromFilename(name) {
  return String(name || '')
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

module.exports = {
  extractPdfText,
  parseMcqsFromText,
  topicFromFilename
};

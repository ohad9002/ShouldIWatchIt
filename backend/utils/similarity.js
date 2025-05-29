// utils/similarity.js


const DEBUG = false;

// 1) collapse non-alphanumerics → spaces, lowercase, collapse whitespace
function cleanText(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 2) map any roman or word numerals to digits
function mapNumerals(s) {
  const romanMap = {
    iii: '3', ii: '2', iv: '4', v: '5',
    vi: '6', vii: '7', viii: '8', ix: '9', x: '10'
  };
  const wordMap = {
    zero:'0', one:'1', two:'2', three:'3', four:'4', five:'5',
    six:'6', seven:'7', eight:'8', nine:'9', ten:'10'
  };
  // globally replace romans and words
  Object.entries(romanMap).forEach(([r, d]) => {
    s = s.replace(new RegExp(`\\b${r}\\b`, 'gi'), d);
  });
  Object.entries(wordMap).forEach(([w, d]) => {
    s = s.replace(new RegExp(`\\b${w}\\b`, 'gi'), d);
  });
  return s;
}

// 3) Normalize title: map numerals, remove "part", clean
function normalizeText(raw, hint) {
  if (!raw) return '';
  let s = raw;
  s = cleanText(s);
  s = mapNumerals(s);
  // remove any “part” tokens
  s = s.replace(/\bpart\b/gi, ' ');
  return cleanText(s);
}

// 4) extract standalone trailing number
function extractTrailingNumber(str) {
  const t = str.split(' ').pop();
  return /^\d+$/.test(t) ? t : null;
}

// 5) drop trivial stopwords
function removeStopwords(tok) {
  const stop = new Set(['the','a','an','of']);
  return tok.filter(w => w && !stop.has(w));
}

// 6) Levenshtein distance
function levenshtein(a, b) {
  const M = a.length, N = b.length;
  const dp = Array.from({ length: M+1 }, () => Array(N+1).fill(0));
  for (let i=0; i<=M; i++) dp[i][0] = i;
  for (let j=0; j<=N; j++) dp[0][j] = j;
  for (let i=1; i<=M; i++) {
    for (let j=1; j<=N; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i-1][j] + 1,
        dp[i][j-1] + 1,
        dp[i-1][j-1] + cost
      );
    }
  }
  return dp[M][N];
}

// Main similarity
function calculateSimilarity(a, b) {
  const A = normalizeText(a, b);
  const B = normalizeText(b, null);

  // 1) exact normalized match
  if (A === B) return 1;

  // 2) numeric sequel shortcut
  const nA = extractTrailingNumber(A);
  const nB = extractTrailingNumber(B);
  if (nA && nA === nB) return 1;

  // 3) token-by-token exact
  const tA = removeStopwords(A.split(' '));
  const tB = removeStopwords(B.split(' '));
  if (
    tA.length > 0 &&
    tA.length === tB.length &&
    tA.every((w,i) => w === tB[i])
  ) return 1;

  // 4) both empty → 0
  if (!tA.length && !tB.length) return 0;

  // 5) Jaccard
  const setA = new Set(tA), setB = new Set(tB);
  const inter = [...setA].filter(x => setB.has(x)).length;
  const uni   = new Set([...setA, ...setB]).size;
  const jaccard = uni === 0 ? 1 : inter / uni;

  // 6) Levenshtein ratio
  const lev = 1 - (levenshtein(A, B) / Math.max(A.length, B.length));

  // 7) order bonus
  const orderBonus = (tA.join(' ') === tB.join(' ')) ? 0.2 : 0;

  // 8) final
  const score = jaccard * 0.7 + lev * 0.1 + orderBonus;
  return Math.min(Math.max(score, 0), 1);
}

// Normalizes and generates robust variants for fuzzy movie title search
function generateTitleVariants(title) {
  const base = normalizeText(title);
  const variants = new Set([
    title,
    base,
    base.replace(/\b2\b/, 'ii'),
    base.replace(/\bii\b/, '2'),
    base.replace(/\b3\b/, 'iii'),
    base.replace(/\biii\b/, '3'),
    base.replace(/\bpart\b/g, ''),
    base.replace(/\bpart\b/g, ': part'),
    base.replace(/\bpart\b/g, ', part'),
    base.replace(/[:,\-]/g, ''),
    base.replace(/[:,\-]/g, ' ')
  ]);
  // Remove empty/duplicate
  return Array.from(variants).filter(Boolean);
}

module.exports = {
  normalizeText,
  calculateSimilarity,
  generateTitleVariants
};

/**
 * AI content moderation stub.
 *
 * Drop-in replacement points:
 *   - OpenAI Moderation API  → https://platform.openai.com/docs/api-reference/moderations
 *   - AWS Comprehend          → detectSentiment / detectToxicContent
 *   - Google Perspective API  → analyzeComment
 *
 * Returns { flagged: bool, categories: string[], score: number }
 */

// Simple keyword blocklist as a fallback when no AI provider is configured
const BLOCKED_TERMS = [
  /\b(abuse|harass|threat|kill|rape|slur)\b/i,
];

const moderateText = async (text) => {
  // ── Swap this block with a real API call ──────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/moderations', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json();
      const result = data.results?.[0];
      if (result) {
        const flaggedCategories = Object.entries(result.categories)
          .filter(([, v]) => v)
          .map(([k]) => k);
        return {
          flagged:    result.flagged,
          categories: flaggedCategories,
          score:      Math.max(...Object.values(result.category_scores ?? {}), 0),
        };
      }
    } catch (err) {
      console.warn('[Moderation] OpenAI call failed, falling back to keyword check:', err.message);
    }
  }
  // ── Keyword fallback ──────────────────────────────────────────────────────
  const matched = BLOCKED_TERMS.filter(r => r.test(text)).map(r => r.source);
  return {
    flagged:    matched.length > 0,
    categories: matched.length > 0 ? ['keyword_match'] : [],
    score:      matched.length > 0 ? 1 : 0,
  };
};

module.exports = { moderateText };

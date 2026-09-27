const AlertKeyword = require('../models/AlertKeyword');

// Baseline built-in high-priority risk patterns
const DEFAULT_SAFETY_KEYWORDS = [
  'kill yourself',
  'kys',
  'die',
  'suicide',
  'hurt yourself',
  'send nudes',
  'dont tell your parents',
  "don't tell your parents",
  'dont tell your mom',
  "don't tell your mom",
  'secret meet',
  'where do you live',
  'send pic',
  'send picture',
  'hate you',
  'ugly',
  'loser'
];

async function scanContentForAlerts(parentId, textToScan) {
  if (!textToScan || typeof textToScan !== 'string') {
    return { isFlagged: false, flagReason: null };
  }

  const normalized = textToScan.toLowerCase();

  // 1. Check parent-defined custom keywords in DB
  try {
    const customKeywords = await AlertKeyword.find({ parentId });
    for (const item of customKeywords) {
      const kw = item.keyword.toLowerCase();
      // Use regex with word boundaries where possible
      const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
      if (regex.test(normalized) || normalized.includes(kw)) {
        return {
          isFlagged: true,
          flagReason: `Custom alert keyword matched: "${item.keyword}" (${item.severity})`
        };
      }
    }
  } catch (err) {
    console.error('[SafetyEngine] Error querying custom alert keywords:', err.message);
  }

  // 2. Check default safety triggers
  for (const defKw of DEFAULT_SAFETY_KEYWORDS) {
    if (normalized.includes(defKw)) {
      return {
        isFlagged: true,
        flagReason: `Safety alert triggered: "${defKw}"`
      };
    }
  }

  return { isFlagged: false, flagReason: null };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  scanContentForAlerts,
  DEFAULT_SAFETY_KEYWORDS
};

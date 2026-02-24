// Uzbek Latin → Cyrillic script converter
// Based on the official 1995 Uzbek Latin alphabet standard

const MULTI: [RegExp, string][] = [
  // Special chars with apostrophe (all variants: ', ', ʻ, plain ')
  [/O[''ʻ']/g, "Ў"], [/o[''ʻ']/g, "ў"],
  [/G[''ʻ']/g, "Ғ"], [/g[''ʻ']/g, "ғ"],
  // Digraphs — uppercase variants
  [/SH/g, "Ш"], [/CH/g, "Ч"], [/NG/g, "НГ"],
  [/YO/g, "Ё"], [/YA/g, "Я"], [/YU/g, "Ю"], [/YE/g, "Е"],
  // Digraphs — title case
  [/Sh/g, "Ш"], [/Ch/g, "Ч"], [/Ng/g, "Нг"],
  [/Yo/g, "Ё"], [/Ya/g, "Я"], [/Yu/g, "Ю"], [/Ye/g, "Е"],
  // Digraphs — lowercase
  [/sh/g, "ш"], [/ch/g, "ч"], [/ng/g, "нг"],
  [/yo/g, "ё"], [/ya/g, "я"], [/yu/g, "ю"], [/ye/g, "е"],
  // ts digraph
  [/TS/g, "ТС"], [/Ts/g, "Тс"], [/ts/g, "тс"],
];

const SINGLE: [RegExp, string][] = [
  [/A/g, "А"], [/B/g, "Б"], [/D/g, "Д"], [/E/g, "Е"],
  [/F/g, "Ф"], [/G/g, "Г"], [/H/g, "Ҳ"], [/I/g, "И"],
  [/J/g, "Ж"], [/K/g, "К"], [/L/g, "Л"], [/M/g, "М"],
  [/N/g, "Н"], [/O/g, "О"], [/P/g, "П"], [/Q/g, "Қ"],
  [/R/g, "Р"], [/S/g, "С"], [/T/g, "Т"], [/U/g, "У"],
  [/V/g, "В"], [/X/g, "Х"], [/Y/g, "Й"], [/Z/g, "З"],
  [/a/g, "а"], [/b/g, "б"], [/d/g, "д"], [/e/g, "е"],
  [/f/g, "ф"], [/g/g, "г"], [/h/g, "ҳ"], [/i/g, "и"],
  [/j/g, "ж"], [/k/g, "к"], [/l/g, "л"], [/m/g, "м"],
  [/n/g, "н"], [/o/g, "о"], [/p/g, "п"], [/q/g, "қ"],
  [/r/g, "р"], [/s/g, "с"], [/t/g, "т"], [/u/g, "у"],
  [/v/g, "в"], [/x/g, "х"], [/y/g, "й"], [/z/g, "з"],
];

// Manual overrides for words that don't convert correctly
const OVERRIDES: Record<string, string> = {
  "Yaxshi": "Яхши", "yaxshi": "яхши",
  "Yangi": "Янги", "yangi": "янги",
  "Yopish": "Ёпиш", "yopish": "ёпиш",
  "Yo'q": "Йўқ", "yo'q": "йўқ",
  "Yo'l": "Йўл", "yo'l": "йўл",
  "Yillik": "Йиллик", "yillik": "йиллик",
  "Yil": "Йил", "yil": "йил",
  "Yig'ish": "Йиғиш", "yig'ish": "йиғиш",
  "Yig'ib": "Йиғиб", "yig'ib": "йиғиб",
  "Yugurish": "Югуриш", "yugurish": "югуриш",
};

export function latinToCyrillic(text: string): string {
  // Check overrides for the whole text first
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, text)) {
    return OVERRIDES[text]!;
  }

  // Apply word-level overrides within text
  let result = text;
  for (const [word, cyr] of Object.entries(OVERRIDES)) {
    result = result.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, "g"), cyr);
  }

  // Apply multi-char replacements first
  for (const [pattern, replacement] of MULTI) {
    result = result.replace(pattern, replacement);
  }

  // Apply single-char replacements
  for (const [pattern, replacement] of SINGLE) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

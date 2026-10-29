// Deterministic parsing of what the technician says. No model involved: option labels from the
// reviewed i18n catalogs are matched against the utterance, so nothing is invented.

import i18n from '@/i18n';
import { optionsOf } from '../demo/triage';

const NOT_SURE = [
  'not sure',
  'no idea',
  "don't know",
  'dont know',
  'unsure',
  'maybe',
  'skip',
  'தெரியாது',
  'தெரியவில்லை',
  'உறுதியாக',
  'पता नहीं',
  'पक्का नहीं',
  'मालूम नहीं',
  'नहीं पता',
];

const YES = [
  'yes',
  'yeah',
  'yep',
  'correct',
  'right',
  'ஆம்',
  'ஆமாம்',
  'हां',
  'हाँ',
  'जी हां',
  'सही',
];
const NO = ['no', 'nope', 'not really', 'இல்லை', 'நோ', 'नहीं', 'ना'];

// Extra spoken forms per option, in addition to the catalog labels (all Assumption: keyword lists).
const SYNONYMS: Record<string, Record<string, string[]>> = {
  age_band: {
    lt5: [
      'under five',
      'less than five',
      'new',
      'recent',
      '1 year',
      '2 year',
      '3 year',
      '4 year',
      'one year',
      'two year',
      'three year',
      'four year',
    ],
    '5to10': [
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      '5 year',
      '6 year',
      '7 year',
      '8 year',
      '9 year',
      'ஐந்து',
      'ஆறு',
      'ஏழு',
      'எட்டு',
      'ஒன்பது',
      'पांच',
      'छह',
      'सात',
      'आठ',
      'नौ',
    ],
    '10to20': [
      'ten',
      'eleven',
      'twelve',
      'fifteen',
      'old',
      'பத்து',
      'பதினைந்து',
      'दस',
      'पंद्रह',
      'बारह',
    ],
    gt20: ['twenty', 'thirty', 'very old', 'over twenty', 'இருபது', 'बीस', 'तीस'],
  },
  installed_where: {
    rooftop: ['roof', 'terrace', 'மேற்கூரை', 'மொட்டை மாடி', 'छत'],
    ground: ['ground', 'field', 'land', 'தரை', 'ज़मीन', 'जमीन'],
    tracker: ['tracker', 'tracking'],
    unknown_site: ['unknown', "don't know where", 'தெரியாது', 'पता नहीं'],
  },
  junction_box_condition: {
    fine: ['fine', 'good', 'okay', 'ok', 'normal', 'intact', 'நன்றாக', 'ठीक'],
    loose: ['loose', 'hanging', 'dangling', 'தளர்', 'ढीला', 'लटका'],
    burnt: ['burnt', 'burned', 'burn', 'melted', 'black', 'கருகிய', 'உருகிய', 'जला', 'पिघला'],
    cracked_lid: ['lid', 'cover cracked', 'cracked lid', 'மூடி', 'ढक्कन'],
  },
  glass_condition: {
    clean: ['clean', 'intact', 'fine', 'good', 'சுத்தம்', 'साफ'],
    dusty: ['dust', 'dusty', 'dirty', 'dirt', 'soil', 'தூசி', 'அழுக்கு', 'धूल', 'गंदा', 'गंदगी'],
    cracked: ['crack', 'cracked', 'விரிசல்', 'दरार', 'चटका'],
    shattered: ['shatter', 'smashed', 'broken', 'நொறுங்கிய', 'टूटा', 'बिखरा'],
  },
  discolouration: {
    none: ['none', 'nothing', 'no discolouration', 'clean'],
    yellow_brown: ['yellow', 'brown', 'tint', 'மஞ்சள்', 'பழுப்பு', 'पीला', 'भूरा'],
    dark_patches: ['dark', 'black', 'patch', 'burn mark', 'spots', 'கருப்பு', 'काला', 'धब्बे'],
  },
  output_band: {
    above90: [
      'above ninety',
      'over ninety',
      'ninety',
      '95',
      '100',
      'full',
      'almost full',
      'நூறு',
      'पूरा',
    ],
    '70to90': ['seventy', 'eighty', '75', '80', '85', 'எழுபது', 'எண்பது', 'सत्तर', 'अस्सी'],
    '40to70': [
      'forty',
      'fifty',
      'sixty',
      '45',
      '50',
      '55',
      '60',
      'half',
      'நாற்பது',
      'ஐம்பது',
      'அறுபது',
      'चालीस',
      'पचास',
      'साठ',
      'आधा',
    ],
    below40: [
      'below forty',
      'under forty',
      'thirty',
      'twenty',
      'ten percent',
      '10',
      '20',
      '30',
      'very low',
      'முப்பது',
      'இருபது',
      'तीस',
      'बीस',
      'बहुत कम',
    ],
  },
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,!?;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function labelsFor(questionId: string, option: string): string[] {
  const out: string[] = [];
  for (const lng of ['en', 'ta', 'hi']) {
    const label = i18n.getFixedT(lng)(`questions.items.${questionId}.options.${option}`, {
      defaultValue: '',
    });
    if (label) out.push(norm(label));
  }
  return out;
}

export type ParsedAnswer =
  | { status: 'accepted'; option: string; confidence: number }
  | { status: 'not_sure' }
  | { status: 'unclear' };

export function parseAnswer(questionId: string, utterance: string): ParsedAnswer {
  const text = norm(utterance);
  if (!text) return { status: 'unclear' };
  if (NOT_SURE.some((p) => text.includes(p))) return { status: 'not_sure' };

  const options = optionsOf(questionId);
  if (options.length === 2 && options.includes('yes') && options.includes('no')) {
    const words = new Set(text.split(' '));
    const saysNo = NO.some((p) => (p.includes(' ') ? text.includes(p) : words.has(p)));
    const saysYes = YES.some((p) => (p.includes(' ') ? text.includes(p) : words.has(p)));
    if (saysNo && !saysYes) return { status: 'accepted', option: 'no', confidence: 0.9 };
    if (saysYes && !saysNo) return { status: 'accepted', option: 'yes', confidence: 0.9 };
    return { status: 'unclear' };
  }

  const scores = options.map((option) => {
    let score = 0;
    for (const label of labelsFor(questionId, option))
      if (label && text.includes(label)) score = Math.max(score, 3);
    for (const syn of SYNONYMS[questionId]?.[option] ?? [])
      if (text.includes(norm(syn))) score = Math.max(score, 2);
    // Digits: "eight years" / "8 years" style answers for age bands.
    return { option, score };
  });

  if (questionId === 'age_band') {
    const n = text.match(/\b(\d{1,2})\b/);
    if (n) {
      const years = Number(n[1]);
      const option = years < 5 ? 'lt5' : years <= 10 ? '5to10' : years <= 20 ? '10to20' : 'gt20';
      return { status: 'accepted', option, confidence: 0.85 };
    }
  }

  scores.sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (!best || best.score === 0) return { status: 'unclear' };
  // Two options tied: do not guess.
  if (second && second.score === best.score) return { status: 'unclear' };
  return { status: 'accepted', option: best.option, confidence: best.score >= 3 ? 0.9 : 0.7 };
}

// ---------- Measurements ----------

const WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/** "thirty five point two" or "35.2" → 35.2. Returns null if no number is found. */
export function parseSpokenNumber(utterance: string): number | null {
  const text = norm(utterance);
  const digits = text.match(/\d+(?:\.\d+)?/);
  if (digits) return Number(digits[0]);
  const tokens = text.split(' ');
  let whole = 0;
  let found = false;
  let i = 0;
  for (; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === 'hundred' && found) {
      whole *= 100;
    } else if (t in WORDS) {
      whole += WORDS[t]!;
      found = true;
    } else if (t === 'point') {
      break;
    } else if (found) {
      break;
    }
  }
  if (!found) return null;
  let fraction = '';
  if (tokens[i] === 'point') {
    for (let j = i + 1; j < tokens.length; j++) {
      const d = WORDS[tokens[j]!];
      if (d === undefined || d > 9) break;
      fraction += String(d);
    }
  }
  return Number(fraction ? `${whole}.${fraction}` : String(whole));
}

export type Quantity = 'voc' | 'isc' | 'pmax';
export const QUANTITY_UNIT: Record<Quantity, 'V' | 'A' | 'W'> = { voc: 'V', isc: 'A', pmax: 'W' };
export const QUANTITY_RANGE: Record<Quantity, [number, number]> = {
  voc: [10, 60],
  isc: [0.5, 20],
  pmax: [5, 800],
};

export function parseMeasurement(
  quantity: Quantity,
  utterance: string,
): { value: number; unit: 'V' | 'A' | 'W' } | { error: string } {
  const value = parseSpokenNumber(utterance);
  if (value === null) return { error: 'no_number_heard' };
  const [min, max] = QUANTITY_RANGE[quantity];
  if (value < min || value > max) return { error: 'out_of_range' };
  return { value, unit: QUANTITY_UNIT[quantity] };
}

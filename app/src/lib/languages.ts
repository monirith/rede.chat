// Language catalog. Default 7 flags shown in the picker. If the user's browser
// language is outside those 7, we add it dynamically.
//
// `flag` is the Unicode flag emoji; `country` is the ISO-3166 alpha-2 code used
// for rendering when emoji isn't supported (Windows mostly).

export interface LanguageInfo {
  code: string;          // ISO 639-1 primary tag, e.g. "en", "de", "gsw"
  name: string;          // Native name
  englishName: string;   // English exonym
  flag: string;          // Unicode flag emoji
  country: string;       // ISO-3166 alpha-2
}

// Languages shown in the picker. Order at runtime is reshuffled by
// pickerLanguages(): browser-detected first, then Swiss German, then Romansh,
// then the rest. The order here just defines the "rest" sequence.
export const DEFAULT_LANGUAGES: LanguageInfo[] = [
  { code: "gsw", name: "Schwiizerdütsch",    englishName: "Swiss German", flag: "🇨🇭", country: "CH" },
  { code: "rm",  name: "Rumantsch Grischun", englishName: "Romansh",      flag: "🇨🇭", country: "CH" },
  { code: "en",  name: "English",            englishName: "English",      flag: "🇺🇸", country: "US" },
  { code: "fr",  name: "Français",           englishName: "French",       flag: "🇫🇷", country: "FR" },
  { code: "it",  name: "Italiano",           englishName: "Italian",      flag: "🇮🇹", country: "IT" },
  { code: "de",  name: "Deutsch",            englishName: "German",       flag: "🇩🇪", country: "DE" },
  { code: "es",  name: "Español",            englishName: "Spanish",      flag: "🇪🇸", country: "ES" },
  { code: "ja",  name: "日本語",              englishName: "Japanese",     flag: "🇯🇵", country: "JP" },
  { code: "zh",  name: "中文",                englishName: "Chinese",      flag: "🇨🇳", country: "CN" },
  { code: "ko",  name: "한국어",              englishName: "Korean",       flag: "🇰🇷", country: "KR" },
  { code: "th",  name: "ไทย",                 englishName: "Thai",         flag: "🇹🇭", country: "TH" },
  { code: "hi",  name: "हिन्दी",                englishName: "Hindi",        flag: "🇮🇳", country: "IN" },
  { code: "ru",  name: "Русский",            englishName: "Russian",      flag: "🇷🇺", country: "RU" },
];

// Extended catalog — any language Gemini supports that we can flag-pick.
// If user's browser is e.g. ja-JP, we add this row to the bar at runtime.
export const ALL_LANGUAGES: LanguageInfo[] = [
  ...DEFAULT_LANGUAGES,
  { code: "pt",  name: "Português",       englishName: "Portuguese",  flag: "🇵🇹", country: "PT" },
  { code: "nl",  name: "Nederlands",      englishName: "Dutch",       flag: "🇳🇱", country: "NL" },
  { code: "pl",  name: "Polski",          englishName: "Polish",      flag: "🇵🇱", country: "PL" },
  { code: "tr",  name: "Türkçe",          englishName: "Turkish",     flag: "🇹🇷", country: "TR" },
  { code: "sv",  name: "Svenska",         englishName: "Swedish",     flag: "🇸🇪", country: "SE" },
  { code: "no",  name: "Norsk",           englishName: "Norwegian",   flag: "🇳🇴", country: "NO" },
  { code: "da",  name: "Dansk",           englishName: "Danish",      flag: "🇩🇰", country: "DK" },
  { code: "fi",  name: "Suomi",           englishName: "Finnish",     flag: "🇫🇮", country: "FI" },
  { code: "cs",  name: "Čeština",         englishName: "Czech",       flag: "🇨🇿", country: "CZ" },
  { code: "hu",  name: "Magyar",          englishName: "Hungarian",   flag: "🇭🇺", country: "HU" },
  { code: "ro",  name: "Română",          englishName: "Romanian",    flag: "🇷🇴", country: "RO" },
  // EU/EFTA citizens who get residence in Switzerland on a passport (free
  // movement under the bilateral agreements). Adding their primary languages
  // so signup and onboarding can happen in the user's mother tongue.
  { code: "hr",  name: "Hrvatski",        englishName: "Croatian",    flag: "🇭🇷", country: "HR" },
  { code: "sk",  name: "Slovenčina",      englishName: "Slovak",      flag: "🇸🇰", country: "SK" },
  { code: "sl",  name: "Slovenščina",     englishName: "Slovenian",   flag: "🇸🇮", country: "SI" },
  { code: "et",  name: "Eesti",           englishName: "Estonian",    flag: "🇪🇪", country: "EE" },
  { code: "lv",  name: "Latviešu",        englishName: "Latvian",     flag: "🇱🇻", country: "LV" },
  { code: "lt",  name: "Lietuvių",        englishName: "Lithuanian",  flag: "🇱🇹", country: "LT" },
  { code: "mt",  name: "Malti",           englishName: "Maltese",     flag: "🇲🇹", country: "MT" },
  { code: "is",  name: "Íslenska",        englishName: "Icelandic",   flag: "🇮🇸", country: "IS" },
  { code: "el",  name: "Ελληνικά",        englishName: "Greek",       flag: "🇬🇷", country: "GR" },
  { code: "bg",  name: "Български",       englishName: "Bulgarian",   flag: "🇧🇬", country: "BG" },
  { code: "uk",  name: "Українська",      englishName: "Ukrainian",   flag: "🇺🇦", country: "UA" },
  { code: "he",  name: "עברית",            englishName: "Hebrew",      flag: "🇮🇱", country: "IL" },
  { code: "ar",  name: "العربية",          englishName: "Arabic",      flag: "🇸🇦", country: "SA" },
  { code: "fa",  name: "فارسی",           englishName: "Persian",     flag: "🇮🇷", country: "IR" },
  { code: "bn",  name: "বাংলা",            englishName: "Bengali",     flag: "🇧🇩", country: "BD" },
  { code: "ur",  name: "اردو",            englishName: "Urdu",        flag: "🇵🇰", country: "PK" },
  { code: "id",  name: "Bahasa Indonesia", englishName: "Indonesian",  flag: "🇮🇩", country: "ID" },
  { code: "ms",  name: "Bahasa Melayu",   englishName: "Malay",       flag: "🇲🇾", country: "MY" },
  { code: "vi",  name: "Tiếng Việt",      englishName: "Vietnamese",  flag: "🇻🇳", country: "VN" },
  { code: "tl",  name: "Tagalog",         englishName: "Filipino",    flag: "🇵🇭", country: "PH" },
  { code: "sw",  name: "Kiswahili",       englishName: "Swahili",     flag: "🇰🇪", country: "KE" },
  { code: "am",  name: "አማርኛ",           englishName: "Amharic",     flag: "🇪🇹", country: "ET" },
  // Top-30 spoken languages additions
  { code: "mr",  name: "मराठी",            englishName: "Marathi",         flag: "🇮🇳", country: "IN" },
  { code: "te",  name: "తెలుగు",           englishName: "Telugu",          flag: "🇮🇳", country: "IN" },
  { code: "ta",  name: "தமிழ்",            englishName: "Tamil",           flag: "🇮🇳", country: "IN" },
  { code: "jv",  name: "Basa Jawa",       englishName: "Javanese",        flag: "🇮🇩", country: "ID" },
  { code: "ha",  name: "Hausa",           englishName: "Hausa",           flag: "🇳🇬", country: "NG" },
  { code: "yue", name: "粵語",             englishName: "Cantonese",       flag: "🇭🇰", country: "HK" },
  { code: "wuu", name: "吳語",             englishName: "Wu Chinese",      flag: "🇨🇳", country: "CN" },
  { code: "pcm", name: "Naijá",           englishName: "Nigerian Pidgin", flag: "🇳🇬", country: "NG" },
  { code: "arz", name: "مصري",            englishName: "Egyptian Arabic", flag: "🇪🇬", country: "EG" },
  { code: "pnb", name: "پنجابی",          englishName: "Western Punjabi", flag: "🇵🇰", country: "PK" },
];

export function findLanguage(code: string): LanguageInfo | undefined {
  return ALL_LANGUAGES.find((l) => l.code === code);
}

// Map browser locale (e.g. "de-CH", "en-US", "zh-Hant-HK") to one of our codes.
// Special case: de-CH and gsw-* → Swiss German.
export function detectBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  const tag = (navigator.language || "en").toLowerCase();
  if (tag.startsWith("gsw")) return "gsw";
  if (tag === "de-ch") return "gsw";
  const primary = tag.split("-")[0];
  const found = ALL_LANGUAGES.find((l) => l.code === primary);
  return found ? found.code : "en";
}

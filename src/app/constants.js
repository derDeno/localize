export const languageMeta = {
  ar: { countryCode: "sa", name: "Arabic" },
  bg: { countryCode: "bg", name: "Bulgarian" },
  cs: { countryCode: "cz", name: "Czech" },
  da: { countryCode: "dk", name: "Danish" },
  de: { countryCode: "de", name: "Deutsch" },
  el: { countryCode: "gr", name: "Greek" },
  en: { countryCode: "gb", name: "English" },
  es: { countryCode: "es", name: "Spanish" },
  et: { countryCode: "ee", name: "Estonian" },
  fi: { countryCode: "fi", name: "Finnish" },
  fr: { countryCode: "fr", name: "French" },
  he: { countryCode: "il", name: "Hebrew" },
  hi: { countryCode: "in", name: "Hindi" },
  hu: { countryCode: "hu", name: "Hungarian" },
  it: { countryCode: "it", name: "Italian" },
  ja: { countryCode: "jp", name: "Japanese" },
  ko: { countryCode: "kr", name: "Korean" },
  nl: { countryCode: "nl", name: "Dutch" },
  no: { countryCode: "no", name: "Norwegian" },
  pl: { countryCode: "pl", name: "Polish" },
  pt: { countryCode: "pt", name: "Portuguese" },
  ro: { countryCode: "ro", name: "Romanian" },
  ru: { countryCode: "ru", name: "Russian" },
  sk: { countryCode: "sk", name: "Slovak" },
  sl: { countryCode: "si", name: "Slovenian" },
  sv: { countryCode: "se", name: "Swedish" },
  tr: { countryCode: "tr", name: "Turkish" },
  uk: { countryCode: "ua", name: "Ukrainian" },
  zh: { countryCode: "cn", name: "Chinese" },
};

export const initialProjectForm = {
  name: "",
  description: "",
  version: "1.0.0",
  sourceLanguage: "en",
  sourceLabel: "English",
  sourceLibraryFile: "",
};

export const apiKeyScopeOptions = ["create", "read", "update", "delete"];

export const editorFilterOptions = [
  { value: "all", label: "All" },
  { value: "changed", label: "Changed since last update" },
  { value: "untranslated", label: "Untranslated" },
  { value: "translated", label: "Translated" },
  { value: "identical", label: "Identical to source" },
  { value: "needs-approval", label: "Needs approval" },
  { value: "approved", label: "Approved" },
];

export const appVersion = __APP_VERSION__;

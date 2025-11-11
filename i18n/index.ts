import { ro } from './translations/ro';
import { en } from './translations/en';

export const translations = {
  ro,
  en
} as const;

export type Language = keyof typeof translations;
export type TranslationKeys = typeof translations[Language];

export const defaultLanguage: Language = 'ro';

// Helper function to get nested translation value
export function getTranslation(language: Language, path: string): string {
  const keys = path.split('.');
  let current: any = translations[language];
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      // Fallback to Romanian if translation is missing
      current = translations.ro;
      for (const fallbackKey of keys) {
        if (current && typeof current === 'object' && fallbackKey in current) {
          current = current[fallbackKey];
        } else {
          return path; // Return the path itself if translation is not found
        }
      }
      break;
    }
  }
  
  return typeof current === 'string' ? current : path;
}

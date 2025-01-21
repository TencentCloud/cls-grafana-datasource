import en_US from './en_US';
import zh_CN from './zh_CN';

let LocalLanguage = 'zh-CN';

export enum Language {
  Chinese = 'zh-CN',
  English = 'en-US',
}

export function t(key: string) {
  if (LocalLanguage === Language.Chinese) {
    return zh_CN[key];
  }
  return en_US[key];
}

export function setLanguage(language: Language) {
  LocalLanguage = language;
}

export function getLanguage() {
  return LocalLanguage;
}

try {
  const language = localStorage.getItem('cls_datasource_language');
  if (language) {
    setLanguage(language as Language);
  }
} catch (e) {
  console.error(e);
}

import en_US from './en_US';
import zh_CN from './zh_CN';

let locale_language = 'zh-CN';

export enum Language {
  Chinese = 'zh-CN',
  English = 'en-US',
}

export const t = (key: string) => {
  if (locale_language === Language.Chinese) {
    return zh_CN[key];
  }
  return en_US[key];
};

export const setLanguage = (language: Language) => {
  locale_language = language;
};

export const getLanguage = () => locale_language;

try {
  const language = localStorage.getItem('cls_datasource_language');
  if (language) {
    setLanguage(language as Language);
  }
} catch (e) {
  console.error(e);
}

import { config } from '@grafana/runtime';

import en_US from './en_US';
import zh_CN from './zh_CN';

let LocalLanguage = 'en-US';

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

/**
 * 从 Grafana 用户设置中获取语言偏好
 * Grafana 使用 'zh-Hans', 'en-US', '' (default/browser) 等语言标识
 */
export function getGrafanaLanguage(): Language | undefined {
  try {
    const grafanaLang = config?.bootData?.user?.language;
    if (!grafanaLang) {
      return undefined;
    }
    if (grafanaLang.startsWith('zh')) {
      return Language.Chinese;
    }
    if (grafanaLang.startsWith('en')) {
      return Language.English;
    }
    // 其他语言回退为 undefined，由调用方决定默认值
    return undefined;
  } catch {
    return undefined;
  }
}

try {
  const storedLang = localStorage.getItem('cls_datasource_language');
  if (storedLang) {
    setLanguage(storedLang as Language);
  } else {
    const grafanaLang = getGrafanaLanguage();
    if (grafanaLang) {
      setLanguage(grafanaLang);
    }
  }
} catch (e) {
  console.error(e);
}

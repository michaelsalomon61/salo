import { createContext, useContext } from 'react';
import { locale, type Locale } from './index';

export const LocaleContext = createContext<Locale>(locale('de'));

/** Übersetzung und Zahlenformate der gewählten Sprache. */
export const useLocale = () => useContext(LocaleContext);

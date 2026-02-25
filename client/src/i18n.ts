import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import ptBRTranslations from './locales/pt-BR.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: enTranslations
            },
            'pt-BR': {
                translation: ptBRTranslations
            }
        },
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false // React already escapes by default
        }
    });

export default i18n;

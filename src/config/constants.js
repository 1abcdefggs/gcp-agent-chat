/**
 * Google Cloud Agent Platform - Core Configuration & Single Source of Truth (SSOT)
 * Centralizes all supported models, languages, and pricing metrics.
 */

const SUPPORTED_MODELS = [
    {
        id: 'gemini-3.7-flash',
        name: 'gemini-3.7-flash',
        displayName: 'gemini-3.7-flash',
        inputPer1M: 0.075,
        outputPer1M: 0.30,
        isDefault: true
    },
    {
        id: 'gemini-3.6-flash',
        name: 'gemini-3.6-flash',
        displayName: 'gemini-3.6-flash',
        inputPer1M: 0.075,
        outputPer1M: 0.30
    },
    {
        id: 'gemini-2.5-flash',
        name: 'gemini-2.5-flash',
        displayName: 'gemini-2.5-flash',
        inputPer1M: 0.075,
        outputPer1M: 0.30
    },
    {
        id: 'gemini-2.5-pro',
        name: 'gemini-2.5-pro',
        displayName: 'gemini-2.5-pro',
        inputPer1M: 1.25,
        outputPer1M: 5.00
    }
];

const SUPPORTED_LANGUAGES = [
    { id: 'auto', name: 'Auto', nativeName: 'Auto', label: 'Auto' },
    { id: 'en', name: 'English', nativeName: 'EN', label: 'EN' },
    { id: 'ar', name: 'Arabic', nativeName: 'AR', label: 'AR' },
    { id: 'zh', name: 'Chinese', nativeName: 'ZH', label: 'ZH' },
    { id: 'nl', name: 'Dutch', nativeName: 'NL', label: 'NL' },
    { id: 'fr', name: 'French', nativeName: 'FR', label: 'FR' },
    { id: 'de', name: 'German', nativeName: 'DE', label: 'DE' },
    { id: 'hi', name: 'Hindi', nativeName: 'HI', label: 'HI' },
    { id: 'it', name: 'Italian', nativeName: 'IT', label: 'IT' },
    { id: 'ja', name: 'Japanese', nativeName: 'JA', label: 'JA' },
    { id: 'ko', name: 'Korean', nativeName: 'KO', label: 'KO' },
    { id: 'pt', name: 'Portuguese', nativeName: 'PT', label: 'PT' },
    { id: 'ru', name: 'Russian', nativeName: 'RU', label: 'RU' },
    { id: 'es', name: 'Spanish', nativeName: 'ES', label: 'ES' }
];

// Price mapping per 1M tokens ($)
const MODEL_PRICING = SUPPORTED_MODELS.reduce((acc, model) => {
    acc[model.id] = {
        inputPer1M: model.inputPer1M,
        outputPer1M: model.outputPer1M
    };
    return acc;
}, {});

const DEFAULT_CONFIG = {
    model: 'gemini-3.7-flash',
    language: 'auto',
    monthlyBudgetLimit: 10.0
};

module.exports = {
    SUPPORTED_MODELS,
    SUPPORTED_LANGUAGES,
    MODEL_PRICING,
    DEFAULT_CONFIG
};

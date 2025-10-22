/**
 * Конфигурация приложения Budget v2.0
 */

export const CONFIG = {
    // Версия приложения
    VERSION: {
        MAJOR: 2,
        MINOR: 0,
        PATCH: 0,
        toString() {
            return `${this.MAJOR}.${this.MINOR}.${this.PATCH}`;
        }
    },

    // API настройки
    API: {
        BASE_URL: 'https://priolia-budget.duckdns.org/api',
        KEY: 'BdgtAPI_7k9mX2pL5nQ8wR4vY6zT3hJ0sF1dG',
        TIMEOUT: 10000, // 10 секунд
        USE_API: true   // false = только localStorage
    },

    // LocalStorage ключи
    STORAGE_KEYS: {
        CATEGORIES: 'budget_categories_v2',
        EXPENSES: 'budget_expenses_v2',
        CONFIG: 'budget_config_v2',
        PASSWORD: 'budget_password',
        LAST_SYNC: 'budget_last_sync'
    },

    // Настройки по умолчанию
    DEFAULTS: {
        PERIOD_START_DAY: 25,
        RATE_EUR_TO_UAH: 48.40,
        RATE_EUR_TO_BGN: 1.9558,
        TAX_RATE: 7.3,
        LIMIT_FOP: 2200,
        LIMIT_CRYPTO: 1100,
        INCOME_EURO: 3300
    },

    // Форматы ID
    ID_FORMATS: {
        CATEGORY: 'cat',
        EXPENSE: 'exp'
    },

    // UI настройки
    UI: {
        DATE_FORMAT: 'DD.MM.YYYY',
        MONTH_NAMES: [
            'янв', 'фев', 'мар', 'апр', 'май', 'июн',
            'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
        ],
        MONTH_NAMES_FULL: [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ]
    },

    // Бэкап настройки
    BACKUP: {
        RETENTION_DAYS: 30,
        AUTO_BACKUP: true
    }
};

export default CONFIG;

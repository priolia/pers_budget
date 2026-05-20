/**
 * DataManager v2.0
 * Управление данными приложения с поддержкой уникальных ID
 */

import { CONFIG } from './config.js';

class DataManagerClass {
    constructor() {
        this.categories = [];
        this.expenses = [];
        this.config = this.getDefaultConfig();
        this.listeners = {
            categoriesChange: [],
            expensesChange: [],
            configChange: []
        };
    }

    // ============================================
    // ГЕНЕРАЦИЯ ID
    // ============================================

    /**
     * Генерировать уникальный ID
     * @param {string} prefix - Префикс ID (cat, exp)
     * @returns {string} Уникальный ID
     */
    generateId(prefix) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}_${timestamp}_${random}`;
    }

    // ============================================
    // РАБОТА С КАТЕГОРИЯМИ
    // ============================================

    /**
     * Получить все категории
     */
    getCategories() {
        return [...this.categories];
    }

    /**
     * Получить категорию по ID
     */
    getCategoryById(id) {
        return this.categories.find(cat => cat.id === id);
    }

    /**
     * Добавить категорию
     */
    addCategory(categoryData) {
        const category = {
            id: this.generateId(CONFIG.ID_FORMATS.CATEGORY),
            name: categoryData.name,
            limit: categoryData.limit || 0,
            percentage: categoryData.percentage || 0,
            order: categoryData.order || this.categories.length + 1,
            icon: categoryData.icon || '',
            includeInDailyLimit: categoryData.includeInDailyLimit || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.categories.push(category);
        this.notifyListeners('categoriesChange');
        return category;
    }

    /**
     * Обновить категорию
     */
    updateCategory(id, updates) {
        const index = this.categories.findIndex(cat => cat.id === id);
        if (index === -1) {
            console.error(`Категория с ID ${id} не найдена`);
            return null;
        }

        this.categories[index] = {
            ...this.categories[index],
            ...updates,
            id: this.categories[index].id, // ID не меняется
            createdAt: this.categories[index].createdAt, // createdAt не меняется
            updatedAt: new Date().toISOString()
        };

        this.notifyListeners('categoriesChange');
        return this.categories[index];
    }

    /**
     * Удалить категорию
     */
    deleteCategory(id) {
        const index = this.categories.findIndex(cat => cat.id === id);
        if (index === -1) {
            return false;
        }

        this.categories.splice(index, 1);
        this.notifyListeners('categoriesChange');
        return true;
    }

    /**
     * Установить все категории (для синхронизации)
     */
    setCategories(categories) {
        this.categories = categories.map(cat => ({
            ...cat,
            // Генерируем ID если его нет (миграция старых данных)
            id: cat.id || this.generateId(CONFIG.ID_FORMATS.CATEGORY),
            createdAt: cat.createdAt || new Date().toISOString(),
            updatedAt: cat.updatedAt || new Date().toISOString()
        }));
        this.notifyListeners('categoriesChange');
    }

    // ============================================
    // РАБОТА С ТРАТАМИ
    // ============================================

    /**
     * Получить все траты
     */
    getExpenses() {
        return [...this.expenses];
    }

    /**
     * Получить трату по ID
     */
    getExpenseById(id) {
        return this.expenses.find(exp => exp.id === id);
    }

    /**
     * Получить траты по категории
     */
    getExpensesByCategoryId(categoryId) {
        return this.expenses.filter(exp => exp.categoryId === categoryId);
    }

    /**
     * Добавить трату
     */
    addExpense(expenseData) {
        const expense = {
            id: this.generateId(CONFIG.ID_FORMATS.EXPENSE),
            categoryId: expenseData.categoryId,
            date: expenseData.date || new Date().toISOString(),
            description: expenseData.description || '',
            amount: expenseData.amount || 0,
            currency: expenseData.currency || 'EUR',
            amountEUR: expenseData.amountEUR || expenseData.amount || 0,
            amountUAH: expenseData.amountUAH || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.expenses.push(expense);
        this.notifyListeners('expensesChange');
        return expense;
    }

    /**
     * Обновить трату
     */
    updateExpense(id, updates) {
        const index = this.expenses.findIndex(exp => exp.id === id);
        if (index === -1) {
            console.error(`Трата с ID ${id} не найдена`);
            return null;
        }

        this.expenses[index] = {
            ...this.expenses[index],
            ...updates,
            id: this.expenses[index].id, // ID не меняется
            createdAt: this.expenses[index].createdAt, // createdAt не меняется
            updatedAt: new Date().toISOString()
        };

        this.notifyListeners('expensesChange');
        return this.expenses[index];
    }

    /**
     * Удалить трату
     */
    deleteExpense(id) {
        const index = this.expenses.findIndex(exp => exp.id === id);
        if (index === -1) {
            return false;
        }

        this.expenses.splice(index, 1);
        this.notifyListeners('expensesChange');
        return true;
    }

    /**
     * Установить все траты (для синхронизации)
     */
    setExpenses(expenses) {
        this.expenses = expenses.map(exp => ({
            ...exp,
            // Генерируем ID если его нет (миграция старых данных)
            id: exp.id || this.generateId(CONFIG.ID_FORMATS.EXPENSE),
            createdAt: exp.createdAt || new Date().toISOString(),
            updatedAt: exp.updatedAt || new Date().toISOString()
        }));
        this.notifyListeners('expensesChange');
    }

    // ============================================
    // РАБОТА С КОНФИГУРАЦИЕЙ
    // ============================================

    getDefaultConfig() {
        return {
            passwordHash: null,
            periodStartDay: CONFIG.DEFAULTS.PERIOD_START_DAY,
            settings: {
                rateEURtoUAH: CONFIG.DEFAULTS.RATE_EUR_TO_UAH,
                taxRate: CONFIG.DEFAULTS.TAX_RATE,
                limitFop: CONFIG.DEFAULTS.LIMIT_FOP,
                limitCrypto: CONFIG.DEFAULTS.LIMIT_CRYPTO,
                incomeEuro: CONFIG.DEFAULTS.INCOME_EURO,
                periodStartDay: CONFIG.DEFAULTS.PERIOD_START_DAY,
                defaultCategoryId: null,
                totalIncomeUAH: 0,
                lastRatesUpdate: null,
                lastRatesDate: null
            }
        };
    }

    /**
     * Получить конфигурацию
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Обновить конфигурацию
     */
    updateConfig(updates) {
        this.config = {
            ...this.config,
            ...updates
        };
        this.notifyListeners('configChange');
        return this.config;
    }

    /**
     * Обновить настройки
     */
    updateSettings(settings) {
        this.config.settings = {
            ...this.config.settings,
            ...settings
        };
        this.notifyListeners('configChange');
        return this.config.settings;
    }

    /**
     * Установить конфигурацию (для синхронизации)
     */
    setConfig(config) {
        this.config = {
            ...this.getDefaultConfig(),
            ...config
        };
        this.notifyListeners('configChange');
    }

    // ============================================
    // СОБЫТИЯ И СЛУШАТЕЛИ
    // ============================================

    /**
     * Подписаться на изменения
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Отписаться от изменений
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Уведомить слушателей
     */
    notifyListeners(event) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback();
                } catch (error) {
                    console.error(`Ошибка в слушателе ${event}:`, error);
                }
            });
        }
    }

    // ============================================
    // МИГРАЦИЯ ДАННЫХ
    // ============================================

    /**
     * Проверить нужна ли миграция
     */
    needsMigration() {
        // Если есть категории или траты без ID - нужна миграция
        const categoriesNeedMigration = this.categories.some(cat => !cat.id);
        const expensesNeedMigration = this.expenses.some(exp => !exp.id);
        return categoriesNeedMigration || expensesNeedMigration;
    }

    /**
     * Мигрировать данные на новый формат с ID
     */
    migrateToV2() {
        console.log('Начинаем миграцию данных на v2.0...');

        // Мигрируем категории
        this.categories = this.categories.map(cat => ({
            ...cat,
            id: cat.id || this.generateId(CONFIG.ID_FORMATS.CATEGORY),
            createdAt: cat.createdAt || new Date().toISOString(),
            updatedAt: cat.updatedAt || new Date().toISOString()
        }));

        // Создаем мапу имя категории -> ID для миграции трат
        const categoryNameToId = {};
        this.categories.forEach(cat => {
            categoryNameToId[cat.name] = cat.id;
        });

        // Мигрируем траты
        this.expenses = this.expenses.map(exp => {
            // Если нет categoryId, пытаемся найти по имени категории
            let categoryId = exp.categoryId;
            if (!categoryId && exp.category) {
                categoryId = categoryNameToId[exp.category];
            }

            return {
                ...exp,
                id: exp.id || this.generateId(CONFIG.ID_FORMATS.EXPENSE),
                categoryId: categoryId,
                createdAt: exp.createdAt || new Date().toISOString(),
                updatedAt: exp.updatedAt || new Date().toISOString()
            };
        });

        console.log('Миграция завершена!');
        console.log(`Мигрировано категорий: ${this.categories.length}`);
        console.log(`Мигрировано трат: ${this.expenses.length}`);

        this.notifyListeners('categoriesChange');
        this.notifyListeners('expensesChange');

        return {
            categoriesCount: this.categories.length,
            expensesCount: this.expenses.length
        };
    }

    // ============================================
    // ОЧИСТКА ДАННЫХ
    // ============================================

    /**
     * Очистить все данные
     */
    clearAll() {
        this.categories = [];
        this.expenses = [];
        this.config = this.getDefaultConfig();

        this.notifyListeners('categoriesChange');
        this.notifyListeners('expensesChange');
        this.notifyListeners('configChange');
    }
}

// Создаем единственный экземпляр
export const DataManager = new DataManagerClass();
export default DataManager;

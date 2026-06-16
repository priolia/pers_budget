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
        this.snapshots = [];
        this.listeners = {
            categoriesChange: [],
            expensesChange: [],
            configChange: [],
            snapshotsChange: []
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
            isReserveSource: categoryData.isReserveSource || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.categories.push(category);
        this.addSnapshot({
            type: 'category_created',
            entityId: category.id,
            entityName: category.name,
            field: null,
            oldValue: null,
            newValue: null
        });
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

        const old = this.categories[index];
        if ('name' in updates && updates.name !== old.name) {
            this.addSnapshot({ type: 'category_name', entityId: id, entityName: updates.name, field: 'name', oldValue: old.name, newValue: updates.name });
        }
        if ('limit' in updates && updates.limit !== old.limit) {
            this.addSnapshot({ type: 'category_limit', entityId: id, entityName: old.name, field: 'limit', oldValue: old.limit, newValue: updates.limit });
        }
        if ('percentage' in updates && updates.percentage !== old.percentage) {
            this.addSnapshot({ type: 'category_limit', entityId: id, entityName: old.name, field: 'percentage', oldValue: old.percentage, newValue: updates.percentage });
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

        const removed = this.categories[index];
        this.addSnapshot({
            type: 'category_deleted',
            entityId: removed.id,
            entityName: removed.name,
            field: null,
            oldValue: null,
            newValue: null
        });
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
        // Снимок имени категории на момент создания траты.
        // Нужен для читаемости файлов экспорта после переименования/удаления категории.
        const category = this.getCategoryById(expenseData.categoryId);

        const expense = {
            id: this.generateId(CONFIG.ID_FORMATS.EXPENSE),
            categoryId: expenseData.categoryId,
            categoryName: category ? category.name : '',
            date: expenseData.date || new Date().toISOString(),
            description: expenseData.description || '',
            amount: expenseData.amount || 0,
            currency: expenseData.currency || 'EUR',
            amountEUR: expenseData.amountEUR || expenseData.amount || 0,
            amountUAH: expenseData.amountUAH || 0,
            paidFrom: expenseData.paidFrom || 'monthly',
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

        // Если в обновлении меняется категория — пересчитываем снимок имени.
        // Если categoryId не передан или совпадает с текущим — снимок не трогаем.
        const oldCategoryId = this.expenses[index].categoryId;
        if (updates.categoryId && updates.categoryId !== oldCategoryId) {
            const newCategory = this.getCategoryById(updates.categoryId);
            updates.categoryName = newCategory ? newCategory.name : '';
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
            // Обратная совместимость: старые расходы без paidFrom считаются как 'monthly'
            paidFrom: exp.paidFrom || 'monthly',
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
            baselineSnapshotDone: false,
            reserves: [
                { id: 'reserve_eur', name: 'Запас EUR', icon: '💶', currency: 'EUR', balance: 0 },
                { id: 'reserve_uah', name: 'Запас UAH', icon: '🇺🇦', currency: 'UAH', balance: 0 }
            ],
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
        const oldS = this.config.settings || {};
        const globalMap = [
            ['incomeEuro', 'income', 'incomeEuro'],
            ['taxRate', 'tax_rate', 'taxRate'],
            ['limitFop', 'fop_limit', 'limitFop'],
            ['periodStartDay', 'period_start_day', 'periodStartDay']
        ];
        globalMap.forEach(([key, snapType, field]) => {
            if (key in settings && settings[key] !== oldS[key]) {
                this.addSnapshot({ type: snapType, entityId: null, entityName: null, field: field, oldValue: (oldS[key] !== undefined ? oldS[key] : null), newValue: settings[key] });
            }
        });
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
        // Миграция: если reserves отсутствуют — создаём дефолтные две копилки (EUR + UAH)
        if (!Array.isArray(this.config.reserves) || this.config.reserves.length === 0) {
            this.config.reserves = [
                { id: 'reserve_eur', name: 'Запас EUR', icon: '💶', currency: 'EUR', balance: 0 },
                { id: 'reserve_uah', name: 'Запас UAH', icon: '🇺🇦', currency: 'UAH', balance: 0 }
            ];
        }
        this.notifyListeners('configChange');
    }

    // ============================================
    // РАБОТА С КОПИЛКАМИ (RESERVES)
    // ============================================

    /**
     * Получить все копилки
     */
    getReserves() {
        return [...(this.config.reserves || [])];
    }

    /**
     * Найти копилку по ID
     */
    getReserveById(id) {
        return (this.config.reserves || []).find(r => r.id === id);
    }

    /**
     * Найти копилку по валюте (первая встреченная)
     */
    getReserveByCurrency(currency) {
        return (this.config.reserves || []).find(r => r.currency === currency);
    }

    /**
     * Установить баланс конкретной копилки
     */
    setReserveBalance(id, balance) {
        const reserves = this.config.reserves || [];
        const idx = reserves.findIndex(r => r.id === id);
        if (idx === -1) {
            console.error(`Копилка с ID ${id} не найдена`);
            return null;
        }
        const oldReserve = reserves[idx];
        const newBalance = parseFloat(balance) || 0;
        if (newBalance !== oldReserve.balance) {
            this.addSnapshot({ type: 'reserve_balance', entityId: oldReserve.id, entityName: oldReserve.name, field: 'balance', oldValue: oldReserve.balance, newValue: newBalance });
        }
        reserves[idx] = { ...reserves[idx], balance: newBalance };
        this.config.reserves = reserves;
        this.notifyListeners('configChange');
        return reserves[idx];
    }

    // ============================================
    // SNAPSHOTS (change log)
    // ============================================

    /**
     * Add a snapshot record. Accepts a partial record; fills id/timestamp/baseline.
     */
    addSnapshot(partial) {
        const snapshot = {
            id: this.generateId('snap'),
            timestamp: new Date().toISOString(),
            type: partial.type,
            entityId: (partial.entityId !== undefined ? partial.entityId : null),
            entityName: (partial.entityName !== undefined ? partial.entityName : null),
            field: (partial.field !== undefined ? partial.field : null),
            oldValue: (partial.oldValue !== undefined ? partial.oldValue : null),
            newValue: (partial.newValue !== undefined ? partial.newValue : null),
            baseline: partial.baseline === true
        };
        this.snapshots.push(snapshot);
        this.notifyListeners('snapshotsChange');
        return snapshot;
    }

    /**
     * Get a copy of all snapshots.
     */
    getSnapshots() {
        return [...this.snapshots];
    }

    /**
     * Replace snapshots from server (no new records created).
     */
    setSnapshots(arr) {
        this.snapshots = Array.isArray(arr) ? arr : [];
    }

    /**
     * Stamp current state as the zero point. All records baseline: true.
     */
    createBaselineSnapshot() {
        const s = this.config.settings || {};
        this.categories.forEach(cat => {
            this.addSnapshot({ type: 'category_limit', entityId: cat.id, entityName: cat.name, field: 'limit', oldValue: null, newValue: (cat.limit !== undefined ? cat.limit : null), baseline: true });
            this.addSnapshot({ type: 'category_limit', entityId: cat.id, entityName: cat.name, field: 'percentage', oldValue: null, newValue: (cat.percentage !== undefined ? cat.percentage : null), baseline: true });
        });
        const periodStartDay = (s.periodStartDay !== undefined ? s.periodStartDay : (this.config.periodStartDay !== undefined ? this.config.periodStartDay : null));
        this.addSnapshot({ type: 'income', entityId: null, entityName: null, field: 'incomeEuro', oldValue: null, newValue: (s.incomeEuro !== undefined ? s.incomeEuro : null), baseline: true });
        this.addSnapshot({ type: 'tax_rate', entityId: null, entityName: null, field: 'taxRate', oldValue: null, newValue: (s.taxRate !== undefined ? s.taxRate : null), baseline: true });
        this.addSnapshot({ type: 'fop_limit', entityId: null, entityName: null, field: 'limitFop', oldValue: null, newValue: (s.limitFop !== undefined ? s.limitFop : null), baseline: true });
        this.addSnapshot({ type: 'period_start_day', entityId: null, entityName: null, field: 'periodStartDay', oldValue: null, newValue: periodStartDay, baseline: true });
        (this.config.reserves || []).forEach(r => {
            this.addSnapshot({ type: 'reserve_balance', entityId: r.id, entityName: r.name, field: 'balance', oldValue: null, newValue: (r.balance !== undefined ? r.balance : null), baseline: true });
        });
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

/**
 * Budget App v2.0 - Main Entry Point
 * Инициализация приложения и интеграция всех модулей
 */

import { CONFIG } from './config.js';
import { DataManager } from './dataManager.js';
import { BudgetAPI } from './api.js';
import { SyncManager } from './sync.js';
import { AuthManager } from './auth.js';
import { MigrationManager } from './migration.js';
import { DateUtils } from './utils/dates.js';
import { CurrencyUtils } from './utils/currency.js';
import { ExportUtils } from './utils/export.js';
import { ImportUtils } from './utils/import.js';

// Глобальное приложение
window.BudgetApp = {
    // Модули
    CONFIG,
    DataManager,
    BudgetAPI,
    SyncManager,
    AuthManager,
    MigrationManager,
    DateUtils,
    CurrencyUtils,
    ExportUtils,
    ImportUtils,

    // Состояние
    initialized: false,
    currentPeriod: null,

    /**
     * Инициализация приложения
     */
    async init() {
        try {
            console.log('🚀 Запуск Budget App v2.0...');

            // 1. Проверка доступности API
            await BudgetAPI.checkHealth();

            // 2. Загрузка данных
            await this.loadData();

            // 3. Проверка необходимости миграции
            const migrationStatus = MigrationManager.getMigrationStatus();
            console.log(migrationStatus.message);

            // 4. Установка текущего периода
            const config = DataManager.getConfig();
            this.currentPeriod = DateUtils.getCurrentPeriod(config.periodStartDay);

            // 5. Инициализация UI (если используется старый index.html)
            if (typeof initializeApp === 'function') {
                // Совместимость со старым кодом
                this.integrateWithLegacyUI();
            }

            this.initialized = true;

            console.log('✅ Приложение инициализировано');
            console.log(`📅 Текущий период: ${DateUtils.formatPeriod(this.currentPeriod)}`);

            return { success: true };

        } catch (error) {
            console.error('❌ Ошибка инициализации приложения:', error);
            return { success: false, error: error };
        }
    },

    /**
     * Загрузить данные
     */
    async loadData() {
        try {
            console.log('📥 Загрузка данных...');

            const data = await BudgetAPI.fetchAll();

            DataManager.setCategories(data.categories);
            DataManager.setExpenses(data.expenses);
            DataManager.setConfig(data.config);

            console.log(`✅ Загружено: ${data.categories.length} категорий, ${data.expenses.length} трат`);

            return { success: true };

        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);

            // Пытаемся загрузить из localStorage
            console.log('⚠️ Загрузка из локального хранилища...');

            const categoriesData = BudgetAPI.loadCategoriesFromLocalStorage();
            const expensesData = BudgetAPI.loadExpensesFromLocalStorage();
            const configData = BudgetAPI.loadConfigFromLocalStorage();

            DataManager.setCategories(categoriesData.categories || []);
            DataManager.setExpenses(expensesData.expenses || []);
            DataManager.setConfig(configData);

            return { success: false, fallbackToLocal: true };
        }
    },

    /**
     * Сохранить данные
     */
    async saveData() {
        try {
            const categories = DataManager.getCategories();
            const expenses = DataManager.getExpenses();
            const config = DataManager.getConfig();

            await BudgetAPI.pushAll(categories, expenses, config);

            console.log('✅ Данные сохранены');

            return { success: true };

        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
            return { success: false, error: error };
        }
    },

    /**
     * Синхронизация
     */
    async sync() {
        return await SyncManager.smartSync();
    },

    /**
     * Экспорт данных
     */
    async exportData() {
        return ExportUtils.exportToJSON();
    },

    /**
     * Импорт данных
     */
    async importData() {
        return await ImportUtils.openFilePicker();
    },

    /**
     * Миграция данных
     */
    async migrate() {
        return await MigrationManager.performMigration();
    },

    /**
     * Обновить курсы валют
     */
    async updateRates() {
        try {
            const rates = await CurrencyUtils.fetchMonobankRates();

            DataManager.updateSettings({
                rateEURtoUAH: rates.rateEURtoUAH,
                rateEURtoBGN: rates.rateEURtoBGN,
                lastRatesUpdate: rates.lastUpdate
            });

            await this.saveData();

            console.log('✅ Курсы обновлены');
            console.log(`EUR → UAH: ${rates.rateEURtoUAH}`);
            console.log(`EUR → BGN: ${rates.rateEURtoBGN}`);

            return { success: true, rates: rates };

        } catch (error) {
            console.error('❌ Ошибка обновления курсов:', error);
            return { success: false, error: error };
        }
    },

    /**
     * Интеграция со старым UI (для совместимости)
     */
    integrateWithLegacyUI() {
        console.log('🔗 Интеграция с существующим UI...');

        // Подменяем глобальные функции для работы через DataManager

        // Сохранение данных
        if (typeof window.saveDataToServer === 'function') {
            const originalSave = window.saveDataToServer;
            window.saveDataToServer = async () => {
                await this.saveData();
                return originalSave();
            };
        }

        // Добавляем обработчики на кнопки
        this.attachEventHandlers();
    },

    /**
     * Добавить обработчики событий
     */
    attachEventHandlers() {
        // Кнопка синхронизации
        const syncBtn = document.querySelector('[data-action="sync"]');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                const result = await this.sync();
                if (result.success) {
                    alert('✅ Синхронизация завершена');
                } else {
                    alert('❌ Ошибка синхронизации: ' + result.message);
                }
            });
        }

        // Кнопка экспорта
        const exportBtn = document.querySelector('[data-action="export"]');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                await this.exportData();
            });
        }

        // Кнопка импорта
        const importBtn = document.querySelector('[data-action="import"]');
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                const result = await this.importData();
                if (result.success) {
                    alert('✅ Импорт завершен');
                    window.location.reload();
                } else if (!result.cancelled) {
                    alert('❌ Ошибка импорта: ' + result.error);
                }
            });
        }

        // Кнопка миграции
        const migrateBtn = document.querySelector('[data-action="migrate"]');
        if (migrateBtn) {
            migrateBtn.addEventListener('click', async () => {
                await this.migrate();
            });
        }

        // Кнопка обновления курсов
        const updateRatesBtn = document.querySelector('[data-action="update-rates"]');
        if (updateRatesBtn) {
            updateRatesBtn.addEventListener('click', async () => {
                const result = await this.updateRates();
                if (result.success) {
                    alert(`✅ Курсы обновлены\nEUR → UAH: ${result.rates.rateEURtoUAH}\nEUR → BGN: ${result.rates.rateEURtoBGN}`);
                    window.location.reload();
                } else {
                    alert('❌ Ошибка обновления курсов');
                }
            });
        }
    },

    /**
     * Получить статистику приложения
     */
    getStats() {
        const categories = DataManager.getCategories();
        const expenses = DataManager.getExpenses();
        const config = DataManager.getConfig();

        const periodExpenses = DateUtils.filterExpensesByPeriod(
            expenses,
            this.currentPeriod
        );

        const totalSpent = CurrencyUtils.sumExpenses(periodExpenses, 'EUR');

        return {
            version: CONFIG.VERSION.toString(),
            categories: categories.length,
            expenses: expenses.length,
            periodExpenses: periodExpenses.length,
            totalSpent: totalSpent,
            period: DateUtils.formatPeriod(this.currentPeriod),
            isOnline: BudgetAPI.isOnline,
            lastSync: SyncManager.lastSyncTime,
            needsMigration: MigrationManager.needsMigration()
        };
    },

    /**
     * Показать информацию о приложении
     */
    showInfo() {
        const stats = this.getStats();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Budget App v2.0 - Статистика');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Версия: ${stats.version}`);
        console.log(`Категорий: ${stats.categories}`);
        console.log(`Всего трат: ${stats.expenses}`);
        console.log(`Трат за период: ${stats.periodExpenses}`);
        console.log(`Потрачено за период: ${stats.totalSpent.toFixed(2)} €`);
        console.log(`Текущий период: ${stats.period}`);
        console.log(`Статус API: ${stats.isOnline ? '🟢 Онлайн' : '🔴 Оффлайн'}`);
        console.log(`Последняя синхронизация: ${stats.lastSync || 'Никогда'}`);
        console.log(`Требуется миграция: ${stats.needsMigration ? '⚠️ Да' : '✅ Нет'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return stats;
    }
};

// Автозапуск при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM загружен');

    // Проверяем аутентификацию
    const isAuth = await AuthManager.checkAuth();

    if (isAuth) {
        // Если пароля нет - сразу запускаем приложение
        await window.BudgetApp.init();

        // Показываем статистику в консоли
        window.BudgetApp.showInfo();
    }
});

// Экспортируем для использования в консоли
export default window.BudgetApp;

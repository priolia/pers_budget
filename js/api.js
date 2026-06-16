/**
 * API модуль v2.0 для работы с Budget API Server
 * Поддерживает разделение данных на categories, expenses и config
 */

import { CONFIG } from './config.js';
import { AuthManager } from './auth.js';

class BudgetAPIClass {
    constructor() {
        this.isOnline = true;
        this.lastSyncTime = null;
        this.retryCount = 0;
        this.maxRetries = 4;
        this.retryDelays = [2000, 4000, 8000, 16000]; // Экспоненциальная задержка
    }

    // ============================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    /**
     * Выполнить HTTP запрос к API
     */
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API.BASE_URL}${endpoint}`;

        const token = AuthManager.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);

            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Токен невалиден или нет доступа — выходим
            if (response.status === 401 || response.status === 403) {
                console.warn('🔒 Токен невалиден или нет доступа, выход');
                AuthManager.clearToken();
                AuthManager.isAuthenticated = false;
                // Перезагружаем страницу — пользователь увидит экран входа
                window.location.reload();
                throw new Error(`Не авторизован (${response.status})`);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Если это запрос на скачивание файла
            if (endpoint === '/export') {
                return response.blob();
            }

            return await response.json();

        } catch (error) {
            console.error('API request error:', error);
            this.isOnline = false;
            throw error;
        }
    }

    /**
     * Повторить запрос с экспоненциальной задержкой
     */
    async requestWithRetry(endpoint, options = {}, retryCount = 0) {
        try {
            const result = await this.request(endpoint, options);
            this.isOnline = true;
            return result;
        } catch (error) {
            // Если это сетевая ошибка и есть попытки
            if (retryCount < this.maxRetries) {
                const delay = this.retryDelays[retryCount];
                console.log(`Повтор запроса через ${delay}ms (попытка ${retryCount + 1}/${this.maxRetries})`);

                await this.sleep(delay);
                return this.requestWithRetry(endpoint, options, retryCount + 1);
            }

            throw error;
        }
    }

    /**
     * Задержка
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Проверить доступность API
     */
    async checkHealth() {
        try {
            const response = await fetch(`${CONFIG.API.BASE_URL}/health`);
            const data = await response.json();

            this.isOnline = response.ok;

            if (this.isOnline) {
                console.log('✅ API доступен:', data.version);
            }

            return this.isOnline;
        } catch (error) {
            console.warn('⚠️ API недоступен, работаем в оффлайн режиме');
            this.isOnline = false;
            return false;
        }
    }

    // ============================================
    // API МЕТОДЫ - КАТЕГОРИИ
    // ============================================

    /**
     * Загрузить категории с сервера
     */
    async fetchCategories() {
        if (!CONFIG.API.USE_API) {
            return this.loadCategoriesFromLocalStorage();
        }

        try {
            const data = await this.requestWithRetry('/categories', { method: 'GET' });
            this.lastSyncTime = new Date();
            return data;
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
            return this.loadCategoriesFromLocalStorage();
        }
    }

    /**
     * Сохранить категории на сервер
     */
    async pushCategories(categories) {
        if (!CONFIG.API.USE_API) {
            return this.saveCategoriesToLocalStorage(categories);
        }

        const data = {
            categories: categories,
            version: {
                major: CONFIG.VERSION.MAJOR,
                minor: CONFIG.VERSION.MINOR,
                patch: CONFIG.VERSION.PATCH,
                timestamp: new Date().toISOString()
            },
            lastSync: new Date().toISOString()
        };

        try {
            const result = await this.requestWithRetry('/categories', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            this.lastSyncTime = new Date();
            console.log('✅ Категории сохранены на сервер');
            return result;
        } catch (error) {
            console.error('Ошибка сохранения категорий:', error);
            // Сохраняем локально как fallback
            this.saveCategoriesToLocalStorage(categories);
            throw error;
        }
    }

    // ============================================
    // API МЕТОДЫ - ТРАТЫ
    // ============================================

    /**
     * Загрузить траты с сервера
     */
    async fetchExpenses() {
        if (!CONFIG.API.USE_API) {
            return this.loadExpensesFromLocalStorage();
        }

        try {
            const data = await this.requestWithRetry('/expenses', { method: 'GET' });
            this.lastSyncTime = new Date();
            return data;
        } catch (error) {
            console.error('Ошибка загрузки трат:', error);
            return this.loadExpensesFromLocalStorage();
        }
    }

    /**
     * Сохранить траты на сервер
     */
    async pushExpenses(expenses) {
        if (!CONFIG.API.USE_API) {
            return this.saveExpensesToLocalStorage(expenses);
        }

        const data = {
            expenses: expenses,
            version: {
                major: CONFIG.VERSION.MAJOR,
                minor: CONFIG.VERSION.MINOR,
                patch: CONFIG.VERSION.PATCH,
                timestamp: new Date().toISOString()
            },
            lastSync: new Date().toISOString()
        };

        try {
            const result = await this.requestWithRetry('/expenses', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            this.lastSyncTime = new Date();
            console.log('✅ Траты сохранены на сервер');
            return result;
        } catch (error) {
            console.error('Ошибка сохранения трат:', error);
            // Сохраняем локально как fallback
            this.saveExpensesToLocalStorage(expenses);
            throw error;
        }
    }

    // ============================================
    // API МЕТОДЫ - КОНФИГУРАЦИЯ
    // ============================================

    /**
     * Загрузить конфигурацию с сервера
     */
    async fetchConfig() {
        if (!CONFIG.API.USE_API) {
            return this.loadConfigFromLocalStorage();
        }

        try {
            const data = await this.requestWithRetry('/config', { method: 'GET' });
            this.lastSyncTime = new Date();
            return data;
        } catch (error) {
            console.error('Ошибка загрузки конфигурации:', error);
            return this.loadConfigFromLocalStorage();
        }
    }

    /**
     * Сохранить конфигурацию на сервер
     */
    async pushConfig(config) {
        if (!CONFIG.API.USE_API) {
            return this.saveConfigToLocalStorage(config);
        }

        const data = {
            ...config,
            version: {
                major: CONFIG.VERSION.MAJOR,
                minor: CONFIG.VERSION.MINOR,
                patch: CONFIG.VERSION.PATCH,
                timestamp: new Date().toISOString()
            },
            lastSync: new Date().toISOString()
        };

        try {
            const result = await this.requestWithRetry('/config', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            this.lastSyncTime = new Date();
            console.log('✅ Конфигурация сохранена на сервер');
            return result;
        } catch (error) {
            console.error('Ошибка сохранения конфигурации:', error);
            // Сохраняем локально как fallback
            this.saveConfigToLocalStorage(config);
            throw error;
        }
    }

    // ============================================
    // API МЕТОДЫ - СНАПШОТЫ
    // ============================================

    /**
     * Load snapshots log from server (returns a plain array).
     */
    async fetchSnapshots() {
        if (!CONFIG.API.USE_API) {
            return this.loadSnapshotsFromLocalStorage();
        }
        try {
            const data = await this.requestWithRetry('/snapshots', { method: 'GET' });
            this.lastSyncTime = new Date();
            if (Array.isArray(data)) return data;
            if (data && Array.isArray(data.snapshots)) return data.snapshots;
            return [];
        } catch (error) {
            console.error('Ошибка загрузки снапшотов:', error);
            return this.loadSnapshotsFromLocalStorage();
        }
    }

    /**
     * Save snapshots log to server (sends a plain array).
     */
    async pushSnapshots(snapshots) {
        const arr = Array.isArray(snapshots) ? snapshots : [];
        if (!CONFIG.API.USE_API) {
            return this.saveSnapshotsToLocalStorage(arr);
        }
        try {
            const result = await this.requestWithRetry('/snapshots', {
                method: 'POST',
                body: JSON.stringify(arr)
            });
            this.lastSyncTime = new Date();
            console.log('✅ Снапшоты сохранены на сервер');
            return result;
        } catch (error) {
            console.error('Ошибка сохранения снапшотов:', error);
            this.saveSnapshotsToLocalStorage(arr);
            throw error;
        }
    }

    // ============================================
    // API МЕТОДЫ - СВОДНЫЕ
    // ============================================

    /**
     * Загрузить все данные (категории + траты + конфиг)
     */
    async fetchAll() {
        try {
            const [categories, expenses, config, snapshots] = await Promise.all([
                this.fetchCategories(),
                this.fetchExpenses(),
                this.fetchConfig(),
                this.fetchSnapshots()
            ]);

            return {
                categories: categories.categories || [],
                expenses: expenses.expenses || [],
                config: config,
                snapshots: Array.isArray(snapshots) ? snapshots : []
            };
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            throw error;
        }
    }

    /**
     * Сохранить все данные
     */
    async pushAll(categories, expenses, config, snapshots) {
        try {
            const tasks = [
                this.pushCategories(categories),
                this.pushExpenses(expenses),
                this.pushConfig(config)
            ];
            if (snapshots !== undefined) {
                tasks.push(this.pushSnapshots(snapshots));
            }
            await Promise.all(tasks);

            console.log('✅ Все данные сохранены');
            return { success: true };
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            throw error;
        }
    }

    // ============================================
    // API МЕТОДЫ - ЭКСПОРТ/ИМПОРТ
    // ============================================

    /**
     * Экспортировать все данные
     */
    async exportData() {
        try {
            const blob = await this.request('/export', { method: 'GET' });

            // Создаем ссылку для скачивания
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `budget_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            console.log('✅ Данные экспортированы');
            return { success: true };
        } catch (error) {
            console.error('Ошибка экспорта данных:', error);
            throw error;
        }
    }

    /**
     * Получить список бэкапов
     */
    async listBackups() {
        try {
            const data = await this.request('/backups', { method: 'GET' });
            return data.backups;
        } catch (error) {
            console.error('Ошибка получения списка бэкапов:', error);
            throw error;
        }
    }

    // ============================================
    // LOCALSTORAGE МЕТОДЫ (FALLBACK)
    // ============================================

    loadCategoriesFromLocalStorage() {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.CATEGORIES);
        return data ? JSON.parse(data) : { categories: [] };
    }

    saveCategoriesToLocalStorage(categories) {
        const data = {
            categories: categories,
            lastSync: new Date().toISOString()
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.CATEGORIES, JSON.stringify(data));
    }

    loadExpensesFromLocalStorage() {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.EXPENSES);
        return data ? JSON.parse(data) : { expenses: [] };
    }

    saveExpensesToLocalStorage(expenses) {
        const data = {
            expenses: expenses,
            lastSync: new Date().toISOString()
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.EXPENSES, JSON.stringify(data));
    }

    loadConfigFromLocalStorage() {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.CONFIG);
        return data ? JSON.parse(data) : {};
    }

    saveConfigToLocalStorage(config) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.CONFIG, JSON.stringify(config));
    }

    loadSnapshotsFromLocalStorage() {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.SNAPSHOTS);
        return data ? JSON.parse(data) : [];
    }

    saveSnapshotsToLocalStorage(snapshots) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.SNAPSHOTS, JSON.stringify(Array.isArray(snapshots) ? snapshots : []));
    }
}

// Создаем единственный экземпляр
export const BudgetAPI = new BudgetAPIClass();
export default BudgetAPI;

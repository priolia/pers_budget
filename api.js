/**
 * API модуль для работы с Budget API Server
 *
 * Использование:
 * 1. Установите API_BASE_URL и API_KEY
 * 2. Замените вызовы localStorage на BudgetAPI.loadData() и BudgetAPI.saveData()
 */

const BudgetAPI = {
    // ========================================
    // НАСТРОЙКИ (ИЗМЕНИТЕ ПОД СВОЙ СЕРВЕР)
    // ========================================

    // URL вашего API сервера (замените YOUR_SERVER_IP на IP вашего сервера)
    API_BASE_URL: 'https://yarn-helps-rising-resumes.trycloudflare.com/api',

    // API ключ (должен совпадать с .env файлом на сервере)
    API_KEY: 'BdgtAPI_7k9mX2pL5nQ8wR4vY6zT3hJ0sF1dG',

    // Режим работы
    USE_API: true,  // false = только localStorage (для тестирования)

    // Состояние
    isOnline: true,
    lastSyncTime: null,

    // ========================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ========================================

    /**
     * Выполнить запрос к API
     */
    async request(endpoint, options = {}) {
        const url = `${this.API_BASE_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': this.API_KEY,
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

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
    },

    /**
     * Проверить доступность API
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/health`);
            this.isOnline = response.ok;
            return this.isOnline;
        } catch (error) {
            console.warn('API недоступен, работаем в оффлайн режиме');
            this.isOnline = false;
            return false;
        }
    },

    // ========================================
    // ОСНОВНЫЕ МЕТОДЫ
    // ========================================

    /**
     * Загрузить все данные
     * @returns {Object} Данные приложения
     */
    async loadData() {
        // Если API отключен, используем localStorage
        if (!this.USE_API) {
            return this.loadFromLocalStorage();
        }

        try {
            // Пытаемся загрузить с сервера
            const data = await this.request('/data', { method: 'GET' });

            this.isOnline = true;
            this.lastSyncTime = new Date();

            // Сохраняем копию в localStorage на случай оффлайна
            this.saveToLocalStorage(data);

            console.log('✅ Данные загружены с сервера');
            return data;

        } catch (error) {
            console.warn('⚠️ Не удалось загрузить данные с сервера, используем локальные');
            this.isOnline = false;

            // Fallback на localStorage
            return this.loadFromLocalStorage();
        }
    },

    /**
     * Сохранить все данные
     * @param {Object} data - Данные приложения
     * @returns {Boolean} Успешность сохранения
     */
    async saveData(data) {
        // Сохраняем в localStorage в любом случае
        this.saveToLocalStorage(data);

        // Если API отключен, только localStorage
        if (!this.USE_API) {
            return true;
        }

        try {
            // Пытаемся сохранить на сервер
            const response = await this.request('/data', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            this.isOnline = true;
            this.lastSyncTime = new Date();

            console.log('✅ Данные сохранены на сервере');
            return true;

        } catch (error) {
            console.warn('⚠️ Не удалось сохранить на сервер, данные сохранены локально');
            this.isOnline = false;
            return false;
        }
    },

    /**
     * Экспортировать данные (скачать JSON)
     */
    async exportData() {
        if (!this.USE_API || !this.isOnline) {
            // Экспорт из localStorage
            const data = this.loadFromLocalStorage();
            this.downloadJSON(data, `budget_export_${this.formatDate(new Date())}.json`);
            return;
        }

        try {
            const blob = await this.request('/export');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `budget_export_${this.formatDate(new Date())}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('✅ Данные экспортированы');
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            alert('Ошибка экспорта данных');
        }
    },

    /**
     * Синхронизировать локальные данные с сервером
     */
    async sync() {
        if (!this.USE_API) {
            return;
        }

        try {
            // Загружаем данные с сервера
            const serverData = await this.request('/data', { method: 'GET' });

            // Загружаем локальные данные
            const localData = this.loadFromLocalStorage();

            // Простая стратегия: сервер всегда прав (для одного пользователя это ок)
            this.saveToLocalStorage(serverData);

            this.isOnline = true;
            this.lastSyncTime = new Date();

            console.log('✅ Синхронизация завершена');
            return serverData;

        } catch (error) {
            console.warn('⚠️ Синхронизация не удалась');
            this.isOnline = false;
            return null;
        }
    },

    // ========================================
    // РАБОТА С LOCALSTORAGE
    // ========================================

    /**
     * Загрузить данные из localStorage
     */
    loadFromLocalStorage() {
        const savedData = localStorage.getItem('budgetAppData');
        const savedExpenses = localStorage.getItem('budgetAppExpenses');

        let data = savedData ? JSON.parse(savedData) : null;
        let expenses = savedExpenses ? JSON.parse(savedExpenses) : [];

        if (!data) {
            // Первый запуск - возвращаем дефолтную структуру
            return {
                categories: [],
                expenses: [],
                settings: {
                    rateEURtoUAH: 41.5,
                    rateEURtoBGN: 1.96,
                    taxRate: 7.3,
                    limitFop: 2200,
                    limitCrypto: 1100,
                    incomeEuro: 3300,
                    lastRatesUpdate: null
                }
            };
        }

        // Объединяем данные
        return {
            categories: data.categories || [],
            expenses: expenses,
            settings: {
                rateEURtoUAH: data.rateEURtoUAH || 41.5,
                rateEURtoBGN: data.rateEURtoBGN || 1.96,
                taxRate: data.taxRate || 7.3,
                limitFop: data.limitFop || 2200,
                limitCrypto: data.limitCrypto || 1100,
                incomeEuro: data.incomeEuro || 3300,
                totalIncomeUAH: data.totalIncomeUAH,
                totalIncomeBGN: data.totalIncomeBGN,
                lastRatesUpdate: data.lastRatesUpdate
            }
        };
    },

    /**
     * Сохранить данные в localStorage
     */
    saveToLocalStorage(data) {
        // Разделяем на две части как в оригинальном приложении
        const budgetData = {
            categories: data.categories,
            rateEURtoUAH: data.settings.rateEURtoUAH,
            rateEURtoBGN: data.settings.rateEURtoBGN,
            taxRate: data.settings.taxRate,
            limitFop: data.settings.limitFop,
            limitCrypto: data.settings.limitCrypto,
            incomeEuro: data.settings.incomeEuro,
            totalIncomeUAH: data.settings.totalIncomeUAH,
            totalIncomeBGN: data.settings.totalIncomeBGN,
            lastRatesUpdate: data.settings.lastRatesUpdate
        };

        localStorage.setItem('budgetAppData', JSON.stringify(budgetData));
        localStorage.setItem('budgetAppExpenses', JSON.stringify(data.expenses));
    },

    // ========================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ========================================

    /**
     * Форматировать дату для имени файла
     */
    formatDate(date) {
        return date.toISOString().split('T')[0].replace(/-/g, '');
    },

    /**
     * Скачать JSON файл
     */
    downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Получить информацию о статусе
     */
    getStatus() {
        return {
            online: this.isOnline,
            lastSync: this.lastSyncTime,
            apiEnabled: this.USE_API
        };
    }
};

// Экспортируем для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BudgetAPI;
}

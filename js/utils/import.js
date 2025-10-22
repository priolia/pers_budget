/**
 * Утилиты для импорта данных
 */

import { DataManager } from '../dataManager.js';
import { SyncManager } from '../sync.js';
import { CONFIG } from '../config.js';

export class ImportUtils {
    /**
     * Импортировать данные из файла
     * @param {File} file - Файл для импорта
     */
    static async importFromFile(file) {
        try {
            // Читаем файл
            const text = await file.text();
            const data = JSON.parse(text);

            // Валидация структуры
            const validation = this.validateImportData(data);

            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Показываем превью и диалог выбора стратегии
            const strategy = await this.showImportDialog(data);

            if (!strategy) {
                // Пользователь отменил импорт
                return { success: false, cancelled: true };
            }

            // Создаем бэкап перед импортом
            if (strategy.createBackup) {
                await this.createBackup();
            }

            // Выполняем импорт
            let result;

            if (strategy.mode === 'merge') {
                result = await this.mergeImportedData(data);
            } else {
                result = await this.replaceWithImportedData(data);
            }

            // Сохраняем на сервер
            await SyncManager.pushToServer();

            console.log('✅ Импорт завершен успешно');

            return {
                success: true,
                ...result
            };

        } catch (error) {
            console.error('❌ Ошибка импорта:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Валидация структуры импортируемых данных
     */
    static validateImportData(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Неверный формат файла' };
        }

        // Проверяем наличие хотя бы одного раздела данных
        if (!data.categories && !data.expenses && !data.config) {
            return { valid: false, error: 'Файл не содержит данных для импорта' };
        }

        // Проверяем структуру категорий
        if (data.categories) {
            if (!Array.isArray(data.categories)) {
                return { valid: false, error: 'Неверный формат категорий' };
            }

            for (const cat of data.categories) {
                if (!cat.name) {
                    return { valid: false, error: 'Категория без названия' };
                }
            }
        }

        // Проверяем структуру трат
        if (data.expenses) {
            if (!Array.isArray(data.expenses)) {
                return { valid: false, error: 'Неверный формат трат' };
            }

            for (const exp of data.expenses) {
                if (!exp.amount && !exp.amountEUR) {
                    return { valid: false, error: 'Трата без суммы' };
                }
            }
        }

        return { valid: true };
    }

    /**
     * Показать диалог выбора стратегии импорта
     */
    static async showImportDialog(data) {
        return new Promise((resolve) => {
            // Создаем модальное окно
            const modal = document.createElement('div');
            modal.className = 'import-modal';
            modal.innerHTML = `
                <div class="import-modal-content">
                    <h3>📥 Импорт данных</h3>

                    <div class="import-preview">
                        <h4>Содержимое файла:</h4>
                        <ul>
                            ${data.categories ? `<li>Категорий: <strong>${data.categories.length}</strong></li>` : ''}
                            ${data.expenses ? `<li>Трат: <strong>${data.expenses.length}</strong></li>` : ''}
                            ${data.config ? `<li>Настройки: <strong>Да</strong></li>` : ''}
                        </ul>

                        ${this.detectOldFormat(data) ? `
                            <div class="warning">
                                ⚠️ Обнаружен старый формат данных без ID.<br>
                                Данные будут автоматически мигрированы.
                            </div>
                        ` : ''}
                    </div>

                    <div class="import-strategy">
                        <h4>Стратегия импорта:</h4>

                        <label class="radio-option">
                            <input type="radio" name="strategy" value="merge" checked>
                            <div>
                                <strong>Объединить с текущими данными</strong>
                                <p>При совпадении ID будет выбрана более новая версия по времени изменения</p>
                            </div>
                        </label>

                        <label class="radio-option">
                            <input type="radio" name="strategy" value="replace">
                            <div>
                                <strong>Заменить все данные</strong>
                                <p class="warning">⚠️ Все текущие данные будут удалены!</p>
                            </div>
                        </label>
                    </div>

                    <div class="import-options">
                        <label>
                            <input type="checkbox" id="createBackup" checked>
                            Создать бэкап перед импортом
                        </label>
                    </div>

                    <div class="import-actions">
                        <button class="btn btn-secondary" id="cancelImport">Отмена</button>
                        <button class="btn btn-primary" id="confirmImport">Импортировать</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Обработчик отмены
            document.getElementById('cancelImport').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });

            // Обработчик подтверждения
            document.getElementById('confirmImport').addEventListener('click', () => {
                const strategy = document.querySelector('input[name="strategy"]:checked').value;
                const createBackup = document.getElementById('createBackup').checked;

                document.body.removeChild(modal);

                resolve({
                    mode: strategy,
                    createBackup: createBackup
                });
            });
        });
    }

    /**
     * Определить старый формат данных
     */
    static detectOldFormat(data) {
        // Проверяем есть ли ID у категорий и трат
        if (data.categories && data.categories.length > 0) {
            if (!data.categories[0].id) {
                return true;
            }
        }

        if (data.expenses && data.expenses.length > 0) {
            if (!data.expenses[0].id) {
                return true;
            }
        }

        return false;
    }

    /**
     * Объединить импортируемые данные с текущими
     */
    static async mergeImportedData(data) {
        let categories = data.categories || [];
        let expenses = data.expenses || [];

        // Мигрируем старый формат если нужно
        if (this.detectOldFormat(data)) {
            const migrated = this.migrateOldFormat(data);
            categories = migrated.categories;
            expenses = migrated.expenses;
        }

        // Получаем текущие данные
        const currentCategories = DataManager.getCategories();
        const currentExpenses = DataManager.getExpenses();

        // Мёрджим категории
        const mergedCategories = this.mergeArrays(currentCategories, categories);

        // Мёрджим траты
        const mergedExpenses = this.mergeArrays(currentExpenses, expenses);

        // Обновляем DataManager
        DataManager.setCategories(mergedCategories);
        DataManager.setExpenses(mergedExpenses);

        // Обновляем конфиг если есть
        if (data.config) {
            const currentConfig = DataManager.getConfig();
            const mergedConfig = {
                ...currentConfig,
                ...data.config,
                // Пароль не импортируем
                passwordHash: currentConfig.passwordHash
            };
            DataManager.setConfig(mergedConfig);
        }

        return {
            categoriesAdded: mergedCategories.length - currentCategories.length,
            expensesAdded: mergedExpenses.length - currentExpenses.length,
            categoriesTotal: mergedCategories.length,
            expensesTotal: mergedExpenses.length
        };
    }

    /**
     * Заменить все данные импортируемыми
     */
    static async replaceWithImportedData(data) {
        let categories = data.categories || [];
        let expenses = data.expenses || [];

        // Мигрируем старый формат если нужно
        if (this.detectOldFormat(data)) {
            const migrated = this.migrateOldFormat(data);
            categories = migrated.categories;
            expenses = migrated.expenses;
        }

        // Заменяем все данные
        DataManager.setCategories(categories);
        DataManager.setExpenses(expenses);

        // Обновляем конфиг если есть
        if (data.config) {
            const currentConfig = DataManager.getConfig();
            const newConfig = {
                ...currentConfig,
                ...data.config,
                // Пароль не импортируем
                passwordHash: currentConfig.passwordHash
            };
            DataManager.setConfig(newConfig);
        }

        return {
            categoriesTotal: categories.length,
            expensesTotal: expenses.length
        };
    }

    /**
     * Мёрджить массивы по ID и timestamp
     */
    static mergeArrays(currentItems, newItems) {
        const merged = new Map();

        // Добавляем все текущие элементы
        currentItems.forEach(item => {
            merged.set(item.id, item);
        });

        // Добавляем/обновляем новыми элементами
        newItems.forEach(newItem => {
            const currentItem = merged.get(newItem.id);

            if (!currentItem) {
                // Новый элемент
                merged.set(newItem.id, newItem);
            } else {
                // Элемент существует - сравниваем по времени
                const currentTime = new Date(currentItem.updatedAt || 0);
                const newTime = new Date(newItem.updatedAt || 0);

                if (newTime > currentTime) {
                    merged.set(newItem.id, newItem);
                }
            }
        });

        return Array.from(merged.values());
    }

    /**
     * Мигрировать старый формат на новый с ID
     */
    static migrateOldFormat(data) {
        console.log('🔄 Миграция старого формата данных...');

        const categories = (data.categories || []).map(cat => ({
            ...cat,
            id: cat.id || DataManager.generateId(CONFIG.ID_FORMATS.CATEGORY),
            createdAt: cat.createdAt || new Date().toISOString(),
            updatedAt: cat.updatedAt || new Date().toISOString()
        }));

        // Создаем мапу имя категории -> ID
        const categoryNameToId = {};
        categories.forEach(cat => {
            categoryNameToId[cat.name] = cat.id;
        });

        const expenses = (data.expenses || []).map(exp => {
            // Определяем categoryId
            let categoryId = exp.categoryId;

            if (!categoryId) {
                if (exp.category) {
                    // Старый формат - ищем по имени
                    categoryId = categoryNameToId[exp.category];
                }
            }

            return {
                ...exp,
                id: exp.id || DataManager.generateId(CONFIG.ID_FORMATS.EXPENSE),
                categoryId: categoryId,
                createdAt: exp.createdAt || new Date().toISOString(),
                updatedAt: exp.updatedAt || new Date().toISOString()
            };
        });

        console.log(`✅ Мигрировано: ${categories.length} категорий, ${expenses.length} трат`);

        return { categories, expenses };
    }

    /**
     * Создать бэкап текущих данных
     */
    static async createBackup() {
        try {
            const ExportUtils = (await import('./export.js')).default;
            ExportUtils.exportToJSON();
            console.log('✅ Бэкап создан');
        } catch (error) {
            console.error('⚠️ Не удалось создать бэкап:', error);
        }
    }

    /**
     * Открыть file picker для импорта
     */
    static async openFilePicker() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const result = await this.importFromFile(file);
                    resolve(result);
                } else {
                    reject(new Error('Файл не выбран'));
                }
            };

            input.click();
        });
    }
}

export default ImportUtils;

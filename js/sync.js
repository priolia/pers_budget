/**
 * SyncManager v2.0
 * Умная двусторонняя синхронизация с разрешением конфликтов
 */

import { BudgetAPI } from './api.js';
import { DataManager } from './dataManager.js';

class SyncManagerClass {
    constructor() {
        this.isSyncing = false;
        this.lastSyncTime = null;
        this.conflicts = [];
    }

    // ============================================
    // ОСНОВНАЯ СИНХРОНИЗАЦИЯ
    // ============================================

    /**
     * Выполнить умную синхронизацию
     * 1. Загрузить данные с сервера
     * 2. Мёрдж с локальными данными по timestamp
     * 3. Разрешить конфликты (если есть)
     * 4. Отправить итоговые данные на сервер
     */
    async smartSync(options = {}) {
        if (this.isSyncing) {
            console.log('⚠️ Синхронизация уже выполняется');
            return { success: false, message: 'Синхронизация уже выполняется' };
        }

        this.isSyncing = true;
        this.conflicts = [];

        try {
            console.log('🔄 Начинаем синхронизацию...');

            // 1. Загрузить данные с сервера
            const serverData = await BudgetAPI.fetchAll();

            // 2. Получить локальные данные
            const localCategories = DataManager.getCategories();
            const localExpenses = DataManager.getExpenses();
            const localConfig = DataManager.getConfig();

            // 3. Мёрдж категорий
            const mergedCategories = await this.mergeItems(
                localCategories,
                serverData.categories,
                'categories',
                options
            );

            // 4. Мёрдж трат
            const mergedExpenses = await this.mergeItems(
                localExpenses,
                serverData.expenses,
                'expenses',
                options
            );

            // 5. Мёрдж конфига (конфиг не конфликтует, берем новейший)
            const mergedConfig = this.mergeConfig(localConfig, serverData.config);

            // 5b. Merge snapshots (append-only log, union by id)
            const localSnapshots = DataManager.getSnapshots();
            const serverSnapshots = Array.isArray(serverData.snapshots) ? serverData.snapshots : [];
            const snapById = new Map();
            [...serverSnapshots, ...localSnapshots].forEach(snap => {
                if (snap && snap.id) snapById.set(snap.id, snap);
            });
            const mergedSnapshots = Array.from(snapById.values());

            // 6. Обновить локальные данные
            DataManager.setCategories(mergedCategories);
            DataManager.setExpenses(mergedExpenses);
            DataManager.setConfig(mergedConfig);
            DataManager.setSnapshots(mergedSnapshots);

            // 7. Отправить на сервер
            await BudgetAPI.pushAll(mergedCategories, mergedExpenses, mergedConfig, mergedSnapshots);

            this.lastSyncTime = new Date();

            console.log('✅ Синхронизация завершена успешно');

            return {
                success: true,
                message: 'Синхронизация завершена',
                timestamp: this.lastSyncTime,
                stats: {
                    categories: mergedCategories.length,
                    expenses: mergedExpenses.length,
                    conflicts: this.conflicts.length
                }
            };

        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            return {
                success: false,
                message: `Ошибка синхронизации: ${error.message}`,
                error: error
            };
        } finally {
            this.isSyncing = false;
        }
    }

    // ============================================
    // МЁРДЖ ДАННЫХ
    // ============================================

    /**
     * Мёрджить элементы по timestamp
     * Если локальная запись новее - она приоритетнее
     */
    async mergeItems(localItems, serverItems, type, options = {}) {
        const merged = new Map();

        // Сначала добавляем все серверные элементы
        serverItems.forEach(item => {
            merged.set(item.id, { ...item, source: 'server' });
        });

        // Затем проверяем локальные элементы
        for (const localItem of localItems) {
            const serverItem = merged.get(localItem.id);

            if (!serverItem) {
                // Локальный элемент новый, добавляем
                merged.set(localItem.id, { ...localItem, source: 'local' });
            } else {
                // Элемент есть и локально, и на сервере - сравниваем по времени
                const localTime = new Date(localItem.updatedAt);
                const serverTime = new Date(serverItem.updatedAt);

                if (localTime > serverTime) {
                    // Локальная версия новее
                    merged.set(localItem.id, { ...localItem, source: 'local' });
                } else if (localTime < serverTime) {
                    // Серверная версия новее
                    merged.set(localItem.id, { ...serverItem, source: 'server' });
                } else {
                    // Времена совпадают - проверяем содержимое
                    if (JSON.stringify(localItem) !== JSON.stringify(serverItem)) {
                        // Есть конфликт - нужно разрешить
                        const resolved = await this.resolveConflict(
                            localItem,
                            serverItem,
                            type,
                            options
                        );
                        merged.set(localItem.id, resolved);
                    } else {
                        // Данные идентичны
                        merged.set(localItem.id, { ...localItem, source: 'same' });
                    }
                }
            }
        }

        // Удаляем служебное поле source
        return Array.from(merged.values()).map(item => {
            const { source, ...cleanItem } = item;
            return cleanItem;
        });
    }

    /**
     * Мёрджить конфигурацию
     */
    mergeConfig(localConfig, serverConfig) {
        // Для конфига просто берем данные с более поздней синхронизацией
        const localSync = localConfig.lastSync ? new Date(localConfig.lastSync) : new Date(0);
        const serverSync = serverConfig.lastSync ? new Date(serverConfig.lastSync) : new Date(0);

        if (localSync > serverSync) {
            return localConfig;
        } else {
            return serverConfig;
        }
    }

    // ============================================
    // РАЗРЕШЕНИЕ КОНФЛИКТОВ
    // ============================================

    /**
     * Разрешить конфликт между локальной и серверной версией
     */
    async resolveConflict(localItem, serverItem, type, options = {}) {
        // Если включен автоматический режим - берем новейшую по timestamp
        if (options.autoResolve) {
            const localTime = new Date(localItem.updatedAt);
            const serverTime = new Date(serverItem.updatedAt);
            return localTime >= serverTime ? localItem : serverItem;
        }

        // Сохраняем конфликт для отображения пользователю
        this.conflicts.push({
            type: type,
            local: localItem,
            server: serverItem
        });

        // По умолчанию берем локальную версию (безопаснее)
        console.log(`⚠️ Обнаружен конфликт в ${type}:`, localItem.id);
        return localItem;
    }

    /**
     * Показать диалог разрешения конфликтов
     */
    async showConflictDialog(conflict) {
        return new Promise((resolve) => {
            // Создаем модальное окно
            const modal = document.createElement('div');
            modal.className = 'conflict-modal';
            modal.innerHTML = `
                <div class="conflict-modal-content">
                    <h3>⚠️ Конфликт синхронизации</h3>

                    <div class="conflict-info">
                        <p>Обнаружены конфликтующие изменения:</p>

                        <div class="conflict-versions">
                            <div class="version local">
                                <h4>💻 Локальная версия</h4>
                                <pre>${JSON.stringify(conflict.local, null, 2)}</pre>
                                <p class="timestamp">Изменено: ${new Date(conflict.local.updatedAt).toLocaleString('ru-RU')}</p>
                            </div>

                            <div class="version server">
                                <h4>🌐 Серверная версия</h4>
                                <pre>${JSON.stringify(conflict.server, null, 2)}</pre>
                                <p class="timestamp">Изменено: ${new Date(conflict.server.updatedAt).toLocaleString('ru-RU')}</p>
                            </div>
                        </div>
                    </div>

                    <div class="conflict-actions">
                        <p>Какую версию использовать?</p>
                        <button class="btn btn-primary" data-choice="local">Локальную (новее)</button>
                        <button class="btn btn-secondary" data-choice="server">Серверную</button>
                    </div>

                    <label>
                        <input type="checkbox" id="applyToAll"> Применить ко всем конфликтам
                    </label>
                </div>
            `;

            document.body.appendChild(modal);

            // Обработчики кнопок
            modal.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const choice = btn.dataset.choice;
                    const applyToAll = document.getElementById('applyToAll').checked;

                    document.body.removeChild(modal);

                    resolve({
                        choice: choice,
                        applyToAll: applyToAll,
                        resolved: choice === 'local' ? conflict.local : conflict.server
                    });
                });
            });
        });
    }

    /**
     * Разрешить все конфликты с пользователем
     */
    async resolveAllConflicts() {
        if (this.conflicts.length === 0) {
            return [];
        }

        const resolved = [];
        let applyToAllChoice = null;

        for (const conflict of this.conflicts) {
            let result;

            if (applyToAllChoice) {
                // Применяем выбор ко всем
                result = {
                    choice: applyToAllChoice,
                    resolved: applyToAllChoice === 'local' ? conflict.local : conflict.server
                };
            } else {
                // Спрашиваем пользователя
                result = await this.showConflictDialog(conflict);

                if (result.applyToAll) {
                    applyToAllChoice = result.choice;
                }
            }

            resolved.push(result.resolved);
        }

        this.conflicts = [];
        return resolved;
    }

    // ============================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    /**
     * Получить статус синхронизации
     */
    getStatus() {
        return {
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime,
            isOnline: BudgetAPI.isOnline,
            hasConflicts: this.conflicts.length > 0,
            conflictsCount: this.conflicts.length
        };
    }

    /**
     * Принудительная отправка локальных данных на сервер
     */
    async pushToServer() {
        try {
            const categories = DataManager.getCategories();
            const expenses = DataManager.getExpenses();
            const config = DataManager.getConfig();

            await BudgetAPI.pushAll(categories, expenses, config);

            console.log('✅ Данные отправлены на сервер');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка отправки данных:', error);
            return { success: false, error: error };
        }
    }

    /**
     * Принудительная загрузка данных с сервера
     */
    async pullFromServer() {
        try {
            const serverData = await BudgetAPI.fetchAll();

            DataManager.setCategories(serverData.categories);
            DataManager.setExpenses(serverData.expenses);
            DataManager.setConfig(serverData.config);
            DataManager.setSnapshots(serverData.snapshots);

            console.log('✅ Данные загружены с сервера');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            return { success: false, error: error };
        }
    }
}

// Создаем единственный экземпляр
export const SyncManager = new SyncManagerClass();
export default SyncManager;

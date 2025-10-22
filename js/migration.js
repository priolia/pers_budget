/**
 * Модуль миграции данных на формат v2.0 с ID
 */

import { DataManager } from './dataManager.js';
import { SyncManager } from './sync.js';
import { BudgetAPI } from './api.js';

export class MigrationManager {
    /**
     * Проверить нужна ли миграция
     */
    static needsMigration() {
        return DataManager.needsMigration();
    }

    /**
     * Показать диалог миграции
     */
    static async showMigrationDialog() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'migration-modal';
            modal.innerHTML = `
                <div class="migration-modal-content">
                    <h3>🔄 Миграция данных</h3>

                    <div class="migration-info">
                        <p>Ваши данные используют старый формат.</p>
                        <p>Необходимо выполнить миграцию на новый формат с уникальными ID для каждой категории и траты.</p>

                        <div class="migration-benefits">
                            <h4>Что даст миграция:</h4>
                            <ul>
                                <li>✅ Исправит проблему потери данных при фильтрации</li>
                                <li>✅ Обеспечит корректное сохранение изменений категорий</li>
                                <li>✅ Включит создание бэкапов</li>
                                <li>✅ Улучшит синхронизацию данных</li>
                            </ul>
                        </div>

                        <div class="migration-warning">
                            <p><strong>⚠️ Важно:</strong></p>
                            <ul>
                                <li>Перед миграцией будет создан бэкап текущих данных</li>
                                <li>Процесс миграции необратим</li>
                                <li>После миграции данные будут сохранены на сервер</li>
                            </ul>
                        </div>
                    </div>

                    <div class="migration-actions">
                        <button class="btn btn-secondary" id="skipMigration">Пропустить</button>
                        <button class="btn btn-primary" id="startMigration">Начать миграцию</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('skipMigration').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });

            document.getElementById('startMigration').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
        });
    }

    /**
     * Выполнить миграцию
     */
    static async performMigration() {
        try {
            console.log('🔄 Начинаем миграцию данных...');

            // 1. Показываем индикатор прогресса
            this.showProgressDialog();

            this.updateProgress('Создание бэкапа...', 10);

            // 2. Создаем бэкап перед миграцией
            try {
                const { ExportUtils } = await import('./utils/export.js');
                await ExportUtils.exportToJSON();
            } catch (error) {
                console.warn('⚠️ Не удалось создать бэкап:', error);
            }

            this.updateProgress('Миграция категорий и трат...', 30);

            // 3. Выполняем миграцию
            const result = DataManager.migrateToV2();

            this.updateProgress('Сохранение на сервер...', 60);

            // 4. Сохраняем на сервер
            await SyncManager.pushToServer();

            this.updateProgress('Миграция завершена!', 100);

            // 5. Показываем результат
            setTimeout(() => {
                this.hideProgressDialog();
                this.showSuccessDialog(result);
            }, 500);

            return {
                success: true,
                ...result
            };

        } catch (error) {
            console.error('❌ Ошибка миграции:', error);

            this.hideProgressDialog();
            this.showErrorDialog(error.message);

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Показать диалог прогресса
     */
    static showProgressDialog() {
        const modal = document.createElement('div');
        modal.id = 'migration-progress-modal';
        modal.className = 'migration-modal';
        modal.innerHTML = `
            <div class="migration-modal-content">
                <h3>🔄 Выполняется миграция</h3>

                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <p class="progress-text">Инициализация...</p>
                </div>

                <p class="progress-note">Пожалуйста, не закрывайте страницу</p>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Обновить прогресс
     */
    static updateProgress(text, percentage) {
        const modal = document.getElementById('migration-progress-modal');
        if (!modal) return;

        const fill = modal.querySelector('.progress-fill');
        const textEl = modal.querySelector('.progress-text');

        if (fill) {
            fill.style.width = `${percentage}%`;
        }

        if (textEl) {
            textEl.textContent = text;
        }
    }

    /**
     * Скрыть диалог прогресса
     */
    static hideProgressDialog() {
        const modal = document.getElementById('migration-progress-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
    }

    /**
     * Показать диалог успешной миграции
     */
    static showSuccessDialog(result) {
        const modal = document.createElement('div');
        modal.className = 'migration-modal';
        modal.innerHTML = `
            <div class="migration-modal-content">
                <h3>✅ Миграция завершена успешно!</h3>

                <div class="migration-result">
                    <p>Ваши данные успешно мигрированы на новый формат.</p>

                    <div class="migration-stats">
                        <p>📊 Статистика:</p>
                        <ul>
                            <li>Категорий: ${result.categoriesCount}</li>
                            <li>Трат: ${result.expensesCount}</li>
                        </ul>
                    </div>

                    <p>Все данные сохранены на сервер и доступны для использования.</p>
                </div>

                <div class="migration-actions">
                    <button class="btn btn-primary" id="closeMigrationSuccess">Продолжить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('closeMigrationSuccess').addEventListener('click', () => {
            document.body.removeChild(modal);
            // Перезагружаем страницу чтобы обновить UI
            window.location.reload();
        });
    }

    /**
     * Показать диалог ошибки миграции
     */
    static showErrorDialog(errorMessage) {
        const modal = document.createElement('div');
        modal.className = 'migration-modal';
        modal.innerHTML = `
            <div class="migration-modal-content">
                <h3>❌ Ошибка миграции</h3>

                <div class="migration-error">
                    <p>Произошла ошибка при миграции данных:</p>
                    <pre>${errorMessage}</pre>

                    <p>Пожалуйста, попробуйте еще раз или обратитесь к администратору.</p>
                </div>

                <div class="migration-actions">
                    <button class="btn btn-secondary" id="closeMigrationError">Закрыть</button>
                    <button class="btn btn-primary" id="retryMigration">Повторить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('closeMigrationError').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('retryMigration').addEventListener('click', async () => {
            document.body.removeChild(modal);
            await this.performMigration();
        });
    }

    /**
     * Проверить и запустить миграцию если нужно (автоматически)
     */
    static async checkAndMigrate() {
        if (!this.needsMigration()) {
            console.log('✅ Данные уже в актуальном формате');
            return { success: true, migrated: false };
        }

        console.log('⚠️ Обнаружены данные в старом формате');

        const shouldMigrate = await this.showMigrationDialog();

        if (!shouldMigrate) {
            console.log('ℹ️ Миграция пропущена пользователем');
            return { success: true, migrated: false, skipped: true };
        }

        return await this.performMigration();
    }

    /**
     * Получить статус миграции
     */
    static getMigrationStatus() {
        const needsMigration = this.needsMigration();

        return {
            needsMigration: needsMigration,
            message: needsMigration
                ? '⚠️ Требуется миграция'
                : '✅ Данные в актуальном формате'
        };
    }
}

export default MigrationManager;

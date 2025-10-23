/**
 * UIManager v2.0
 * Управление пользовательским интерфейсом Budget App v2.0
 */

import { DataManager } from './dataManager.js';
import { DateUtils } from './utils/dates.js';
import { CurrencyUtils } from './utils/currency.js';

export class UIManager {
    // ============================================
    // ГРУППА 1: ИНИЦИАЛИЗАЦИЯ
    // ============================================

    /**
     * Инициализация UI
     * Подключение всех обработчиков событий и первичный рендеринг
     */
    static init() {
        console.log('🎨 Инициализация UI...');

        // Подключить обработчики вкладок
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.showTab(tabName);
            });
        });

        // Подключить обработчик селектора периода
        const periodSelector = document.getElementById('period-selector');
        if (periodSelector) {
            periodSelector.addEventListener('change', () => this.changePeriod());
        }

        // Кнопка "Текущий период"
        const currentPeriodBtn = document.getElementById('current-period-btn');
        if (currentPeriodBtn) {
            currentPeriodBtn.addEventListener('click', () => this.setCurrentPeriod());
        }

        // Кнопки категорий
        const addCategoryBtn = document.getElementById('add-category-btn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.addCategory());
        }

        // Кнопки трат
        const addExpenseBtn = document.getElementById('add-expense-btn');
        if (addExpenseBtn) {
            addExpenseBtn.addEventListener('click', () => this.addExpense());
        }

        // Кнопка сохранения настроек
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }

        // Фильтр категорий
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => this.filterExpenses(e.target.value));
        }

        // Обработчики data-action кнопок
        document.querySelectorAll('[data-action="update-rates"]').forEach(btn => {
            btn.addEventListener('click', () => this.updateExchangeRates());
        });

        document.querySelectorAll('[data-action="settings"]').forEach(btn => {
            btn.addEventListener('click', () => this.showTab('settings'));
        });

        document.querySelectorAll('[data-action="logout"]').forEach(btn => {
            btn.addEventListener('click', () => this.logout());
        });

        document.querySelectorAll('[data-action="sync"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const result = await window.BudgetApp.sync();
                if (result.success) {
                    alert('✅ Синхронизация завершена');
                } else {
                    alert('❌ Ошибка синхронизации: ' + result.message);
                }
            });
        });

        document.querySelectorAll('[data-action="export"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await window.BudgetApp.exportData();
            });
        });

        document.querySelectorAll('[data-action="import"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const result = await window.BudgetApp.importData();
                if (result.success) {
                    alert('✅ Импорт завершен');
                    window.location.reload();
                } else if (!result.cancelled) {
                    alert('❌ Ошибка импорта: ' + result.error);
                }
            });
        });

        document.querySelectorAll('[data-action="migrate"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await window.BudgetApp.migrate();
            });
        });

        // Дополнительные кнопки
        const resetCategoriesBtn = document.getElementById('reset-categories-btn');
        if (resetCategoriesBtn) {
            resetCategoriesBtn.addEventListener('click', () => this.resetCategories());
        }

        const clearExpensesBtn = document.getElementById('clear-expenses-btn');
        if (clearExpensesBtn) {
            clearExpensesBtn.addEventListener('click', () => this.clearExpenses());
        }

        const clearAllBtn = document.getElementById('clear-all-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllData());
        }

        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.changePassword());
        }

        // Инициализация данных
        this.initPeriodSelector();
        this.updateExchangeRatesDisplay();
        this.loadSettings();

        // Рендеринг всех таблиц
        this.renderReferenceTable();
        this.renderExpensesTable();
        this.renderBudgetSummary();
        this.updateCategoryFilter();

        console.log('✅ UI инициализирован');
    }

    // ============================================
    // ГРУППА 2: ВКЛАДКИ
    // ============================================

    /**
     * Переключение вкладок
     * @param {string} tabName - Название вкладки (reference, expenses, categories, budget, settings)
     */
    static showTab(tabName) {
        // Скрыть все вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Снять выделение со всех кнопок
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Показать выбранную вкладку
        const tabContent = document.getElementById(tabName + '-tab');
        if (tabContent) {
            tabContent.classList.add('active');
        }

        // Выделить кнопку
        const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if (tabBtn) {
            tabBtn.classList.add('active');
        }

        // Обновить данные для специфичных вкладок
        if (tabName === 'budget') {
            this.renderBudgetSummary();
        } else if (tabName === 'reference') {
            this.renderReferenceTable();
        } else if (tabName === 'expenses') {
            this.renderExpensesTable();
        }
    }

    // ============================================
    // ГРУППА 3: СЕЛЕКТОР ПЕРИОДОВ
    // ============================================

    /**
     * Инициализация селектора периодов
     * Заполнение списка доступных периодов
     */
    static initPeriodSelector() {
        const selector = document.getElementById('period-selector');
        if (!selector) return;

        selector.innerHTML = '';

        const config = DataManager.getConfig();
        const periodStartDay = config.settings?.periodStartDay || config.periodStartDay || 25;

        // Генерируем периоды (последние 24 месяца + 2 вперед)
        const periods = [];
        const now = new Date();

        for (let i = -24; i <= 2; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() + i, periodStartDay);
            const period = DateUtils.getPeriodForDate(date, periodStartDay);
            periods.push(period);
        }

        // Заполнить selector
        periods.forEach(period => {
            const option = document.createElement('option');
            const startMonth = period.periodStart.getMonth();
            const startYear = period.periodStart.getFullYear();
            option.value = `${startYear}-${String(startMonth).padStart(2, '0')}`;
            option.textContent = DateUtils.formatPeriod(period);

            // Выделить текущий период
            if (window.BudgetApp && window.BudgetApp.currentPeriod) {
                const currentStart = window.BudgetApp.currentPeriod.periodStart;
                if (period.periodStart.getTime() === currentStart.getTime()) {
                    option.selected = true;
                }
            }

            selector.appendChild(option);
        });
    }

    /**
     * Обработчик смены периода
     * Обновляет текущий период и перерендеривает таблицы
     */
    static changePeriod() {
        const selector = document.getElementById('period-selector');
        if (!selector) return;

        const value = selector.value;
        const [year, month] = value.split('-').map(Number);

        const config = DataManager.getConfig();
        const periodStartDay = config.settings?.periodStartDay || config.periodStartDay || 25;

        // Создаем дату внутри выбранного периода
        const date = new Date(year, month, periodStartDay);
        const period = DateUtils.getPeriodForDate(date, periodStartDay);

        // Обновить текущий период
        window.BudgetApp.currentPeriod = period;

        // Обновить заголовок
        const titleEl = document.getElementById('expenses-period-title');
        if (titleEl) {
            titleEl.textContent = DateUtils.formatPeriod(period);
        }

        // Перерендерить таблицы
        this.renderReferenceTable();
        this.renderExpensesTable();
        this.renderBudgetSummary();

        console.log(`📅 Период изменен: ${DateUtils.formatPeriod(period)}`);
    }

    /**
     * Установить текущий период
     * Возвращает к текущему периоду
     */
    static setCurrentPeriod() {
        const config = DataManager.getConfig();
        const periodStartDay = config.settings?.periodStartDay || config.periodStartDay || 25;

        const currentPeriod = DateUtils.getCurrentPeriod(periodStartDay);
        window.BudgetApp.currentPeriod = currentPeriod;

        // Обновить селектор
        this.initPeriodSelector();

        // Обновить таблицы
        this.changePeriod();

        console.log('📅 Установлен текущий период');
    }

    // ============================================
    // ГРУППА 4: РЕНДЕРИНГ ТАБЛИЦ
    // ============================================

    /**
     * Рендеринг таблицы справочника категорий
     * Показывает лимиты, проценты, потраченные суммы и остатки (редактируемая)
     */
    static renderReferenceTable() {
        const tbody = document.querySelector('#reference-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const categories = DataManager.getCategories();
        const expenses = DataManager.getExpenses();
        const config = DataManager.getConfig();

        // Фильтруем траты по текущему периоду
        const periodExpenses = DateUtils.filterExpensesByPeriod(expenses, window.BudgetApp.currentPeriod);

        // Суммируем траты по категориям
        const categoryTotals = {};
        periodExpenses.forEach(expense => {
            if (!categoryTotals[expense.categoryId]) {
                categoryTotals[expense.categoryId] = 0;
            }
            categoryTotals[expense.categoryId] += parseFloat(expense.amountEUR || 0);
        });

        // Сортируем категории по порядку
        const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

        sortedCategories.forEach(category => {
            const spent = categoryTotals[category.id] || 0;
            const remaining = Math.max(0, category.limit - spent);
            const percentage = category.limit > 0 ? (spent / category.limit * 100) : 0;

            // Получить курс UAH
            const rateEURtoUAH = config.settings?.rateEURtoUAH || config.rateEURtoUAH || 48.40;
            const amountUAH = category.limit * rateEURtoUAH;

            const row = document.createElement('tr');
            row.dataset.categoryId = category.id;

            // Цветовая индикация
            let colorClass = '';
            if (percentage < 50) {
                colorClass = 'budget-under-50';
            } else if (percentage >= 50 && percentage < 90) {
                colorClass = 'budget-50-90';
            } else if (percentage >= 90 && percentage < 100) {
                colorClass = 'budget-90-100';
            } else if (percentage >= 100) {
                colorClass = 'budget-over-100';
            }
            row.className = colorClass;

            row.innerHTML = `
                <td>
                    <input type="number" min="1" class="category-order" style="width: 60px;"
                           value="${category.order || 1}" data-original="${category.order || 1}">
                </td>
                <td>
                    <input type="text" class="category-name" value="${category.name}"
                           data-original="${category.name}">
                </td>
                <td>
                    <input type="number" step="0.01" min="0" class="category-limit"
                           value="${category.limit}" data-original="${category.limit}"
                           onchange="window.BudgetApp.UIManager.onLimitChange(this)">
                </td>
                <td>
                    <input type="number" step="0.01" min="0" max="100" class="category-percentage"
                           value="${category.percentage || 0}" data-original="${category.percentage || 0}"
                           onchange="window.BudgetApp.UIManager.onPercentageChange(this)">
                </td>
                <td>${amountUAH.toFixed(2)}</td>
                <td>${spent.toFixed(2)}</td>
                <td>${remaining.toFixed(2)}</td>
                <td>${percentage.toFixed(2)}%</td>
                <td>
                    <button class="button-secondary" onclick="window.BudgetApp.UIManager.updateCategory('${category.id}')"
                            title="Сохранить изменения">💾</button>
                    <button class="button-danger" onclick="window.BudgetApp.UIManager.deleteCategory('${category.id}')"
                            title="Удалить категорию">🗑️</button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }


    /**
     * Рендеринг таблицы трат
     * Показывает все траты за текущий период
     */
    static renderExpensesTable() {
        const tbody = document.querySelector('#expenses-table tbody');
        if (!tbody) return;

        // Полная очистка таблицы
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }

        const expenses = DataManager.getExpenses();
        const categories = DataManager.getCategories();
        const config = DataManager.getConfig();

        // Фильтруем траты по текущему периоду
        let periodExpenses = DateUtils.filterExpensesByPeriod(expenses, window.BudgetApp.currentPeriod);

        // Применить фильтр по категории, если выбран
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter && categoryFilter.value) {
            periodExpenses = periodExpenses.filter(expense => expense.categoryId === categoryFilter.value);
        }

        // Сортировка по дате (новые первые)
        periodExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        periodExpenses.forEach(expense => {
            const category = categories.find(cat => cat.id === expense.categoryId);
            const categoryName = category ? category.name : 'Не указана';

            // Расчет оставшегося лимита ПОСЛЕ этой операции
            const spent = this.getCategorySpentAmount(expense.categoryId);
            const remaining = category ? (category.limit - spent) : 0;
            const budgetRefEuro = category ? category.limit : 0;
            const budgetRefPercent = category ? (category.percentage || 0) : 0;

            // Преобразовать дату в формат для datetime-local
            const date = new Date(expense.date);
            const dateValue = date.toISOString().slice(0, 16);

            const row = document.createElement('tr');
            row.className = 'expense-row';
            row.dataset.expenseId = expense.id;

            row.innerHTML = `
                <td><input type="datetime-local" class="expense-date" value="${dateValue}"></td>
                <td><input type="text" class="expense-description" value="${expense.description}"></td>
                <td>
                    <select class="category-select">
                        ${categories.map(cat =>
                            `<option value="${cat.id}" ${cat.id === expense.categoryId ? 'selected' : ''}>${cat.name}</option>`
                        ).join('')}
                    </select>
                </td>
                <td><input type="number" step="0.01" min="0" class="expense-amount" value="${expense.amount}"></td>
                <td>
                    <select class="currency-select">
                        <option value="EUR" ${expense.currency === 'EUR' ? 'selected' : ''}>€</option>
                        <option value="UAH" ${expense.currency === 'UAH' ? 'selected' : ''}>UAH</option>
                        <option value="BGN" ${expense.currency === 'BGN' ? 'selected' : ''}>BGN</option>
                    </select>
                </td>
                <td class="readonly-field">${remaining.toFixed(2)}</td>
                <td class="readonly-field">${budgetRefEuro.toFixed(2)}</td>
                <td class="readonly-field">${budgetRefPercent.toFixed(2)}</td>
                <td>
                    <button class="button-secondary" onclick="window.BudgetApp.UIManager.updateExpenseInline('${expense.id}')" title="Обновить">🔄</button>
                    <button class="button-danger" onclick="window.BudgetApp.UIManager.deleteExpense('${expense.id}')" title="Удалить">🗑️</button>
                </td>
            `;

            tbody.appendChild(row);
        });

        // Обновить заголовок периода
        const titleEl = document.getElementById('expenses-period-title');
        if (titleEl) {
            titleEl.textContent = DateUtils.formatPeriod(window.BudgetApp.currentPeriod);
        }
    }

    /**
     * Рендеринг сводки бюджета
     * Показывает план, факт, процент исполнения по каждой категории
     */
    static renderBudgetSummary() {
        const tbody = document.querySelector('#budget-summary-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const categories = DataManager.getCategories();
        const expenses = DataManager.getExpenses();
        const config = DataManager.getConfig();

        // Фильтруем траты по текущему периоду
        const periodExpenses = DateUtils.filterExpensesByPeriod(expenses, window.BudgetApp.currentPeriod);

        // Суммируем траты по категориям
        const categoryTotals = {};
        periodExpenses.forEach(expense => {
            if (!categoryTotals[expense.categoryId]) {
                categoryTotals[expense.categoryId] = 0;
            }
            categoryTotals[expense.categoryId] += parseFloat(expense.amountEUR || 0);
        });

        let totalPlan = 0;
        let totalFact = 0;
        let totalRemaining = 0;

        // Сортируем категории по порядку
        const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

        sortedCategories.forEach(category => {
            const plan = category.limit;
            const fact = categoryTotals[category.id] || 0;
            const percentage = plan > 0 ? (fact / plan * 100) : 0;
            const remaining = plan - fact;

            const row = document.createElement('tr');

            // Цветовая индикация
            let colorClass = '';
            if (percentage < 50) {
                colorClass = 'budget-under-50';
            } else if (percentage >= 50 && percentage < 90) {
                colorClass = 'budget-50-90';
            } else if (percentage >= 90 && percentage < 100) {
                colorClass = 'budget-90-100';
            } else if (percentage >= 100) {
                colorClass = 'budget-over-100';
            }
            row.className = colorClass;

            row.innerHTML = `
                <td>${category.name}</td>
                <td>${plan.toFixed(2)}</td>
                <td>${fact.toFixed(2)}</td>
                <td>${percentage.toFixed(2)}%</td>
                <td>${remaining.toFixed(2)}</td>
            `;

            tbody.appendChild(row);

            totalPlan += plan;
            totalFact += fact;
            totalRemaining += remaining;
        });

        // Обновить итоговую строку
        document.getElementById('total-plan-euro').textContent = totalPlan.toFixed(2);
        document.getElementById('total-fact-euro').textContent = totalFact.toFixed(2);
        const totalPercentage = totalPlan > 0 ? (totalFact / totalPlan * 100) : 0;
        document.getElementById('total-percentage').textContent = totalPercentage.toFixed(2) + '%';
        document.getElementById('total-remaining').textContent = totalRemaining.toFixed(2);

        // Обновить секцию итогов
        const incomeEuro = config.settings?.incomeEuro || config.incomeEuro || 0;
        document.getElementById('summary-income').textContent = incomeEuro.toFixed(2);
        document.getElementById('summary-fact').textContent = totalFact.toFixed(2);

        // Отложено евро (сумма трат в категории "Инвестиции и сбережения")
        const savingsCategory = categories.find(cat => cat.name === 'Инвестиции и сбережения');
        const savedEuro = savingsCategory ? (categoryTotals[savingsCategory.id] || 0) : 0;
        document.getElementById('saved-euro').textContent = savedEuro.toFixed(2);
    }

    // ============================================
    // ГРУППА 5: КАТЕГОРИИ
    // ============================================

    /**
     * Добавление новой категории
     * Открывает prompt для ввода имени новой категории
     */
    static async addCategory() {
        const categoryName = prompt('Введите название новой категории:');

        if (!categoryName || categoryName.trim() === '') {
            return;
        }

        // Проверка на дубликаты
        const categories = DataManager.getCategories();
        if (categories.some(cat => cat.name === categoryName.trim())) {
            alert('Категория с таким именем уже существует');
            return;
        }

        try {
            const newCategory = DataManager.addCategory({
                name: categoryName.trim(),
                limit: 0,
                percentage: 0,
                order: categories.length + 1
            });

            await window.BudgetApp.saveData();

            this.renderReferenceTable();
            this.updateCategoryFilter();

            console.log('✅ Категория добавлена:', newCategory);
        } catch (error) {
            console.error('❌ Ошибка добавления категории:', error);
            alert('Ошибка добавления категории');
        }
    }

    /**
     * Удаление категории
     * @param {string} categoryId - ID категории
     */
    static async deleteCategory(categoryId) {
        const category = DataManager.getCategoryById(categoryId);
        if (!category) {
            alert('Категория не найдена');
            return;
        }

        if (!confirm(`Вы уверены, что хотите удалить категорию "${category.name}"?`)) {
            return;
        }

        // Проверить, есть ли расходы в этой категории
        const expenses = DataManager.getExpenses();
        const hasExpenses = expenses.some(exp => exp.categoryId === categoryId);

        if (hasExpenses) {
            if (!confirm(`В категории "${category.name}" есть расходы. Они будут потеряны. Продолжить?`)) {
                return;
            }
        }

        try {
            DataManager.deleteCategory(categoryId);
            await window.BudgetApp.saveData();

            this.renderReferenceTable();
            this.renderExpensesTable();
            this.renderBudgetSummary();
            this.updateCategoryFilter();

            console.log('✅ Категория удалена');
        } catch (error) {
            console.error('❌ Ошибка удаления категории:', error);
            alert('Ошибка удаления категории');
        }
    }

    /**
     * Автопересчет лимита при изменении процента
     * @param {HTMLElement} input - Поле ввода процента
     */
    static onPercentageChange(input) {
        const row = input.closest('tr');
        const percentage = parseFloat(input.value) || 0;

        // Получить доход из настроек
        const config = DataManager.getConfig();
        const incomeEuro = config.settings?.incomeEuro || config.incomeEuro || 0;

        // Пересчитать лимит
        const newLimit = (incomeEuro * percentage / 100).toFixed(2);

        // Обновить поле лимита
        const limitInput = row.querySelector('.category-limit');
        if (limitInput) {
            limitInput.value = newLimit;
        }
    }

    /**
     * Автопересчет процента при изменении лимита
     * @param {HTMLElement} input - Поле ввода лимита
     */
    static onLimitChange(input) {
        const row = input.closest('tr');
        const limit = parseFloat(input.value) || 0;

        // Получить доход из настроек
        const config = DataManager.getConfig();
        const incomeEuro = config.settings?.incomeEuro || config.incomeEuro || 0;

        // Пересчитать процент
        const newPercentage = incomeEuro > 0 ? ((limit / incomeEuro) * 100).toFixed(2) : 0;

        // Обновить поле процента
        const percentageInput = row.querySelector('.category-percentage');
        if (percentageInput) {
            percentageInput.value = newPercentage;
        }
    }

    /**
     * Обновление категории
     * @param {string} categoryId - ID категории
     */
    static async updateCategory(categoryId) {
        const row = document.querySelector(`tr[data-category-id="${categoryId}"]`);
        if (!row) return;

        const name = row.querySelector('.category-name').value.trim();
        const limit = parseFloat(row.querySelector('.category-limit').value) || 0;
        const percentage = parseFloat(row.querySelector('.category-percentage').value) || 0;
        const order = parseInt(row.querySelector('.category-order').value) || 1;

        if (!name) {
            alert('Название категории не может быть пустым');
            return;
        }

        // Проверка на дубликаты (кроме текущей)
        const categories = DataManager.getCategories();
        const duplicate = categories.find(cat => cat.id !== categoryId && cat.name === name);
        if (duplicate) {
            alert('Категория с таким именем уже существует');
            return;
        }

        try {
            DataManager.updateCategory(categoryId, {
                name,
                limit,
                percentage,
                order
            });

            await window.BudgetApp.saveData();

            this.renderReferenceTable();
            this.renderExpensesTable();
            this.renderBudgetSummary();
            this.updateCategoryFilter();

            console.log('✅ Категория обновлена');
        } catch (error) {
            console.error('❌ Ошибка обновления категории:', error);
            alert('Ошибка обновления категории');
        }
    }

    // ============================================
    // ГРУППА 6: ТРАТЫ
    // ============================================

    /**
     * Добавление новой траты
     * Добавляет временную строку в таблицу для ввода новой траты
     */
    static addExpense() {
        const tbody = document.querySelector('#expenses-table tbody');
        if (!tbody) return;

        const categories = DataManager.getCategories();
        if (categories.length === 0) {
            alert('Сначала создайте категории');
            return;
        }

        const row = document.createElement('tr');
        row.className = 'expense-row expense-row-unsaved';

        // Текущая дата в формате для datetime-local
        const now = new Date();
        const dateValue = now.toISOString().slice(0, 16);

        row.innerHTML = `
            <td><input type="datetime-local" value="${dateValue}" required></td>
            <td><input type="text" placeholder="Описание" required></td>
            <td>
                <select class="category-select" required>
                    ${categories.map(cat =>
                        `<option value="${cat.id}">${cat.name}</option>`
                    ).join('')}
                </select>
            </td>
            <td><input type="number" step="0.01" min="0" class="amount" placeholder="0.00" required></td>
            <td>
                <select class="currency-select">
                    <option value="EUR">€</option>
                    <option value="UAH">UAH</option>
                    <option value="BGN">BGN</option>
                </select>
            </td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>
                <button class="button-primary" onclick="window.BudgetApp.UIManager.saveExpenseFromRow(this)">💾</button>
                <button class="button-danger" onclick="window.BudgetApp.UIManager.cancelExpense(this)">❌</button>
            </td>
        `;

        tbody.insertBefore(row, tbody.firstChild);

        // Фокус на поле описания
        row.querySelector('input[type="text"]').focus();
    }

    /**
     * Сохранение траты из строки таблицы
     * @param {HTMLElement} button - Кнопка сохранения
     */
    static async saveExpenseFromRow(button) {
        const row = button.closest('tr');

        // Получить данные из полей
        const date = row.querySelector('input[type="datetime-local"]').value;
        const description = row.querySelector('input[type="text"]').value.trim();
        const categoryId = row.querySelector('.category-select').value;
        const amount = parseFloat(row.querySelector('.amount').value);
        const currency = row.querySelector('.currency-select').value;

        // Валидация
        if (!date || !description || !categoryId || !amount || amount <= 0) {
            alert('Заполните все обязательные поля корректно');
            return;
        }

        // Конвертация валют
        const config = DataManager.getConfig();
        const rates = {
            rateEURtoUAH: config.settings?.rateEURtoUAH || config.rateEURtoUAH || 48.40,
            rateEURtoBGN: config.settings?.rateEURtoBGN || config.rateEURtoBGN || 1.9558
        };

        const converted = CurrencyUtils.convertToAll(amount, currency, rates);

        const expenseData = {
            categoryId,
            date: new Date(date).toISOString(),
            description,
            amount,
            currency,
            amountEUR: converted.EUR,
            amountUAH: converted.UAH,
            amountBGN: converted.BGN
        };

        try {
            await this.saveExpense(expenseData);

            // Удалить временную строку
            row.remove();

            // Обновить таблицы
            this.renderExpensesTable();
            this.renderReferenceTable();
            this.renderBudgetSummary();

            console.log('✅ Расход добавлен');
        } catch (error) {
            console.error('❌ Ошибка сохранения расхода:', error);
            alert('Ошибка сохранения расхода');
        }
    }

    /**
     * Сохранение траты в DataManager
     * @param {Object} expenseData - Данные траты
     */
    static async saveExpense(expenseData) {
        try {
            const expense = DataManager.addExpense(expenseData);
            await window.BudgetApp.saveData();

            return expense;
        } catch (error) {
            console.error('❌ Ошибка сохранения траты:', error);
            throw error;
        }
    }

    /**
     * Отмена добавления траты
     * @param {HTMLElement} button - Кнопка отмены
     */
    static cancelExpense(button) {
        const row = button.closest('tr');
        row.remove();
    }

    /**
     * Обновление расхода прямо в таблице (inline)
     * @param {string} expenseId - ID расхода
     */
    static async updateExpenseInline(expenseId) {
        const row = document.querySelector(`tr[data-expense-id="${expenseId}"]`);
        if (!row) {
            alert('Расход не найден');
            return;
        }

        // Получить данные из полей
        const date = row.querySelector('.expense-date').value;
        const description = row.querySelector('.expense-description').value.trim();
        const categoryId = row.querySelector('.category-select').value;
        const amount = parseFloat(row.querySelector('.expense-amount').value);
        const currency = row.querySelector('.currency-select').value;

        // Валидация
        if (!date || !description || !categoryId || !amount || amount <= 0) {
            alert('Заполните все обязательные поля корректно');
            return;
        }

        // Конвертация валют
        const config = DataManager.getConfig();
        const rates = {
            rateEURtoUAH: config.settings?.rateEURtoUAH || config.rateEURtoUAH || 48.40,
            rateEURtoBGN: config.settings?.rateEURtoBGN || config.rateEURtoBGN || 1.9558
        };

        const converted = CurrencyUtils.convertToAll(amount, currency, rates);

        const expenseData = {
            categoryId,
            date: new Date(date).toISOString(),
            description,
            amount,
            currency,
            amountEUR: converted.EUR,
            amountUAH: converted.UAH,
            amountBGN: converted.BGN
        };

        try {
            DataManager.updateExpense(expenseId, expenseData);
            await window.BudgetApp.saveData();

            // Обновить таблицы
            this.renderExpensesTable();
            this.renderReferenceTable();
            this.renderBudgetSummary();

            console.log('✅ Расход обновлен');
        } catch (error) {
            console.error('❌ Ошибка обновления расхода:', error);
            alert('Ошибка обновления расхода');
        }
    }

    /**
     * Редактирование траты
     * @param {string} expenseId - ID траты
     */
    static editExpense(expenseId) {
        const expense = DataManager.getExpenseById(expenseId);
        if (!expense) {
            alert('Расход не найден');
            return;
        }

        const categories = DataManager.getCategories();
        const tbody = document.querySelector('#expenses-table tbody');
        if (!tbody) return;

        // Найти строку с этой тратой
        const rows = tbody.querySelectorAll('tr');
        let targetRow = null;
        for (const row of rows) {
            const editBtn = row.querySelector(`button[onclick*="${expenseId}"]`);
            if (editBtn) {
                targetRow = row;
                break;
            }
        }

        if (!targetRow) return;

        // Преобразовать дату в формат datetime-local
        const date = new Date(expense.date);
        const dateValue = date.toISOString().slice(0, 16);

        // Заменить содержимое строки на редактируемую форму
        targetRow.className = 'expense-row expense-row-unsaved';
        targetRow.innerHTML = `
            <td><input type="datetime-local" value="${dateValue}" required></td>
            <td><input type="text" value="${expense.description}" placeholder="Описание" required></td>
            <td>
                <select class="category-select" required>
                    ${categories.map(cat =>
                        `<option value="${cat.id}" ${cat.id === expense.categoryId ? 'selected' : ''}>${cat.name}</option>`
                    ).join('')}
                </select>
            </td>
            <td><input type="number" step="0.01" min="0" class="amount" value="${expense.amount}" placeholder="0.00" required></td>
            <td>
                <select class="currency-select">
                    <option value="EUR" ${expense.currency === 'EUR' ? 'selected' : ''}>€</option>
                    <option value="UAH" ${expense.currency === 'UAH' ? 'selected' : ''}>UAH</option>
                    <option value="BGN" ${expense.currency === 'BGN' ? 'selected' : ''}>BGN</option>
                </select>
            </td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>
                <button class="button-primary" onclick="window.BudgetApp.UIManager.updateExpenseFromRow(this, '${expenseId}')">💾</button>
                <button class="button-danger" onclick="window.BudgetApp.UIManager.cancelExpenseEdit(this, '${expenseId}')">❌</button>
            </td>
        `;

        // Фокус на поле описания
        targetRow.querySelector('input[type="text"]').focus();
    }

    /**
     * Обновление траты из строки таблицы
     * @param {HTMLElement} button - Кнопка сохранения
     * @param {string} expenseId - ID траты
     */
    static async updateExpenseFromRow(button, expenseId) {
        const row = button.closest('tr');

        // Получить данные из полей
        const date = row.querySelector('input[type="datetime-local"]').value;
        const description = row.querySelector('input[type="text"]').value.trim();
        const categoryId = row.querySelector('.category-select').value;
        const amount = parseFloat(row.querySelector('.amount').value);
        const currency = row.querySelector('.currency-select').value;

        // Валидация
        if (!date || !description || !categoryId || !amount || amount <= 0) {
            alert('Заполните все обязательные поля корректно');
            return;
        }

        // Конвертация валют
        const config = DataManager.getConfig();
        const rates = {
            rateEURtoUAH: config.settings?.rateEURtoUAH || config.rateEURtoUAH || 48.40,
            rateEURtoBGN: config.settings?.rateEURtoBGN || config.rateEURtoBGN || 1.9558
        };

        const converted = CurrencyUtils.convertToAll(amount, currency, rates);

        const expenseData = {
            categoryId,
            date: new Date(date).toISOString(),
            description,
            amount,
            currency,
            amountEUR: converted.EUR,
            amountUAH: converted.UAH,
            amountBGN: converted.BGN
        };

        try {
            DataManager.updateExpense(expenseId, expenseData);
            await window.BudgetApp.saveData();

            // Обновить таблицы
            this.renderExpensesTable();
            this.renderReferenceTable();
            this.renderBudgetSummary();

            console.log('✅ Расход обновлен');
        } catch (error) {
            console.error('❌ Ошибка обновления расхода:', error);
            alert('Ошибка обновления расхода');
        }
    }

    /**
     * Отмена редактирования траты
     * @param {HTMLElement} button - Кнопка отмены
     * @param {string} expenseId - ID траты
     */
    static cancelExpenseEdit(button, expenseId) {
        // Просто перерисовать таблицу
        this.renderExpensesTable();
    }

    /**
     * Удаление траты
     * @param {string} expenseId - ID траты
     */
    static async deleteExpense(expenseId) {
        const expense = DataManager.getExpenseById(expenseId);
        if (!expense) {
            alert('Расход не найден');
            return;
        }

        if (!confirm(`Вы уверены, что хотите удалить расход "${expense.description}"?`)) {
            return;
        }

        try {
            DataManager.deleteExpense(expenseId);
            await window.BudgetApp.saveData();

            this.renderExpensesTable();
            this.renderReferenceTable();
            this.renderBudgetSummary();

            console.log('✅ Расход удален');
        } catch (error) {
            console.error('❌ Ошибка удаления расхода:', error);
            alert('Ошибка удаления расхода');
        }
    }

    // ============================================
    // ГРУППА 7: ОТОБРАЖЕНИЕ ДАННЫХ
    // ============================================

    /**
     * Обновление отображения курсов валют
     * Показывает актуальные курсы валют в UI
     */
    static updateExchangeRatesDisplay() {
        const config = DataManager.getConfig();
        const settings = config.settings || config;

        const rateEURtoUAH = settings.rateEURtoUAH || 48.40;
        const rateEURtoBGN = settings.rateEURtoBGN || 1.9558;
        const lastUpdate = settings.lastRatesUpdate || 'Никогда';

        // Обновить в шапке
        const exchangeRates = document.getElementById('exchange-rates');
        if (exchangeRates) {
            exchangeRates.innerHTML = `
                <div class="rate-item">1 EUR = ${rateEURtoUAH.toFixed(4)} UAH</div>
                <div class="rate-item">1 EUR = ${rateEURtoBGN.toFixed(4)} BGN</div>
            `;
        }

        // Обновить время последнего обновления
        const lastUpdateEl = document.getElementById('last-update');
        if (lastUpdateEl) {
            if (lastUpdate === 'Никогда') {
                lastUpdateEl.textContent = lastUpdate;
            } else {
                lastUpdateEl.textContent = DateUtils.formatDateTime(lastUpdate);
            }
        }

        // Обновить в настройках
        const rateUAHDisplay = document.getElementById('rate-uah-display');
        if (rateUAHDisplay) {
            rateUAHDisplay.textContent = rateEURtoUAH.toFixed(4);
        }

        const rateBGNDisplay = document.getElementById('rate-bgn-display');
        if (rateBGNDisplay) {
            rateBGNDisplay.textContent = rateEURtoBGN.toFixed(4);
        }
    }

    /**
     * Обновление курсов валют с API
     * Загружает актуальные курсы с Monobank API
     */
    static async updateExchangeRates() {
        try {
            console.log('🔄 Обновление курсов валют...');

            const rates = await CurrencyUtils.fetchMonobankRates();

            // Обновить конфигурацию
            const config = DataManager.getConfig();
            const updatedSettings = {
                ...config.settings,
                rateEURtoUAH: rates.rateEURtoUAH,
                rateEURtoBGN: rates.rateEURtoBGN,
                lastRatesUpdate: rates.lastUpdate
            };

            DataManager.updateSettings(updatedSettings);
            await window.BudgetApp.saveData();

            this.updateExchangeRatesDisplay();

            alert(`Курсы обновлены:\n1 EUR = ${rates.rateEURtoUAH.toFixed(4)} UAH\n1 EUR = ${rates.rateEURtoBGN.toFixed(4)} BGN`);

            console.log('✅ Курсы валют обновлены');
        } catch (error) {
            console.error('❌ Ошибка обновления курсов:', error);
            alert('Ошибка обновления курсов валют. Попробуйте позже.');
        }
    }

    /**
     * Обновление фильтра категорий
     * Заполняет селектор фильтра категорий
     */
    static updateCategoryFilter() {
        const categoryFilter = document.getElementById('category-filter');
        if (!categoryFilter) return;

        const currentValue = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="">Все категории</option>';

        const categories = DataManager.getCategories();
        const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

        sortedCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            if (category.id === currentValue) {
                option.selected = true;
            }
            categoryFilter.appendChild(option);
        });
    }

    /**
     * Фильтрация таблицы трат по категории
     * @param {string} categoryId - ID категории для фильтрации (пустая строка = все)
     */
    static filterExpenses(categoryId) {
        this.renderExpensesTable();
    }

    /**
     * Получить сумму потраченных средств по категории
     * @param {string} categoryId - ID категории
     * @param {string} excludeExpenseId - ID траты, которую нужно исключить из расчета
     * @returns {number} Сумма в евро
     */
    static getCategorySpentAmount(categoryId, excludeExpenseId = null) {
        const expenses = DataManager.getExpenses();
        const periodExpenses = DateUtils.filterExpensesByPeriod(expenses, window.BudgetApp.currentPeriod);

        const categoryExpenses = periodExpenses.filter(expense =>
            expense.categoryId === categoryId && expense.id !== excludeExpenseId
        );

        return categoryExpenses.reduce((sum, expense) => sum + parseFloat(expense.amountEUR || 0), 0);
    }

    // ============================================
    // ГРУППА 8: НАСТРОЙКИ
    // ============================================

    /**
     * Загрузка настроек в форму
     * Заполняет поля формы настроек текущими значениями
     */
    static loadSettings() {
        const config = DataManager.getConfig();
        const settings = config.settings || config;

        // День начала периода
        const periodStartDay = document.getElementById('period-start-day');
        if (periodStartDay) {
            periodStartDay.value = settings.periodStartDay || 25;
        }

        // Доход
        const incomeEuro = document.getElementById('income-euro');
        if (incomeEuro) {
            incomeEuro.value = settings.incomeEuro || 0;
        }

        // Лимиты
        const limitFop = document.getElementById('limit-fop');
        if (limitFop) {
            limitFop.value = settings.limitFop || 0;
        }

        const limitCrypto = document.getElementById('limit-crypto');
        if (limitCrypto) {
            limitCrypto.value = settings.limitCrypto || 0;
        }

        // Ставка налога
        const taxRate = document.getElementById('tax-rate');
        if (taxRate) {
            taxRate.value = settings.taxRate || 0;
        }

        // Обновить курсы
        this.updateExchangeRatesDisplay();

        // Отобразить текущий период
        const currentPeriodDisplay = document.getElementById('current-period-display');
        if (currentPeriodDisplay && window.BudgetApp.currentPeriod) {
            currentPeriodDisplay.textContent = DateUtils.formatPeriodFull(window.BudgetApp.currentPeriod);
        }
    }

    /**
     * Сохранение настроек из формы
     * Считывает значения из полей формы и сохраняет в DataManager
     */
    static async saveSettings() {
        const periodStartDay = parseInt(document.getElementById('period-start-day').value) || 25;
        const incomeEuro = parseFloat(document.getElementById('income-euro').value) || 0;
        const limitFop = parseFloat(document.getElementById('limit-fop').value) || 0;
        const limitCrypto = parseFloat(document.getElementById('limit-crypto').value) || 0;
        const taxRate = parseFloat(document.getElementById('tax-rate').value) || 0;

        // Валидация
        if (periodStartDay < 1 || periodStartDay > 28) {
            alert('День начала периода должен быть от 1 до 28');
            return;
        }

        if (incomeEuro < 0 || limitFop < 0 || limitCrypto < 0 || taxRate < 0) {
            alert('Значения не могут быть отрицательными');
            return;
        }

        try {
            const config = DataManager.getConfig();
            const updatedSettings = {
                ...config.settings,
                periodStartDay,
                incomeEuro,
                limitFop,
                limitCrypto,
                taxRate
            };

            DataManager.updateSettings(updatedSettings);

            // Обновить категорию "Налоги" если есть
            const categories = DataManager.getCategories();
            const taxCategory = categories.find(cat => cat.name === 'Налоги');
            if (taxCategory) {
                const taxBase = Math.min(incomeEuro, limitFop);
                const taxLimit = parseFloat((taxBase * taxRate / 100).toFixed(2));

                DataManager.updateCategory(taxCategory.id, {
                    limit: taxLimit,
                    percentage: taxRate
                });
            }

            await window.BudgetApp.saveData();

            // Обновить текущий период если изменился день начала
            const currentPeriod = DateUtils.getCurrentPeriod(periodStartDay);
            window.BudgetApp.currentPeriod = currentPeriod;

            // Обновить UI
            this.initPeriodSelector();
            this.renderReferenceTable();
            this.renderExpensesTable();
            this.renderBudgetSummary();
            this.loadSettings();

            alert('Настройки сохранены');
            console.log('✅ Настройки сохранены');
        } catch (error) {
            console.error('❌ Ошибка сохранения настроек:', error);
            alert('Ошибка сохранения настроек');
        }
    }

    // ============================================
    // ГРУППА 9: ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
    // ============================================

    /**
     * Выход из приложения
     */
    static logout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            // Скрыть основное приложение
            document.getElementById('app').classList.add('hidden');

            // Показать экран входа
            document.getElementById('login-screen').classList.remove('hidden');

            // Очистить пароль из AuthManager
            if (window.BudgetApp && window.BudgetApp.AuthManager) {
                window.BudgetApp.AuthManager.logout();
            }

            console.log('👋 Выход из приложения');
        }
    }

    /**
     * Сброс категорий к дефолтным значениям
     */
    static async resetCategories() {
        if (!confirm('Вы уверены, что хотите сбросить все категории к дефолтным значениям? Это действие необратимо!')) {
            return;
        }

        try {
            // Получить дефолтные категории из CONFIG
            const defaultCategories = window.BudgetApp.CONFIG.DEFAULT_CATEGORIES || [];

            if (defaultCategories.length === 0) {
                alert('Дефолтные категории не найдены');
                return;
            }

            // Установить дефолтные категории
            DataManager.setCategories(defaultCategories);

            await window.BudgetApp.saveData();

            // Обновить UI
            this.renderReferenceTable();
            this.renderBudgetSummary();
            this.updateCategoryFilter();

            alert('Категории сброшены к дефолтным значениям');
            console.log('✅ Категории сброшены');
        } catch (error) {
            console.error('❌ Ошибка сброса категорий:', error);
            alert('Ошибка сброса категорий');
        }
    }

    /**
     * Очистка всех трат текущего периода
     */
    static async clearExpenses() {
        if (!confirm('Вы уверены, что хотите очистить все траты текущего периода? Это действие необратимо!')) {
            return;
        }

        try {
            const expenses = DataManager.getExpenses();
            const currentPeriod = window.BudgetApp.currentPeriod;

            // Удалить траты только текущего периода
            const remainingExpenses = expenses.filter(expense => {
                const expenseDate = new Date(expense.date);
                const expensePeriod = DateUtils.getPeriodForDate(expenseDate, DataManager.getConfig().periodStartDay || 25);

                return !(expensePeriod.year === currentPeriod.year && expensePeriod.month === currentPeriod.month);
            });

            DataManager.setExpenses(remainingExpenses);

            await window.BudgetApp.saveData();

            // Обновить UI
            this.renderExpensesTable();
            this.renderReferenceTable();
            this.renderBudgetSummary();

            alert(`Траты за ${DateUtils.formatPeriod(currentPeriod)} очищены`);
            console.log('✅ Траты очищены');
        } catch (error) {
            console.error('❌ Ошибка очистки трат:', error);
            alert('Ошибка очистки трат');
        }
    }

    /**
     * Очистка всех данных
     */
    static async clearAllData() {
        const confirmation = prompt('⚠️ ВНИМАНИЕ! Это удалит ВСЕ данные (категории, траты, настройки)!\n\nДля подтверждения введите: УДАЛИТЬ ВСЕ');

        if (confirmation !== 'УДАЛИТЬ ВСЕ') {
            alert('Очистка отменена');
            return;
        }

        try {
            // Очистить все данные
            DataManager.setCategories([]);
            DataManager.setExpenses([]);
            DataManager.resetConfig();

            await window.BudgetApp.saveData();

            // Обновить UI
            this.renderExpensesTable();
            this.renderReferenceTable();
            this.renderBudgetSummary();
            this.updateCategoryFilter();
            this.loadSettings();

            alert('Все данные очищены');
            console.log('✅ Все данные очищены');

            // Предложить перезагрузить страницу
            if (confirm('Рекомендуется перезагрузить страницу. Перезагрузить сейчас?')) {
                window.location.reload();
            }
        } catch (error) {
            console.error('❌ Ошибка очистки данных:', error);
            alert('Ошибка очистки данных');
        }
    }

    /**
     * Смена пароля
     */
    static async changePassword() {
        const currentPassword = prompt('Введите текущий пароль:');
        if (!currentPassword) {
            return;
        }

        // Проверить текущий пароль
        const isValid = await window.BudgetApp.AuthManager.checkPassword(currentPassword);
        if (!isValid) {
            alert('Неверный текущий пароль');
            return;
        }

        const newPassword = prompt('Введите новый пароль (минимум 6 символов):');
        if (!newPassword || newPassword.length < 6) {
            alert('Пароль должен содержать минимум 6 символов');
            return;
        }

        const confirmPassword = prompt('Подтвердите новый пароль:');
        if (newPassword !== confirmPassword) {
            alert('Пароли не совпадают');
            return;
        }

        try {
            await window.BudgetApp.AuthManager.changePassword(newPassword);
            alert('Пароль успешно изменен');
            console.log('✅ Пароль изменен');
        } catch (error) {
            console.error('❌ Ошибка смены пароля:', error);
            alert('Ошибка смены пароля: ' + error.message);
        }
    }
}

// Экспорт для использования в window.BudgetApp
export default UIManager;

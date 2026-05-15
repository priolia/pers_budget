/**
 * UIManager v2.0
 * Управление пользовательским интерфейсом Budget App v2.0
 */

import { DataManager } from './dataManager.js';
import { DateUtils } from './utils/dates.js';
import { CurrencyUtils } from './utils/currency.js';

/**
 * Словарь автоматических иконок для новых категорий.
 * Порядок ВАЖЕН: проверка идёт сверху вниз, первое совпадение выигрывает.
 * Поэтому специальные кейсы (типа "Ицо") должны быть раньше общих ("кредит").
 */
const ICON_SUGGESTIONS = [
    // Специальные кейсы — ВПЕРЕДИ
    { keywords: ['ицо'], icon: '🎸' },

    // Еда и быт
    { keywords: ['еда', 'хоз', 'продукт', 'супермарк'], icon: '🛒' },
    { keywords: ['кафе', 'ресторан', 'бар', 'заведен'], icon: '🍔' },

    // Здоровье
    { keywords: ['аптек', 'лекарств', 'бад', 'витамин'], icon: '💊' },
    { keywords: ['врач', 'медицин', 'клиник', 'больниц'], icon: '🏥' },
    { keywords: ['психолог', 'психотерап'], icon: '🧘🏻‍♂️' },

    // Красота
    { keywords: ['ресниц'], icon: '🧏‍♀️' },
    { keywords: ['парикмахер'], icon: '💇🏼‍♀️' },
    { keywords: ['маникюр', 'педикюр', 'ногт', 'салон', 'красот', 'космет'], icon: '💅' },

    // Жильё и обязательные платежи
    { keywords: ['аренд', 'жиль', 'квартир'], icon: '🏠' },
    { keywords: ['коммунал', 'услуг', 'подписк', 'интернет', 'связ'], icon: '💡' },
    { keywords: ['налог', 'фоп', 'отчислен', 'сбор'], icon: '🏛' },

    // Финансы
    { keywords: ['инвест', 'сбережен', 'накоплен', 'депозит'], icon: '💶' },
    { keywords: ['кредит', 'ипотек', 'рассрочк'], icon: '🏦' },

    // Транспорт и шопинг
    { keywords: ['транспорт', 'бензин', 'машин', 'такси', 'авто'], icon: '🚗' },
    { keywords: ['одежд', 'обувь'], icon: '👕' },

    // Прочее
    { keywords: ['сигарет', 'табак', 'вейп'], icon: '🚬' },
    { keywords: ['развлечен', 'кино', 'путешеств', 'отдых'], icon: '🎬' },
    { keywords: ['подар', 'благотвор', 'донат'], icon: '🎁' },
    { keywords: ['образован', 'курс', 'книг', 'обучен'], icon: '📚' },
    { keywords: ['дет', 'школ', 'садик'], icon: '🧒' },
    { keywords: ['разное', 'дом', 'музык', 'прочее'], icon: '📦' }
];

/**
 * Предложить иконку по названию категории. Возвращает emoji или null, если ничего не подошло.
 */
function suggestIconForCategory(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    for (const entry of ICON_SUGGESTIONS) {
        if (entry.keywords.some(kw => lower.includes(kw))) {
            return entry.icon;
        }
    }
    return null;
}

export class UIManager {
    /**
     * Отображение названия категории: «иконка пробел название».
     * Если иконки нет — просто название.
     */
    static formatCategoryName(category) {
        if (!category) return '';
        const icon = (category.icon || '').trim();
        return icon ? `${icon} ${category.name}` : category.name;
    }

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

        // Автоматический расчет дохода при изменении ФОП или Крипты
        const limitFopInput = document.getElementById('limit-fop');
        const limitCryptoInput = document.getElementById('limit-crypto');

        if (limitFopInput) {
            limitFopInput.addEventListener('input', () => this.updateIncomeCalculation());
        }

        if (limitCryptoInput) {
            limitCryptoInput.addEventListener('input', () => this.updateIncomeCalculation());
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

        // ─── Активные периоды: 1 прошлый + текущий + 12 будущих ───
        // Считаем от ТЕКУЩЕГО периода, а не от календарного месяца.
        const currentPeriod = DateUtils.getCurrentPeriod(periodStartDay);
        const currentStartMs = currentPeriod.periodStart.getTime();
        const activePeriods = [];
        // Берём «опорную дату» внутри каждого периода как periodStart + N месяцев
        for (let offset = -1; offset <= 12; offset++) {
            const probe = new Date(currentPeriod.periodStart);
            probe.setMonth(probe.getMonth() + offset);
            const period = DateUtils.getPeriodForDate(probe, periodStartDay);
            activePeriods.push(period);
        }

        // ─── Архивные периоды: всё, что старше "1 прошлый" и где есть траты ───
        const expenses = DataManager.getExpenses();
        const allUsedPeriods = DateUtils.getAvailablePeriods(expenses, periodStartDay);
        const minActiveStartMs = activePeriods[0].periodStart.getTime();
        const archivePeriods = allUsedPeriods
            .filter(p => p.periodStart.getTime() < minActiveStartMs)
            .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime()); // новые архивные первыми

        // ─── Заполняем selector ───
        const addOption = (parent, period) => {
            const option = document.createElement('option');
            const startMonth = period.periodStart.getMonth();
            const startYear = period.periodStart.getFullYear();
            option.value = `${startYear}-${String(startMonth).padStart(2, '0')}`;
            option.textContent = DateUtils.formatPeriodFull(period);

            // Выделить текущий выбранный период
            const selectedStart = (window.BudgetApp && window.BudgetApp.currentPeriod)
                ? window.BudgetApp.currentPeriod.periodStart.getTime()
                : currentStartMs;
            if (period.periodStart.getTime() === selectedStart) {
                option.selected = true;
            }

            parent.appendChild(option);
        };

        // Активные периоды — без группировки
        activePeriods.forEach(p => addOption(selector, p));

        // Архивные — в optgroup, чтобы визуально отделить
        if (archivePeriods.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = '📦 Архив (есть траты)';
            archivePeriods.forEach(p => addOption(optgroup, p));
            selector.appendChild(optgroup);
        }
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

        if (sortedCategories.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="10" class="empty-state">
                <span class="empty-state-icon">📂</span>
                Категорий пока нет — нажмите «Добавить категорию», чтобы начать.
            </td>`;
            tbody.appendChild(tr);
            this.updateTaxCalculation();
            return;
        }

        sortedCategories.forEach((category, index) => {
            const spent = categoryTotals[category.id] || 0;
            const remaining = Math.max(0, category.limit - spent);
            const percentage = category.limit > 0 ? (spent / category.limit * 100) : 0;

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

            const isFirst = index === 0;
            const isLast = index === sortedCategories.length - 1;

            row.innerHTML = `
                <td>
                    <div class="order-controls">
                        <button class="order-btn" title="Вверх"
                                onclick="window.BudgetApp.UIManager.moveCategoryUp('${category.id}')"
                                ${isFirst ? 'disabled' : ''}>▲</button>
                        <span class="order-number">${index + 1}</span>
                        <button class="order-btn" title="Вниз"
                                onclick="window.BudgetApp.UIManager.moveCategoryDown('${category.id}')"
                                ${isLast ? 'disabled' : ''}>▼</button>
                    </div>
                </td>
                <td>
                    <input type="text" class="category-icon" maxlength="4"
                           value="${category.icon || ''}" data-original="${category.icon || ''}"
                           placeholder="—" style="width: 50px; text-align: center; font-size: 18px;">
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

        // Обновить расчет налогов
        this.updateTaxCalculation();
    }

    /**
     * Перенумеровать все категории по их текущему порядку (1, 2, 3, … без дырок)
     * Возвращает массив, отсортированный по новому order
     */
    static _renumberCategories() {
        const categories = [...DataManager.getCategories()]
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        categories.forEach((cat, idx) => {
            const newOrder = idx + 1;
            if (cat.order !== newOrder) {
                DataManager.updateCategory(cat.id, { order: newOrder });
            }
        });
        return categories;
    }

    /**
     * Переместить категорию на одну позицию вверх (с автосохранением)
     */
    static async moveCategoryUp(categoryId) {
        // Сначала перенумеровать, чтобы не было дырок и дублей
        const sorted = this._renumberCategories();
        const idx = sorted.findIndex(c => c.id === categoryId);
        if (idx <= 0) return; // уже первая

        const cur = sorted[idx];
        const prev = sorted[idx - 1];
        DataManager.updateCategory(cur.id, { order: prev.order });
        DataManager.updateCategory(prev.id, { order: cur.order });

        try {
            await window.BudgetApp.saveData();
        } catch (e) {
            console.error('Ошибка автосохранения порядка категорий:', e);
        }

        this.renderReferenceTable();
        this.renderBudgetSummary();
        this.updateCategoryFilter();
    }

    /**
     * Переместить категорию на одну позицию вниз (с автосохранением)
     */
    static async moveCategoryDown(categoryId) {
        const sorted = this._renumberCategories();
        const idx = sorted.findIndex(c => c.id === categoryId);
        if (idx === -1 || idx >= sorted.length - 1) return; // уже последняя

        const cur = sorted[idx];
        const next = sorted[idx + 1];
        DataManager.updateCategory(cur.id, { order: next.order });
        DataManager.updateCategory(next.id, { order: cur.order });

        try {
            await window.BudgetApp.saveData();
        } catch (e) {
            console.error('Ошибка автосохранения порядка категорий:', e);
        }

        this.renderReferenceTable();
        this.renderBudgetSummary();
        this.updateCategoryFilter();
    }

    /**
     * Обновление расчета налогов
     * Рассчитывает налог за месяц и за квартал
     */
    static updateTaxCalculation() {
        const config = DataManager.getConfig();
        const settings = config.settings || config;

        const limitFop = settings.limitFop || 0;
        const taxRate = settings.taxRate || 0;
        const rateEURtoUAH = settings.rateEURtoUAH || 48.40;

        // Налог считается только с лимита ФОП
        const taxBaseEuro = limitFop;
        const taxAmountEuro = taxBaseEuro * taxRate / 100;
        const taxAmountUAH = taxAmountEuro * rateEURtoUAH;

        // Налог за квартал = налог за месяц * 3
        const taxAmountQuarterUAH = taxAmountUAH * 3;

        // Обновить элементы
        const taxMonthEl = document.getElementById('tax-month-uah');
        if (taxMonthEl) {
            taxMonthEl.textContent = taxAmountUAH.toFixed(2);
        }

        const taxQuarterEl = document.getElementById('tax-quarter-uah');
        if (taxQuarterEl) {
            taxQuarterEl.textContent = taxAmountQuarterUAH.toFixed(2);
        }
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
                <td class="col-description"><input type="text" class="expense-description" value="${expense.description}"></td>
                <td>
                    <select class="category-select">
                        ${categories.map(cat =>
                            `<option value="${cat.id}" ${cat.id === expense.categoryId ? 'selected' : ''}>${UIManager.formatCategoryName(cat)}</option>`
                        ).join('')}
                    </select>
                </td>
                <td><input type="number" step="0.01" min="0" class="expense-amount" value="${expense.amount}"></td>
                <td>
                    <select class="currency-select">
                        <option value="EUR" ${expense.currency === 'EUR' ? 'selected' : ''}>€</option>
                        <option value="UAH" ${expense.currency === 'UAH' ? 'selected' : ''}>UAH</option>
                    </select>
                </td>
                <td class="readonly-field">${remaining.toFixed(2)}</td>
                <td class="readonly-field">${budgetRefEuro.toFixed(2)}</td>
                <td class="readonly-field">${budgetRefPercent.toFixed(2)}</td>
                <td>
                    <button class="button-secondary" onclick="window.BudgetApp.UIManager.updateExpenseInline('${expense.id}')" title="Обновить">🔄</button>
                    <button class="button-danger" onclick="window.BudgetApp.UIManager.deleteExpense('${expense.id}')" title="Удалить">🗑️</button>
                </td>
                <td><input type="datetime-local" class="expense-date" value="${dateValue}"></td>
            `;

            tbody.appendChild(row);
        });

        // Обновить заголовок периода
        const titleEl = document.getElementById('expenses-period-title');
        if (titleEl) {
            titleEl.textContent = DateUtils.formatPeriod(window.BudgetApp.currentPeriod);
        }

        // Обновить информацию о сумме по выбранной категории
        if (categoryFilter && categoryFilter.value) {
            this.updateCategoryTotalInfo(categoryFilter.value);
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
        let totalRemaining = 0;     // план − факт по каждой категории, суммарно (может быть отрицательным)
        let totalPlannedRest = 0;   // Σ max(0, план − факт)   — сколько ещё нужно потратить по плану
        let totalOverspend = 0;     // Σ max(0, факт − план)   — перерасход

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
                <td>${UIManager.formatCategoryName(category)}</td>
                <td>${plan.toFixed(2)}</td>
                <td>${fact.toFixed(2)}</td>
                <td>${percentage.toFixed(2)}%</td>
                <td>${remaining.toFixed(2)}</td>
            `;

            tbody.appendChild(row);

            totalPlan += plan;
            totalFact += fact;
            totalRemaining += remaining;
            totalPlannedRest += Math.max(0, plan - fact);
            totalOverspend += Math.max(0, fact - plan);
        });

        // Пустое состояние, если категорий нет
        if (sortedCategories.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" class="empty-state">
                <span class="empty-state-icon">📊</span>
                Категорий пока нет — заведите их в Справочнике.
            </td>`;
            tbody.appendChild(tr);
        }

        // Обновить итоговую строку таблицы
        document.getElementById('total-plan-euro').textContent = totalPlan.toFixed(2);
        document.getElementById('total-fact-euro').textContent = totalFact.toFixed(2);
        const totalPercentage = totalPlan > 0 ? (totalFact / totalPlan * 100) : 0;
        document.getElementById('total-percentage').textContent = totalPercentage.toFixed(2) + '%';
        document.getElementById('total-remaining').textContent = totalRemaining.toFixed(2);

        // ─── Карточки итогов: ВЕРХ (главные) и НИЗ ───
        const incomeEuro = config.settings?.incomeEuro || config.incomeEuro || 0;
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        // НИЗ
        setText('summary-income', `${incomeEuro.toFixed(2)} €`);
        setText('summary-fact', `${totalFact.toFixed(2)} €`);
        setText('summary-planned-rest', `${totalPlannedRest.toFixed(2)} €`);

        // «Свободно» = Доход − Факт − (запланировано ещё потратить).
        // Не выводится отдельной карточкой, но используется в карточке дней наверху.
        const freeFunds = incomeEuro - totalFact - totalPlannedRest;

        // ─── Перерасход (НИЗ): только если ≥ 50 копеек ───
        const overspendCard = document.getElementById('overspend-card');
        if (overspendCard) {
            if (totalOverspend >= 0.5) {
                overspendCard.style.display = '';
                setText('summary-overspend', `−${totalOverspend.toFixed(2)} €`);
            } else {
                overspendCard.style.display = 'none';
            }
        }

        // ─── Отложено (НИЗ): категория «Инвестиции и сбережения» ───
        const savingsCategory = categories.find(cat => cat.name === 'Инвестиции и сбережения');
        const savedEuro = savingsCategory ? (categoryTotals[savingsCategory.id] || 0) : 0;
        setText('saved-euro', `${savedEuro.toFixed(2)} €`);

        // ─── ВЕРХ: дни / % исполнения / план в день ───
        this._updateTopCards(incomeEuro, totalFact, totalPlan, totalPlannedRest, freeFunds);

        // Обновить график
        this.updateChart(categories, categoryTotals);
    }

    /**
     * Верхний блок из трёх главных карточек:
     *   1) «До конца периода» — дни, всего свободно, на день
     *   2) «% исполнения бюджета» — Σ факт / Σ план
     *   3) «План в день» — Запланировано ещё / дней
     */
    static _updateTopCards(income, totalFact, totalPlan, totalPlannedRest, freeFunds) {
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        // ─── Карточка «% исполнения бюджета» ───
        const execPct = totalPlan > 0 ? (totalFact / totalPlan * 100) : 0;
        setText('exec-percentage', `${execPct.toFixed(2)}%`);

        // Жёлтый/красный для перевыполнения
        const execCard = document.getElementById('exec-card');
        if (execCard) {
            execCard.classList.toggle('is-overspent', execPct > 100);
        }

        // ─── Считаем дни ───
        const period = window.BudgetApp?.currentPeriod;
        const daysCard = document.getElementById('days-card');
        const planPerDayCard = document.getElementById('plan-perday-card');

        if (!period || !period.periodEnd || !period.periodStart) {
            setText('days-card-days', '—');
            setText('days-card-free', '0.00 €');
            setText('days-card-perday', '0.00 €');
            setText('plan-perday-value', '≈ 0.00 €/день');
            setText('plan-perday-total', `${totalPlannedRest.toFixed(2)} €`);
            return;
        }

        const now = new Date();
        const start = period.periodStart;
        const end = period.periodEnd;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        // Дни до конца периода: 1 — если последние сутки, 0 — если уже завершился
        let daysLeft;
        let daysLabel;

        if (now < start) {
            // Период не начался — показываем «не начался»
            const daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / MS_PER_DAY);
            daysLeft = 0;
            daysLabel = `через ${daysUntilStart} дн.`;
        } else if (now > end) {
            // Период закончился
            daysLeft = 0;
            daysLabel = 'завершён';
        } else {
            daysLeft = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY));
            daysLabel = `${daysLeft} дн.`;
        }

        // ─── Карточка «До конца периода» ───
        setText('days-card-days', daysLabel);
        setText('days-card-free', `${freeFunds.toFixed(2)} €`);
        const freeFundsPerDay = daysLeft > 0 ? freeFunds / daysLeft : 0;
        setText('days-card-perday', `${freeFundsPerDay.toFixed(2)} €`);

        // Если «Свободно» отрицательное — карточка краснеет
        if (daysCard) {
            daysCard.classList.toggle('is-negative', freeFunds < 0);
        }

        // ─── Карточка «План в день» ───
        const planPerDay = daysLeft > 0 ? totalPlannedRest / daysLeft : 0;
        setText('plan-perday-value', `≈ ${planPerDay.toFixed(2)} €/день`);
        setText('plan-perday-total', `${totalPlannedRest.toFixed(2)} €`);

        // Если запланированных трат нет — приглушим карточку
        if (planPerDayCard) {
            planPerDayCard.classList.toggle('is-empty', totalPlannedRest < 0.5);
        }
    }

    /**
     * Создание графика распределения расходов
     * @param {Array} categories - Массив категорий
     * @param {Object} categoryTotals - Объект с суммами трат по категориям
     */
    static createChart(categories, categoryTotals) {
        const container = document.getElementById('chart-container');
        if (!container) return;

        // Очистить контейнер
        container.innerHTML = '';

        // Создать canvas
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        // Подготовить данные
        const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
        const labels = sortedCategories.map(cat => cat.name);
        const planData = sortedCategories.map(cat => cat.limit);
        const factData = sortedCategories.map(cat => categoryTotals[cat.id] || 0);

        // Определить цвета для столбцов факта (красный если перерасход)
        const factColors = sortedCategories.map((cat, index) => {
            const fact = categoryTotals[cat.id] || 0;
            const plan = cat.limit;
            return fact > plan ? 'rgba(244, 67, 54, 0.6)' : 'rgba(33, 150, 243, 0.6)';
        });

        const factBorderColors = sortedCategories.map((cat, index) => {
            const fact = categoryTotals[cat.id] || 0;
            const plan = cat.limit;
            return fact > plan ? 'rgba(244, 67, 54, 1)' : 'rgba(33, 150, 243, 1)';
        });

        // Создать график
        this.budgetChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'План (€)',
                        data: planData,
                        backgroundColor: 'rgba(76, 175, 80, 0.6)',
                        borderColor: 'rgba(76, 175, 80, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Факт (€)',
                        data: factData,
                        backgroundColor: factColors,
                        borderColor: factBorderColors,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' €';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' €';

                                // Если это столбец "Факт", добавляем информацию о перерасходе
                                if (context.datasetIndex === 1) {
                                    const categoryIndex = context.dataIndex;
                                    const plan = planData[categoryIndex];
                                    const fact = factData[categoryIndex];

                                    if (fact > plan) {
                                        const overspend = fact - plan;
                                        return [label, 'Перерасход: ' + overspend.toFixed(2) + ' €'];
                                    }
                                }

                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Обновление графика распределения расходов
     * @param {Array} categories - Массив категорий
     * @param {Object} categoryTotals - Объект с суммами трат по категориям
     */
    static updateChart(categories, categoryTotals) {
        if (this.budgetChart) {
            // Обновить существующий график
            const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
            const planData = sortedCategories.map(cat => cat.limit);
            const factData = sortedCategories.map(cat => categoryTotals[cat.id] || 0);

            // Определить цвета для столбцов факта (красный если перерасход)
            const factColors = sortedCategories.map((cat, index) => {
                const fact = categoryTotals[cat.id] || 0;
                const plan = cat.limit;
                return fact > plan ? 'rgba(244, 67, 54, 0.6)' : 'rgba(33, 150, 243, 0.6)';
            });

            const factBorderColors = sortedCategories.map((cat, index) => {
                const fact = categoryTotals[cat.id] || 0;
                const plan = cat.limit;
                return fact > plan ? 'rgba(244, 67, 54, 1)' : 'rgba(33, 150, 243, 1)';
            });

            this.budgetChart.data.labels = sortedCategories.map(cat => cat.name);
            this.budgetChart.data.datasets[0].data = planData;
            this.budgetChart.data.datasets[1].data = factData;
            this.budgetChart.data.datasets[1].backgroundColor = factColors;
            this.budgetChart.data.datasets[1].borderColor = factBorderColors;
            this.budgetChart.update();
        } else {
            // Создать новый график
            this.createChart(categories, categoryTotals);
        }
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

        const trimmedName = categoryName.trim();

        // Проверка на дубликаты
        const categories = DataManager.getCategories();
        if (categories.some(cat => cat.name === trimmedName)) {
            alert('Категория с таким именем уже существует');
            return;
        }

        // Предложить иконку по словарю (можно отказаться)
        const suggested = suggestIconForCategory(trimmedName) || '';
        const promptText = suggested
            ? `Иконка для категории «${trimmedName}»\n(предлагается: ${suggested}, можно изменить или оставить пусто):`
            : `Иконка для категории «${trimmedName}»\n(можно вписать emoji или оставить пусто):`;
        const iconInput = prompt(promptText, suggested);
        // Если нажали "Отмена" — iconInput === null. В этом случае иконку не ставим.
        const icon = (iconInput === null) ? '' : iconInput.trim();

        try {
            // Новая категория уходит в конец списка
            const maxOrder = categories.reduce((m, c) => Math.max(m, c.order || 0), 0);
            const newCategory = DataManager.addCategory({
                name: trimmedName,
                limit: 0,
                percentage: 0,
                order: maxOrder + 1,
                icon
            });

            // Перенумеруем на всякий случай — вдруг были дырки в старых данных
            this._renumberCategories();

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

            // Если удалили категорию-по-умолчанию — сбрасываем настройку
            const config = DataManager.getConfig();
            if (config.settings?.defaultCategoryId === categoryId) {
                DataManager.updateSettings({ defaultCategoryId: null });
            }

            // После удаления — перенумеровать оставшиеся, чтобы не было дырок
            this._renumberCategories();

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
        const limitFop = config.settings?.limitFop || 0;

        // Получить название категории
        const categoryName = row.querySelector('.category-name').value.trim();

        // Для категории "Налоги" используем limitFop, для остальных - incomeEuro
        const baseAmount = (categoryName === 'Налоги') ? limitFop : incomeEuro;

        // Пересчитать лимит
        const newLimit = (baseAmount * percentage / 100).toFixed(2);

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
        const limitFop = config.settings?.limitFop || 0;

        // Получить название категории
        const categoryName = row.querySelector('.category-name').value.trim();

        // Для категории "Налоги" используем limitFop, для остальных - incomeEuro
        const baseAmount = (categoryName === 'Налоги') ? limitFop : incomeEuro;

        // Пересчитать процент
        const newPercentage = baseAmount > 0 ? ((limit / baseAmount) * 100).toFixed(2) : 0;

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
        const iconEl = row.querySelector('.category-icon');
        const icon = iconEl ? iconEl.value.trim() : '';
        // order больше не редактируется через эту кнопку — он управляется стрелками ↑↓

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
                icon
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

        // Берём отсортированный по `order` список — как в Бюджете и фильтре трат
        const categories = [...DataManager.getCategories()]
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        if (categories.length === 0) {
            alert('Сначала создайте категории');
            return;
        }

        // Категория по умолчанию из настроек, иначе — первая в справочнике
        const config = DataManager.getConfig();
        const defaultCategoryId = config.settings?.defaultCategoryId || null;
        const selectedCategoryId = (defaultCategoryId && categories.some(c => c.id === defaultCategoryId))
            ? defaultCategoryId
            : categories[0].id;

        const row = document.createElement('tr');
        row.className = 'expense-row expense-row-unsaved';

        // Текущая дата в формате для datetime-local
        const now = new Date();
        const dateValue = now.toISOString().slice(0, 16);

        row.innerHTML = `
            <td class="col-description"><input type="text" placeholder="Описание" required></td>
            <td>
                <select class="category-select" required>
                    ${categories.map(cat =>
                        `<option value="${cat.id}"${cat.id === selectedCategoryId ? ' selected' : ''}>${UIManager.formatCategoryName(cat)}</option>`
                    ).join('')}
                </select>
            </td>
            <td><input type="number" step="0.01" min="0" class="amount" placeholder="0.00" required></td>
            <td>
                <select class="currency-select">
                    <option value="EUR">€</option>
                    <option value="UAH">UAH</option>
                </select>
            </td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>
                <button class="button-primary" onclick="window.BudgetApp.UIManager.saveExpenseFromRow(this)">💾</button>
                <button class="button-danger" onclick="window.BudgetApp.UIManager.cancelExpense(this)">❌</button>
            </td>
            <td><input type="datetime-local" value="${dateValue}" required></td>
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
            rateEURtoUAH: config.settings?.rateEURtoUAH || config.rateEURtoUAH || 48.40
        };

        const converted = CurrencyUtils.convertToAll(amount, currency, rates);

        const expenseData = {
            categoryId,
            date: new Date(date).toISOString(),
            description,
            amount,
            currency,
            amountEUR: converted.EUR,
            amountUAH: converted.UAH
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
            rateEURtoUAH: config.settings?.rateEURtoUAH || config.rateEURtoUAH || 48.40
        };

        const converted = CurrencyUtils.convertToAll(amount, currency, rates);

        const expenseData = {
            categoryId,
            date: new Date(date).toISOString(),
            description,
            amount,
            currency,
            amountEUR: converted.EUR,
            amountUAH: converted.UAH
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
            <td class="col-description"><input type="text" value="${expense.description}" placeholder="Описание" required></td>
            <td>
                <select class="category-select" required>
                    ${categories.map(cat =>
                        `<option value="${cat.id}" ${cat.id === expense.categoryId ? 'selected' : ''}>${UIManager.formatCategoryName(cat)}</option>`
                    ).join('')}
                </select>
            </td>
            <td><input type="number" step="0.01" min="0" class="amount" value="${expense.amount}" placeholder="0.00" required></td>
            <td>
                <select class="currency-select">
                    <option value="EUR" ${expense.currency === 'EUR' ? 'selected' : ''}>€</option>
                    <option value="UAH" ${expense.currency === 'UAH' ? 'selected' : ''}>UAH</option>
                </select>
            </td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>
                <button class="button-primary" onclick="window.BudgetApp.UIManager.updateExpenseFromRow(this, '${expenseId}')">💾</button>
                <button class="button-danger" onclick="window.BudgetApp.UIManager.cancelExpenseEdit(this, '${expenseId}')">❌</button>
            </td>
            <td><input type="datetime-local" value="${dateValue}" required></td>
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
            rateEURtoUAH: config.settings?.rateEURtoUAH || config.rateEURtoUAH || 48.40
        };

        const converted = CurrencyUtils.convertToAll(amount, currency, rates);

        const expenseData = {
            categoryId,
            date: new Date(date).toISOString(),
            description,
            amount,
            currency,
            amountEUR: converted.EUR,
            amountUAH: converted.UAH
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
        const lastUpdate = settings.lastRatesUpdate || null;
        const lastRatesDate = settings.lastRatesDate || null;

        // Обновить в шапке
        const exchangeRates = document.getElementById('exchange-rates');
        if (exchangeRates) {
            exchangeRates.innerHTML = `
                <div class="rate-item">1 € = ${rateEURtoUAH.toFixed(4)} UAH</div>
            `;
        }

        // Дата курса от ЕЦБ (через Monobank)
        const ratesDateEl = document.getElementById('rates-date');
        if (ratesDateEl) {
            ratesDateEl.textContent = lastRatesDate
                ? DateUtils.formatDate(lastRatesDate)
                : '—';
        }

        // Время последнего обновления (когда мы запросили курсы)
        const lastUpdateEl = document.getElementById('last-update');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = lastUpdate
                ? DateUtils.formatDateTime(lastUpdate)
                : 'никогда';
        }

        // Дублируем в Настройках
        const rateUAHDisplay = document.getElementById('rate-uah-display');
        if (rateUAHDisplay) {
            rateUAHDisplay.textContent = rateEURtoUAH.toFixed(4);
        }
        const rateUAHDateEl = document.getElementById('rate-uah-date');
        if (rateUAHDateEl) {
            rateUAHDateEl.textContent = lastRatesDate
                ? DateUtils.formatDate(lastRatesDate)
                : '—';
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
                lastRatesUpdate: rates.lastUpdate,
                lastRatesDate: rates.lastRatesDate
            };

            DataManager.updateSettings(updatedSettings);
            await window.BudgetApp.saveData();

            this.updateExchangeRatesDisplay();
            // Пересчитать с новым курсом
            this.renderReferenceTable();
            this.renderBudgetSummary();

            const dateStr = DateUtils.formatDate(rates.lastRatesDate);
            console.log(`✅ Курсы валют обновлены (на ${dateStr})`);
            // Тихое обновление — без alert, чтобы не раздражать
        } catch (error) {
            console.error('❌ Ошибка обновления курсов:', error);
            alert('Не удалось обновить курсы валют. Проверьте подключение к интернету.');
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
            option.textContent = UIManager.formatCategoryName(category);
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
        this.updateCategoryTotalInfo(categoryId);
    }

    /**
     * Обновление информации о сумме трат по выбранной категории
     * @param {string} categoryId - ID выбранной категории
     */
    static updateCategoryTotalInfo(categoryId) {
        const categoryTotalInfo = document.getElementById('category-total-info');
        const categoryNameDisplay = document.getElementById('category-name-display');
        const categoryTotalDisplay = document.getElementById('category-total-display');
        const categoryTotalDisplayUAH = document.getElementById('category-total-display-uah');

        if (!categoryTotalInfo || !categoryNameDisplay || !categoryTotalDisplay || !categoryTotalDisplayUAH) return;

        // Если категория не выбрана, скрыть информацию
        if (!categoryId) {
            categoryTotalInfo.style.display = 'none';
            return;
        }

        // Найти выбранную категорию
        const categories = DataManager.getCategories();
        const selectedCategory = categories.find(cat => cat.id === categoryId);

        if (!selectedCategory) {
            categoryTotalInfo.style.display = 'none';
            return;
        }

        // Получить траты по выбранной категории за текущий период
        const expenses = DataManager.getExpenses();
        const periodExpenses = DateUtils.filterExpensesByPeriod(expenses, window.BudgetApp.currentPeriod);
        const categoryExpenses = periodExpenses.filter(expense => expense.categoryId === categoryId);

        // Подсчитать сумму в евро
        const totalEUR = categoryExpenses.reduce((sum, expense) => sum + parseFloat(expense.amountEUR || 0), 0);

        // Получить курс EUR -> UAH
        const config = DataManager.getConfig();
        const rateEURtoUAH = config.settings?.rateEURtoUAH || config.rateEURtoUAH || 48.40;

        // Рассчитать сумму в гривнах
        const totalUAH = totalEUR * rateEURtoUAH;

        // Обновить отображение
        categoryNameDisplay.textContent = selectedCategory.name;
        categoryTotalDisplay.textContent = totalEUR.toFixed(2);
        categoryTotalDisplayUAH.textContent = totalUAH.toFixed(2);

        // Показать информацию
        categoryTotalInfo.style.display = 'block';
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

        // День начала периода — читаем с fallback'ом на верхний уровень config
        // (исправление: раньше после сохранения значение читалось только из settings и сбрасывалось)
        const periodStartDay = document.getElementById('period-start-day');
        if (periodStartDay) {
            periodStartDay.value = settings.periodStartDay || config.periodStartDay || 25;
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

        // Пересчитать доход автоматически
        this.updateIncomeCalculation();

        // Ставка налога
        const taxRate = document.getElementById('tax-rate');
        if (taxRate) {
            taxRate.value = settings.taxRate || 0;
        }

        // Категория по умолчанию: заполнить выпадающий список и выбрать сохранённую
        const defaultCategorySelect = document.getElementById('default-category-select');
        if (defaultCategorySelect) {
            const categories = [...DataManager.getCategories()]
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const savedDefault = settings.defaultCategoryId || '';

            defaultCategorySelect.innerHTML = '<option value="">— первая в справочнике —</option>' +
                categories.map(cat =>
                    `<option value="${cat.id}"${cat.id === savedDefault ? ' selected' : ''}>${UIManager.formatCategoryName(cat)}</option>`
                ).join('');
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
     * Автоматический расчет дохода
     * Рассчитывает доход как сумма Лимит ФОП + Лимит крипты
     */
    static updateIncomeCalculation() {
        const limitFop = parseFloat(document.getElementById('limit-fop').value) || 0;
        const limitCrypto = parseFloat(document.getElementById('limit-crypto').value) || 0;
        const incomeEuro = limitFop + limitCrypto;

        const incomeEuroInput = document.getElementById('income-euro');
        if (incomeEuroInput) {
            incomeEuroInput.value = incomeEuro.toFixed(2);
        }
    }

    /**
     * Сохранение настроек из формы
     * Считывает значения из полей формы и сохраняет в DataManager
     */
    static async saveSettings() {
        const periodStartDay = parseInt(document.getElementById('period-start-day').value) || 25;
        const limitFop = parseFloat(document.getElementById('limit-fop').value) || 0;
        const limitCrypto = parseFloat(document.getElementById('limit-crypto').value) || 0;
        const taxRate = parseFloat(document.getElementById('tax-rate').value) || 0;

        // Категория по умолчанию (пустая строка = «первая в справочнике»)
        const defaultCategorySelectEl = document.getElementById('default-category-select');
        const defaultCategoryId = defaultCategorySelectEl
            ? (defaultCategorySelectEl.value || null)
            : null;

        // Автоматический расчет дохода
        const incomeEuro = limitFop + limitCrypto;

        // Валидация
        if (periodStartDay < 1 || periodStartDay > 28) {
            alert('День начала периода должен быть от 1 до 28');
            return;
        }

        if (limitFop < 0 || limitCrypto < 0 || taxRate < 0) {
            alert('Значения не могут быть отрицательными');
            return;
        }

        try {
            const config = DataManager.getConfig();
            const updatedSettings = {
                ...config.settings,
                incomeEuro,
                limitFop,
                limitCrypto,
                taxRate,
                // periodStartDay храним и здесь — иначе loadSettings его не показывает корректно
                periodStartDay,
                defaultCategoryId
            };

            DataManager.updateSettings(updatedSettings);

            // Дублируем periodStartDay и на верхний уровень config — для обратной совместимости
            DataManager.updateConfig({
                periodStartDay
            });

            // Обновить категорию "Налоги" если есть
            // Налог всегда считается только от Лимита ФОП, независимо от дохода
            const categories = DataManager.getCategories();
            const taxCategory = categories.find(cat => cat.name === 'Налоги');
            if (taxCategory) {
                const taxBase = limitFop; // Налог всегда от ФОП
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
        const isValid = await window.BudgetApp.AuthManager.verifyPassword(currentPassword);
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

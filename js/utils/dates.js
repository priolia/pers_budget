/**
 * Утилиты для работы с датами и кастомными периодами
 */

import { CONFIG } from '../config.js';

export class DateUtils {
    /**
     * Получить текущий период на основе кастомного дня старта
     * @param {number} periodStartDay - День начала периода (1-28)
     * @returns {{periodStart: Date, periodEnd: Date}}
     */
    static getCurrentPeriod(periodStartDay = CONFIG.DEFAULTS.PERIOD_START_DAY) {
        const now = new Date();
        const currentDay = now.getDate();

        let periodStart, periodEnd;

        if (currentDay >= periodStartDay) {
            // Текущий период: с periodStartDay текущего месяца до (periodStartDay-1) следующего
            periodStart = new Date(now.getFullYear(), now.getMonth(), periodStartDay, 0, 0, 0, 0);
            periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, periodStartDay - 1, 23, 59, 59, 999);
        } else {
            // Текущий период: с periodStartDay прошлого месяца до (periodStartDay-1) текущего
            periodStart = new Date(now.getFullYear(), now.getMonth() - 1, periodStartDay, 0, 0, 0, 0);
            periodEnd = new Date(now.getFullYear(), now.getMonth(), periodStartDay - 1, 23, 59, 59, 999);
        }

        return { periodStart, periodEnd };
    }

    /**
     * Получить период по дате
     * @param {Date} date - Дата для которой нужно получить период
     * @param {number} periodStartDay - День начала периода
     */
    static getPeriodForDate(date, periodStartDay = CONFIG.DEFAULTS.PERIOD_START_DAY) {
        const currentDay = date.getDate();

        let periodStart, periodEnd;

        if (currentDay >= periodStartDay) {
            periodStart = new Date(date.getFullYear(), date.getMonth(), periodStartDay, 0, 0, 0, 0);
            periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, periodStartDay - 1, 23, 59, 59, 999);
        } else {
            periodStart = new Date(date.getFullYear(), date.getMonth() - 1, periodStartDay, 0, 0, 0, 0);
            periodEnd = new Date(date.getFullYear(), date.getMonth(), periodStartDay - 1, 23, 59, 59, 999);
        }

        return { periodStart, periodEnd };
    }

    /**
     * Получить список всех периодов с трат
     * @param {Array} expenses - Массив трат
     * @param {number} periodStartDay - День начала периода
     */
    static getAvailablePeriods(expenses, periodStartDay = CONFIG.DEFAULTS.PERIOD_START_DAY) {
        if (!expenses || expenses.length === 0) {
            return [this.getCurrentPeriod(periodStartDay)];
        }

        const periodsMap = new Map();

        expenses.forEach(expense => {
            const expenseDate = new Date(expense.date);
            const period = this.getPeriodForDate(expenseDate, periodStartDay);

            const key = `${period.periodStart.getTime()}_${period.periodEnd.getTime()}`;

            if (!periodsMap.has(key)) {
                periodsMap.set(key, period);
            }
        });

        // Добавляем текущий период если его нет
        const currentPeriod = this.getCurrentPeriod(periodStartDay);
        const currentKey = `${currentPeriod.periodStart.getTime()}_${currentPeriod.periodEnd.getTime()}`;

        if (!periodsMap.has(currentKey)) {
            periodsMap.set(currentKey, currentPeriod);
        }

        // Сортируем по дате (новые первые)
        return Array.from(periodsMap.values()).sort((a, b) =>
            b.periodStart.getTime() - a.periodStart.getTime()
        );
    }

    /**
     * Форматировать период для отображения ("окт-ноя 2025")
     * @param {{periodStart: Date, periodEnd: Date}} period
     */
    static formatPeriod(period) {
        const startMonth = CONFIG.UI.MONTH_NAMES[period.periodStart.getMonth()];
        const endMonth = CONFIG.UI.MONTH_NAMES[period.periodEnd.getMonth()];
        const year = period.periodEnd.getFullYear();

        return `${startMonth}-${endMonth} ${year}`;
    }

    /**
     * Форматировать период полностью ("25 окт 2025 - 24 ноя 2025")
     */
    static formatPeriodFull(period) {
        const startDay = period.periodStart.getDate();
        const startMonth = CONFIG.UI.MONTH_NAMES[period.periodStart.getMonth()];
        const startYear = period.periodStart.getFullYear();

        const endDay = period.periodEnd.getDate();
        const endMonth = CONFIG.UI.MONTH_NAMES[period.periodEnd.getMonth()];
        const endYear = period.periodEnd.getFullYear();

        return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
    }

    /**
     * Проверить находится ли дата в периоде
     */
    static isDateInPeriod(date, period) {
        const timestamp = new Date(date).getTime();
        return timestamp >= period.periodStart.getTime() &&
               timestamp <= period.periodEnd.getTime();
    }

    /**
     * Фильтровать траты по периоду
     */
    static filterExpensesByPeriod(expenses, period) {
        return expenses.filter(expense =>
            this.isDateInPeriod(expense.date, period)
        );
    }

    /**
     * Форматировать дату для отображения ("22.10.2025")
     */
    static formatDate(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        return `${day}.${month}.${year}`;
    }

    /**
     * Форматировать дату и время
     */
    static formatDateTime(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    /**
     * Парсить дату из строки формата "DD.MM.YYYY"
     */
    static parseDate(dateString) {
        const parts = dateString.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);

        return new Date(year, month, day);
    }

    /**
     * Получить название месяца
     */
    static getMonthName(monthIndex, full = false) {
        const names = full ? CONFIG.UI.MONTH_NAMES_FULL : CONFIG.UI.MONTH_NAMES;
        return names[monthIndex] || '';
    }

    /**
     * Группировать траты по месяцам
     */
    static groupExpensesByMonth(expenses) {
        const groups = {};

        expenses.forEach(expense => {
            const date = new Date(expense.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!groups[monthKey]) {
                groups[monthKey] = {
                    month: date.getMonth(),
                    year: date.getFullYear(),
                    expenses: []
                };
            }

            groups[monthKey].expenses.push(expense);
        });

        return groups;
    }
}

export default DateUtils;

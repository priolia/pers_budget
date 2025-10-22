/**
 * Утилиты для работы с валютами и конвертацией
 */

export class CurrencyUtils {
    /**
     * Конвертировать EUR в другие валюты
     * @param {number} amountEUR - Сумма в EUR
     * @param {Object} rates - Курсы валют {rateEURtoUAH, rateEURtoBGN}
     */
    static convertFromEUR(amountEUR, rates) {
        return {
            EUR: parseFloat(amountEUR.toFixed(2)),
            UAH: parseFloat((amountEUR * rates.rateEURtoUAH).toFixed(2)),
            BGN: parseFloat((amountEUR * rates.rateEURtoBGN).toFixed(2))
        };
    }

    /**
     * Конвертировать из любой валюты в EUR и другие
     * @param {number} amount - Сумма
     * @param {string} fromCurrency - Исходная валюта (EUR, UAH, BGN)
     * @param {Object} rates - Курсы валют
     */
    static convertToAll(amount, fromCurrency, rates) {
        let amountEUR;

        switch (fromCurrency.toUpperCase()) {
            case 'EUR':
                amountEUR = amount;
                break;
            case 'UAH':
                amountEUR = amount / rates.rateEURtoUAH;
                break;
            case 'BGN':
                amountEUR = amount / rates.rateEURtoBGN;
                break;
            default:
                console.error('Неизвестная валюта:', fromCurrency);
                amountEUR = amount;
        }

        return this.convertFromEUR(amountEUR, rates);
    }

    /**
     * Форматировать сумму с валютой
     * @param {number} amount - Сумма
     * @param {string} currency - Валюта
     * @param {boolean} showSymbol - Показывать символ валюты
     */
    static formatAmount(amount, currency = 'EUR', showSymbol = true) {
        const formatted = new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);

        if (!showSymbol) {
            return formatted;
        }

        const symbols = {
            'EUR': '€',
            'UAH': '₴',
            'BGN': 'лв'
        };

        return `${formatted} ${symbols[currency] || currency}`;
    }

    /**
     * Получить актуальные курсы с Monobank API
     */
    static async fetchMonobankRates() {
        try {
            const response = await fetch('https://api.monobank.ua/bank/currency');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const rates = await response.json();

            // Ищем EUR -> UAH (код 978 -> 980)
            const eurToUah = rates.find(r =>
                r.currencyCodeA === 978 && r.currencyCodeB === 980
            );

            // Ищем EUR -> BGN через кросс-курс (EUR->USD->BGN)
            // Если нет прямого курса, используем дефолтное значение
            const eurToBgn = 1.9558; // Фиксированный курс (примерно)

            return {
                rateEURtoUAH: eurToUah ? eurToUah.rateSell : 48.40,
                rateEURtoBGN: eurToBgn,
                lastUpdate: new Date().toISOString(),
                source: 'monobank'
            };
        } catch (error) {
            console.error('Ошибка получения курсов Monobank:', error);
            throw error;
        }
    }

    /**
     * Рассчитать общий доход в разных валютах
     * @param {number} incomeEuro - Доход в EUR
     * @param {Object} rates - Курсы валют
     */
    static calculateTotalIncome(incomeEuro, rates) {
        return {
            incomeEuro: incomeEuro,
            totalIncomeUAH: parseFloat((incomeEuro * rates.rateEURtoUAH).toFixed(2)),
            totalIncomeBGN: parseFloat((incomeEuro * rates.rateEURtoBGN).toFixed(2))
        };
    }

    /**
     * Рассчитать налог
     * @param {number} amount - Сумма
     * @param {number} taxRate - Ставка налога (в процентах)
     */
    static calculateTax(amount, taxRate) {
        return parseFloat((amount * taxRate / 100).toFixed(2));
    }

    /**
     * Проверить превышение лимита
     * @param {number} amount - Текущая сумма
     * @param {number} limit - Лимит
     */
    static checkLimit(amount, limit) {
        const remaining = limit - amount;
        const percentage = (amount / limit) * 100;

        return {
            amount: amount,
            limit: limit,
            remaining: remaining,
            percentage: parseFloat(percentage.toFixed(2)),
            exceeded: amount > limit,
            status: amount > limit ? 'exceeded' :
                   percentage > 90 ? 'warning' :
                   percentage > 75 ? 'attention' : 'ok'
        };
    }

    /**
     * Суммировать траты по валюте
     * @param {Array} expenses - Массив трат
     * @param {string} currency - Валюта для суммирования
     */
    static sumExpenses(expenses, currency = 'EUR') {
        const fieldMap = {
            'EUR': 'amountEUR',
            'UAH': 'amountUAH',
            'BGN': 'amountBGN'
        };

        const field = fieldMap[currency.toUpperCase()];

        if (!field) {
            console.error('Неизвестная валюта:', currency);
            return 0;
        }

        return expenses.reduce((sum, expense) =>
            sum + (expense[field] || 0), 0
        );
    }

    /**
     * Суммировать траты по категориям
     * @param {Array} expenses - Массив трат
     * @param {string} currency - Валюта для суммирования
     */
    static sumByCategory(expenses, currency = 'EUR') {
        const sums = {};

        expenses.forEach(expense => {
            const categoryId = expense.categoryId;

            if (!sums[categoryId]) {
                sums[categoryId] = 0;
            }

            const fieldMap = {
                'EUR': 'amountEUR',
                'UAH': 'amountUAH',
                'BGN': 'amountBGN'
            };

            const field = fieldMap[currency.toUpperCase()];
            sums[categoryId] += expense[field] || 0;
        });

        return sums;
    }

    /**
     * Рассчитать статистику по категории
     * @param {Array} expenses - Траты категории
     * @param {number} limit - Лимит категории
     * @param {string} currency - Валюта
     */
    static calculateCategoryStats(expenses, limit, currency = 'EUR') {
        const total = this.sumExpenses(expenses, currency);
        const limitCheck = this.checkLimit(total, limit);

        return {
            total: total,
            count: expenses.length,
            average: expenses.length > 0 ? parseFloat((total / expenses.length).toFixed(2)) : 0,
            limit: limit,
            ...limitCheck
        };
    }

    /**
     * Форматировать курс валюты
     */
    static formatRate(rate, digits = 4) {
        return parseFloat(rate.toFixed(digits));
    }
}

export default CurrencyUtils;

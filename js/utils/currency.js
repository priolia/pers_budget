/**
 * Утилиты для работы с валютами и конвертацией
 * v2.1 (2026): только EUR и UAH. BGN удалён — Болгария в еврозоне с 01.01.2026.
 */

export class CurrencyUtils {
    /**
     * Конвертировать EUR в другие валюты
     */
    static convertFromEUR(amountEUR, rates) {
        return {
            EUR: parseFloat(amountEUR.toFixed(2)),
            UAH: parseFloat((amountEUR * rates.rateEURtoUAH).toFixed(2))
        };
    }

    /**
     * Конвертировать из любой валюты в EUR и другие
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
            default:
                console.error('Неизвестная валюта:', fromCurrency);
                amountEUR = amount;
        }

        return this.convertFromEUR(amountEUR, rates);
    }

    /**
     * Форматировать сумму с валютой
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
            'UAH': '₴'
        };

        return `${formatted} ${symbols[currency] || currency}`;
    }

    /**
     * Получить актуальные курсы с Monobank API.
     * Возвращает {rateEURtoUAH, lastUpdate, lastRatesDate, source}.
     * Бросает ошибку при сетевых проблемах — вызывающий код должен её ловить.
     */
    static async fetchMonobankRates() {
        const response = await fetch('https://api.monobank.ua/bank/currency');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const rates = await response.json();

        // Ищем EUR -> UAH (код 978 -> 980)
        const eurToUah = rates.find(r =>
            r.currencyCodeA === 978 && r.currencyCodeB === 980
        );

        if (!eurToUah) {
            throw new Error('Курс EUR→UAH не найден в ответе Monobank');
        }

        // Среднее между покупкой и продажей даёт более реалистичный курс
        const rate = (eurToUah.rateBuy && eurToUah.rateSell)
            ? (eurToUah.rateBuy + eurToUah.rateSell) / 2
            : (eurToUah.rateSell || eurToUah.rateBuy || eurToUah.rateCross);

        // Monobank присылает date в Unix seconds
        const rateDate = eurToUah.date ? new Date(eurToUah.date * 1000) : new Date();

        return {
            rateEURtoUAH: parseFloat(rate.toFixed(4)),
            lastUpdate: new Date().toISOString(),
            lastRatesDate: rateDate.toISOString(),
            source: 'monobank'
        };
    }

    /**
     * Рассчитать общий доход в разных валютах
     */
    static calculateTotalIncome(incomeEuro, rates) {
        return {
            incomeEuro: incomeEuro,
            totalIncomeUAH: parseFloat((incomeEuro * rates.rateEURtoUAH).toFixed(2))
        };
    }

    /**
     * Рассчитать налог
     */
    static calculateTax(amount, taxRate) {
        return parseFloat((amount * taxRate / 100).toFixed(2));
    }

    /**
     * Проверить превышение лимита
     */
    static checkLimit(amount, limit) {
        const remaining = limit - amount;
        const percentage = limit > 0 ? (amount / limit) * 100 : 0;

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
     */
    static sumExpenses(expenses, currency = 'EUR') {
        const fieldMap = {
            'EUR': 'amountEUR',
            'UAH': 'amountUAH'
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
     */
    static sumByCategory(expenses, currency = 'EUR') {
        const sums = {};
        const fieldMap = {
            'EUR': 'amountEUR',
            'UAH': 'amountUAH'
        };
        const field = fieldMap[currency.toUpperCase()];

        expenses.forEach(expense => {
            const categoryId = expense.categoryId;
            if (!sums[categoryId]) {
                sums[categoryId] = 0;
            }
            sums[categoryId] += expense[field] || 0;
        });

        return sums;
    }

    /**
     * Рассчитать статистику по категории
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

/**
 * Утилиты для экспорта данных
 */

import { DataManager } from '../dataManager.js';
import { CONFIG } from '../config.js';

export class ExportUtils {
    /**
     * Экспортировать все данные в JSON файл
     */
    static exportToJSON() {
        const config = DataManager.getConfig();

        const data = {
            categories: DataManager.getCategories(),
            expenses: DataManager.getExpenses(),
            config: {
                periodStartDay: config.periodStartDay,
                settings: config.settings
                // Пароль не экспортируем из соображений безопасности
            },
            version: {
                major: CONFIG.VERSION.MAJOR,
                minor: CONFIG.VERSION.MINOR,
                patch: CONFIG.VERSION.PATCH,
                timestamp: new Date().toISOString()
            },
            exportDate: new Date().toISOString()
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });

        this.downloadFile(
            blob,
            `budget_export_${new Date().toISOString().split('T')[0]}.json`
        );

        console.log('✅ Данные экспортированы');

        return {
            success: true,
            categoriesCount: data.categories.length,
            expensesCount: data.expenses.length
        };
    }

    /**
     * Экспортировать данные в CSV (траты)
     */
    static exportExpensesToCSV() {
        const expenses = DataManager.getExpenses();
        const categories = DataManager.getCategories();

        // Создаем мапу ID -> имя категории
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.id] = cat.name;
        });

        // Заголовки CSV
        const headers = [
            'Дата',
            'Категория',
            'Описание',
            'Сумма EUR',
            'Сумма UAH',
            'Валюта'
        ];

        // Строки данных
        const rows = expenses.map(expense => {
            const date = new Date(expense.date);
            const dateStr = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;

            return [
                dateStr,
                categoryMap[expense.categoryId] || 'Неизвестная категория',
                expense.description || '',
                expense.amountEUR || '',
                expense.amountUAH || '',
                expense.currency || 'EUR'
            ];
        });

        // Формируем CSV
        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell =>
                // Экранируем запятые и кавычки
                typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))
                    ? `"${cell.replace(/"/g, '""')}"`
                    : cell
            ).join(','))
        ].join('\n');

        // Добавляем BOM для корректного отображения кириллицы в Excel
        const bom = '\uFEFF';
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

        this.downloadFile(
            blob,
            `budget_expenses_${new Date().toISOString().split('T')[0]}.csv`
        );

        console.log('✅ Траты экспортированы в CSV');

        return {
            success: true,
            count: expenses.length
        };
    }

    /**
     * Экспортировать категории в CSV
     */
    static exportCategoriesToCSV() {
        const categories = DataManager.getCategories();

        // Заголовки CSV
        const headers = [
            'Название',
            'Лимит',
            'Процент',
            'Порядок'
        ];

        // Строки данных
        const rows = categories.map(category => [
            category.name,
            category.limit,
            category.percentage,
            category.order
        ]);

        // Формируем CSV
        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Добавляем BOM для корректного отображения кириллицы в Excel
        const bom = '\uFEFF';
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

        this.downloadFile(
            blob,
            `budget_categories_${new Date().toISOString().split('T')[0]}.csv`
        );

        console.log('✅ Категории экспортированы в CSV');

        return {
            success: true,
            count: categories.length
        };
    }

    /**
     * Скачать файл
     */
    static downloadFile(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    /**
     * Экспортировать отчет за период в HTML
     */
    static exportPeriodReport(period, expenses, categories) {
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.id] = cat;
        });

        // Группируем траты по категориям
        const expensesByCategory = {};
        expenses.forEach(expense => {
            const catId = expense.categoryId;
            if (!expensesByCategory[catId]) {
                expensesByCategory[catId] = [];
            }
            expensesByCategory[catId].push(expense);
        });

        // Генерируем HTML
        let html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Отчет по бюджету</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2 {
            color: #333;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #4CAF50;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        .summary {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .category-section {
            margin: 30px 0;
        }
        @media print {
            button {
                display: none;
            }
        }
    </style>
</head>
<body>
    <h1>Отчет по бюджету</h1>
    <div class="summary">
        <h2>Период: ${this.formatDateRange(period)}</h2>
        <p><strong>Дата формирования:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        <p><strong>Всего трат:</strong> ${expenses.length}</p>
        <p><strong>Общая сумма:</strong> ${this.sumExpenses(expenses)} €</p>
    </div>

    <h2>Расходы по категориям</h2>
`;

        categories.forEach(category => {
            const catExpenses = expensesByCategory[category.id] || [];
            const total = catExpenses.reduce((sum, exp) => sum + exp.amountEUR, 0);

            html += `
    <div class="category-section">
        <h3>${category.name}</h3>
        <p><strong>Лимит:</strong> ${category.limit} € | <strong>Потрачено:</strong> ${total.toFixed(2)} € | <strong>Остаток:</strong> ${(category.limit - total).toFixed(2)} €</p>

        <table>
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Описание</th>
                    <th>Сумма (EUR)</th>
                    <th>Сумма (UAH)</th>
                </tr>
            </thead>
            <tbody>
`;

            catExpenses.forEach(expense => {
                html += `
                <tr>
                    <td>${new Date(expense.date).toLocaleDateString('ru-RU')}</td>
                    <td>${expense.description || '-'}</td>
                    <td>${expense.amountEUR.toFixed(2)} €</td>
                    <td>${expense.amountUAH.toFixed(2)} ₴</td>
                </tr>
`;
            });

            html += `
            </tbody>
        </table>
    </div>
`;
        });

        html += `
    <button onclick="window.print()">Печать отчета</button>
</body>
</html>
`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        this.downloadFile(
            blob,
            `budget_report_${new Date().toISOString().split('T')[0]}.html`
        );

        console.log('✅ Отчет экспортирован');

        return { success: true };
    }

    /**
     * Вспомогательные методы
     */
    static formatDateRange(period) {
        const start = new Date(period.periodStart);
        const end = new Date(period.periodEnd);
        return `${start.toLocaleDateString('ru-RU')} - ${end.toLocaleDateString('ru-RU')}`;
    }

    static sumExpenses(expenses) {
        return expenses.reduce((sum, exp) => sum + exp.amountEUR, 0).toFixed(2);
    }

    /**
     * Export the reports table (facts per period + avg/min/max) to CSV.
     */
    static exportReportToCSV(model) {
        if (!model || !Array.isArray(model.periods) || !Array.isArray(model.rows)) {
            return { success: false };
        }
        const esc = v => {
            const s = (v === null || v === undefined) ? '' : String(v);
            return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const headers = ['Категория', ...model.periods.map(p => p.label), 'Среднее', 'Мин', 'Макс'];
        const rows = model.rows.map(r => {
            const cells = model.periods.map(p => {
                const c = r.cells[p.key];
                return (c && c.fact !== null && c.fact !== undefined) ? c.fact.toFixed(2) : '';
            });
            return [
                r.name,
                ...cells,
                r.avg !== null && r.avg !== undefined ? r.avg.toFixed(2) : '',
                r.min !== null && r.min !== undefined ? r.min.toFixed(2) : '',
                r.max !== null && r.max !== undefined ? r.max.toFixed(2) : ''
            ];
        });
        const csv = [headers.map(esc).join(','), ...rows.map(row => row.map(esc).join(','))].join('\n');
        const bom = '\uFEFF';
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        this.downloadFile(blob, `budget_report_${new Date().toISOString().split('T')[0]}.csv`);
        console.log('✅ Отчёт по периодам экспортирован в CSV');
        return { success: true };
    }
}

export default ExportUtils;

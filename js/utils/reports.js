/**
 * ReportUtils
 * Pure computation for the "Reports" tab (Phase 2): period trends by category.
 * No DOM access here — rendering lives in ui.js.
 */

import { CONFIG } from '../config.js';
import { DateUtils } from './dates.js';

// Dirty legacy window ends 21 Oct 2025; clean data starts 22 Oct 2025.
// Default report range drops any period that starts before this date.
const DIRTY_TAIL_END = new Date(2025, 9, 22, 0, 0, 0, 0); // 22 Oct 2025

export class ReportUtils {
    /**
     * Resolve the active period start day (settings -> root -> default).
     */
    static getPeriodStartDay(config) {
        if (config && config.settings && config.settings.periodStartDay) {
            return config.settings.periodStartDay;
        }
        if (config && config.periodStartDay) {
            return config.periodStartDay;
        }
        return CONFIG.DEFAULTS.PERIOD_START_DAY;
    }

    static periodKey(period) {
        return String(period.periodStart.getTime());
    }

    /**
     * Continuous month-stepped periods from the earliest expense period up to
     * the current period (inclusive), ascending. Empty months are kept so the
     * timeline has no holes (gaps are drawn as "—", per spec).
     */
    static buildPeriods(expenses, periodStartDay) {
        const current = DateUtils.getCurrentPeriod(periodStartDay);
        let earliest = current.periodStart;
        (expenses || []).forEach(e => {
            const p = DateUtils.getPeriodForDate(new Date(e.date), periodStartDay);
            if (p.periodStart.getTime() < earliest.getTime()) {
                earliest = p.periodStart;
            }
        });

        const periods = [];
        let y = earliest.getFullYear();
        let m = earliest.getMonth();
        const endY = current.periodStart.getFullYear();
        const endM = current.periodStart.getMonth();
        let guard = 0;
        while ((y < endY || (y === endY && m <= endM)) && guard < 120) {
            const start = new Date(y, m, periodStartDay, 0, 0, 0, 0);
            const end = new Date(y, m + 1, periodStartDay - 1, 23, 59, 59, 999);
            periods.push({ periodStart: start, periodEnd: end });
            m++;
            if (m > 11) { m = 0; y++; }
            guard++;
        }
        return periods;
    }

    /**
     * Latest snapshot value (newValue) matching predicate with timestamp <= refTime.
     * Returns null when nothing applies (=> gap "—").
     */
    static valueInEffect(snapshots, predicate, refTime) {
        let bestVal = null;
        let bestTime = -Infinity;
        for (let i = 0; i < snapshots.length; i++) {
            const s = snapshots[i];
            if (!predicate(s)) continue;
            const t = new Date(s.timestamp).getTime();
            if (t <= refTime && t >= bestTime) {
                bestTime = t;
                bestVal = s.newValue;
            }
        }
        return bestVal;
    }

    /**
     * Resolve a display name for a category id using current categories,
     * then snapshots (deleted), then expense text, then fallback.
     */
    static resolveRowName(categoryId, categories, snapshots, expensesForId) {
        if (categoryId === '__none__') {
            return { name: 'без категории', deleted: false };
        }
        const cat = (categories || []).find(c => c.id === categoryId);
        if (cat && cat.name) {
            return { name: cat.name, deleted: false };
        }
        let snapName = null;
        let snapTime = -Infinity;
        for (let i = 0; i < snapshots.length; i++) {
            const s = snapshots[i];
            if (s.entityId === categoryId && s.entityName) {
                const t = new Date(s.timestamp).getTime();
                if (t >= snapTime) { snapTime = t; snapName = s.entityName; }
            }
        }
        if (snapName) {
            return { name: snapName + ' (удалена)', deleted: true };
        }
        let expName = null;
        let expTime = -Infinity;
        (expensesForId || []).forEach(e => {
            const t = new Date(e.date).getTime();
            const nm = e.categoryName || e.category;
            if (nm && t >= expTime) { expTime = t; expName = nm; }
        });
        if (expName) {
            return { name: expName + ' (удалена)', deleted: true };
        }
        return { name: 'без категории', deleted: false };
    }

    static daysInclusive(start, end) {
        const MS = 24 * 60 * 60 * 1000;
        return Math.round((end.getTime() - start.getTime()) / MS) + 1;
    }

    /**
     * Build the full report model.
     * options: { fromKey, toKey } (inclusive period keys). When absent, the
     * default clean range is used (periods starting on/after DIRTY_TAIL_END).
     */
    static buildReport(expenses, categories, snapshots, config, options = {}) {
        const periodStartDay = this.getPeriodStartDay(config);
        const now = Date.now();
        const snaps = Array.isArray(snapshots) ? snapshots : [];
        const exps = Array.isArray(expenses) ? expenses : [];

        const allPeriods = this.buildPeriods(exps, periodStartDay);

        const fromKey = options.fromKey || null;
        const toKey = options.toKey || null;

        const periods = allPeriods.filter(p => {
            const k = Number(this.periodKey(p));
            if (fromKey && k < Number(fromKey)) return false;
            if (toKey && k > Number(toKey)) return false;
            if (!fromKey && p.periodStart.getTime() < DIRTY_TAIL_END.getTime()) return false;
            return true;
        });

        const current = DateUtils.getCurrentPeriod(periodStartDay);
        const currentKey = this.periodKey(current);

        const periodMeta = periods.map(p => {
            const key = this.periodKey(p);
            const isCurrent = key === currentKey;
            let partial = null;
            if (isCurrent) {
                const daysTotal = this.daysInclusive(p.periodStart, p.periodEnd);
                const today = new Date();
                let daysPassed = this.daysInclusive(p.periodStart, today);
                if (daysPassed < 1) daysPassed = 1;
                if (daysPassed > daysTotal) daysPassed = daysTotal;
                partial = { daysPassed, daysTotal };
            }
            return {
                key,
                start: p.periodStart,
                end: p.periodEnd,
                label: DateUtils.formatPeriod(p),
                isCurrent,
                partial
            };
        });

        const facts = {};
        const expensesByCat = {};
        exps.forEach(e => {
            const cid = e.categoryId || '__none__';
            if (!expensesByCat[cid]) expensesByCat[cid] = [];
            expensesByCat[cid].push(e);

            const d = new Date(e.date);
            const pm = periodMeta.find(p => d.getTime() >= p.start.getTime() && d.getTime() <= p.end.getTime());
            if (!pm) return;
            const amt = typeof e.amountEUR === 'number' ? e.amountEUR : 0;
            if (!facts[cid]) facts[cid] = {};
            if (facts[cid][pm.key] === undefined) facts[cid][pm.key] = 0;
            facts[cid][pm.key] += amt;
        });

        const categoryIds = Object.keys(expensesByCat);
        let rows = categoryIds.map(cid => {
            const nameInfo = this.resolveRowName(cid, categories, snaps, expensesByCat[cid]);

            const limitPred = s => s.type === 'category_limit' && s.field === 'limit' && s.entityId === cid;
            const pctPred = s => s.type === 'category_limit' && s.field === 'percentage' && s.entityId === cid;

            const cells = {};
            const closedFacts = [];
            periodMeta.forEach(pm => {
                const factRaw = facts[cid] ? facts[cid][pm.key] : undefined;
                const fact = (factRaw === undefined) ? null : factRaw;
                const refTime = pm.isCurrent ? now : pm.end.getTime();
                const limit = cid === '__none__' ? null : this.valueInEffect(snaps, limitPred, refTime);
                const percentage = cid === '__none__' ? null : this.valueInEffect(snaps, pctPred, refTime);
                const execPct = (fact !== null && typeof limit === 'number' && limit > 0)
                    ? (fact / limit) * 100 : null;
                cells[pm.key] = { fact, limit, percentage, execPct, partial: pm.isCurrent };
                if (!pm.isCurrent && fact !== null) closedFacts.push(fact);
            });

            const avg = closedFacts.length ? closedFacts.reduce((a, b) => a + b, 0) / closedFacts.length : null;
            const min = closedFacts.length ? Math.min(...closedFacts) : null;
            const max = closedFacts.length ? Math.max(...closedFacts) : null;

            return {
                categoryId: cid,
                name: nameInfo.name,
                deleted: nameInfo.deleted,
                cells,
                avg,
                min,
                max,
                _closedFacts: closedFacts
            };
        }).filter(r => {
            return periodMeta.some(pm => r.cells[pm.key] && r.cells[pm.key].fact !== null);
        });

        const orderOf = {};
        (categories || []).forEach(c => { orderOf[c.id] = c.order || 9999; });
        rows.sort((a, b) => {
            const oa = orderOf[a.categoryId] !== undefined ? orderOf[a.categoryId] : 9999;
            const ob = orderOf[b.categoryId] !== undefined ? orderOf[b.categoryId] : 9999;
            if (oa !== ob) return oa - ob;
            return a.name.localeCompare(b.name, 'ru');
        });

        const closedPeriods = periodMeta.filter(p => !p.isCurrent);
        let topUp = [];
        let topDown = [];
        if (closedPeriods.length >= 3) {
            const lastClosed = closedPeriods[closedPeriods.length - 1];
            const movers = [];
            rows.forEach(r => {
                const cell = r.cells[lastClosed.key];
                if (!cell || cell.fact === null || r.avg === null) return;
                if (r._closedFacts.length < 3) return;
                const delta = cell.fact - r.avg;
                const deltaPct = r.avg !== 0 ? (delta / r.avg) * 100 : null;
                movers.push({ name: r.name, categoryId: r.categoryId, delta, deltaPct, last: cell.fact, avg: r.avg });
            });
            const up = movers.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta);
            const down = movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta);
            topUp = up.slice(0, 3);
            topDown = down.slice(0, 3);
        }

        return {
            periodStartDay,
            periods: periodMeta,
            allPeriods: allPeriods.map(p => ({ key: this.periodKey(p), label: DateUtils.formatPeriod(p) })),
            rows,
            topUp,
            topDown
        };
    }

    static execClass(execPct) {
        if (execPct === null || execPct === undefined) return null;
        if (execPct <= 95) return 'ok';
        if (execPct <= 100) return 'warn';
        return 'over';
    }
}

export default ReportUtils;

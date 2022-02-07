import { ObjectData } from './objectdata.js';
import { hex } from './util.js';
export class Monster extends ObjectData {
    constructor(parent, data) {
        super(parent, data.id);
        const scaling = data.scaling;
        const expectedLevel = (level(scaling) + this.level) / 2;
        const expectedAttack = expectedLevel + playerSword(scaling, this.elements);
        this.hits = (this.hp + 1) / (expectedAttack - this.def);
        this.sdef = this.def / expectedAttack;
        const expectedPlayerHP = Math.min(255, Math.max(16, 32 + expectedLevel * 16));
        this.satk =
            (this.atk - expectedPlayerDefense(scaling, this.attackType)) /
                expectedPlayerHP;
        this.extraDifficulty = data.difficulty || 0;
        this.monsterClass = data.class;
        const vsExp = processExpReward(this.expReward) / baselineExp(scaling);
        const vsGld = VANILLA_GOLD_DROPS[this.goldDrop] / baselineGold(scaling);
        this.type = data.type || 'monster';
        this.wealth = vsGld && vsGld / (vsExp + vsGld);
    }
    isBoss() {
        return this.type === 'boss';
    }
    isProjectile() {
        return this.type === 'projectile';
    }
    isBird() {
        const a = this.rom.objectActions[this.action];
        return (a === null || a === void 0 ? void 0 : a.data.bird) || false;
    }
    isFlyer() {
        const a = this.rom.objectActions[this.action];
        return (a === null || a === void 0 ? void 0 : a.data.bird) || (a === null || a === void 0 ? void 0 : a.data.moth) || false;
    }
    placement() {
        var _a, _b;
        return (_b = (_a = this.rom.objectActions[this.action]) === null || _a === void 0 ? void 0 : _a.data.placement) !== null && _b !== void 0 ? _b : 'normal';
    }
    clearance() {
        var _a;
        return ((_a = this.rom.objectActions[this.action]) === null || _a === void 0 ? void 0 : _a.data.large) ? 6 : 3;
    }
    totalDifficulty() {
        return this.toughness() + this.attack() + this.statusDifficulty() +
            this.immunities() + this.movement();
    }
    collectDifficulty(f, r) {
        let result = f(this);
        const child = this.spawnedChild();
        if (child instanceof Monster) {
            result = r(result, child.collectDifficulty(f, r));
        }
        const death = this.spawnedReplacement();
        if (death instanceof Monster) {
            result = r(result, death.collectDifficulty(f, r));
        }
        return result;
    }
    toughness() {
        return this.collectDifficulty(m => lookup(m.hits, 0, [2, 1], [3, 2], [5, 3], [7, 4], [10, 5], [13, 6]), Math.max);
    }
    attack() {
        return this.collectDifficulty(m => {
            if (m.attackType && m.statusEffect)
                return 0;
            return lookup(m.satk, 0, [.04, 1], [.08, 2], [.13, 3], [.18, 4], [.25, 5], [.33, 6]);
        }, Math.max);
    }
    addStatusEffects(set) {
        if (this.attackType && this.statusEffect) {
            set.add(this.statusEffect);
        }
        else if (!this.attackType && this.poison) {
            set.add(0);
        }
        const replacement = this.spawnedReplacement();
        if (replacement instanceof Monster)
            replacement.addStatusEffects(set);
        const child = this.spawnedChild();
        if (child instanceof Monster)
            child.addStatusEffects(set);
    }
    statusDifficulty() {
        const set = new Set();
        this.addStatusEffects(set);
        let result = 0;
        for (const status of set) {
            result += STATUS_DIFFICULTY[status];
        }
        return result;
    }
    immunities() {
        let count = 0;
        let elems = this.elements;
        while (elems) {
            if (elems & 1)
                count++;
            elems >>>= 1;
        }
        return (count && 1 << (count - 1));
    }
    movement() {
        return this.collectDifficulty(m => {
            const actionData = this.rom.objectActions[m.action];
            const child = m.spawnedChild();
            let result = m.extraDifficulty;
            if (actionData) {
                result += (actionData.data.movement || 0);
                if (actionData.data.large)
                    result++;
                if (child && !child.statusEffect) {
                    result += (actionData.data.projectile || 0);
                }
            }
            if (this.metasprite === 0xa7)
                result += 2;
            return result;
        }, (a, b) => a + b);
    }
    totalReward() {
        return this.totalDifficulty() / 4;
    }
    normalizedGold() {
        if (!this.wealth)
            return 0;
        const dgld = this.totalDifficulty() * this.wealth * 0.6;
        return Math.max(1, Math.min(15, Math.round(dgld)));
    }
    normalizedExp() {
        if (this.wealth === 1)
            return 0;
        const sexp = 0.488 + this.totalDifficulty() * (1 - this.wealth) * 0.256;
        return Math.max(1, Math.min(255, Math.round(sexp * 32)));
    }
    toString() {
        return `Monster $${hex(this.id)} ${this.name}`;
    }
}
function processExpReward(raw) {
    return raw < 128 ? raw : (raw & 0x7f) << 4;
}
function baselineExp(scaling) {
    return 2 ** (scaling / 5 - 1);
}
const STATUS_DIFFICULTY = [
    2,
    1,
    3,
    2,
    4,
];
const VANILLA_GOLD_DROPS = [
    0, 1, 2, 4, 8, 16, 30, 50,
    100, 200, 400, 50, 100, 200, 400, 500,
];
function baselineGold(scaling) {
    return 2 ** (scaling / 7 - 1);
}
function level(scaling) {
    return scaling < 24 ? 1 + scaling / 3 : (scaling + 12) / 4;
}
function playerSword(scaling, elements = 0) {
    const bestOwned = scaling < 10 ? 1 : scaling < 18 ? 2 : scaling < 38 ? 4 : 8;
    for (let i = bestOwned; i; i >>>= 1) {
        if (!(i & elements))
            return i << 1;
    }
    return bestOwned << 1;
}
function expectedPlayerDefense(scaling, attackType) {
    return level(scaling) + playerArmor(scaling, attackType);
}
function playerArmor(scaling, attackType) {
    if (!attackType) {
        return lookup(scaling, 2, [6, 6], [18, 10], [25, 14], [30, 18], [40, 24], [46, 32]);
    }
    else {
        return lookup(scaling, 2, [6, 6], [18, 8], [25, 12], [30, 18], [37, 24], [42, 32]);
    }
}
function lookup(x, first, ...table) {
    for (let i = table.length - 1; i >= 0; i--) {
        const [k, v] = table[i];
        if (x >= k)
            return v;
    }
    return first;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uc3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9qcy9yb20vbW9uc3Rlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFN0MsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQWFoQyxNQUFNLE9BQU8sT0FBUSxTQUFRLFVBQVU7SUEyQnJDLFlBQVksTUFBZSxFQUFFLElBQWlCO1FBQzVDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBU3ZCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDN0IsTUFBTSxhQUFhLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN4RCxNQUFNLGNBQWMsR0FBRyxhQUFhLEdBQUcsV0FBVyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDM0UsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsR0FBRyxjQUFjLENBQUM7UUFFdEMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsYUFBYSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDOUUsSUFBSSxDQUFDLElBQUk7WUFDTCxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcscUJBQXFCLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFD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QUFFO1FBQ2YsT0FBTyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3JGO1NBQU07UUFDTCxPQUFPLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDcEY7QUFDSCxDQUFDO0FBRUQsU0FBUyxNQUFNLENBQTBCLENBQUksRUFDSixLQUFRLEVBQ1IsR0FBRyxLQUFxQztJQUMvRSxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDMUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEIsSUFBSSxDQUFDLElBQUksQ0FBQztZQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ3RCO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgT2JqZWN0RGF0YSB9IGZyb20gJy4vb2JqZWN0ZGF0YS5qcyc7XG5pbXBvcnQgeyBQbGFjZW1lbnQgfSBmcm9tICcuL29iamVjdGFjdGlvbi5qcyc7XG5pbXBvcnQgeyBoZXggfSBmcm9tICcuL3V0aWwuanMnO1xuaW1wb3J0IHR5cGUgeyBPYmplY3RzIH0gZnJvbSAnLi9vYmplY3RzLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBNb25zdGVyRGF0YSB7XG4gIGlkOiBudW1iZXIsXG4gIHNjYWxpbmc6IG51bWJlcixcbiAgZGlmZmljdWx0eT86IG51bWJlcjtcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIHR5cGU/OiAnYm9zcycgfCAncHJvamVjdGlsZSc7IC8vIG9yIGRlZmF1bHQ6IG1vbnN0ZXJcbn1cblxudHlwZSBEaWZmaWN1bHR5RmFjdG9yID0gbnVtYmVyICYge19fZGlmZmljdWx0eV9fOiBuZXZlcn07XG5cbmV4cG9ydCBjbGFzcyBNb25zdGVyIGV4dGVuZHMgT2JqZWN0RGF0YSB7XG5cbiAgLy8gLyoqIFZhbmlsbGEgZGVmZW5zZS4gSWYgY2hhbmdpbmcgZGVmIGJlZm9yZSBzY2FsaW5nLCBjaGFuZ2UgdmRlZiBpbnN0ZWFkLiAqL1xuICAvLyB2ZGVmOiBudW1iZXI7XG4gIC8vIC8qKiBWYW5pbGxhIGhlYWx0aC4gSWYgY2hhbmdpbmcgaHAgYmVmb3JlIHNjYWxpbmcsIGNoYW5nZSB2aHAgaW5zdGVhZC4gKi9cbiAgLy8gdmhwOiBudW1iZXI7XG5cbiAgLyoqIFRhcmdldCBudW1iZXIgb2YgaGl0cyB0byBraWxsIG1vbnN0ZXIuICovXG4gIGhpdHM6IG51bWJlcjtcbiAgLyoqIFRhcmdldCBkZWZlbnNlIGFzIGEgZnJhY3Rpb24gb2YgZXhwZWN0ZWQgcGxheWVyIGF0dGFjay4gKi9cbiAgc2RlZjogbnVtYmVyO1xuICAvKiogVGFyZ2V0IGF0dGFjayBhcyBhIGZyYWN0aW9uIG9mIGV4cGVjdGVkIHBsYXllciBIUC4gKi9cbiAgc2F0azogbnVtYmVyO1xuXG4gIC8qKiBSZWxhdGl2ZSBmcmFjdGlvbiBvZiByZXdhcmQgZ2l2ZW4gYXMgbW9uZXkuICovXG4gIHdlYWx0aDogbnVtYmVyO1xuXG4gIC8qKiBFeHRyYSBkaWZmaWN1bHR5IGZhY3Rvci4gKi9cbiAgZXh0cmFEaWZmaWN1bHR5OiBudW1iZXI7XG5cbiAgc2hpZnRQYXR0ZXJucz86IFNldDxudW1iZXI+O1xuICB1c2VkUGFsZXR0ZXM/OiByZWFkb25seSBudW1iZXJbXTtcbiAgdXNlZFBhdHRlcm5zPzogcmVhZG9ubHkgbnVtYmVyW107XG5cbiAgdHlwZTogJ21vbnN0ZXInIHwgJ2Jvc3MnIHwgJ3Byb2plY3RpbGUnO1xuICBtb25zdGVyQ2xhc3M/OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IocGFyZW50OiBPYmplY3RzLCBkYXRhOiBNb25zdGVyRGF0YSkge1xuICAgIHN1cGVyKHBhcmVudCwgZGF0YS5pZCk7XG5cbiAgICAvLyBNYWtlIHRoZSBzY2FsaW5nIGNhbGN1bGF0aW9ucyBoZXJlXG4gICAgLy8gRmlyc3QgZGVyaXZlIHZhbHVlcyBjb3JyZXNwb25kaW5nIHRvIHZhbmlsbGEuXG5cbiAgICAvLyBFeHBlY3RlZCB2YW5pbGxhIHBsYXllciBsZXZlbCBjb21lcyBmcm9tIGF2ZXJhZ2luZyAoMSkgdGhlIGV4cGVjdGVkXG4gICAgLy8gbGV2ZWwgZnJvbSB0aGUgbWFudWFsbHktc3BlY2lmaWVkIChlcXVpdmFsZW50KSBzY2FsaW5nIGxldmVsIHdpdGhcbiAgICAvLyAoMikgdGhlIG1pbmltdW0gbGV2ZWwgdG8gZGFtYWdlIChmcm9tIHRoZSBvYmplY3QgZGF0YSkuICBUaGlzIG1heSBiZVxuICAgIC8vIGZyYWN0aW9uYWwuXG4gICAgY29uc3Qgc2NhbGluZyA9IGRhdGEuc2NhbGluZztcbiAgICBjb25zdCBleHBlY3RlZExldmVsID0gKGxldmVsKHNjYWxpbmcpICsgdGhpcy5sZXZlbCkgLyAyO1xuICAgIGNvbnN0IGV4cGVjdGVkQXR0YWNrID0gZXhwZWN0ZWRMZXZlbCArIHBsYXllclN3b3JkKHNjYWxpbmcsIHRoaXMuZWxlbWVudHMpO1xuICAgIHRoaXMuaGl0cyA9ICh0aGlzLmhwICsgMSkgLyAoZXhwZWN0ZWRBdHRhY2sgLSB0aGlzLmRlZik7XG4gICAgdGhpcy5zZGVmID0gdGhpcy5kZWYgLyBleHBlY3RlZEF0dGFjaztcblxuICAgIGNvbnN0IGV4cGVjdGVkUGxheWVySFAgPSBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDE2LCAzMiArIGV4cGVjdGVkTGV2ZWwgKiAxNikpO1xuICAgIHRoaXMuc2F0ayA9XG4gICAgICAgICh0aGlzLmF0ayAtIGV4cGVjdGVkUGxheWVyRGVmZW5zZShzY2FsaW5nLCB0aGlzLmF0dGFja1R5cGUpKSAvXG4gICAgICAgIGV4cGVjdGVkUGxheWVySFA7XG4gICAgdGhpcy5leHRyYURpZmZpY3VsdHkgPSBkYXRhLmRpZmZpY3VsdHkgfHwgMDtcbiAgICB0aGlzLm1vbnN0ZXJDbGFzcyA9IGRhdGEuY2xhc3M7XG5cbiAgICAvLyBDb21wdXRlIHZhbmlsbGEgc2NhbGVkIGV4cCBhbmQgZ29sZC5cbiAgICBjb25zdCB2c0V4cCA9IHByb2Nlc3NFeHBSZXdhcmQodGhpcy5leHBSZXdhcmQpIC8gYmFzZWxpbmVFeHAoc2NhbGluZyk7XG4gICAgY29uc3QgdnNHbGQgPSBWQU5JTExBX0dPTERfRFJPUFNbdGhpcy5nb2xkRHJvcF0gLyBiYXNlbGluZUdvbGQoc2NhbGluZyk7XG5cbiAgICB0aGlzLnR5cGUgPSBkYXRhLnR5cGUgfHwgJ21vbnN0ZXInO1xuICAgIHRoaXMud2VhbHRoID0gdnNHbGQgJiYgdnNHbGQgLyAodnNFeHAgKyB2c0dsZCk7XG4gIH1cblxuICBpc0Jvc3MoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gJ2Jvc3MnO1xuICB9XG5cbiAgaXNQcm9qZWN0aWxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT09ICdwcm9qZWN0aWxlJztcbiAgfVxuXG4gIGlzQmlyZCgpOiBib29sZWFuIHtcbiAgICBjb25zdCBhID0gdGhpcy5yb20ub2JqZWN0QWN0aW9uc1t0aGlzLmFjdGlvbl07XG4gICAgcmV0dXJuIGE/LmRhdGEuYmlyZCB8fCBmYWxzZTtcbiAgfVxuXG4gIGlzRmx5ZXIoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgYSA9IHRoaXMucm9tLm9iamVjdEFjdGlvbnNbdGhpcy5hY3Rpb25dO1xuICAgIHJldHVybiBhPy5kYXRhLmJpcmQgfHwgYT8uZGF0YS5tb3RoIHx8IGZhbHNlO1xuICB9XG5cbiAgcGxhY2VtZW50KCk6IFBsYWNlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMucm9tLm9iamVjdEFjdGlvbnNbdGhpcy5hY3Rpb25dPy5kYXRhLnBsYWNlbWVudCA/PyAnbm9ybWFsJztcbiAgfVxuXG4gIGNsZWFyYW5jZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLnJvbS5vYmplY3RBY3Rpb25zW3RoaXMuYWN0aW9uXT8uZGF0YS5sYXJnZSA/IDYgOiAzO1xuICB9XG5cbiAgdG90YWxEaWZmaWN1bHR5KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMudG91Z2huZXNzKCkgKyB0aGlzLmF0dGFjaygpICsgdGhpcy5zdGF0dXNEaWZmaWN1bHR5KCkgK1xuICAgICAgICB0aGlzLmltbXVuaXRpZXMoKSArIHRoaXMubW92ZW1lbnQoKTtcbiAgfVxuXG4gIGNvbGxlY3REaWZmaWN1bHR5KGY6IChtOiBNb25zdGVyKSA9PiBudW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIHI6IChhOiBudW1iZXIsIGI6IG51bWJlcikgPT4gbnVtYmVyKTogRGlmZmljdWx0eUZhY3RvciB7XG4gICAgbGV0IHJlc3VsdCA9IGYodGhpcyk7XG4gICAgY29uc3QgY2hpbGQgPSB0aGlzLnNwYXduZWRDaGlsZCgpO1xuICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIE1vbnN0ZXIpIHtcbiAgICAgIHJlc3VsdCA9IHIocmVzdWx0LCBjaGlsZC5jb2xsZWN0RGlmZmljdWx0eShmLCByKSk7XG4gICAgfVxuICAgIGNvbnN0IGRlYXRoID0gdGhpcy5zcGF3bmVkUmVwbGFjZW1lbnQoKTtcbiAgICBpZiAoZGVhdGggaW5zdGFuY2VvZiBNb25zdGVyKSB7XG4gICAgICByZXN1bHQgPSByKHJlc3VsdCwgZGVhdGguY29sbGVjdERpZmZpY3VsdHkoZiwgcikpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0IGFzIERpZmZpY3VsdHlGYWN0b3I7XG4gIH1cblxuICAvKiogQmFzaWMgbWVhc3VyZSBvZiBob3cgaGFyZCB0aGUgZW5lbXkgaXMgdG8ga2lsbC4gKi9cbiAgdG91Z2huZXNzKCk6IERpZmZpY3VsdHlGYWN0b3Ige1xuICAgIHJldHVybiB0aGlzLmNvbGxlY3REaWZmaWN1bHR5KFxuICAgICAgICBtID0+IGxvb2t1cChtLmhpdHMsIDAsIFsyLCAxXSwgWzMsIDJdLCBbNSwgM10sIFs3LCA0XSwgWzEwLCA1XSwgWzEzLCA2XSksXG4gICAgICAgIE1hdGgubWF4KTtcbiAgfVxuXG4gIC8qKiBIb3cgaGFyZCB0aGUgbW9uc3RlciBoaXRzLiAqL1xuICBhdHRhY2soKTogRGlmZmljdWx0eUZhY3RvciB7XG4gICAgLy8gaWdub3JlIEFUSyBmb3IgcHJvamVjdGlsZXMgd2l0aCBzdGF0dXNcbiAgICByZXR1cm4gdGhpcy5jb2xsZWN0RGlmZmljdWx0eShcbiAgICAgICAgbSA9PiB7XG4gICAgICAgICAgaWYgKG0uYXR0YWNrVHlwZSAmJiBtLnN0YXR1c0VmZmVjdCkgcmV0dXJuIDA7XG4gICAgICAgICAgcmV0dXJuIGxvb2t1cChtLnNhdGssXG4gICAgICAgICAgICAgICAgICAgICAgICAwLCBbLjA0LCAxXSwgWy4wOCwgMl0sIFsuMTMsIDNdLCBbLjE4LCA0XSwgWy4yNSwgNV0sIFsuMzMsIDZdKTtcbiAgICAgICAgfSwgTWF0aC5tYXgpO1xuICB9XG5cbiAgYWRkU3RhdHVzRWZmZWN0cyhzZXQ6IFNldDxudW1iZXI+KTogdm9pZCB7XG4gICAgLy8gVE9ETyAtIGlmIHdlIGFsbG93IHByb2plY3RpbGUgcG9pc29uIG9yIGJvZHkgcGFyYWx5c2lzLCBhY2NvdW50IGZvciB0aGF0LlxuICAgIGlmICh0aGlzLmF0dGFja1R5cGUgJiYgdGhpcy5zdGF0dXNFZmZlY3QpIHtcbiAgICAgIHNldC5hZGQodGhpcy5zdGF0dXNFZmZlY3QpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuYXR0YWNrVHlwZSAmJiB0aGlzLnBvaXNvbikge1xuICAgICAgc2V0LmFkZCgwKTtcbiAgICB9XG4gICAgY29uc3QgcmVwbGFjZW1lbnQgPSB0aGlzLnNwYXduZWRSZXBsYWNlbWVudCgpO1xuICAgIGlmIChyZXBsYWNlbWVudCBpbnN0YW5jZW9mIE1vbnN0ZXIpIHJlcGxhY2VtZW50LmFkZFN0YXR1c0VmZmVjdHMoc2V0KTtcbiAgICBjb25zdCBjaGlsZCA9IHRoaXMuc3Bhd25lZENoaWxkKCk7XG4gICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgTW9uc3RlcikgY2hpbGQuYWRkU3RhdHVzRWZmZWN0cyhzZXQpO1xuICB9XG5cbiAgc3RhdHVzRGlmZmljdWx0eSgpOiBEaWZmaWN1bHR5RmFjdG9yIHtcbiAgICBjb25zdCBzZXQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICB0aGlzLmFkZFN0YXR1c0VmZmVjdHMoc2V0KTtcbiAgICBsZXQgcmVzdWx0ID0gMDtcbiAgICBmb3IgKGNvbnN0IHN0YXR1cyBvZiBzZXQpIHtcbiAgICAgIHJlc3VsdCArPSBTVEFUVVNfRElGRklDVUxUWVtzdGF0dXNdO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0IGFzIERpZmZpY3VsdHlGYWN0b3I7XG4gIH1cblxuICBpbW11bml0aWVzKCk6IERpZmZpY3VsdHlGYWN0b3Ige1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgbGV0IGVsZW1zID0gdGhpcy5lbGVtZW50cztcbiAgICB3aGlsZSAoZWxlbXMpIHtcbiAgICAgIGlmIChlbGVtcyAmIDEpIGNvdW50Kys7XG4gICAgICBlbGVtcyA+Pj49IDE7XG4gICAgfVxuICAgIHJldHVybiAoY291bnQgJiYgMSA8PCAoY291bnQgLSAxKSkgYXMgRGlmZmljdWx0eUZhY3RvcjtcbiAgfVxuXG4gIG1vdmVtZW50KCk6IERpZmZpY3VsdHlGYWN0b3Ige1xuICAgIHJldHVybiB0aGlzLmNvbGxlY3REaWZmaWN1bHR5KFxuICAgICAgICBtID0+IHtcbiAgICAgICAgICBjb25zdCBhY3Rpb25EYXRhID0gdGhpcy5yb20ub2JqZWN0QWN0aW9uc1ttLmFjdGlvbl07XG4gICAgICAgICAgY29uc3QgY2hpbGQgPSBtLnNwYXduZWRDaGlsZCgpO1xuICAgICAgICAgIGxldCByZXN1bHQgPSBtLmV4dHJhRGlmZmljdWx0eTtcbiAgICAgICAgICBpZiAoYWN0aW9uRGF0YSkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IChhY3Rpb25EYXRhLmRhdGEubW92ZW1lbnQgfHwgMCk7XG4gICAgICAgICAgICBpZiAoYWN0aW9uRGF0YS5kYXRhLmxhcmdlKSByZXN1bHQrKztcbiAgICAgICAgICAgIC8vIE5PVEU6IE1vdGhSZXNpZHVlU291cmNlIGhhcyBzdGF0dXNEaWZmaWN1bHR5IGJ1dCBub3Qgc3RhdHVzRWZmZWN0LlxuICAgICAgICAgICAgaWYgKGNoaWxkICYmICFjaGlsZC5zdGF0dXNFZmZlY3QpIHtcbiAgICAgICAgICAgICAgcmVzdWx0ICs9IChhY3Rpb25EYXRhLmRhdGEucHJvamVjdGlsZSB8fCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTaGFkb3dzIGdldCArMiwgYWN0aW9uICQyNiB0cmlnZ2VycyB0aGlzIG9uIG1ldGFzcHJpdGUgJGE3XG4gICAgICAgICAgaWYgKHRoaXMubWV0YXNwcml0ZSA9PT0gMHhhNykgcmVzdWx0ICs9IDI7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LCAoYSwgYikgPT4gYSArIGIpO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIG51bWJlciAwLi42IG9yIHNvXG4gIHRvdGFsUmV3YXJkKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMudG90YWxEaWZmaWN1bHR5KCkgLyA0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBudW1iZXIgZnJvbSAwIHRvIDE1LCByZXByZXNlbnRpbmcgREdMRC8yLCBvciAwIGZvciBubyBnb2xkLlxuICAgKi9cbiAgbm9ybWFsaXplZEdvbGQoKTogbnVtYmVyIHtcbiAgICBpZiAoIXRoaXMud2VhbHRoKSByZXR1cm4gMDtcbiAgICAvLyBBdmVyYWdlIGRpZmZpY3VsdHkgaXMgMTAsIGF2ZXJhZ2Ugd2VhbHRoIGlzIDAuNSA9PiAzIGlzIGF2ZXJhZ2UgZGdsZC5cbiAgICAvLyBNYXggZGlmZmljdWx0eSBvZiAyNSwgd2l0aCB3ZWFsdGggb2YgMSA9PiAxNSBkZ2xkLlxuICAgIGNvbnN0IGRnbGQgPSB0aGlzLnRvdGFsRGlmZmljdWx0eSgpICogdGhpcy53ZWFsdGggKiAwLjY7XG4gICAgcmV0dXJuIE1hdGgubWF4KDEsIE1hdGgubWluKDE1LCBNYXRoLnJvdW5kKGRnbGQpKSk7XG4gIH1cblxuICAvKiogUmV0dXJucyBhIG51bWJlciBmcm9tIDAgdG8gMjU1LCByZXByZXNlbnRpbmcgU0VYUC8zMi4gKi9cbiAgbm9ybWFsaXplZEV4cCgpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLndlYWx0aCA9PT0gMSkgcmV0dXJuIDA7XG4gICAgLy8gQXZnIGRpZmZpY3VsdHkgMTAsIHdlYWx0aCAwLjUgPT4gc2V4cCAxLjc2OFxuICAgIC8vIFNsaW1lIGRpZmZpY3VsdHkgNCwgd2VhbHRoIDAuNSA9PiBzZXhwIDFcbiAgICAvLyBNYXggZGlmZmljdWx0eSAyNSwgd2VhbHRoIDAgPT4gc2V4cCA2Ljg4OCA9PiAyMjAgLyAzMlxuICAgIGNvbnN0IHNleHAgPSAwLjQ4OCArIHRoaXMudG90YWxEaWZmaWN1bHR5KCkgKiAoMSAtIHRoaXMud2VhbHRoKSAqIDAuMjU2O1xuICAgIHJldHVybiBNYXRoLm1heCgxLCBNYXRoLm1pbigyNTUsIE1hdGgucm91bmQoc2V4cCAqIDMyKSkpO1xuICB9XG5cbiAgLy8gLyoqIENvbmZpZ3VyZXMgYSBzcGF3biBiYXNlZCBvbiB0aGUgY2hvc2VuIGJhbmtzIGZvciBhIGxvY2F0aW9uLiAqL1xuICAvLyBjb25maWd1cmUobG9jYXRpb246IExvY2F0aW9uLCBzcGF3bjogU3Bhd24pIHtcbiAgLy8gICBpZiAoIXRoaXMuc2hpZnRQYXR0ZXJucykgcmV0dXJuO1xuICAvLyAgIGlmICh0aGlzLnNoaWZ0UGF0dGVybnMuaGFzKGxvY2F0aW9uLnNwcml0ZVBhbGV0dGVzWzBdKSkgc3Bhd24ucGF0dGVybkJhbmsgPSAwO1xuICAvLyAgIGlmICh0aGlzLnNoaWZ0UGF0dGVybnMuaGFzKGxvY2F0aW9uLnNwcml0ZVBhbGV0dGVzWzFdKSkgc3Bhd24ucGF0dGVybkJhbmsgPSAxO1xuICAvLyB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIGBNb25zdGVyICQke2hleCh0aGlzLmlkKX0gJHt0aGlzLm5hbWV9YDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzRXhwUmV3YXJkKHJhdzogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIHJhdyA8IDEyOCA/IHJhdyA6IChyYXcgJiAweDdmKSA8PCA0O1xufVxuXG5mdW5jdGlvbiBiYXNlbGluZUV4cChzY2FsaW5nOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gMiAqKiAoc2NhbGluZyAvIDUgLSAxKTtcbn1cblxuY29uc3QgU1RBVFVTX0RJRkZJQ1VMVFk6IG51bWJlcltdID0gW1xuICAyLCAvLyAwIHBvaXNvbiAoaGFuZGxlZCBzcGVjaWFsKVxuICAxLCAvLyAxIHBhcmFseXNpc1xuICAzLCAvLyAyIHN0b25lXG4gIDIsIC8vIDMgbXAgZHJhaW5cbiAgNCwgLy8gNCBjdXJzZVxuXTtcblxuY29uc3QgVkFOSUxMQV9HT0xEX0RST1BTID0gW1xuICAgIDAsICAgMSwgICAyLCAgIDQsICAgOCwgIDE2LCAgMzAsICA1MCxcbiAgMTAwLCAyMDAsIDQwMCwgIDUwLCAxMDAsIDIwMCwgNDAwLCA1MDAsXG5dO1xuXG5mdW5jdGlvbiBiYXNlbGluZUdvbGQoc2NhbGluZzogbnVtYmVyKTogbnVtYmVyIHtcbiAgLy8gVG8gY29udmVydCBhIHNjYWxpbmcgZmFjdG9yIHRvIERHTEQsIG5vdGUgdGhhdCBwYXRjaGVkIGdvbGQgZHJvcHMgc2NhbGUgYnlcbiAgLy8gdGhlIGdvbGRlbiByYXRpbyAoMS42MTgpLi4uP1xuICByZXR1cm4gMiAqKiAoc2NhbGluZyAvIDcgLSAxKTtcbn1cblxuLy8gR29sZCBhbmQgRXhwZXJpZW5jZSBzY2FsaW5nOlxuLy8gIC0gZ29hbDogYmFzZSBleHAgc2hvdWxkIGJlIHJvdWdobHkgMSBhdCAwIGFuZCAxMDAwIGFyb3VuZCA0MC00OFxuLy8gICAgICAgICAgdmFyaWFuY2Ugd2l0aGluIGEgZGlmZmljdWx0eSBsZXZlbDogZmFjdG9yIG9mIDg/XG4vLyAgICAgICAgICBzbyBpZiB3ZSB3YW50IHRvIHN0YXJ0IHNhdHVyYXRpbmcgYXJvdW5kIDQ0LCB0aGVuIHdlXG4vLyAgICAgICAgICBzaG91bGQgc2hvb3QgZm9yIGEgYmFzZSBvZiAyNTYgYXQgNDUsXG4vLyAgICAgICAgICBNYXliZSBzbG93IGRvd24gdGhlIGdyb3d0aCB0byAxLzUsIHNvIHRoYXQgd2UncmUgYXQgMC41IGF0IDA/XG4vLyAgICAgICAgICBiYXNlID0gMl4ocy81LTEpXG4vLyAgICAgICAgICBzY2FsZSBmYWN0b3IgPSAwLi44IGZvciB2YXJpb3VzIG5vcm1hbCBlbmVtaWVzLCAxNmlzaCBmb3IgYm9zc2VzLlxuLy8gIC0gZ29hbDogYmFzZSBnb2xkIHNob3VsZCBiZSAwLjUgYXQgMCBhbmQgNTAgYXQgNDcgKGluIHZhbmlsbGEgdW5pdHMpLlxuLy8gICAgICAgICAgYmFzZSA9IDJeKHMvNy0xKVxuLy8gVGhpcyBtYWtlcyB0aGUgYXZlcmFnZSBcIndlYWx0aFwiIChkZWZpbmVkIGFzIHNnbGQgLyAoc2V4cCArIHNnbGQpKSB0b1xuLy8gYXZlcmFnZSByb3VnaGx5IDAuNSBhdCBhbGwgZGlmZmljdWx0eSBsZXZlbHMuXG5cbi8vIERFQVRIIFJFUExBQ0VNRU5UUy4uLj9cblxuXG5cbi8vIFNjYWxpbmcgZm9ybXVsYXNcbmZ1bmN0aW9uIGxldmVsKHNjYWxpbmc6IG51bWJlcik6IG51bWJlciB7XG4gIC8vIFRPRE8gLSBub3Qgc3VwZXIgdXNlZnVsLi4uP1xuICAvLyBTZWVtcyBsaWtlIEkgYWN0dWFsbHkgd2FudCB0aGUgbGV2ZWwsIG5vdCB0aGUgc2NhbGluZy5cbiAgLy8gNy1vZmYgY29tcHJlc3Npb21cbiAgcmV0dXJuIHNjYWxpbmcgPCAyNCA/IDEgKyBzY2FsaW5nIC8gMyA6IChzY2FsaW5nICsgMTIpIC8gNDtcbn1cblxuLyoqIEJlc3Qgc3dvcmQgb3duZWQgYnkgcGxheWVyIGF0IGdpdmVuICh2YW5pbGxhIGVxdWl2YWxlbnQpIHNjYWxpbmcuICovXG5mdW5jdGlvbiBwbGF5ZXJTd29yZChzY2FsaW5nOiBudW1iZXIsIGVsZW1lbnRzOiBudW1iZXIgPSAwKTogbnVtYmVyIHtcbiAgY29uc3QgYmVzdE93bmVkID0gc2NhbGluZyA8IDEwID8gMSA6IHNjYWxpbmcgPCAxOCA/IDIgOiBzY2FsaW5nIDwgMzggPyA0IDogODtcbiAgZm9yIChsZXQgaSA9IGJlc3RPd25lZDsgaTsgaSA+Pj49IDEpIHtcbiAgICBpZiAoIShpICYgZWxlbWVudHMpKSByZXR1cm4gaSA8PCAxO1xuICB9XG4gIHJldHVybiBiZXN0T3duZWQgPDwgMTtcbn1cblxuLyoqIEV4cGVjdGVkIHRvdGFsIGRlZmVuc2UuICovXG5mdW5jdGlvbiBleHBlY3RlZFBsYXllckRlZmVuc2Uoc2NhbGluZzogbnVtYmVyLCBhdHRhY2tUeXBlOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gbGV2ZWwoc2NhbGluZykgKyBwbGF5ZXJBcm1vcihzY2FsaW5nLCBhdHRhY2tUeXBlKTtcbn1cblxuLyoqIEV4cGVjdGVkIGFybW9yL3NoaWVsZCBkZWZlbnNlIGF0IGdpdmVuIHNjYWxpbmcuICovXG5mdW5jdGlvbiBwbGF5ZXJBcm1vcihzY2FsaW5nOiBudW1iZXIsIGF0dGFja1R5cGU6IG51bWJlcik6IG51bWJlciB7XG4gIGlmICghYXR0YWNrVHlwZSkgeyAvLyBib2R5IGRhbWFnZVxuICAgIHJldHVybiBsb29rdXAoc2NhbGluZywgMiwgWzYsIDZdLCBbMTgsIDEwXSwgWzI1LCAxNF0sIFszMCwgMThdLCBbNDAsIDI0XSwgWzQ2LCAzMl0pO1xuICB9IGVsc2UgeyAvLyBwcm9qZWN0aWxlIGRhbWFnZVxuICAgIHJldHVybiBsb29rdXAoc2NhbGluZywgMiwgWzYsIDZdLCBbMTgsIDhdLCBbMjUsIDEyXSwgWzMwLCAxOF0sIFszNywgMjRdLCBbNDIsIDMyXSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbG9va3VwPEsgZXh0ZW5kcyBDb21wYXJhYmxlLCBWPih4OiBLLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXJzdDogVixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4udGFibGU6IFJlYWRvbmx5QXJyYXk8cmVhZG9ubHkgW0ssIFZdPik6IFYge1xuICBmb3IgKGxldCBpID0gdGFibGUubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBbaywgdl0gPSB0YWJsZVtpXTtcbiAgICBpZiAoeCA+PSBrKSByZXR1cm4gdjtcbiAgfVxuICByZXR1cm4gZmlyc3Q7XG59XG5cbnR5cGUgQ29tcGFyYWJsZSA9IG51bWJlciB8IHN0cmluZztcbiJdfQ==
export class Deque {
    constructor() {
        this.buffer = new Array(16);
        this.mask = 0xf;
        this.start = 0;
        this.end = 0;
        this.size = 0;
    }
    get length() {
        return this.size;
    }
    upsize(target) {
        while (this.mask < target) {
            if (this.end <= this.start)
                this.start += this.mask + 1;
            this.mask = this.mask << 1 | 1;
            this.buffer = this.buffer.concat(this.buffer);
        }
        this.size = target;
    }
    push(...elems) {
        this.upsize(this.size + elems.length);
        for (const elem of elems) {
            this.buffer[this.end] = elem;
            this.end = (this.end + 1) & this.mask;
        }
    }
    pop() {
        if (!this.size)
            return undefined;
        this.end = (this.end - 1) & this.mask;
        this.size--;
        return this.buffer[this.end];
    }
    peek() {
        if (!this.size)
            return undefined;
        return this.buffer[(this.end - 1) & this.mask];
    }
    unshift(...elems) {
        this.upsize(this.size + elems.length);
        for (const elem of elems) {
            this.start = (this.start - 1) & this.mask;
            this.buffer[this.start] = elem;
        }
    }
    shift() {
        if (!this.size)
            return undefined;
        const result = this.buffer[this.start];
        this.start = (this.start + 1) & this.mask;
        this.size--;
        return result;
    }
    front() {
        if (!this.size)
            return undefined;
        return this.buffer[this.start];
    }
    toString() {
        const parts = new Array(this.size);
        for (let i = 0; i < this.size; i++) {
            parts[i] = this.buffer[(this.start + i) & this.mask];
        }
        return `[${parts.join(', ')}]`;
    }
}
export const breakLines = (str, len) => {
    str = str.trim();
    const out = [];
    while (str.length > len) {
        let b = str.substring(0, len).lastIndexOf(' ');
        if (b < 0)
            b = len;
        out.push(str.substring(0, b).trim());
        str = str.substring(b).trim();
    }
    out.push(str.trim());
    return out;
};
export class UsageError extends Error {
}
export class SuffixTrie {
    constructor(key = '') {
        this.key = key;
        this.next = new Map();
    }
    get(key) {
        let t = this;
        for (let i = key.length - 1; i >= 0 && t; i++) {
            t = t.next.get(key[i]);
        }
        return t && t.data;
    }
    with(c) {
        let t = this.next.get(c);
        if (!t)
            this.next.set(c, (t = new SuffixTrie(c + this.key)));
        return t;
    }
    set(key, value) {
        let t = this;
        for (let i = key.length - 1; i >= 0 && t; i++) {
            t = t.with(key[i]);
        }
        t.data = value;
    }
    *values() {
        const stack = [this];
        while (stack.length) {
            const top = stack.pop();
            if (top.data)
                yield top.data;
            stack.push(...top.next.values());
        }
    }
}
export class DefaultMap extends Map {
    constructor(supplier, init) {
        super(init);
        this.supplier = supplier;
    }
    get(key) {
        let value = super.get(key);
        if (value == null)
            super.set(key, value = this.supplier(key));
        return value;
    }
}
export class IndexedSet {
    constructor() {
        this.forward = [];
        this.reverse = new Map();
    }
    add(elem) {
        let result = this.reverse.get(elem);
        if (result == null)
            this.reverse.set(elem, result = this.forward.push(elem) - 1);
        return result;
    }
    get(index) {
        return this.forward[index];
    }
}
export var iters;
(function (iters_1) {
    function* concat(...iters) {
        for (const iter of iters) {
            yield* iter;
        }
    }
    iters_1.concat = concat;
})(iters || (iters = {}));
const INVALIDATED = Symbol('Invalidated');
const SIZE = Symbol('Size');
class SetMultimapSetView {
    constructor(ownerMap, ownerKey, currentSet) {
        this.ownerMap = ownerMap;
        this.ownerKey = ownerKey;
        this.currentSet = currentSet;
    }
    getCurrentSet() {
        if (!this.currentSet || this.currentSet[INVALIDATED]) {
            this.currentSet = this.ownerMap.get(this.ownerKey) || new Set();
        }
        return this.currentSet;
    }
    mutateSet(f) {
        const set = this.getCurrentSet();
        const size = set.size;
        try {
            return f(set);
        }
        finally {
            this.ownerMap[SIZE] += set.size - size;
            if (!set.size) {
                this.ownerMap.delete(this.ownerKey);
                set[INVALIDATED] = true;
            }
        }
    }
    add(elem) {
        this.mutateSet(s => s.add(elem));
        return this;
    }
    has(elem) {
        return this.getCurrentSet().has(elem);
    }
    clear() {
        this.mutateSet(s => s.clear());
    }
    delete(elem) {
        return this.mutateSet(s => s.delete(elem));
    }
    [Symbol.iterator]() {
        return this.getCurrentSet()[Symbol.iterator]();
    }
    values() {
        return this.getCurrentSet().values();
    }
    keys() {
        return this.getCurrentSet().keys();
    }
    entries() {
        return this.getCurrentSet().entries();
    }
    forEach(callback, thisArg) {
        this.getCurrentSet().forEach(callback, thisArg);
    }
    get size() {
        return this.getCurrentSet().size;
    }
    get [Symbol.toStringTag]() {
        return 'Set';
    }
}
Reflect.setPrototypeOf(SetMultimapSetView.prototype, Set.prototype);
export class SetMultimap {
    constructor(entries = []) {
        this.map = new Map();
        this.map[SIZE] = 0;
        for (const [k, v] of entries) {
            this.add(k, v);
        }
    }
    get size() {
        return this.map[SIZE];
    }
    get(k) {
        return new SetMultimapSetView(this.map, k, this.map.get(k));
    }
    add(k, v) {
        let set = this.map.get(k);
        if (!set)
            this.map.set(k, set = new Set());
        const size = set.size;
        set.add(v);
        this.map[SIZE] += set.size - size;
    }
}
export class Multiset {
    constructor(entries = []) {
        this.entries = new DefaultMap(() => 0, entries);
    }
    add(elem) {
        this.entries.set(elem, this.entries.get(elem) + 1);
    }
    delete(elem) {
        const count = this.entries.get(elem) - 1;
        if (count > 0) {
            this.entries.set(elem, count);
        }
        else {
            this.entries.delete(elem);
        }
    }
    unique() {
        return this.entries.size;
    }
    count(elem) {
        return this.entries.has(elem) ? this.entries.get(elem) : 0;
    }
    [Symbol.iterator]() {
        return this.entries.entries();
    }
}
export function assertNever(x) {
    throw new Error(`non-exhaustive check: ${x}`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9qcy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sT0FBTyxLQUFLO0lBQWxCO1FBRVUsV0FBTSxHQUFzQixJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMxQyxTQUFJLEdBQVcsR0FBRyxDQUFDO1FBQ25CLFVBQUssR0FBVyxDQUFDLENBQUM7UUFDbEIsUUFBRyxHQUFXLENBQUMsQ0FBQztRQUNoQixTQUFJLEdBQVcsQ0FBQyxDQUFDO0lBK0QzQixDQUFDO0lBN0RDLElBQUksTUFBTTtRQUNSLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztJQUNuQixDQUFDO0lBRUQsTUFBTSxDQUFDLE1BQWM7UUFDbkIsT0FBTyxJQUFJLENBQUMsSUFBSSxHQUFHLE1BQU0sRUFBRTtZQUN6QixJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUs7Z0JBQUUsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMvQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUMvQztRQUNELElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDO0lBQ3JCLENBQUM7SUFFRCxJQUFJLENBQUMsR0FBRyxLQUFVO1FBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxD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O0FBQ2hELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY2xhc3MgRGVxdWU8VD4ge1xuXG4gIHByaXZhdGUgYnVmZmVyOiAoVCB8IHVuZGVmaW5lZClbXSA9IG5ldyBBcnJheSgxNik7XG4gIHByaXZhdGUgbWFzazogbnVtYmVyID0gMHhmO1xuICBwcml2YXRlIHN0YXJ0OiBudW1iZXIgPSAwO1xuICBwcml2YXRlIGVuZDogbnVtYmVyID0gMDtcbiAgcHJpdmF0ZSBzaXplOiBudW1iZXIgPSAwO1xuXG4gIGdldCBsZW5ndGgoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5zaXplO1xuICB9XG5cbiAgdXBzaXplKHRhcmdldDogbnVtYmVyKSB7XG4gICAgd2hpbGUgKHRoaXMubWFzayA8IHRhcmdldCkge1xuICAgICAgaWYgKHRoaXMuZW5kIDw9IHRoaXMuc3RhcnQpIHRoaXMuc3RhcnQgKz0gdGhpcy5tYXNrICsgMTtcbiAgICAgIHRoaXMubWFzayA9IHRoaXMubWFzayA8PCAxIHwgMTtcbiAgICAgIHRoaXMuYnVmZmVyID0gdGhpcy5idWZmZXIuY29uY2F0KHRoaXMuYnVmZmVyKTtcbiAgICB9XG4gICAgdGhpcy5zaXplID0gdGFyZ2V0O1xuICB9XG5cbiAgcHVzaCguLi5lbGVtczogVFtdKSB7XG4gICAgdGhpcy51cHNpemUodGhpcy5zaXplICsgZWxlbXMubGVuZ3RoKTtcbiAgICBmb3IgKGNvbnN0IGVsZW0gb2YgZWxlbXMpIHtcbiAgICAgIHRoaXMuYnVmZmVyW3RoaXMuZW5kXSA9IGVsZW07XG4gICAgICB0aGlzLmVuZCA9ICh0aGlzLmVuZCArIDEpICYgdGhpcy5tYXNrO1xuICAgIH1cbiAgfVxuXG4gIHBvcCgpOiBUIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoIXRoaXMuc2l6ZSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB0aGlzLmVuZCA9ICh0aGlzLmVuZCAtIDEpICYgdGhpcy5tYXNrO1xuICAgIHRoaXMuc2l6ZS0tO1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlclt0aGlzLmVuZF07XG4gIH1cblxuICBwZWVrKCk6IFQgfCB1bmRlZmluZWQge1xuICAgIGlmICghdGhpcy5zaXplKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlclsodGhpcy5lbmQgLSAxKSAmIHRoaXMubWFza107XG4gIH1cblxuICB1bnNoaWZ0KC4uLmVsZW1zOiBUW10pIHtcbiAgICB0aGlzLnVwc2l6ZSh0aGlzLnNpemUgKyBlbGVtcy5sZW5ndGgpO1xuICAgIGZvciAoY29uc3QgZWxlbSBvZiBlbGVtcykge1xuICAgICAgdGhpcy5zdGFydCA9ICh0aGlzLnN0YXJ0IC0gMSkgJiB0aGlzLm1hc2s7XG4gICAgICB0aGlzLmJ1ZmZlclt0aGlzLnN0YXJ0XSA9IGVsZW07XG4gICAgfVxuICB9XG5cbiAgc2hpZnQoKTogVCB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKCF0aGlzLnNpemUpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5idWZmZXJbdGhpcy5zdGFydF07XG4gICAgdGhpcy5zdGFydCA9ICh0aGlzLnN0YXJ0ICsgMSkgJiB0aGlzLm1hc2s7XG4gICAgdGhpcy5zaXplLS07XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGZyb250KCk6IFQgfCB1bmRlZmluZWQge1xuICAgIGlmICghdGhpcy5zaXplKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlclt0aGlzLnN0YXJ0XTtcbiAgfVxuXG4gIHRvU3RyaW5nKCkge1xuICAgIGNvbnN0IHBhcnRzID0gbmV3IEFycmF5KHRoaXMuc2l6ZSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNpemU7IGkrKykge1xuICAgICAgcGFydHNbaV0gPSB0aGlzLmJ1ZmZlclsodGhpcy5zdGFydCArIGkpICYgdGhpcy5tYXNrXTtcbiAgICB9XG4gICAgcmV0dXJuIGBbJHtwYXJ0cy5qb2luKCcsICcpfV1gO1xuICB9XG59XG5cbi8vIC8qKiBAdGVtcGxhdGUgVCAqL1xuLy8gZXhwb3J0IGNsYXNzIERlcXVlU2V0IHtcbi8vICAgY29uc3RydWN0b3IoKSB7XG4vLyAgICAgLyoqIEB0eXBlIHshQXJyYXk8VHx1bmRlZmluZWQ+fSAqL1xuLy8gICAgIHRoaXMuYnVmZmVyID0gbmV3IEFycmF5KDE2KTtcbi8vICAgICAvKiogQHR5cGUge251bWJlcn0gKi9cbi8vICAgICB0aGlzLm1hc2sgPSAweGY7XG4vLyAgICAgLyoqIEB0eXBlIHtudW1iZXJ9ICovXG4vLyAgICAgdGhpcy5zdGFydCA9IDA7XG4vLyAgICAgLyoqIEB0eXBlIHtudW1iZXJ9ICovXG4vLyAgICAgdGhpcy5lbmQgPSAwO1xuLy8gICAgIC8qKiBAdHlwZSB7bnVtYmVyfSAqL1xuLy8gICAgIHRoaXMuc2l6ZSA9IDA7IC8vIHJlYWRvbmx5IGV4dGVybmFsbHlcbi8vICAgICAvKiogQHR5cGUgeyFTZXQ8VD59ICovXG4vLyAgICAgdGhpcy5zZXQgPSBuZXcgU2V0KCk7XG4vLyAgIH1cblxuLy8gICB1cHNpemUodGFyZ2V0KSB7XG4vLyAgICAgd2hpbGUgKHRoaXMubWFzayA8IHRhcmdldCkge1xuLy8gICAgICAgdGhpcy5zdGFydCArPSB0aGlzLm1hc2sgKyAxO1xuLy8gICAgICAgdGhpcy5tYXNrID0gdGhpcy5tYXNrIDw8IDEgfCAxO1xuLy8gICAgICAgdGhpcy5idWZmZXIgPSB0aGlzLmJ1ZmZlci5jb25jYXQodGhpcy5idWZmZXIpO1xuLy8gICAgIH1cbi8vICAgICB0aGlzLnNpemUgPSB0YXJnZXQ7XG4vLyAgIH1cblxuLy8gICAvKiogQHBhcmFtIHsuLi5UfSBlbGVtICovXG4vLyAgIHB1c2goLi4uZWxlbXMpIHtcbi8vICAgICB0aGlzLnVwc2l6ZSh0aGlzLnNpemUgKyBlbGVtcy5sZW5ndGgpO1xuLy8gICAgIGZvciAoY29uc3QgZWxlbSBvZiBlbGVtcykge1xuLy8gICAgICAgaWYgKHRoaXMuc2V0LmhhcyhlbGVtKSkge1xuLy8gICAgICAgICB0aGlzLnNpemUtLTtcbi8vICAgICAgICAgY29udGludWU7XG4vLyAgICAgICB9XG4vLyAgICAgICB0aGlzLmJ1ZmZlclt0aGlzLmVuZF0gPSBlbGVtO1xuLy8gICAgICAgdGhpcy5lbmQgPSAodGhpcy5lbmQgKyAxKSAmIHRoaXMubWFzaztcbi8vICAgICB9XG4vLyAgIH1cblxuLy8gICAvKiogQHJldHVybiB7VHx1bmRlZmluZWR9ICovXG4vLyAgIHBvcCgpIHtcbi8vICAgICBpZiAoIXRoaXMuc2l6ZSkgcmV0dXJuIHVuZGVmaW5lZDtcbi8vICAgICB0aGlzLmVuZCA9ICh0aGlzLmVuZCAtIDEpICYgdGhpcy5tYXNrO1xuLy8gICAgIHRoaXMuc2l6ZS0tO1xuLy8gICAgIGNvbnN0IG91dCA9IHRoaXMuYnVmZmVyW3RoaXMuZW5kXTtcbi8vICAgICB0aGlzLnNldC5kZWxldGUob3V0KTtcbi8vICAgICByZXR1cm4gb3V0O1xuLy8gICB9XG5cbi8vICAgLyoqIEByZXR1cm4ge1R8dW5kZWZpbmVkfSAqL1xuLy8gICBwZWVrKCkge1xuLy8gICAgIGlmICghdGhpcy5zaXplKSByZXR1cm4gdW5kZWZpbmVkO1xuLy8gICAgIHJldHVybiB0aGlzLmJ1ZmZlclsodGhpcy5lbmQgLSAxKSAmIHRoaXMubWFza107XG4vLyAgIH1cblxuLy8gICAvKiogQHBhcmFtIHsuLi5UfSBlbGVtICovXG4vLyAgIHVuc2hpZnQoLi4uZWxlbXMpIHtcbi8vICAgICB0aGlzLnVwc2l6ZSh0aGlzLnNpemUgKyBlbGVtcy5sZW5ndGgpO1xuLy8gICAgIGZvciAoY29uc3QgZWxlbSBvZiBlbGVtcykge1xuLy8gICAgICAgaWYgKHRoaXMuc2V0LmhhcyhlbGVtKSkge1xuLy8gICAgICAgICB0aGlzLnNpemUtLTtcbi8vICAgICAgICAgY29udGludWU7XG4vLyAgICAgICB9XG4vLyAgICAgICB0aGlzLnN0YXJ0ID0gKHRoaXMuc3RhcnQgLSAxKSAmIHRoaXMubWFzaztcbi8vICAgICAgIHRoaXMuYnVmZmVyW3RoaXMuc3RhcnRdID0gZWxlbTtcbi8vICAgICB9XG4vLyAgIH1cblxuLy8gICAvKiogQHJldHVybiB7VHx1bmRlZmluZWR9ICovXG4vLyAgIHNoaWZ0KCkge1xuLy8gICAgIGlmICghdGhpcy5zaXplKSByZXR1cm4gdW5kZWZpbmVkO1xuLy8gICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuYnVmZmVyW3RoaXMuc3RhcnRdO1xuLy8gICAgIHRoaXMuc3RhcnQgPSAodGhpcy5zdGFydCArIDEpICYgdGhpcy5tYXNrO1xuLy8gICAgIHRoaXMuc2l6ZS0tO1xuLy8gICAgIHRoaXMuc2V0LnJlbW92ZShyZXN1bHQpO1xuLy8gICAgIHJldHVybiByZXN1bHQ7XG4vLyAgIH1cblxuLy8gICAvKiogQHJldHVybiB7VHx1bmRlZmluZWR9ICovXG4vLyAgIGZyb250KCkge1xuLy8gICAgIGlmICghdGhpcy5zaXplKSByZXR1cm4gdW5kZWZpbmVkO1xuLy8gICAgIHJldHVybiB0aGlzLmJ1ZmZlclt0aGlzLnN0YXJ0XTtcbi8vICAgfVxuLy8gfVxuXG4vLyBleHBvcnQgY2xhc3MgSW5kZXhlZExpc3Qge1xuLy8gICBjb25zdHJ1Y3RvcigpIHtcbi8vICAgICB0aGlzLmxpc3QgPSBbXTtcbi8vICAgICB0aGlzLm1hcCA9IG5ldyBNYXAoKTtcbi8vICAgfVxuXG4vLyAgIGFkZChlbGVtKSB7XG4vLyAgICAgaWYgKHRoaXMubWFwLmhhcyhlbGVtKSkgcmV0dXJuO1xuLy8gICAgIHRoaXMubWFwLnNldChlbGVtLCB0aGlzLmxpc3QubGVuZ3RoKTtcbi8vICAgICB0aGlzLmxpc3QucHVzaChlbGVtKTtcbi8vICAgfVxuXG4vLyAgIGluZGV4T2YoZWxlbSkge1xuLy8gICAgIHJldHVybiB0aGlzLm1hcC5nZXQoZWxlbSk7XG4vLyAgIH1cblxuLy8gICByZW1vdmUoZWxlbSkge1xuLy8gICAgIC8vIFRPRE8gLSB0aGlzIGlzbid0IHN1cGVyIGVmZmljaWVudC4uLlxuLy8gICAgIC8vIFdlIGNvdWxkIG1haW50YWluIGEgc21hbGwgaGFuZGZ1bCBvZiBzcGxpdCBwb2ludHMuXG4vLyAgICAgLy8gT3IgYSBSZW1vdmFsVHJlZSB3aGVyZSBpdCBzdGFydHMgd2l0aCBhIGZ1bGx5LWJhbGFuY2VkXG4vLyAgICAgLy8gYmluYXJ5IHRyZWUgKGhlaWdodCB+IGxvZyhuKSkgYW5kIHRoZW4gd2UganVzdCByZW1vdmVcbi8vICAgICAvLyBlbGVtZW50cyBmcm9tIHRoZXJlIHNvIHRoYXQgd2Ugb25seSBuZWVkIHRvIHVwZGF0ZVxuLy8gICAgIC8vIE8obG9nKG4pKSBcInNpemVcIiB2YWx1ZXMgb24gdGhlIHdheSB1cC4gIFRob3VnaCB0aGlzXG4vLyAgICAgLy8gZG9lc24ndCBoZWxwIHRvIGFjdHVhbGx5ICpmaW5kKiB0aGUgZWxlbWVudC4uLlxuLy8gICAgIC8vIEFub3RoZXIgb3B0aW9uIHdvdWxkIGJlIHRvIHVzZSB0aGUgYml0cyBvZiB0aGUgaW5kZXhcbi8vICAgICAvLyB0byBrZWVwIHRyYWNrIG9mIHRoZSBudW1iZXIgb2YgcmVtb3ZlZCBlbGVtZW50cyBiZWZvcmUuXG4vLyAgICAgLy8gU28gd2UgaGF2ZSBhIHNhbWUtc2l6ZSBhcnJheSBvZiBudW1iZXJzXG4vLyAgICAgLy8gd2hlcmUgZWFjaCBlbnRyeSB0ZWxscyB0aGUgc2l6ZSB0byBhZGQgZm9yIHRoZSBOdGggb25lLWJpdFxuLy8gICAgIC8vIGFuZCBhbGwgdGhlIGhpZ2hlciBiaXRzLlxuLy8gICAgIC8vICAgMDAgLT4gMFxuLy8gICAgIC8vICAgMDEgLT4gMVxuLy8gICAgIC8vICAgMTAgLT4gMlxuLy8gICAgIC8vICAgMTEgLT4gMyA9IDIgKyAxXG4vLyAgICAgLy8gU3RvcmluZ1xuLy8gICAgIC8vICAgWCMgIC0+IDJcbi8vICAgICAvLyAgIDFYICAtPiAxXG4vLyAgICAgLy8gICAwWCAgLT4gMVxuLy8gICAgIC8vIEZvciBiaWdnZXIgbGlzdCxcbi8vICAgICAvLyAgIDExWCAtPiAxICAgIHN0b3JlZCBhdCAgICAxMTEgPSA3XG4vLyAgICAgLy8gICAxMFggLT4gMSAgICAgICAgICAgICAgICAgMTEwID0gNlxuLy8gICAgIC8vICAgMDFYIC0+IDEgICAgICAgICAgICAgICAgIDEwMSA9IDVcbi8vICAgICAvLyAgIDAwWCAtPiAxICAgICAgICAgICAgICAgICAxMDAgPSA0XG4vLyAgICAgLy8gICAxWCMgLT4gMiAgICAgICAgICAgICAgICAgMDExID0gM1xuLy8gICAgIC8vICAgMFgjIC0+IDIgICAgICAgICAgICAgICAgIDAxMCA9IDJcbi8vICAgICAvLyAgIFgjIyAtPiA0ICAgICAgICAgICAgICAgICAwMDEgPSAxXG4vLyAgICAgLy8gVGhlIHVwc2hvdCBpcyB0aGF0IHdoZW4gcmVtb3ZpbmcgYW4gZWxlbWVudCB3ZSBvbmx5IG5lZWQgdG9cbi8vICAgICAvLyB1cGRhdGUgTyhsb2cobikpIGVsZW1lbnRzLi4uXG4vLyAgICAgLy8gQW5kIHdlIGNhbiBhdm9pZCBzcGxpY2luZyB0aGUgbGlzdCBhbmQgZXZlbiBmaW5kIHRoZSBmaXJzdFxuLy8gICAgIC8vIGVsZW1lbnQgd2l0aCBiaW5hcnkgc2VhcmNoIC0gTyhsb2cobikpXG4vLyAgICAgY29uc3QgaW5kZXggPSB0aGlzLm1hcC5nZXQoZWxlbSk7XG4vLyAgICAgaWYgKGluZGV4ID09IG51bGwpIHJldHVybjtcbi8vICAgICB0aGlzLmxpc3Quc3BsaWNlKGluZGV4LCAxKTtcbi8vICAgICB0aGlzLm1hcC5kZWxldGUoZWxlbSk7XG4vLyAgICAgZm9yIChsZXQgaSA9IGluZGV4OyBpIDwgdGhpcy5saXN0Lmxlbmd0aDsgaSsrKSB7XG4vLyAgICAgICB0aGlzLm1hcC5zZXQodGhpcy5saXN0W2ldLCBpKTtcbi8vICAgICB9XG4vLyAgIH1cblxuLy8gICBbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbi8vICAgICByZXR1cm4gdGhpcy5saXN0W1N5bWJvbC5pdGVyYXRvcl0oKTtcbi8vICAgfVxuLy8gfVxuXG5leHBvcnQgY29uc3QgYnJlYWtMaW5lcyA9IChzdHI6IHN0cmluZywgbGVuOiBudW1iZXIpOiBzdHJpbmdbXSA9PiB7XG4gIHN0ciA9IHN0ci50cmltKCk7XG4gIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXTtcbiAgd2hpbGUgKHN0ci5sZW5ndGggPiBsZW4pIHtcbiAgICBsZXQgYiA9IHN0ci5zdWJzdHJpbmcoMCwgbGVuKS5sYXN0SW5kZXhPZignICcpO1xuICAgIGlmIChiIDwgMCkgYiA9IGxlbjtcbiAgICBvdXQucHVzaChzdHIuc3Vic3RyaW5nKDAsIGIpLnRyaW0oKSk7XG4gICAgc3RyID0gc3RyLnN1YnN0cmluZyhiKS50cmltKCk7XG4gIH1cbiAgb3V0LnB1c2goc3RyLnRyaW0oKSk7XG4gIHJldHVybiBvdXQ7XG59O1xuXG5leHBvcnQgY2xhc3MgVXNhZ2VFcnJvciBleHRlbmRzIEVycm9yIHt9XG5cbmV4cG9ydCBjbGFzcyBTdWZmaXhUcmllPFQ+IHtcbiAgcmVhZG9ubHkgbmV4dCA9IG5ldyBNYXA8c3RyaW5nLCBTdWZmaXhUcmllPFQ+PigpO1xuICBkYXRhOiBUIHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGtleTogc3RyaW5nID0gJycpIHt9XG5cbiAgZ2V0KGtleTogc3RyaW5nKTogVCB8IHVuZGVmaW5lZCB7XG4gICAgbGV0IHQ6IFN1ZmZpeFRyaWU8VD4gfCB1bmRlZmluZWQgPSB0aGlzO1xuICAgIGZvciAobGV0IGkgPSBrZXkubGVuZ3RoIC0gMTsgaSA+PSAwICYmIHQ7IGkrKykge1xuICAgICAgdCA9IHQubmV4dC5nZXQoa2V5W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIHQgJiYgdC5kYXRhO1xuICB9XG5cbiAgd2l0aChjOiBzdHJpbmcpOiBTdWZmaXhUcmllPFQ+IHtcbiAgICBsZXQgdCA9IHRoaXMubmV4dC5nZXQoYyk7XG4gICAgaWYgKCF0KSB0aGlzLm5leHQuc2V0KGMsICh0ID0gbmV3IFN1ZmZpeFRyaWU8VD4oYyArIHRoaXMua2V5KSkpO1xuICAgIHJldHVybiB0O1xuICB9XG5cbiAgc2V0KGtleTogc3RyaW5nLCB2YWx1ZTogVCB8IHVuZGVmaW5lZCkge1xuICAgIGxldCB0OiBTdWZmaXhUcmllPFQ+ID0gdGhpcztcbiAgICBmb3IgKGxldCBpID0ga2V5Lmxlbmd0aCAtIDE7IGkgPj0gMCAmJiB0OyBpKyspIHtcbiAgICAgIHQgPSB0LndpdGgoa2V5W2ldKTtcbiAgICB9XG4gICAgdC5kYXRhID0gdmFsdWU7XG4gIH1cblxuICAqIHZhbHVlcygpOiBJdGVyYWJsZTxUPiB7XG4gICAgY29uc3Qgc3RhY2s6IFN1ZmZpeFRyaWU8VD5bXSA9IFt0aGlzXTtcbiAgICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgICBjb25zdCB0b3AgPSBzdGFjay5wb3AoKSE7XG4gICAgICBpZiAodG9wLmRhdGEpIHlpZWxkIHRvcC5kYXRhO1xuICAgICAgc3RhY2sucHVzaCguLi50b3AubmV4dC52YWx1ZXMoKSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0TWFwPEssIFYgZXh0ZW5kcyB7fT4gZXh0ZW5kcyBNYXA8SywgVj4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHN1cHBsaWVyOiAoa2V5OiBLKSA9PiBWLFxuICAgICAgICAgICAgICBpbml0PzogSXRlcmFibGU8cmVhZG9ubHkgW0ssIFZdPikge1xuICAgIHN1cGVyKGluaXQgYXMgYW55KTsgLy8gTk9URTogTWFwJ3MgZGVjbGFyYXRpb25zIGFyZSBvZmYsIEl0ZXJhYmxlIGlzIGZpbmUuXG4gIH1cbiAgZ2V0KGtleTogSyk6IFYge1xuICAgIGxldCB2YWx1ZSA9IHN1cGVyLmdldChrZXkpO1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSBzdXBlci5zZXQoa2V5LCB2YWx1ZSA9IHRoaXMuc3VwcGxpZXIoa2V5KSk7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRleGVkU2V0PFQgZXh0ZW5kcyB7fT4ge1xuICBwcml2YXRlIGZvcndhcmQ6IFRbXSA9IFtdO1xuICBwcml2YXRlIHJldmVyc2UgPSBuZXcgTWFwPFQsIG51bWJlcj4oKTtcblxuICBhZGQoZWxlbTogVCk6IG51bWJlciB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucmV2ZXJzZS5nZXQoZWxlbSk7XG4gICAgaWYgKHJlc3VsdCA9PSBudWxsKSB0aGlzLnJldmVyc2Uuc2V0KGVsZW0sIHJlc3VsdCA9IHRoaXMuZm9yd2FyZC5wdXNoKGVsZW0pIC0gMSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGdldChpbmRleDogbnVtYmVyKTogVCB7XG4gICAgcmV0dXJuIHRoaXMuZm9yd2FyZFtpbmRleF07XG4gIH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBpdGVycyB7XG4gIC8vIENvbmNhdGVuYXRlcyBpdGVyYWJsZXMuXG4gIGV4cG9ydCBmdW5jdGlvbiAqIGNvbmNhdDxUPiguLi5pdGVyczogQXJyYXk8SXRlcmFibGU8VD4+KTogSXRlcmFibGVJdGVyYXRvcjxUPiB7XG4gICAgZm9yIChjb25zdCBpdGVyIG9mIGl0ZXJzKSB7XG4gICAgICB5aWVsZCAqIGl0ZXI7XG4gICAgfVxuICB9XG59XG5cbi8vIGV4cG9ydCBjbGFzcyBMYWJlbGVkU2V0PFQ+IHtcbi8vICAgcHJpdmF0ZSBtYXA6IE1hcDxTdHJpbmcsIFQ+XG4vLyB9XG5cbmNvbnN0IElOVkFMSURBVEVEID0gU3ltYm9sKCdJbnZhbGlkYXRlZCcpO1xuY29uc3QgU0laRSA9IFN5bWJvbCgnU2l6ZScpO1xuXG5jbGFzcyBTZXRNdWx0aW1hcFNldFZpZXc8SywgVj4gaW1wbGVtZW50cyBTZXQ8Vj4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IG93bmVyTWFwOiBNYXA8SywgU2V0PFY+PixcbiAgICAgICAgICAgICAgcHJpdmF0ZSByZWFkb25seSBvd25lcktleTogSywgcHJpdmF0ZSBjdXJyZW50U2V0PzogU2V0PFY+KSB7fVxuICBwcml2YXRlIGdldEN1cnJlbnRTZXQoKSB7XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRTZXQgfHwgKHRoaXMuY3VycmVudFNldCBhcyBhbnkpW0lOVkFMSURBVEVEXSkge1xuICAgICAgdGhpcy5jdXJyZW50U2V0ID0gdGhpcy5vd25lck1hcC5nZXQodGhpcy5vd25lcktleSkgfHwgbmV3IFNldDxWPigpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5jdXJyZW50U2V0O1xuICB9XG4gIHByaXZhdGUgbXV0YXRlU2V0PFI+KGY6IChzOiBTZXQ8Vj4pID0+IFIpOiBSIHtcbiAgICBjb25zdCBzZXQgPSB0aGlzLmdldEN1cnJlbnRTZXQoKTtcbiAgICBjb25zdCBzaXplID0gc2V0LnNpemU7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBmKHNldCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgICh0aGlzLm93bmVyTWFwIGFzIGFueSlbU0laRV0gKz0gc2V0LnNpemUgLSBzaXplO1xuICAgICAgaWYgKCFzZXQuc2l6ZSkge1xuICAgICAgICB0aGlzLm93bmVyTWFwLmRlbGV0ZSh0aGlzLm93bmVyS2V5KTtcbiAgICAgICAgKHNldCBhcyBhbnkpW0lOVkFMSURBVEVEXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFkZChlbGVtOiBWKTogdGhpcyB7XG4gICAgdGhpcy5tdXRhdGVTZXQocyA9PiBzLmFkZChlbGVtKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaGFzKGVsZW06IFYpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5nZXRDdXJyZW50U2V0KCkuaGFzKGVsZW0pO1xuICB9XG4gIGNsZWFyKCk6IHZvaWQge1xuICAgIHRoaXMubXV0YXRlU2V0KHMgPT4gcy5jbGVhcigpKTtcbiAgfVxuICBkZWxldGUoZWxlbTogVik6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm11dGF0ZVNldChzID0+IHMuZGVsZXRlKGVsZW0pKTtcbiAgfVxuICBbU3ltYm9sLml0ZXJhdG9yXSgpOiBJdGVyYWJsZUl0ZXJhdG9yPFY+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRDdXJyZW50U2V0KClbU3ltYm9sLml0ZXJhdG9yXSgpO1xuICB9XG4gIHZhbHVlcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFY+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRDdXJyZW50U2V0KCkudmFsdWVzKCk7XG4gIH1cbiAga2V5cygpOiBJdGVyYWJsZUl0ZXJhdG9yPFY+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRDdXJyZW50U2V0KCkua2V5cygpO1xuICB9XG4gIGVudHJpZXMoKTogSXRlcmFibGVJdGVyYXRvcjxbViwgVl0+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRDdXJyZW50U2V0KCkuZW50cmllcygpO1xuICB9XG4gIGZvckVhY2g8VD4oY2FsbGJhY2s6ICh2YWx1ZTogViwga2V5OiBWLCBzZXQ6IFNldDxWPikgPT4gdm9pZCwgdGhpc0FyZz86IFQpOiB2b2lkIHtcbiAgICB0aGlzLmdldEN1cnJlbnRTZXQoKS5mb3JFYWNoKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgfVxuICBnZXQgc2l6ZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmdldEN1cnJlbnRTZXQoKS5zaXplO1xuICB9XG4gIGdldCBbU3ltYm9sLnRvU3RyaW5nVGFnXSgpOiBzdHJpbmcge1xuICAgIHJldHVybiAnU2V0JztcbiAgfVxufVxuLy8gRml4ICdpbnN0YW5jZW9mJyB0byB3b3JrIHByb3Blcmx5IHdpdGhvdXQgcmVxdWlyaW5nIGFjdHVhbCBzdXBlcmNsYXNzLi4uXG5SZWZsZWN0LnNldFByb3RvdHlwZU9mKFNldE11bHRpbWFwU2V0Vmlldy5wcm90b3R5cGUsIFNldC5wcm90b3R5cGUpO1xuXG5leHBvcnQgY2xhc3MgU2V0TXVsdGltYXA8SywgVj4ge1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgbWFwID0gbmV3IE1hcDxLLCBTZXQ8Vj4+KCk7XG5cbiAgY29uc3RydWN0b3IoZW50cmllczogSXRlcmFibGU8cmVhZG9ubHkgW0ssIFZdPiA9IFtdKSB7XG4gICAgKHRoaXMubWFwIGFzIGFueSlbU0laRV0gPSAwO1xuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIGVudHJpZXMpIHtcbiAgICAgIHRoaXMuYWRkKGssIHYpO1xuICAgIH1cbiAgfVxuXG4gIGdldCBzaXplKCk6IG51bWJlciB7XG4gICAgcmV0dXJuICh0aGlzLm1hcCBhcyBhbnkpW1NJWkVdO1xuICB9XG5cbiAgZ2V0KGs6IEspOiBTZXQ8Vj4ge1xuICAgIHJldHVybiBuZXcgU2V0TXVsdGltYXBTZXRWaWV3KHRoaXMubWFwLCBrLCB0aGlzLm1hcC5nZXQoaykpO1xuICB9XG5cbiAgYWRkKGs6IEssIHY6IFYpOiB2b2lkIHtcbiAgICBsZXQgc2V0ID0gdGhpcy5tYXAuZ2V0KGspO1xuICAgIGlmICghc2V0KSB0aGlzLm1hcC5zZXQoaywgc2V0ID0gbmV3IFNldCgpKTtcbiAgICBjb25zdCBzaXplID0gc2V0LnNpemU7XG4gICAgc2V0LmFkZCh2KTtcbiAgICAodGhpcy5tYXAgYXMgYW55KVtTSVpFXSArPSBzZXQuc2l6ZSAtIHNpemU7XG4gIH1cblxuICAvLyBUT0RPIC0gaXRlcmF0aW9uP1xufVxuXG5cbmV4cG9ydCBjbGFzcyBNdWx0aXNldDxUPiBpbXBsZW1lbnRzIEl0ZXJhYmxlPFtULCBudW1iZXJdPiB7XG4gIHByaXZhdGUgZW50cmllczogRGVmYXVsdE1hcDxULCBudW1iZXI+O1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzOiBJdGVyYWJsZTxbVCwgbnVtYmVyXT4gPSBbXSkge1xuICAgIHRoaXMuZW50cmllcyA9IG5ldyBEZWZhdWx0TWFwKCgpID0+IDAsIGVudHJpZXMpO1xuICB9XG4gIGFkZChlbGVtOiBUKSB7XG4gICAgdGhpcy5lbnRyaWVzLnNldChlbGVtLCB0aGlzLmVudHJpZXMuZ2V0KGVsZW0pICsgMSk7XG4gIH1cbiAgZGVsZXRlKGVsZW06IFQpIHtcbiAgICBjb25zdCBjb3VudCA9IHRoaXMuZW50cmllcy5nZXQoZWxlbSkgLSAxO1xuICAgIGlmIChjb3VudCA+IDApIHtcbiAgICAgIHRoaXMuZW50cmllcy5zZXQoZWxlbSwgY291bnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVudHJpZXMuZGVsZXRlKGVsZW0pO1xuICAgIH1cbiAgfVxuICB1bmlxdWUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzLnNpemU7XG4gIH1cbiAgY291bnQoZWxlbTogVCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcy5oYXMoZWxlbSkgPyB0aGlzLmVudHJpZXMuZ2V0KGVsZW0pIDogMDtcbiAgfVxuICBbU3ltYm9sLml0ZXJhdG9yXSgpOiBJdGVyYWJsZUl0ZXJhdG9yPFtULCBudW1iZXJdPiB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcy5lbnRyaWVzKCk7XG4gIH1cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0TmV2ZXIoeDogbmV2ZXIpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihgbm9uLWV4aGF1c3RpdmUgY2hlY2s6ICR7eH1gKTtcbn1cbiJdfQ==
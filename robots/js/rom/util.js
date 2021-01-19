export function upperCamelToSpaces(upperCamel) {
    return upperCamel.replace(/([a-z])([A-Z0-9])/g, '$1 $2')
        .replace(/Of/g, 'of')
        .replace(/_/g, ' - ');
}
export function seq(x, f = (i) => i) {
    return new Array(x).fill(0).map((_, i) => f(i));
}
export function slice(arr, start, len) {
    return arr.slice(start, start + len);
}
export function tuple(arr, start, len) {
    return Array.from(arr.slice(start, start + len));
}
export function signed(x) {
    return x < 0x80 ? x : x - 0x100;
}
export function unsigned(x) {
    return x < 0 ? x + 0x100 : x;
}
export function varSlice(arr, start, width, sentinel, end = Infinity, func) {
    if (!func)
        func = (x) => x;
    const out = [];
    while (start + width <= end && arr[start] !== sentinel) {
        out.push(func(arr.slice(start, start + width)));
        start += width;
    }
    return out;
}
export function addr(arr, i, offset = 0) {
    return (arr[i] | arr[i + 1] << 8) + offset;
}
export function group(width, arr, func) {
    if (!func)
        func = (x) => x;
    return seq(Math.max(0, Math.floor(arr.length / width)), i => func(slice(arr, i * width, width)));
}
export function reverseBits(x) {
    return ((x * 0x0802 & 0x22110) | (x * 0x8020 & 0x88440)) * 0x10101 >>> 16 & 0xff;
}
export function countBits(x) {
    x -= x >> 1 & 0x55;
    x = (x & 0x33) + (x >> 2 & 0x33);
    return (x + (x >> 4)) & 0xf;
}
export function hex(id) {
    return id != null ? id.toString(16).padStart(2, '0') : String(id);
}
export function hex4(id) {
    return id.toString(16).padStart(4, '0');
}
export function hex5(id) {
    return id.toString(16).padStart(5, '0');
}
export function concatIterables(iters) {
    const out = [];
    for (const iter of iters) {
        for (const elem of iter) {
            out.push(elem);
        }
    }
    return out;
}
export function readBigEndian(data, offset) {
    return data[offset] << 8 | data[offset + 1];
}
export function readLittleEndian(data, offset) {
    return data[offset + 1] << 8 | data[offset];
}
export function readString(arr, address, end = 0) {
    const bytes = [];
    while (arr[address] != end) {
        bytes.push(arr[address++]);
    }
    return String.fromCharCode(...bytes);
}
export function writeLittleEndian(data, offset, value) {
    data[offset] = value & 0xff;
    data[offset + 1] = value >>> 8;
}
export function writeString(arr, address, str) {
    for (let i = 0, len = str.length; i < len; i++) {
        arr[address + i] = str.charCodeAt(i);
    }
}
export function write(data, offset, values) {
    data.subarray(offset, offset + values.length).set(values);
}
export class FlagListType {
    constructor(last, clear) {
        this.last = last;
        this.clear = clear;
    }
    read(data, offset = 0) {
        const flags = [];
        while (true) {
            const hi = data[offset++];
            const lo = data[offset++];
            const flag = (hi & 3) << 8 | lo;
            const signed = hi & this.clear ? ~flag : flag;
            flags.push(signed);
            if (hi & this.last)
                return flags;
        }
    }
    bytes(flags) {
        const bytes = [];
        for (let i = 0; i < flags.length; i++) {
            let flag = flags[i];
            if (flag < 0)
                flag = (this.clear << 8) | ~flag;
            if (i === flags.length - 1)
                flag |= (this.last << 8);
            bytes.push(flag >>> 8);
            bytes.push(flag & 0xff);
        }
        return bytes;
    }
    write(data, flags, offset = 0) {
        const bytes = this.bytes(flags);
        for (let i = 0; i < bytes.length; i++) {
            data[i + offset] = bytes[i];
        }
    }
}
export const DIALOG_FLAGS = new FlagListType(0x40, 0x80);
export const ITEM_GET_FLAGS = new FlagListType(0x40, 0x80);
export const ITEM_USE_FLAGS = new FlagListType(0x40, 0x80);
export const SPAWN_CONDITION_FLAGS = new FlagListType(0x80, 0x20);
export function initializer() {
    const tag = Symbol();
    function f(...args) {
        return { tag, args };
    }
    f.commit = (instance, builder) => {
        for (const prop of Object.getOwnPropertyNames(instance)) {
            const value = instance[prop];
            if (value.tag !== tag)
                continue;
            instance[prop] = builder(prop, ...value.args);
        }
    };
    return f;
}
export class DataTuple {
    constructor(data) {
        this.data = data;
    }
    [Symbol.iterator]() {
        return this.data[Symbol.iterator]();
    }
    hex() {
        return Array.from(this.data, hex).join(' ');
    }
    clone() {
        return new this.constructor(this.data);
    }
    static make(length, props) {
        const cls = class extends DataTuple {
            constructor(data = new Array(length).fill(0)) { super(data); }
            static of(inits) {
                const out = new cls();
                for (const [key, value] of Object.entries(inits)) {
                    out[key] = value;
                }
                return out;
            }
            static from(data, offset = 0) {
                return new cls(tuple(data, offset, length));
            }
        };
        const descriptors = {};
        for (const key in props) {
            if (typeof props[key] === 'function') {
                descriptors[key] = { value: props[key] };
            }
            else {
                descriptors[key] = props[key];
            }
        }
        Object.defineProperties(cls.prototype, descriptors);
        return cls;
    }
    static prop(...bits) {
        return {
            get() {
                let value = 0;
                for (const [index, mask = 0xff, shift = 0] of bits) {
                    const lsh = shift < 0 ? -shift : 0;
                    const rsh = shift < 0 ? 0 : shift;
                    value |= ((this.data[index] & mask) >>> rsh) << lsh;
                }
                return value;
            },
            set(value) {
                for (const [index, mask = 0xff, shift = 0] of bits) {
                    const lsh = shift < 0 ? -shift : 0;
                    const rsh = shift < 0 ? 0 : shift;
                    const v = (value >>> lsh) << rsh & mask;
                    this.data[index] = this.data[index] & ~mask | v;
                }
            },
        };
    }
    static booleanProp(bit) {
        const prop = DataTuple.prop(bit);
        return { get() { return !!prop.get.call(this); },
            set(value) { prop.set.call(this, +value); } };
    }
}
export const watchArray = (arr, watch) => {
    const arrayChangeHandler = {
        get(target, property) {
            let v = target[property];
            if (property === 'subarray') {
                return (start, end) => {
                    const sub = target.subarray(start, end);
                    if (start <= watch && watch < end)
                        return watchArray(sub, watch - start);
                    return sub;
                };
            }
            else if (property === 'set') {
                return (val) => {
                    console.log(`Setting overlapping array ${watch}`);
                    debugger;
                    target.set(val);
                };
            }
            if (typeof v === 'function')
                v = v.bind(target);
            return v;
        },
        set(target, property, value, receiver) {
            if (property == watch) {
                console.log(`Writing ${watch.toString(16)}`);
                debugger;
            }
            target[property] = value;
            return true;
        },
    };
    return new Proxy(arr, arrayChangeHandler);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9qcy9yb20vdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxNQUFNLFVBQVUsa0JBQWtCLENBQUMsVUFBa0I7SUFDbkQsT0FBTyxVQUFVLENBQUMsT0FBTyxDQUFDLG9CQUFvQixFQUFFLE9BQU8sQ0FBQztTQUNuRCxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztTQUNwQixPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzVCLENBQUM7QUFPRCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQVMsRUFBRSxJQUEyQixDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNoRSxPQUFPLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRCxDQUFDO0FBU0QsTUFBTSxVQUFVLEtBQUssQ0FBc0IsR0FBTSxFQUFFLEtBQWEsRUFBRSxHQUFXO0lBQzNFLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZDLENBQUM7QUFNRCxNQUFNLFVBQVUsS0FBSyxDQUFJLEdBQVksRUFBRSxLQUFhLEVBQUUsR0FBVztJQUMvRCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVELE1BQU0sVUFBVSxNQUFNLENBQUMsQ0FBUztJQUM5QixPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztB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QyxHQUFHLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztBQUM1QyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBHZW5lcmFsIHV0aWxpdGllcyBmb3Igcm9tIHBhY2thZ2UuXG5cbmV4cG9ydCBmdW5jdGlvbiB1cHBlckNhbWVsVG9TcGFjZXModXBwZXJDYW1lbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHVwcGVyQ2FtZWwucmVwbGFjZSgvKFthLXpdKShbQS1aMC05XSkvZywgJyQxICQyJylcbiAgICAgIC5yZXBsYWNlKC9PZi9nLCAnb2YnKVxuICAgICAgLnJlcGxhY2UoL18vZywgJyAtICcpO1xufVxuXG4vKiogUmVtb3ZlcyByZWFkb25seSBmcm9tIGZpZWxkcy4gKi9cbmV4cG9ydCB0eXBlIE11dGFibGU8VD4gPSB7LXJlYWRvbmx5IFtLIGluIGtleW9mKFQpXTogVFtLXX07XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXEoeDogbnVtYmVyKTogbnVtYmVyW107XG5leHBvcnQgZnVuY3Rpb24gc2VxPFQ+KHg6IG51bWJlciwgZj86ICh4OiBudW1iZXIpID0+IFQpOiBUW107XG5leHBvcnQgZnVuY3Rpb24gc2VxKHg6IG51bWJlciwgZjogKHg6IG51bWJlcikgPT4gbnVtYmVyID0gKGkpID0+IGkpOiBudW1iZXJbXSB7XG4gIHJldHVybiBuZXcgQXJyYXkoeCkuZmlsbCgwKS5tYXAoKF8sIGkpID0+IGYoaSkpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERhdGE8VD4ge1xuICBbaW5kZXg6IG51bWJlcl06IFQ7XG4gIGxlbmd0aDogbnVtYmVyO1xuICBzbGljZShzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcik6IHRoaXM7XG4gIFtTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhdG9yPFQ+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2xpY2U8VCBleHRlbmRzIERhdGE8YW55Pj4oYXJyOiBULCBzdGFydDogbnVtYmVyLCBsZW46IG51bWJlcik6IFQge1xuICByZXR1cm4gYXJyLnNsaWNlKHN0YXJ0LCBzdGFydCArIGxlbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0dXBsZTxUPihhcnI6IERhdGE8VD4sIHN0YXJ0OiBudW1iZXIsIGxlbjogMik6IFtULCBUXTtcbmV4cG9ydCBmdW5jdGlvbiB0dXBsZTxUPihhcnI6IERhdGE8VD4sIHN0YXJ0OiBudW1iZXIsIGxlbjogMyk6IFtULCBULCBUXTtcbmV4cG9ydCBmdW5jdGlvbiB0dXBsZTxUPihhcnI6IERhdGE8VD4sIHN0YXJ0OiBudW1iZXIsIGxlbjogNCk6IFtULCBULCBULCBUXTtcbmV4cG9ydCBmdW5jdGlvbiB0dXBsZTxUPihhcnI6IERhdGE8VD4sIHN0YXJ0OiBudW1iZXIsIGxlbjogbnVtYmVyKTogVFtdO1xuZXhwb3J0IGZ1bmN0aW9uIHR1cGxlPFQ+KGFycjogRGF0YTxUPiwgc3RhcnQ6IG51bWJlciwgbGVuOiBudW1iZXIpOiBUW10ge1xuICByZXR1cm4gQXJyYXkuZnJvbShhcnIuc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgbGVuKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduZWQoeDogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIHggPCAweDgwID8geCA6IHggLSAweDEwMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVuc2lnbmVkKHg6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiB4IDwgMCA/IHggKyAweDEwMCA6IHg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJTbGljZTxUIGV4dGVuZHMgRGF0YTxudW1iZXI+PihhcnI6IFQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQ6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbnRpbmVsOiBudW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kPzogbnVtYmVyKTogVFtdO1xuZXhwb3J0IGZ1bmN0aW9uIHZhclNsaWNlPFQgZXh0ZW5kcyBEYXRhPG51bWJlcj4sIFU+KGFycjogVCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydDogbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiBudW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VudGluZWw6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmQ6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jOiAoc2xpY2U6IFQpID0+IFUpOiBVW107XG5leHBvcnQgZnVuY3Rpb24gdmFyU2xpY2U8VCBleHRlbmRzIERhdGE8bnVtYmVyPiwgVT4oYXJyOiBULFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0OiBudW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZW50aW5lbDogbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZDogbnVtYmVyID0gSW5maW5pdHksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuYz86IChzbGljZTogVCkgPT4gVSk6IFVbXSB7XG4gIGlmICghZnVuYykgZnVuYyA9ICh4OiBUKSA9PiB4IGFzIGFueTtcbiAgY29uc3Qgb3V0ID0gW107XG4gIHdoaWxlIChzdGFydCArIHdpZHRoIDw9IGVuZCAmJiBhcnJbc3RhcnRdICE9PSBzZW50aW5lbCkge1xuICAgIG91dC5wdXNoKGZ1bmMhKGFyci5zbGljZShzdGFydCwgc3RhcnQgKyB3aWR0aCkpKTtcbiAgICBzdGFydCArPSB3aWR0aDtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkcihhcnI6IERhdGE8bnVtYmVyPiwgaTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciA9IDApOiBudW1iZXIge1xuICByZXR1cm4gKGFycltpXSB8IGFycltpICsgMV0gPDwgOCkgKyBvZmZzZXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBncm91cDxUIGV4dGVuZHMgRGF0YTxhbnk+Pih3aWR0aDogbnVtYmVyLCBhcnI6IFQpOiBUW107XG5leHBvcnQgZnVuY3Rpb24gZ3JvdXA8VCBleHRlbmRzIERhdGE8YW55PiwgVT4od2lkdGg6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnI6IFQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuYzogKHNsaWNlOiBUKSA9PiBVKTogVVtdO1xuXG5leHBvcnQgZnVuY3Rpb24gZ3JvdXA8VCBleHRlbmRzIERhdGE8YW55PiwgVT4od2lkdGg6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnI6IFQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuYz86IChzbGljZTogVCkgPT4gVSk6IFVbXSB7XG4gIGlmICghZnVuYykgZnVuYyA9ICh4OiBUKSA9PiB4IGFzIGFueTtcbiAgcmV0dXJuIHNlcShcbiAgICAgIE1hdGgubWF4KDAsIE1hdGguZmxvb3IoYXJyLmxlbmd0aCAvIHdpZHRoKSksXG4gICAgICBpID0+IGZ1bmMhKHNsaWNlKGFyciwgaSAqIHdpZHRoLCB3aWR0aCkpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJldmVyc2VCaXRzKHg6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiAoKHggKiAweDA4MDIgJiAweDIyMTEwKSB8ICh4ICogMHg4MDIwICYgMHg4ODQ0MCkpICogMHgxMDEwMSA+Pj4gMTYgJiAweGZmO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY291bnRCaXRzKHg6IG51bWJlcik6IG51bWJlciB7XG4gIHggLT0geCA+PiAxICYgMHg1NTtcbiAgeCA9ICh4ICYgMHgzMykgKyAoeCA+PiAyICYgMHgzMyk7XG4gIHJldHVybiAoeCArICh4ID4+IDQpKSAmIDB4Zjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhleChpZDogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlkICE9IG51bGwgPyBpZC50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSA6IFN0cmluZyhpZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoZXg0KGlkOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gaWQudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDQsICcwJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoZXg1KGlkOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gaWQudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDUsICcwJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25jYXRJdGVyYWJsZXMoaXRlcnM6IEl0ZXJhYmxlPG51bWJlcj5bXSk6IG51bWJlcltdIHtcbiAgY29uc3Qgb3V0OiBudW1iZXJbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGl0ZXIgb2YgaXRlcnMpIHtcbiAgICBmb3IgKGNvbnN0IGVsZW0gb2YgaXRlcikge1xuICAgICAgb3V0LnB1c2goZWxlbSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBvdXQ7XG4gIC8vIHJldHVybiBbXS5jb25jYXQoLi4uaXRlcnMubWFwKEFycmF5LmZyb20pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRCaWdFbmRpYW4oZGF0YTogRGF0YTxudW1iZXI+LCBvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiBkYXRhW29mZnNldF0gPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkTGl0dGxlRW5kaWFuKGRhdGE6IERhdGE8bnVtYmVyPiwgb2Zmc2V0OiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gZGF0YVtvZmZzZXQgKyAxXSA8PCA4IHwgZGF0YVtvZmZzZXRdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZFN0cmluZyhhcnI6IERhdGE8bnVtYmVyPiwgYWRkcmVzczogbnVtYmVyLCBlbmQ6IG51bWJlciA9IDApOiBzdHJpbmcge1xuICBjb25zdCBieXRlcyA9IFtdO1xuICB3aGlsZSAoYXJyW2FkZHJlc3NdICE9IGVuZCkge1xuICAgIGJ5dGVzLnB1c2goYXJyW2FkZHJlc3MrK10pO1xuICB9XG4gIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKC4uLmJ5dGVzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlTGl0dGxlRW5kaWFuKGRhdGE6IERhdGE8bnVtYmVyPiwgb2Zmc2V0OiBudW1iZXIsIHZhbHVlOiBudW1iZXIpIHtcbiAgZGF0YVtvZmZzZXRdID0gdmFsdWUgJiAweGZmO1xuICBkYXRhW29mZnNldCArIDFdID0gdmFsdWUgPj4+IDg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVN0cmluZyhhcnI6IERhdGE8bnVtYmVyPiwgYWRkcmVzczogbnVtYmVyLCBzdHI6IHN0cmluZykge1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gc3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgYXJyW2FkZHJlc3MgKyBpXSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZShkYXRhOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlciwgdmFsdWVzOiBEYXRhPG51bWJlcj4pIHtcbiAgZGF0YS5zdWJhcnJheShvZmZzZXQsIG9mZnNldCArIHZhbHVlcy5sZW5ndGgpLnNldCh2YWx1ZXMpO1xufVxuXG5leHBvcnQgY2xhc3MgRmxhZ0xpc3RUeXBlIHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgbGFzdDogbnVtYmVyLCByZWFkb25seSBjbGVhcjogbnVtYmVyKSB7fVxuXG4gIHJlYWQoZGF0YTogRGF0YTxudW1iZXI+LCBvZmZzZXQ6IG51bWJlciA9IDApOiBudW1iZXJbXSB7XG4gICAgLy8gVE9ETyAtIGRvIHdlIGV2ZXIgbmVlZCB0byBpbnZlcnQgY2xlYXIvbGFzdD8gIElmIHNvLCB1c2UgfiBhcyBzaWduYWwuXG4gICAgY29uc3QgZmxhZ3MgPSBbXTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgaGkgPSBkYXRhW29mZnNldCsrXTtcbiAgICAgIGNvbnN0IGxvID0gZGF0YVtvZmZzZXQrK107XG4gICAgICBjb25zdCBmbGFnID0gKGhpICYgMykgPDwgOCB8IGxvO1xuICAgICAgY29uc3Qgc2lnbmVkID0gaGkgJiB0aGlzLmNsZWFyID8gfmZsYWcgOiBmbGFnO1xuICAgICAgLy9pZiAoc2lnbmVkICE9PSB+MClcbiAgICAgIGZsYWdzLnB1c2goc2lnbmVkKTtcbiAgICAgIGlmIChoaSAmIHRoaXMubGFzdCkgcmV0dXJuIGZsYWdzO1xuICAgIH1cbiAgfVxuXG4gIGJ5dGVzKGZsYWdzOiBudW1iZXJbXSk6IG51bWJlcltdIHtcbiAgICAvL2ZsYWdzID0gZmxhZ3MuZmlsdGVyKGYgPT4gZiAhPT0gfjApO1xuICAgIC8vaWYgKCFmbGFncy5sZW5ndGgpIGZsYWdzID0gW34wXTtcbiAgICBjb25zdCBieXRlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmxhZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBmbGFnID0gZmxhZ3NbaV07XG4gICAgICBpZiAoZmxhZyA8IDApIGZsYWcgPSAodGhpcy5jbGVhciA8PCA4KSB8IH5mbGFnO1xuICAgICAgaWYgKGkgPT09IGZsYWdzLmxlbmd0aCAtIDEpIGZsYWcgfD0gKHRoaXMubGFzdCA8PCA4KTtcbiAgICAgIGJ5dGVzLnB1c2goZmxhZyA+Pj4gOCk7XG4gICAgICBieXRlcy5wdXNoKGZsYWcgJiAweGZmKTtcbiAgICB9XG4gICAgcmV0dXJuIGJ5dGVzO1xuICB9XG5cbiAgd3JpdGUoZGF0YTogRGF0YTxudW1iZXI+LCBmbGFnczogbnVtYmVyW10sIG9mZnNldDogbnVtYmVyID0gMCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy5ieXRlcyhmbGFncyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZGF0YVtpICsgb2Zmc2V0XSA9IGJ5dGVzW2ldO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgRElBTE9HX0ZMQUdTID0gbmV3IEZsYWdMaXN0VHlwZSgweDQwLCAweDgwKTtcbmV4cG9ydCBjb25zdCBJVEVNX0dFVF9GTEFHUyA9IG5ldyBGbGFnTGlzdFR5cGUoMHg0MCwgMHg4MCk7XG5leHBvcnQgY29uc3QgSVRFTV9VU0VfRkxBR1MgPSBuZXcgRmxhZ0xpc3RUeXBlKDB4NDAsIDB4ODApO1xuZXhwb3J0IGNvbnN0IFNQQVdOX0NPTkRJVElPTl9GTEFHUyA9IG5ldyBGbGFnTGlzdFR5cGUoMHg4MCwgMHgyMCk7XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuZGVjbGFyZSBjb25zdCBpbml0aWFsVGFnOiB1bmlxdWUgc3ltYm9sO1xuZXhwb3J0IGludGVyZmFjZSBJbml0aWFsIHsgW2luaXRpYWxUYWddOiBuZXZlcjsgfVxuZXhwb3J0IHR5cGUgSW5pdGlhbFByb3BzPFQsXG4gICAgWCA9IHtbUCBpbiBrZXlvZiBUXTogVFtQXSBleHRlbmRzIEluaXRpYWwgPyBQIDogbmV2ZXJ9PiA9IFhba2V5b2YgWF07XG5cbi8vIEltcGwgLSBxdWVzdGlvbiAtIGNhbiB3ZSBkbyBzb21ldGhpbmcgc2ltaWxhciBmb3IgRGF0YVR1cGxlPz8/XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0aWFsaXplcjxQIGV4dGVuZHMgcmVhZG9ubHkgYW55W10sIFQ+KCk6IEluaXRpYWxpemVyPFAsIFQ+IHtcbiAgY29uc3QgdGFnID0gU3ltYm9sKCk7XG4gIGZ1bmN0aW9uIGYoLi4uYXJnczogUCk6IFQgJiBJbml0aWFsIHtcbiAgICByZXR1cm4ge3RhZywgYXJnc30gYXMgYW55OyAvLyBOT1RFOiB0aGlzIGlzIGEgY29tcGxldGUgbGllIGZvciBub3cuXG4gIH1cbiAgZi5jb21taXQgPSAoaW5zdGFuY2U6IGFueSwgYnVpbGRlcjogKHByb3A6IHN0cmluZywgLi4uYXJnczogUCkgPT4gVCkgPT4ge1xuICAgIGZvciAoY29uc3QgcHJvcCBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhpbnN0YW5jZSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gaW5zdGFuY2VbcHJvcF07XG4gICAgICBpZiAodmFsdWUudGFnICE9PSB0YWcpIGNvbnRpbnVlO1xuICAgICAgaW5zdGFuY2VbcHJvcF0gPSBidWlsZGVyKHByb3AsIC4uLnZhbHVlLmFyZ3MpO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGY7XG59XG5leHBvcnQgaW50ZXJmYWNlIEluaXRpYWxpemVyPFAgZXh0ZW5kcyByZWFkb25seSBhbnlbXSwgVD4ge1xuICAoLi4uYXJnczogUCk6IFQ7XG4gIGNvbW1pdChpbnN0YW5jZTogYW55LCBidWlsZGVyOiAocHJvcDogc3RyaW5nLCAuLi5hcmdzOiBQKSA9PiBUKTogdm9pZDtcbn1cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5leHBvcnQgY2xhc3MgRGF0YVR1cGxlIHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgZGF0YTogRGF0YTxudW1iZXI+KSB7fVxuICBbU3ltYm9sLml0ZXJhdG9yXSgpOiBJdGVyYXRvcjxudW1iZXI+IHtcbiAgICByZXR1cm4gKHRoaXMuZGF0YSBhcyBudW1iZXJbXSlbU3ltYm9sLml0ZXJhdG9yXSgpO1xuICB9XG4gIGhleCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZGF0YSwgaGV4KS5qb2luKCcgJyk7XG4gIH1cbiAgY2xvbmUoKTogdGhpcyB7XG4gICAgcmV0dXJuIG5ldyAodGhpcy5jb25zdHJ1Y3RvciBhcyBhbnkpKHRoaXMuZGF0YSk7XG4gIH1cbiAgc3RhdGljIG1ha2U8VD4obGVuZ3RoOiBudW1iZXIsIHByb3BzOiBUKTogRGF0YVR1cGxlQ3RvcjxUPiB7XG4gICAgLy8gTk9URTogVGhlcmUncyBhIGxvdCBvZiBkeW5hbWlzbSBoZXJlLCBzbyB0eXBlIGNoZWNraW5nIGNhbid0IGhhbmRsZSBpdC5cbiAgICAvLyBUT0RPOiBHaXZlIHRoaXMgY2xhc3MgYSBuYW1lIHNvbWVob3c/XG4gICAgY29uc3QgY2xzID0gY2xhc3MgZXh0ZW5kcyBEYXRhVHVwbGUge1xuICAgICAgY29uc3RydWN0b3IoZGF0YSA9IG5ldyBBcnJheShsZW5ndGgpLmZpbGwoMCkpIHsgc3VwZXIoZGF0YSk7IH1cbiAgICAgIHN0YXRpYyBvZihpbml0czogYW55KSB7XG4gICAgICAgIGNvbnN0IG91dCA9IG5ldyBjbHMoKSBhcyBhbnk7XG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGluaXRzKSkge1xuICAgICAgICAgIG91dFtrZXldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgIH1cbiAgICAgIHN0YXRpYyBmcm9tKGRhdGE6IERhdGE8bnVtYmVyPiwgb2Zmc2V0OiBudW1iZXIgPSAwKSB7XG4gICAgICAgIHJldHVybiBuZXcgY2xzKHR1cGxlKGRhdGEsIG9mZnNldCwgbGVuZ3RoKSBhcyBudW1iZXJbXSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBkZXNjcmlwdG9yczogYW55ID0ge307XG4gICAgZm9yIChjb25zdCBrZXkgaW4gcHJvcHMpIHtcbiAgICAgIGlmICh0eXBlb2YgcHJvcHNba2V5XSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBkZXNjcmlwdG9yc1trZXldID0ge3ZhbHVlOiBwcm9wc1trZXldfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlc2NyaXB0b3JzW2tleV0gPSBwcm9wc1trZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhjbHMucHJvdG90eXBlLCBkZXNjcmlwdG9ycyk7XG4gICAgcmV0dXJuIGNscyBhcyBhbnk7XG4gIH1cbiAgc3RhdGljIHByb3AoLi4uYml0czogW251bWJlciwgbnVtYmVyPywgbnVtYmVyP11bXSk6XG4gICAgICAoR2V0U2V0PG51bWJlcj4gJiBUaGlzVHlwZTxEYXRhVHVwbGU+KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgbGV0IHZhbHVlID0gMDtcbiAgICAgICAgZm9yIChjb25zdCBbaW5kZXgsIG1hc2sgPSAweGZmLCBzaGlmdCA9IDBdIG9mIGJpdHMpIHtcbiAgICAgICAgICBjb25zdCBsc2ggPSBzaGlmdCA8IDAgPyAtc2hpZnQgOiAwO1xuICAgICAgICAgIGNvbnN0IHJzaCA9IHNoaWZ0IDwgMCA/IDAgOiBzaGlmdDtcbiAgICAgICAgICB2YWx1ZSB8PSAoKHRoaXMuZGF0YVtpbmRleF0gJiBtYXNrKSA+Pj4gcnNoKSA8PCBsc2g7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfSxcbiAgICAgIHNldCh2YWx1ZSkge1xuICAgICAgICBmb3IgKGNvbnN0IFtpbmRleCwgbWFzayA9IDB4ZmYsIHNoaWZ0ID0gMF0gb2YgYml0cykge1xuICAgICAgICAgIGNvbnN0IGxzaCA9IHNoaWZ0IDwgMCA/IC1zaGlmdCA6IDA7XG4gICAgICAgICAgY29uc3QgcnNoID0gc2hpZnQgPCAwID8gMCA6IHNoaWZ0O1xuICAgICAgICAgIGNvbnN0IHYgPSAodmFsdWUgPj4+IGxzaCkgPDwgcnNoICYgbWFzaztcbiAgICAgICAgICB0aGlzLmRhdGFbaW5kZXhdID0gdGhpcy5kYXRhW2luZGV4XSAmIH5tYXNrIHwgdjtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9O1xuICB9XG4gIHN0YXRpYyBib29sZWFuUHJvcChiaXQ6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSk6XG4gICAgICAoR2V0U2V0PGJvb2xlYW4+ICYgVGhpc1R5cGU8RGF0YVR1cGxlPikge1xuICAgIGNvbnN0IHByb3AgPSBEYXRhVHVwbGUucHJvcChiaXQpO1xuICAgIHJldHVybiB7Z2V0KCkgeyByZXR1cm4gISFwcm9wLmdldC5jYWxsKHRoaXMpOyB9LFxuICAgICAgICAgICAgc2V0KHZhbHVlKSB7IHByb3Auc2V0LmNhbGwodGhpcywgK3ZhbHVlKTsgfX07XG4gIH1cbiAgLy8gc3RhdGljIGZ1bmM8VD4oZnVuYzogKHg6IGFueSkgPT4gVCk6ICh7dmFsdWU6IGFueX0gJiBUaGlzVHlwZTxEYXRhVHVwbGU+KSB7XG4gIC8vICAgcmV0dXJuIHt2YWx1ZTogZnVuY3Rpb24oKSB7IHJldHVybiBmdW5jKHRoaXMpOyB9fTtcbiAgLy8gfVxufVxuXG5pbnRlcmZhY2UgR2V0U2V0PFU+IHtcbiAgZ2V0KCk6IFU7XG4gIHNldChhcmc6IFUpOiB2b2lkO1xufVxuXG50eXBlIERhdGFUdXBsZVN1YjxUPiA9XG4gICAge1tLIGluIGtleW9mIFRdOiBUW0tdIGV4dGVuZHMgR2V0U2V0PGluZmVyIFU+ID8gVSA6XG4gICAgICAgICAgICAgICAgICAgICBUW0tdIGV4dGVuZHMge3ZhbHVlOiAoaW5mZXIgVyl9ID8gVyA6XG4gICAgICAgICAgICAgICAgICAgICBUW0tdIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkID8gVFtLXSA6IG5ldmVyfSAmIERhdGFUdXBsZTtcblxuLy8gTm90ZTogaXQgd291bGQgYmUgbmljZSBmb3IgdGhlIGZpbmFsIFRbS10gYmVsb3cgdG8gYmUgJ25ldmVyJywgYnV0XG4vLyB0aGlzIGZhaWxzIGJlY2F1c2UgYWxsIG9iamVjdHMgaGF2ZSBhbiBpbXBsaWNpdCB0b1N0cmluZywgd2hpY2ggd291bGRcbi8vIG90aGVyd2lzZSBuZWVkIHRvIGJlIHt0b1N0cmluZz86IHVuZGVmaW5lZH0gZm9yIHNvbWUgcmVhc29uLlxudHlwZSBEYXRhVHVwbGVJbml0czxUPiA9IHtcbiAgW0sgaW4ga2V5b2YgVF0/OiBUW0tdIGV4dGVuZHMge3NldChhcmc6IGluZmVyIFUpOiB2b2lkfSA/IFUgOiBUW0tdXG59O1xuXG5pbnRlcmZhY2UgRGF0YVR1cGxlQ3RvcjxUPiB7XG4gIG5ldyhkYXRhPzogRGF0YTxudW1iZXI+KTogRGF0YVR1cGxlU3ViPFQ+O1xuICBvZihpbml0czogRGF0YVR1cGxlSW5pdHM8VD4pOiBEYXRhVHVwbGVTdWI8VD47XG4gIGZyb20oZGF0YTogRGF0YTxudW1iZXI+LCBvZmZzZXQ/OiBudW1iZXIpOiBEYXRhVHVwbGVTdWI8VD47XG59XG5cblxuZXhwb3J0IGNvbnN0IHdhdGNoQXJyYXkgPSAoYXJyOiBEYXRhPHVua25vd24+LCB3YXRjaDogbnVtYmVyKSA9PiB7XG4gIGNvbnN0IGFycmF5Q2hhbmdlSGFuZGxlciA9IHtcbiAgICBnZXQodGFyZ2V0OiBhbnksIHByb3BlcnR5OiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKCdnZXR0aW5nICcgKyBwcm9wZXJ0eSArICcgZm9yICcgKyB0YXJnZXQpO1xuICAgICAgLy8gcHJvcGVydHkgaXMgaW5kZXggaW4gdGhpcyBjYXNlXG4gICAgICBsZXQgdiA9IHRhcmdldFtwcm9wZXJ0eV07XG4gICAgICBpZiAocHJvcGVydHkgPT09ICdzdWJhcnJheScpIHtcbiAgICAgICAgcmV0dXJuIChzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcikgPT4ge1xuICAgICAgICAgIGNvbnN0IHN1YiA9IHRhcmdldC5zdWJhcnJheShzdGFydCwgZW5kKTtcbiAgICAgICAgICBpZiAoc3RhcnQgPD0gd2F0Y2ggJiYgd2F0Y2ggPCBlbmQpIHJldHVybiB3YXRjaEFycmF5KHN1Yiwgd2F0Y2ggLSBzdGFydCk7XG4gICAgICAgICAgcmV0dXJuIHN1YjtcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAocHJvcGVydHkgPT09ICdzZXQnKSB7XG4gICAgICAgIHJldHVybiAodmFsOiBEYXRhPHVua25vd24+KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFNldHRpbmcgb3ZlcmxhcHBpbmcgYXJyYXkgJHt3YXRjaH1gKTtcbiAgICAgICAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJycpO1xuICAgICAgICAgIGRlYnVnZ2VyO1xuICAgICAgICAgIHRhcmdldC5zZXQodmFsKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Z1bmN0aW9uJykgdiA9IHYuYmluZCh0YXJnZXQpO1xuICAgICAgcmV0dXJuIHY7XG4gICAgfSxcbiAgICBzZXQodGFyZ2V0OiBhbnksIHByb3BlcnR5OiBzdHJpbmcgfCBudW1iZXIsIHZhbHVlOiBhbnksIHJlY2VpdmVyOiBhbnkpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKCdzZXR0aW5nICcgKyBwcm9wZXJ0eSArICcgZm9yICcvKiArIHRhcmdldCovICsgJyB3aXRoIHZhbHVlICcgKyB2YWx1ZSk7XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6dHJpcGxlLWVxdWFsc1xuICAgICAgaWYgKHByb3BlcnR5ID09IHdhdGNoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBXcml0aW5nICR7d2F0Y2gudG9TdHJpbmcoMTYpfWApO1xuICAgICAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJycpO1xuICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgIH1cbiAgICAgIHRhcmdldFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgIC8vIHlvdSBoYXZlIHRvIHJldHVybiB0cnVlIHRvIGFjY2VwdCB0aGUgY2hhbmdlc1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgfTtcbiAgcmV0dXJuIG5ldyBQcm94eShhcnIsIGFycmF5Q2hhbmdlSGFuZGxlcik7XG59O1xuIl19
import { Entity } from './entity.js';
import { MessageId } from './messageid.js';
import { hex, readLittleEndian, readString, seq, tuple, writeLittleEndian } from './util.js';
const ITEM_USE_DATA_TABLE = 0x1dbe2;
const ITEM_DATA_TABLE = 0x20ff0;
const SELECTED_ITEM_TABLE = 0x2103b;
const VANILLA_PAWN_PRICE_TABLE = 0x21ec2;
const MENU_NAME_TABLE = 0x21086;
const MESSAGE_NAME_TABLE = 0x28a5c;
const MENU_NAME_ENCODE = [
    ['Sword', '\x0a\x0b\x0c'],
    [' of ', '\x5c\x5d'],
    ['Bracelet', '\x3c\x3d\x3e\x5b'],
    ['Shield', '\x0d\x0e\x0f'],
    ['Armor', '\x7b\x11\x12'],
    ['Magic', '\x23\x25\x28'],
    ['Power', '\x13\x14\x15'],
    ['Item', '\x16\x17\x5e'],
];
export class Item extends Entity {
    constructor(rom, id) {
        super(rom, id);
        this.itemUseDataPointer = ITEM_USE_DATA_TABLE + 2 * id;
        this.itemUseDataBase = readLittleEndian(rom.prg, this.itemUseDataPointer) + 0x14000;
        this.itemDataPointer = ITEM_DATA_TABLE + id;
        this.itemDataValue = rom.prg[this.itemDataPointer];
        this.selectedItemPointer = SELECTED_ITEM_TABLE + id;
        this.selectedItemValue = rom.prg[this.selectedItemPointer];
        if (rom.shopDataTablesAddress != null) {
            const address = rom.shopDataTablesAddress +
                21 * rom.shopCount +
                2 * rom.scalingLevels +
                2 * (id - 0xd);
            this.basePrice = id >= 0xd && id < 0x27 ? readLittleEndian(rom.prg, address) : 0;
        }
        else {
            const address = VANILLA_PAWN_PRICE_TABLE + 2 * id;
            this.basePrice = readLittleEndian(rom.prg, address) * 2;
        }
        this.messageNamePointer = MESSAGE_NAME_TABLE + 2 * id;
        this.messageNameBase = readLittleEndian(rom.prg, this.messageNamePointer) + 0x20000;
        this.messageName = readString(rom.prg, this.messageNameBase);
        this.menuNamePointer = MENU_NAME_TABLE + 2 * id;
        this.menuNameBase = readLittleEndian(rom.prg, this.menuNamePointer) + 0x18000;
        this.menuName = MENU_NAME_ENCODE.reduce((s, [d, e]) => s.replace(e, d), readString(rom.prg, this.menuNameBase, 0xff));
        const tradeInCount = TRADE_INS.get(id);
        this.tradeIn =
            tradeInCount ? tuple(rom.prg, this.itemUseDataBase, 6 * tradeInCount) : undefined;
    }
    itemUseMessages() {
        const messages = new Map();
        for (const offset of ITEM_USE_MESSAGE.get(this.id) || []) {
            const message = MessageId.from(this.rom.prg, this.itemUseDataBase + offset);
            messages.set(message.mid(), message);
        }
        return [...messages.values()];
    }
    setName(name) {
        this.messageName = this.menuName = name;
    }
    get palette() { return this.itemDataValue & 3; }
    set palette(p) { this.itemDataValue = this.itemDataValue & ~3 | (p & 3); }
    get unique() { return !!(this.itemDataValue & 0x40); }
    set unique(u) { this.itemDataValue = this.itemDataValue & ~0x40 | (u ? 0x40 : 0); }
    get worn() { return !!(this.itemDataValue & 0x20); }
    set worn(w) { this.itemDataValue = this.itemDataValue & ~0x20 | (w ? 0x20 : 0); }
    get solid() { return !!(this.itemDataValue & 0x80); }
    set solid(s) { this.itemDataValue = this.itemDataValue & ~0x80 | (s ? 0x80 : 0); }
    get itemUseData() {
        return this.rom.prg.subarray(this.itemUseDataBase, 24);
    }
    async write(writer) {
        writer.rom[this.itemDataPointer] = this.itemDataValue;
        writer.rom[this.selectedItemPointer] = this.selectedItemValue;
        if (this.rom.shopDataTablesAddress != null) {
            if (this.id >= 0xd && this.id < 0x27) {
                const address = this.rom.shopDataTablesAddress +
                    21 * this.rom.shopCount +
                    2 * this.rom.scalingLevels +
                    2 * (this.id - 0xd);
                writeLittleEndian(writer.rom, address, this.basePrice);
            }
        }
        else {
            const address = VANILLA_PAWN_PRICE_TABLE + 2 * this.id;
            writeLittleEndian(writer.rom, address, this.basePrice >>> 1);
        }
        const menuNameEncoded = MENU_NAME_ENCODE.reduce((s, [d, e]) => s.replace(d, e), this.menuName);
        const menuAddress = await writer.write([...stringToBytes(menuNameEncoded), 0xff], 0x20000, 0x21fff, `ItemMenuName ${hex(this.id)}`);
        writeLittleEndian(writer.rom, this.menuNamePointer, menuAddress - 0x18000);
        if (this.tradeIn) {
            const base = this.itemUseDataBase;
            writer.rom.subarray(base, base + this.tradeIn.length).set(this.tradeIn);
        }
    }
}
const stringToBytes = (s) => {
    return seq(s.length, i => s.charCodeAt(i));
};
const TRADE_INS = new Map([
    [0x1d, 1],
    [0x25, 1],
    [0x28, 4],
    [0x31, 2],
    [0x35, 1],
    [0x3b, 1],
    [0x3c, 1],
    [0x3d, 1],
]);
const ITEM_USE_MESSAGE = new Map([
    [0x1d, [2, 6]],
    [0x1e, [0]],
    [0x1f, [0]],
    [0x20, [0]],
    [0x21, [0]],
    [0x22, [0]],
    [0x23, [0]],
    [0x25, [2]],
    [0x28, [2, 8, 14, 20]],
    [0x32, [1]],
    [0x33, [2]],
    [0x34, [2]],
    [0x35, [2]],
    [0x36, [2]],
    [0x37, [1]],
    [0x39, [0]],
    [0x3a, [2]],
    [0x3b, [2]],
    [0x3c, [2]],
    [0x3d, [2]],
    [0x3e, [2]],
    [0x3f, [2]],
    [0x40, [2]],
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXRlbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9qcy9yb20vaXRlbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ25DLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBSTNGLE1BQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDO0FBQ3BDLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQztBQUNoQyxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQztBQUNwQyxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQztBQUN6QyxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUM7QUFDaEMsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUM7QUFHbkMsTUFBTSxnQkFBZ0IsR0FBRztJQUN2QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUM7SUFDekIsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDO0lBQ3BCLENBQUMsVUFBVSxFQUFFLGtCQUFrQixDQUFDO0lBQ2hDLENBQUMsUUFBUSxFQUFFLGNBQWMsQ0FBQztJQUMxQixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUM7SUFDekIsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDO0lBQ3pCLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQztJQUN6QixDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUM7Q0FDekIsQ0FBQztBQUdGLE1BQU0sT0FBTyxJQUFLLFNBQVEsTUFBTTtJQTBCOUIsWUFBWSxHQUFRLEVBQUUsRUFBVTtRQUM5QixLQUFLLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWYsSUFBSSxDQUFDLGtCQUFrQixHQUFHLG1CQUFtQixH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LENBQUM7SUFDdEIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNYLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDWCxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ1gsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNYLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDWCxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ1gsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNYLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDWCxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ1gsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNYLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDWCxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ1gsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNYLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDWixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0VudGl0eX0gZnJvbSAnLi9lbnRpdHkuanMnO1xuaW1wb3J0IHtNZXNzYWdlSWR9IGZyb20gJy4vbWVzc2FnZWlkLmpzJztcbmltcG9ydCB7aGV4LCByZWFkTGl0dGxlRW5kaWFuLCByZWFkU3RyaW5nLCBzZXEsIHR1cGxlLCB3cml0ZUxpdHRsZUVuZGlhbn0gZnJvbSAnLi91dGlsLmpzJztcbmltcG9ydCB7V3JpdGVyfSBmcm9tICcuL3dyaXRlci5qcyc7XG5pbXBvcnQge1JvbX0gZnJvbSAnLi4vcm9tLmpzJztcblxuY29uc3QgSVRFTV9VU0VfREFUQV9UQUJMRSA9IDB4MWRiZTI7XG5jb25zdCBJVEVNX0RBVEFfVEFCTEUgPSAweDIwZmYwO1xuY29uc3QgU0VMRUNURURfSVRFTV9UQUJMRSA9IDB4MjEwM2I7XG5jb25zdCBWQU5JTExBX1BBV05fUFJJQ0VfVEFCTEUgPSAweDIxZWMyO1xuY29uc3QgTUVOVV9OQU1FX1RBQkxFID0gMHgyMTA4NjtcbmNvbnN0IE1FU1NBR0VfTkFNRV9UQUJMRSA9IDB4MjhhNWM7IC8vIE5PVEU6IGludGVncmF0ZSB3aXRoIG1lc3NhZ2VzIGVudGl0eT9cblxuLy8gTWFwIHRvIHBhdHRlcm4gZW50cmllcyBmb3IgY29tYmluYXRpb25zIG9mIGxldHRlcnMuXG5jb25zdCBNRU5VX05BTUVfRU5DT0RFID0gW1xuICBbJ1N3b3JkJywgJ1xceDBhXFx4MGJcXHgwYyddLFxuICBbJyBvZiAnLCAnXFx4NWNcXHg1ZCddLFxuICBbJ0JyYWNlbGV0JywgJ1xceDNjXFx4M2RcXHgzZVxceDViJ10sXG4gIFsnU2hpZWxkJywgJ1xceDBkXFx4MGVcXHgwZiddLFxuICBbJ0FybW9yJywgJ1xceDdiXFx4MTFcXHgxMiddLFxuICBbJ01hZ2ljJywgJ1xceDIzXFx4MjVcXHgyOCddLFxuICBbJ1Bvd2VyJywgJ1xceDEzXFx4MTRcXHgxNSddLFxuICBbJ0l0ZW0nLCAnXFx4MTZcXHgxN1xceDVlJ10sXG5dO1xuXG4vLyBBbiBpdGVtOyBub3RlIHRoYXQgc29tZSB0YWJsZXMgZ28gdXAgdG8gJDQ5IG9yIGV2ZW4gJDRhIC0gdGhlc2UgY2FuIGJiZSBpZ25vcmVkXG5leHBvcnQgY2xhc3MgSXRlbSBleHRlbmRzIEVudGl0eSB7XG5cbiAgaXRlbVVzZURhdGFQb2ludGVyOiBudW1iZXI7XG4gIGl0ZW1Vc2VEYXRhQmFzZTogbnVtYmVyO1xuXG4gIC8vIERldGVybWluZXMgdGhlIGZpcnN0IDYqTiBieXRlcyBvZiBJdGVtVXNlRGF0YVxuICB0cmFkZUluPzogbnVtYmVyW107XG5cbiAgaXRlbURhdGFQb2ludGVyOiBudW1iZXI7IC8vIHN0YXJ0cyBhdCAyMGZmMCwgb25lIGJ5dGUgZWFjaFxuICBpdGVtRGF0YVZhbHVlOiBudW1iZXI7IC8vIDowMyBpcyBwYWxldHRlLCA6ODAgaXMgc3dvcmQgYW5kIG1hZ2ljIChzb2xpZCBiZylcbiAgICAgICAgICAgICAgICAgICAgICAgICAvLyA6NDAgaXMgdW5pcXVlLCA6MjAgaXMgd29ybiAoc3dvcmQvYW1vci9vcmIvcmluZy9tYWdpYylcbiAgc2VsZWN0ZWRJdGVtUG9pbnRlcjogbnVtYmVyO1xuICBzZWxlY3RlZEl0ZW1WYWx1ZTogbnVtYmVyO1xuXG4gIGJhc2VQcmljZTogbnVtYmVyO1xuXG4gIC8vIFBST0JMRU0gLSByZWFkIGluIG9uZSBmb3JtYXQsIHdyaXRlIGluIGFub3RoZXIuLi4/XG5cbiAgbWVzc2FnZU5hbWVQb2ludGVyOiBudW1iZXI7XG4gIG1lc3NhZ2VOYW1lQmFzZTogbnVtYmVyO1xuICBtZXNzYWdlTmFtZTogc3RyaW5nOyAvLyBUT0RPIC0gdGhpcyBzaG91bGQgbGl2ZSBsaW5rIGludG8gTWVzc2FnZXMgdGFibGVcblxuICBtZW51TmFtZVBvaW50ZXI6IG51bWJlcjtcbiAgbWVudU5hbWVCYXNlOiBudW1iZXI7XG4gIG1lbnVOYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Iocm9tOiBSb20sIGlkOiBudW1iZXIpIHtcbiAgICBzdXBlcihyb20sIGlkKTtcblxuICAgIHRoaXMuaXRlbVVzZURhdGFQb2ludGVyID0gSVRFTV9VU0VfREFUQV9UQUJMRSArIDIgKiBpZDtcbiAgICB0aGlzLml0ZW1Vc2VEYXRhQmFzZSA9IHJlYWRMaXR0bGVFbmRpYW4ocm9tLnByZywgdGhpcy5pdGVtVXNlRGF0YVBvaW50ZXIpICsgMHgxNDAwMDtcbiAgICB0aGlzLml0ZW1EYXRhUG9pbnRlciA9IElURU1fREFUQV9UQUJMRSArIGlkO1xuICAgIHRoaXMuaXRlbURhdGFWYWx1ZSA9IHJvbS5wcmdbdGhpcy5pdGVtRGF0YVBvaW50ZXJdO1xuICAgIHRoaXMuc2VsZWN0ZWRJdGVtUG9pbnRlciA9IFNFTEVDVEVEX0lURU1fVEFCTEUgKyBpZDtcbiAgICB0aGlzLnNlbGVjdGVkSXRlbVZhbHVlID0gcm9tLnByZ1t0aGlzLnNlbGVjdGVkSXRlbVBvaW50ZXJdO1xuXG4gICAgaWYgKHJvbS5zaG9wRGF0YVRhYmxlc0FkZHJlc3MgIT0gbnVsbCkge1xuICAgICAgY29uc3QgYWRkcmVzcyA9XG4gICAgICAgICAgcm9tLnNob3BEYXRhVGFibGVzQWRkcmVzcyArXG4gICAgICAgICAgMjEgKiByb20uc2hvcENvdW50ICtcbiAgICAgICAgICAyICogcm9tLnNjYWxpbmdMZXZlbHMgK1xuICAgICAgICAgIDIgKiAoaWQgLSAweGQpO1xuICAgICAgdGhpcy5iYXNlUHJpY2UgPSBpZCA+PSAweGQgJiYgaWQgPCAweDI3ID8gcmVhZExpdHRsZUVuZGlhbihyb20ucHJnLCBhZGRyZXNzKSA6IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGFkZHJlc3MgPSBWQU5JTExBX1BBV05fUFJJQ0VfVEFCTEUgKyAyICogaWQ7XG4gICAgICB0aGlzLmJhc2VQcmljZSA9IHJlYWRMaXR0bGVFbmRpYW4ocm9tLnByZywgYWRkcmVzcykgKiAyO1xuICAgIH1cblxuICAgIHRoaXMubWVzc2FnZU5hbWVQb2ludGVyID0gTUVTU0FHRV9OQU1FX1RBQkxFICsgMiAqIGlkO1xuICAgIHRoaXMubWVzc2FnZU5hbWVCYXNlID0gcmVhZExpdHRsZUVuZGlhbihyb20ucHJnLCB0aGlzLm1lc3NhZ2VOYW1lUG9pbnRlcikgKyAweDIwMDAwO1xuICAgIHRoaXMubWVzc2FnZU5hbWUgPSByZWFkU3RyaW5nKHJvbS5wcmcsIHRoaXMubWVzc2FnZU5hbWVCYXNlKTtcblxuICAgIHRoaXMubWVudU5hbWVQb2ludGVyID0gTUVOVV9OQU1FX1RBQkxFICsgMiAqIGlkO1xuICAgIHRoaXMubWVudU5hbWVCYXNlID0gcmVhZExpdHRsZUVuZGlhbihyb20ucHJnLCB0aGlzLm1lbnVOYW1lUG9pbnRlcikgKyAweDE4MDAwO1xuICAgIHRoaXMubWVudU5hbWUgPSBNRU5VX05BTUVfRU5DT0RFLnJlZHVjZSgocywgW2QsIGVdKSA9PiBzLnJlcGxhY2UoZSwgZCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYWRTdHJpbmcocm9tLnByZywgdGhpcy5tZW51TmFtZUJhc2UsIDB4ZmYpKTtcblxuICAgIGNvbnN0IHRyYWRlSW5Db3VudCA9IFRSQURFX0lOUy5nZXQoaWQpO1xuICAgIHRoaXMudHJhZGVJbiA9XG4gICAgICAgIHRyYWRlSW5Db3VudCA/IHR1cGxlKHJvbS5wcmcsIHRoaXMuaXRlbVVzZURhdGFCYXNlLCA2ICogdHJhZGVJbkNvdW50KSA6IHVuZGVmaW5lZDtcblxuICAgIC8vIGNvbnNvbGUubG9nKGBJdGVtICR7dGhpcy5tZW51TmFtZX0gYmFzZSBwcmljZSAke3RoaXMuYmFzZVByaWNlfWApO1xuICAgIC8vIFRPRE8gLSByb20udW5pcXVlSXRlbVRhYmxlQWRkcmVzc1xuICAgIC8vICAtPiBjdXJyZW50IGhhcmQtY29kZWQgaW4gcGF0Y2guaWRlbnRpZnlLZXlJdGVtc0ZvckRpZmZpY3VsdHlCdWZmc1xuICB9XG5cbiAgaXRlbVVzZU1lc3NhZ2VzKCk6IE1lc3NhZ2VJZFtdIHtcbiAgICBjb25zdCBtZXNzYWdlcyA9IG5ldyBNYXA8c3RyaW5nLCBNZXNzYWdlSWQ+KCk7XG4gICAgZm9yIChjb25zdCBvZmZzZXQgb2YgSVRFTV9VU0VfTUVTU0FHRS5nZXQodGhpcy5pZCkgfHwgW10pIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBNZXNzYWdlSWQuZnJvbSh0aGlzLnJvbS5wcmcsIHRoaXMuaXRlbVVzZURhdGFCYXNlICsgb2Zmc2V0KTtcbiAgICAgIG1lc3NhZ2VzLnNldChtZXNzYWdlLm1pZCgpLCBtZXNzYWdlKTtcbiAgICB9XG4gICAgcmV0dXJuIFsuLi5tZXNzYWdlcy52YWx1ZXMoKV07XG4gIH1cblxuICBzZXROYW1lKG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubWVzc2FnZU5hbWUgPSB0aGlzLm1lbnVOYW1lID0gbmFtZTtcbiAgfVxuXG4gIC8vIFBhbGV0dGUgZm9yIG1lbnUgaWNvblxuICBnZXQgcGFsZXR0ZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5pdGVtRGF0YVZhbHVlICYgMzsgfVxuICBzZXQgcGFsZXR0ZShwOiBudW1iZXIpIHsgdGhpcy5pdGVtRGF0YVZhbHVlID0gdGhpcy5pdGVtRGF0YVZhbHVlICYgfjMgfCAocCAmIDMpOyB9XG5cbiAgLy8gVW5pcXVlIGl0ZW06IGNhbm5vdCBiZSBkcm9wcGVkIG9yIHNvbGRcbiAgZ2V0IHVuaXF1ZSgpOiBib29sZWFuIHsgcmV0dXJuICEhKHRoaXMuaXRlbURhdGFWYWx1ZSAmIDB4NDApOyB9XG4gIHNldCB1bmlxdWUodTogYm9vbGVhbikgeyB0aGlzLml0ZW1EYXRhVmFsdWUgPSB0aGlzLml0ZW1EYXRhVmFsdWUgJiB+MHg0MCB8ICh1ID8gMHg0MCA6IDApOyB9XG5cbiAgLy8gV29ybiBpdGVtIChzd29yZC9hcm1vci9vcmIvcmluZy9tYWdpYykgLSBub3QgY2xlYXIgd2hlcmUgdGhpcyBpcyB1c2VkXG4gIGdldCB3b3JuKCk6IGJvb2xlYW4geyByZXR1cm4gISEodGhpcy5pdGVtRGF0YVZhbHVlICYgMHgyMCk7IH1cbiAgc2V0IHdvcm4odzogYm9vbGVhbikgeyB0aGlzLml0ZW1EYXRhVmFsdWUgPSB0aGlzLml0ZW1EYXRhVmFsdWUgJiB+MHgyMCB8ICh3ID8gMHgyMCA6IDApOyB9XG5cbiAgLy8gU29saWQgYmFja2dyb3VuZCAoc3dvcmQvbWFnaWMpXG4gIGdldCBzb2xpZCgpOiBib29sZWFuIHsgcmV0dXJuICEhKHRoaXMuaXRlbURhdGFWYWx1ZSAmIDB4ODApOyB9XG4gIHNldCBzb2xpZChzOiBib29sZWFuKSB7IHRoaXMuaXRlbURhdGFWYWx1ZSA9IHRoaXMuaXRlbURhdGFWYWx1ZSAmIH4weDgwIHwgKHMgPyAweDgwIDogMCk7IH1cblxuICBnZXQgaXRlbVVzZURhdGEoKTogVWludDhBcnJheSB7XG4gICAgLy8gTk9URTogdGhpcyBpcyBoYWNreSwgaXQgc2hvdWxkIHJlYWxseSBiZSBsZXNzIHRoYW4gMjQsIGFuZCB2YXJpYWJsZSFcbiAgICAvLyBNb3Jlb3Zlciwgc29tZSBpdGVtcyBoYXZlIG92ZXJsYXBwaW5nIGRhdGEsIHdoaWNoIGlzIGF3a3dhcmQuXG4gICAgLy8gU28gcmVhbGx5IHdlIG5lZWQgc2VwYXJhdGUgSXRlbVVzZSBhbmQgSXRlbUp1bXAgZW50aXRpZXMgYW5kIHRoZW4ganVzdFxuICAgIC8vIHBvaW50IHRvIHdoaWNoIG9uZSB3ZSB3YW50IGhlcmUuXG4gICAgcmV0dXJuIHRoaXMucm9tLnByZy5zdWJhcnJheSh0aGlzLml0ZW1Vc2VEYXRhQmFzZSwgMjQpO1xuICB9XG5cbiAgYXN5bmMgd3JpdGUod3JpdGVyOiBXcml0ZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB3cml0ZXIucm9tW3RoaXMuaXRlbURhdGFQb2ludGVyXSA9IHRoaXMuaXRlbURhdGFWYWx1ZTtcbiAgICB3cml0ZXIucm9tW3RoaXMuc2VsZWN0ZWRJdGVtUG9pbnRlcl0gPSB0aGlzLnNlbGVjdGVkSXRlbVZhbHVlO1xuICAgIGlmICh0aGlzLnJvbS5zaG9wRGF0YVRhYmxlc0FkZHJlc3MgIT0gbnVsbCkge1xuICAgICAgaWYgKHRoaXMuaWQgPj0gMHhkICYmIHRoaXMuaWQgPCAweDI3KSB7XG4gICAgICAgIGNvbnN0IGFkZHJlc3MgPVxuICAgICAgICAgICAgdGhpcy5yb20uc2hvcERhdGFUYWJsZXNBZGRyZXNzICtcbiAgICAgICAgICAgIDIxICogdGhpcy5yb20uc2hvcENvdW50ICtcbiAgICAgICAgICAgIDIgKiB0aGlzLnJvbS5zY2FsaW5nTGV2ZWxzICtcbiAgICAgICAgICAgIDIgKiAodGhpcy5pZCAtIDB4ZCk7XG4gICAgICAgIHdyaXRlTGl0dGxlRW5kaWFuKHdyaXRlci5yb20sIGFkZHJlc3MsIHRoaXMuYmFzZVByaWNlKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYWRkcmVzcyA9IFZBTklMTEFfUEFXTl9QUklDRV9UQUJMRSArIDIgKiB0aGlzLmlkO1xuICAgICAgd3JpdGVMaXR0bGVFbmRpYW4od3JpdGVyLnJvbSwgYWRkcmVzcywgdGhpcy5iYXNlUHJpY2UgPj4+IDEpO1xuICAgIH1cblxuICAgIGNvbnN0IG1lbnVOYW1lRW5jb2RlZCA9XG4gICAgICAgIE1FTlVfTkFNRV9FTkNPREUucmVkdWNlKChzLCBbZCwgZV0pID0+IHMucmVwbGFjZShkLCBlKSwgdGhpcy5tZW51TmFtZSk7XG5cbiAgICBjb25zdCBtZW51QWRkcmVzcyA9IGF3YWl0IHdyaXRlci53cml0ZShcbiAgICAgICAgWy4uLnN0cmluZ1RvQnl0ZXMobWVudU5hbWVFbmNvZGVkKSwgMHhmZl0sXG4gICAgICAgIDB4MjAwMDAsIDB4MjFmZmYsIGBJdGVtTWVudU5hbWUgJHtoZXgodGhpcy5pZCl9YCk7XG4gICAgd3JpdGVMaXR0bGVFbmRpYW4od3JpdGVyLnJvbSwgdGhpcy5tZW51TmFtZVBvaW50ZXIsIG1lbnVBZGRyZXNzIC0gMHgxODAwMCk7XG5cbiAgICBpZiAodGhpcy50cmFkZUluKSB7XG4gICAgICBjb25zdCBiYXNlID0gdGhpcy5pdGVtVXNlRGF0YUJhc2U7XG4gICAgICB3cml0ZXIucm9tLnN1YmFycmF5KGJhc2UsIGJhc2UgKyB0aGlzLnRyYWRlSW4ubGVuZ3RoKS5zZXQodGhpcy50cmFkZUluKTtcbiAgICB9XG5cbiAgICAvLyB3cml0ZXIud3JpdGUoWy4uLnN0cmluZ1RvQnl0ZXModGhpcy5tZXNzYWdlTmFtZSksIDBdLFxuICAgIC8vIDB4MjgwMDAsIDB4MjlmZmYsIGBJdGVtTWVzc2FnZU5hbWUgJHtoZXgodGhpcy5pZCl9YCksXG4gICAgLy8gd3JpdGVMaXR0bGVFbmRpYW4od3JpdGVyLnJvbSwgdGhpcy5tZXNzYWdlTmFtZVBvaW50ZXIsIG1lc3NhZ2VBZGRyZXNzIC0gMHgyMDAwMCk7XG4gIH1cbn1cblxuY29uc3Qgc3RyaW5nVG9CeXRlcyA9IChzOiBzdHJpbmcpOiBudW1iZXJbXSA9PiB7XG4gIHJldHVybiBzZXEocy5sZW5ndGgsIGkgPT4gcy5jaGFyQ29kZUF0KGkpKTtcbn07XG5cbi8vIFRyYWRlLWluIHNsb3RzIGNvdWxkIGJlIGN1c3RvbWl6ZWQgcXVpdGUgYSBiaXQ6XG4vLyAgLSBOUENcbi8vICAtIGl0ZW0gcmVxdWlyZWRcbi8vICAtIGl0ZW0gZ2l2ZW5cbi8vICAtIGZsYWdzIGdpdmVuXG4vLyAgLSBsb2NhdGlvblxuLy8gZXRjLi4uXG5jb25zdCBUUkFERV9JTlMgPSBuZXcgTWFwKFtcbiAgWzB4MWQsIDFdLCAvLyBtZWRpY2FsIGhlcmJcbiAgWzB4MjUsIDFdLCAvLyBzdGF0dWUgb2Ygb255eFxuICBbMHgyOCwgNF0sIC8vIGZsdXRlIG9mIGxpbWUgKGZpcnN0IHR3byB1bnVzZWQpXG4gIFsweDMxLCAyXSwgLy8gYWxhcm0gZmx1dGVcbiAgWzB4MzUsIDFdLCAvLyBmb2cgbGFtcFxuICBbMHgzYiwgMV0sIC8vIGxvdmUgcGVuZGFudFxuICBbMHgzYywgMV0sIC8vIGtpcmlzYSBwbGFudFxuICBbMHgzZCwgMV0sIC8vIGl2b3J5IHN0YXR1ZVxuICAvLyBUT0RPIC0gY29uc2lkZXIgbW92aW5nIHNsZWVwaW5nIHBlb3BsZT9cbiAgLy8gICAgICAtLT4gd291bGQgd2FudCB0byBwdXQgc29tZXRoaW5nIGluIHRoZWlyIHBsYWNlP1xuICAvLyAgICAgICAgICAtIG1heWJlIGV2ZW4gYSBib3NzIGluIGNsb3NlIHF1YXJ0ZXJzIGFyZWE/XG4gIC8vIFRPRE8gLSBtYXliZSBOUEMgc2hvdWxkIGhhdmUgYW4gXCJpdGVtIHdhbnRlZFwiIHByb3BlcnR5P1xuXSk7XG5cbi8vIG1hcHMgaXRlbSBpZCB0byBvZmZzZXQgb2YgZGF0YSBmb3IgbWVzc2FnZS4uLj9cbmNvbnN0IElURU1fVVNFX01FU1NBR0UgPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyW10+KFtcbiAgWzB4MWQsIFsyLCA2XV0sXG4gIFsweDFlLCBbMF1dLFxuICBbMHgxZiwgWzBdXSxcbiAgWzB4MjAsIFswXV0sXG4gIFsweDIxLCBbMF1dLFxuICBbMHgyMiwgWzBdXSxcbiAgWzB4MjMsIFswXV0sXG4gIFsweDI1LCBbMl1dLFxuICBbMHgyOCwgWzIsIDgsIDE0LCAyMF1dLCAvLyBzb21lIHVudXNlZFxuICBbMHgzMiwgWzFdXSxcbiAgWzB4MzMsIFsyXV0sXG4gIFsweDM0LCBbMl1dLFxuICBbMHgzNSwgWzJdXSxcbiAgWzB4MzYsIFsyXV0sXG4gIFsweDM3LCBbMV1dLFxuICBbMHgzOSwgWzBdXSxcbiAgWzB4M2EsIFsyXV0sXG4gIFsweDNiLCBbMl1dLFxuICBbMHgzYywgWzJdXSxcbiAgWzB4M2QsIFsyXV0sXG4gIFsweDNlLCBbMl1dLFxuICBbMHgzZiwgWzJdXSxcbiAgWzB4NDAsIFsyXV0sXG5dKTtcbiJdfQ==
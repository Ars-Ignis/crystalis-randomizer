import { Entity, EntityArray } from './entity.js';
import { MessageId } from './messageid.js';
import { ITEM_GET_FLAGS, hex, readLittleEndian, writeLittleEndian } from './util.js';
const GRANT_ITEM_TABLE = 0x3d6d5;
const GET_TO_ITEM_BASE = 0x1dd66;
const GET_TO_ITEM_THRESHOLD = 0x49;
export class ItemGets extends EntityArray {
    constructor(rom) {
        super(0x71);
        this.rom = rom;
        this.actionGrants = new Map();
        for (let i = 0; i < 0x71; i++) {
            this[i] = new ItemGet(rom, i);
        }
        let addr = GRANT_ITEM_TABLE;
        while (rom.prg[addr] !== 0xff) {
            const key = rom.prg[addr++];
            const value = rom.prg[addr++];
            this.actionGrants.set(key, value);
        }
    }
    async write(writer) {
        const promises = [];
        for (const itemget of this) {
            promises.push(itemget.write(writer));
        }
        await Promise.all(promises);
        let addr = GRANT_ITEM_TABLE;
        for (const [key, value] of this.actionGrants) {
            writer.rom[addr++] = key;
            writer.rom[addr++] = value;
        }
    }
}
export class ItemGet extends Entity {
    constructor(rom, id) {
        super(rom, id);
        this.itemPointer = GET_TO_ITEM_BASE + id;
        this._itemId = rom.prg[this.itemPointer];
        this.tablePointer = 0x1db00 + 2 * id;
        this.tableBase = readLittleEndian(rom.prg, this.tablePointer) + 0x14000;
        let a = this.tableBase;
        this.inventoryRowStart = rom.prg[a++];
        this.inventoryRowLength = rom.prg[a++];
        this.acquisitionAction = MessageId.from(rom.prg, a);
        this.flags = ITEM_GET_FLAGS.read(rom.prg, a + 2);
        this.key = rom.prg[a + 2 + 2 * this.flags.length + 1] === 0xfe;
        if (id !== 0 && this.tableBase === readLittleEndian(rom.prg, 0x1dd66) + 0x14000) {
            this.key = false;
            this.flags = [];
        }
    }
    get itemId() { return this._itemId; }
    set itemId(itemId) {
        if (this.id < GET_TO_ITEM_THRESHOLD)
            throw new Error(`${this.id}`);
        this._itemId = itemId;
    }
    isLosable() {
        return LOSABLE_ROWS.has(this.inventoryRowStart);
    }
    copyFrom(that) {
        this.inventoryRowStart = that.inventoryRowStart;
        this.inventoryRowLength = that.inventoryRowLength;
        this.acquisitionAction = that.acquisitionAction;
        this.flags = [...that.flags];
        this.key = that.key;
    }
    async write(writer) {
        writer.rom[this.itemPointer] = this.itemId;
        const table = [
            this.inventoryRowStart, this.inventoryRowLength,
            ...this.acquisitionAction.data,
            ...ITEM_GET_FLAGS.bytes(this.flags),
            this.key ? 0xfe : 0xff,
        ];
        const address = await writer.write(table, 0x1c000, 0x1ffff, `ItemGetData ${hex(this.id)}`);
        writeLittleEndian(writer.rom, this.tablePointer, address - 0x14000);
    }
}
const LOSABLE_ROWS = new Set([4, 8, 16]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXRlbWdldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9qcy9yb20vaXRlbWdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUMsTUFBTSxFQUFFLFdBQVcsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUNoRCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDekMsT0FBTyxFQUFDLGNBQWMsRUFBRSxHQUFHLEVBQUUsZ0JBQWdCLEVBQUUsaUJBQWlCLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFHbkYsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7QUFDakMsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7QUFDakMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUM7QUFPbkMsTUFBTSxPQUFPLFFBQVMsU0FBUSxXQUFvQjtJQUloRCxZQUFxQixHQUFRO1FBQzNCLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQURPLFFBQUcsR0FBSCxHQUFHLENBQUs7UUFGN0IsaUJBQVksR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUl2QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzdCLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDL0I7UUFFRCxJQUFJLElBQUksR0FBRyxnQkFBZ0IsQ0FBQztRQUM1QixPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQzdCLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUM1QixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFD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TUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1JvbX0gZnJvbSAnLi4vcm9tLmpzJztcbmltcG9ydCB7RW50aXR5LCBFbnRpdHlBcnJheX0gZnJvbSAnLi9lbnRpdHkuanMnO1xuaW1wb3J0IHtNZXNzYWdlSWR9IGZyb20gJy4vbWVzc2FnZWlkLmpzJztcbmltcG9ydCB7SVRFTV9HRVRfRkxBR1MsIGhleCwgcmVhZExpdHRsZUVuZGlhbiwgd3JpdGVMaXR0bGVFbmRpYW59IGZyb20gJy4vdXRpbC5qcyc7XG5pbXBvcnQge1dyaXRlcn0gZnJvbSAnLi93cml0ZXIuanMnO1xuXG5jb25zdCBHUkFOVF9JVEVNX1RBQkxFID0gMHgzZDZkNTtcbmNvbnN0IEdFVF9UT19JVEVNX0JBU0UgPSAweDFkZDY2O1xuY29uc3QgR0VUX1RPX0lURU1fVEhSRVNIT0xEID0gMHg0OTtcblxuLyoqXG4gKiBBcnJheSBvZiBJdGVtR2V0RGF0YSB0YWJsZSBlbnRyaWVzLCB0b2dldGhlciB3aXRoIHRoZSBtYXAgb2ZcbiAqIHRyaWdnZXIvaXRlbXVzZSBncmFudHMgKGFkZGVkIGZvciBzdGF0dWUgb2YgZ29sZCBzaHVmZmxlKSxcbiAqIGZvciBwcm9ncmFtbWF0aWMgYWNjZXNzLlxuICovXG5leHBvcnQgY2xhc3MgSXRlbUdldHMgZXh0ZW5kcyBFbnRpdHlBcnJheTxJdGVtR2V0PiB7XG5cbiAgYWN0aW9uR3JhbnRzID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSByb206IFJvbSkge1xuICAgIHN1cGVyKDB4NzEpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMHg3MTsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gbmV3IEl0ZW1HZXQocm9tLCBpKTtcbiAgICB9XG5cbiAgICBsZXQgYWRkciA9IEdSQU5UX0lURU1fVEFCTEU7XG4gICAgd2hpbGUgKHJvbS5wcmdbYWRkcl0gIT09IDB4ZmYpIHtcbiAgICAgIGNvbnN0IGtleSA9IHJvbS5wcmdbYWRkcisrXTtcbiAgICAgIGNvbnN0IHZhbHVlID0gcm9tLnByZ1thZGRyKytdO1xuICAgICAgdGhpcy5hY3Rpb25HcmFudHMuc2V0KGtleSwgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHdyaXRlKHdyaXRlcjogV3JpdGVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGl0ZW1nZXQgb2YgdGhpcykge1xuICAgICAgcHJvbWlzZXMucHVzaChpdGVtZ2V0LndyaXRlKHdyaXRlcikpO1xuICAgIH1cbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgbGV0IGFkZHIgPSBHUkFOVF9JVEVNX1RBQkxFO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHRoaXMuYWN0aW9uR3JhbnRzKSB7XG4gICAgICB3cml0ZXIucm9tW2FkZHIrK10gPSBrZXk7XG4gICAgICB3cml0ZXIucm9tW2FkZHIrK10gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxufVxuXG4vLyBBIGdldHRhYmxlIGl0ZW0gc2xvdC9jaGVjay4gIEVhY2ggSXRlbUdldCBtYXBzIHRvIGEgc2luZ2xlIGl0ZW0sXG4vLyBidXQgbm9uLXVuaXF1ZSBpdGVtcyBtYXkgbWFwIHRvIG11bHRpcGxlIEl0ZW1HZXRzLlxuZXhwb3J0IGNsYXNzIEl0ZW1HZXQgZXh0ZW5kcyBFbnRpdHkge1xuXG4gIGl0ZW1Qb2ludGVyOiBudW1iZXI7XG4gIHByaXZhdGUgX2l0ZW1JZDogbnVtYmVyO1xuXG4gIHRhYmxlUG9pbnRlcjogbnVtYmVyO1xuICB0YWJsZUJhc2U6IG51bWJlcjtcblxuICAvLyBXaGF0IHBhcnQgb2YgaW52ZW50b3J5IHRvIHNlYXJjaCB3aGVuIGFjcXVpcmluZy5cbiAgaW52ZW50b3J5Um93U3RhcnQ6IG51bWJlcjtcbiAgaW52ZW50b3J5Um93TGVuZ3RoOiBudW1iZXI7XG4gIC8vIE9ubHkgdXNlZCBmb3IgdGhlICdhY3Rpb24nLlxuICBhY3F1aXNpdGlvbkFjdGlvbjogTWVzc2FnZUlkO1xuICAvLyBGbGFncyB0byBzZXQvY2xlYXIgb24gZ2V0dGluZyB0aGUgaXRlbS4gIH5mbGFnIGluZGljYXRlcyB0byBjbGVhci5cbiAgLy8gTm90ZTogd2UgY2FuIGVsaW1pbmF0ZSBtb3N0IG9mIHRoZXNlIHNpbmNlIHdlIGhhbmRsZSB0aGUgMnh4IGZsYWdcbiAgLy8gYXV0b21hdGljYWxseSBhbmQgdXNlIGl0IGZvciBjaGVzdCBzcGF3bmluZy5cbiAgZmxhZ3M6IG51bWJlcltdO1xuXG4gIC8vIFdoZXRoZXIgdGhlIGl0ZW0gaXMgXCJrZXlcIiBvciBub3QgZm9yIHNjYWxpbmcgcHVycG9zZXMuXG4gIC8vIFRPRE8gLSBmaW5kIGEgYmV0dGVyIHNvdXJjZSBmb3IgdGhpcyBzbyB3ZSBjYW4gcmVtb3ZlIGl0IGZyb20gdGhpcyB0YWJsZS5cbiAgLy8gICAgICAgIFdlIGNvdWxkIHBvc3NpYmx5IHN0b3JlIGl0IGluIGEgMTQtYnl0ZSBiaXRmaWVsZC4uLlxuICBrZXk6IGJvb2xlYW47XG5cbiAgY29uc3RydWN0b3Iocm9tOiBSb20sIGlkOiBudW1iZXIpIHtcbiAgICBzdXBlcihyb20sIGlkKTtcblxuICAgIHRoaXMuaXRlbVBvaW50ZXIgPSBHRVRfVE9fSVRFTV9CQVNFICsgaWQ7XG4gICAgdGhpcy5faXRlbUlkID0gcm9tLnByZ1t0aGlzLml0ZW1Qb2ludGVyXTtcbiAgICAvLyBJIGRvbid0IGZ1bGx5IHVuZGVyc3RhbmQgdGhpcyB0YWJsZS4uLlxuICAgIHRoaXMudGFibGVQb2ludGVyID0gMHgxZGIwMCArIDIgKiBpZDtcbiAgICB0aGlzLnRhYmxlQmFzZSA9IHJlYWRMaXR0bGVFbmRpYW4ocm9tLnByZywgdGhpcy50YWJsZVBvaW50ZXIpICsgMHgxNDAwMDtcbiAgICBsZXQgYSA9IHRoaXMudGFibGVCYXNlO1xuXG4gICAgdGhpcy5pbnZlbnRvcnlSb3dTdGFydCA9IHJvbS5wcmdbYSsrXTtcbiAgICB0aGlzLmludmVudG9yeVJvd0xlbmd0aCA9IHJvbS5wcmdbYSsrXTtcbiAgICB0aGlzLmFjcXVpc2l0aW9uQWN0aW9uID0gTWVzc2FnZUlkLmZyb20ocm9tLnByZywgYSk7XG4gICAgdGhpcy5mbGFncyA9IElURU1fR0VUX0ZMQUdTLnJlYWQocm9tLnByZywgYSArIDIpO1xuXG4gICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgY2hlY2tcbiAgICB0aGlzLmtleSA9IHJvbS5wcmdbYSArIDIgKyAyICogdGhpcy5mbGFncy5sZW5ndGggKyAxXSA9PT0gMHhmZTtcblxuICAgIGlmIChpZCAhPT0gMCAmJiB0aGlzLnRhYmxlQmFzZSA9PT0gcmVhZExpdHRsZUVuZGlhbihyb20ucHJnLCAweDFkZDY2KSArIDB4MTQwMDApIHtcbiAgICAgIC8vIFRoaXMgaXMgb25lIG9mIHRoZSB1bnVzZWQgaXRlbXMgdGhhdCBwb2ludCB0byBzd29yZCBvZiB3aW5kLlxuICAgICAgdGhpcy5rZXkgPSBmYWxzZTtcbiAgICAgIHRoaXMuZmxhZ3MgPSBbXTtcbiAgICB9XG4gIH1cblxuICBnZXQgaXRlbUlkKCkgeyByZXR1cm4gdGhpcy5faXRlbUlkOyB9XG4gIHNldCBpdGVtSWQoaXRlbUlkOiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5pZCA8IEdFVF9UT19JVEVNX1RIUkVTSE9MRCkgdGhyb3cgbmV3IEVycm9yKGAke3RoaXMuaWR9YCk7XG4gICAgdGhpcy5faXRlbUlkID0gaXRlbUlkO1xuICB9XG5cbiAgaXNMb3NhYmxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBMT1NBQkxFX1JPV1MuaGFzKHRoaXMuaW52ZW50b3J5Um93U3RhcnQpO1xuICB9XG5cbiAgY29weUZyb20odGhhdDogSXRlbUdldCkge1xuICAgIHRoaXMuaW52ZW50b3J5Um93U3RhcnQgPSB0aGF0LmludmVudG9yeVJvd1N0YXJ0O1xuICAgIHRoaXMuaW52ZW50b3J5Um93TGVuZ3RoID0gdGhhdC5pbnZlbnRvcnlSb3dMZW5ndGg7XG4gICAgdGhpcy5hY3F1aXNpdGlvbkFjdGlvbiA9IHRoYXQuYWNxdWlzaXRpb25BY3Rpb247XG4gICAgdGhpcy5mbGFncyA9IFsuLi50aGF0LmZsYWdzXTtcbiAgICB0aGlzLmtleSA9IHRoYXQua2V5O1xuICB9XG5cbiAgYXN5bmMgd3JpdGUod3JpdGVyOiBXcml0ZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBGaXJzdCB3cml0ZSAoaXRlbWdldCAtPiBpdGVtKSBtYXBwaW5nXG4gICAgd3JpdGVyLnJvbVt0aGlzLml0ZW1Qb2ludGVyXSA9IHRoaXMuaXRlbUlkO1xuICAgIGNvbnN0IHRhYmxlID0gW1xuICAgICAgdGhpcy5pbnZlbnRvcnlSb3dTdGFydCwgdGhpcy5pbnZlbnRvcnlSb3dMZW5ndGgsXG4gICAgICAuLi50aGlzLmFjcXVpc2l0aW9uQWN0aW9uLmRhdGEsXG4gICAgICAuLi5JVEVNX0dFVF9GTEFHUy5ieXRlcyh0aGlzLmZsYWdzKSxcbiAgICAgIHRoaXMua2V5ID8gMHhmZSA6IDB4ZmYsICAvLyBUT0RPOiByZW1vdmUgdGhpcyBieXRlIHdoZW4gbm8gbG9uZ2VyIG5lZWRlZFxuICAgIF07XG4gICAgY29uc3QgYWRkcmVzcyA9IGF3YWl0IHdyaXRlci53cml0ZSh0YWJsZSwgMHgxYzAwMCwgMHgxZmZmZixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBJdGVtR2V0RGF0YSAke2hleCh0aGlzLmlkKX1gKTtcbiAgICB3cml0ZUxpdHRsZUVuZGlhbih3cml0ZXIucm9tLCB0aGlzLnRhYmxlUG9pbnRlciwgYWRkcmVzcyAtIDB4MTQwMDApO1xuICB9XG59XG5cbmNvbnN0IExPU0FCTEVfUk9XUyA9IG5ldyBTZXQoWzQsIDgsIDE2XSk7XG4iXX0=
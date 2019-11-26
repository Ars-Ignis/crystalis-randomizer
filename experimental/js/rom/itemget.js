import { Entity } from './entity.js';
import { MessageId } from './messageid.js';
import { ITEM_GET_FLAGS, hex, readLittleEndian, writeLittleEndian } from './util.js';
export class ItemGet extends Entity {
    constructor(rom, id) {
        super(rom, id);
        this.itemPointer = 0x1dd66 + id;
        this.itemId = rom.prg[this.itemPointer];
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
        const address = await writer.write(table, 0x1d000, 0x1efff, `ItemGetData ${hex(this.id)}`);
        writeLittleEndian(writer.rom, this.tablePointer, address - 0x14000);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXRlbWdldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9qcy9yb20vaXRlbWdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ25DLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsY0FBYyxFQUFFLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQU1uRixNQUFNLE9BQU8sT0FBUSxTQUFRLE1BQU07SUF1QmpDLFlBQVksR0FBUSxFQUFFLEVBQVU7UUFDOUIsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVmLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXhDLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDckMsSUFBSSxDQUFDLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxPQUFPLENBQUM7UUFDeEUsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUV2QixJQUFJLENBQUMsaUJBQWlCLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsS0FBSyxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFHakQsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQztRQUUvRCxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE9BQU8sRUFBRTtZQUUvRSxJQUFJLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztZQUNqQixJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztTQUNqQjtJQUNILENBQUM7SUFFRCxRQUFRLENBQUMsSUFBYTtRQUNwQixJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1FBQ2hELElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUM7UUFDbEQsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztRQUNoRCxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ3RCLENBQUM7SUFFRCxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQWM7UUFFeEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUMzQyxNQUFNLEtBQUssR0FBRztZQUNaLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsa0JBQWtCO1lBQy9DLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUk7WUFDOUIsR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDbkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO1NBQ3ZCLENBQUM7UUFDRixNQUFNLE9BQU8sR0FBRyxNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQ3ZCLGVBQWUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEUsaUJBQWlCLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQztJQUN0RSxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0VudGl0eX0gZnJvbSAnLi9lbnRpdHkuanMnO1xuaW1wb3J0IHtNZXNzYWdlSWR9IGZyb20gJy4vbWVzc2FnZWlkLmpzJztcbmltcG9ydCB7SVRFTV9HRVRfRkxBR1MsIGhleCwgcmVhZExpdHRsZUVuZGlhbiwgd3JpdGVMaXR0bGVFbmRpYW59IGZyb20gJy4vdXRpbC5qcyc7XG5pbXBvcnQge1dyaXRlcn0gZnJvbSAnLi93cml0ZXIuanMnO1xuaW1wb3J0IHtSb219IGZyb20gJy4uL3JvbS5qcyc7XG5cbi8vIEEgZ2V0dGFibGUgaXRlbSBzbG90L2NoZWNrLiAgRWFjaCBJdGVtR2V0IG1hcHMgdG8gYSBzaW5nbGUgaXRlbSxcbi8vIGJ1dCBub24tdW5pcXVlIGl0ZW1zIG1heSBtYXAgdG8gbXVsdGlwbGUgSXRlbUdldHMuXG5leHBvcnQgY2xhc3MgSXRlbUdldCBleHRlbmRzIEVudGl0eSB7XG5cbiAgaXRlbVBvaW50ZXI6IG51bWJlcjtcbiAgaXRlbUlkOiBudW1iZXI7XG5cbiAgdGFibGVQb2ludGVyOiBudW1iZXI7XG4gIHRhYmxlQmFzZTogbnVtYmVyO1xuXG4gIC8vIFdoYXQgcGFydCBvZiBpbnZlbnRvcnkgdG8gc2VhcmNoIHdoZW4gYWNxdWlyaW5nLlxuICBpbnZlbnRvcnlSb3dTdGFydDogbnVtYmVyO1xuICBpbnZlbnRvcnlSb3dMZW5ndGg6IG51bWJlcjtcbiAgLy8gT25seSB1c2VkIGZvciB0aGUgJ2FjdGlvbicuXG4gIGFjcXVpc2l0aW9uQWN0aW9uOiBNZXNzYWdlSWQ7XG4gIC8vIEZsYWdzIHRvIHNldC9jbGVhciBvbiBnZXR0aW5nIHRoZSBpdGVtLiAgfmZsYWcgaW5kaWNhdGVzIHRvIGNsZWFyLlxuICAvLyBOb3RlOiB3ZSBjYW4gZWxpbWluYXRlIG1vc3Qgb2YgdGhlc2Ugc2luY2Ugd2UgaGFuZGxlIHRoZSAyeHggZmxhZ1xuICAvLyBhdXRvbWF0aWNhbGx5IGFuZCB1c2UgaXQgZm9yIGNoZXN0IHNwYXduaW5nLlxuICBmbGFnczogbnVtYmVyW107XG5cbiAgLy8gV2hldGhlciB0aGUgaXRlbSBpcyBcImtleVwiIG9yIG5vdCBmb3Igc2NhbGluZyBwdXJwb3Nlcy5cbiAgLy8gVE9ETyAtIGZpbmQgYSBiZXR0ZXIgc291cmNlIGZvciB0aGlzIHNvIHdlIGNhbiByZW1vdmUgaXQgZnJvbSB0aGlzIHRhYmxlLlxuICAvLyAgICAgICAgV2UgY291bGQgcG9zc2libHkgc3RvcmUgaXQgaW4gYSAxNC1ieXRlIGJpdGZpZWxkLi4uXG4gIGtleTogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3Rvcihyb206IFJvbSwgaWQ6IG51bWJlcikge1xuICAgIHN1cGVyKHJvbSwgaWQpO1xuXG4gICAgdGhpcy5pdGVtUG9pbnRlciA9IDB4MWRkNjYgKyBpZDtcbiAgICB0aGlzLml0ZW1JZCA9IHJvbS5wcmdbdGhpcy5pdGVtUG9pbnRlcl07XG4gICAgLy8gSSBkb24ndCBmdWxseSB1bmRlcnN0YW5kIHRoaXMgdGFibGUuLi5cbiAgICB0aGlzLnRhYmxlUG9pbnRlciA9IDB4MWRiMDAgKyAyICogaWQ7XG4gICAgdGhpcy50YWJsZUJhc2UgPSByZWFkTGl0dGxlRW5kaWFuKHJvbS5wcmcsIHRoaXMudGFibGVQb2ludGVyKSArIDB4MTQwMDA7XG4gICAgbGV0IGEgPSB0aGlzLnRhYmxlQmFzZTtcblxuICAgIHRoaXMuaW52ZW50b3J5Um93U3RhcnQgPSByb20ucHJnW2ErK107XG4gICAgdGhpcy5pbnZlbnRvcnlSb3dMZW5ndGggPSByb20ucHJnW2ErK107XG4gICAgdGhpcy5hY3F1aXNpdGlvbkFjdGlvbiA9IE1lc3NhZ2VJZC5mcm9tKHJvbS5wcmcsIGEpO1xuICAgIHRoaXMuZmxhZ3MgPSBJVEVNX0dFVF9GTEFHUy5yZWFkKHJvbS5wcmcsIGEgKyAyKTtcblxuICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIGNoZWNrXG4gICAgdGhpcy5rZXkgPSByb20ucHJnW2EgKyAyICsgMiAqIHRoaXMuZmxhZ3MubGVuZ3RoICsgMV0gPT09IDB4ZmU7XG5cbiAgICBpZiAoaWQgIT09IDAgJiYgdGhpcy50YWJsZUJhc2UgPT09IHJlYWRMaXR0bGVFbmRpYW4ocm9tLnByZywgMHgxZGQ2NikgKyAweDE0MDAwKSB7XG4gICAgICAvLyBUaGlzIGlzIG9uZSBvZiB0aGUgdW51c2VkIGl0ZW1zIHRoYXQgcG9pbnQgdG8gc3dvcmQgb2Ygd2luZC5cbiAgICAgIHRoaXMua2V5ID0gZmFsc2U7XG4gICAgICB0aGlzLmZsYWdzID0gW107XG4gICAgfVxuICB9XG5cbiAgY29weUZyb20odGhhdDogSXRlbUdldCkge1xuICAgIHRoaXMuaW52ZW50b3J5Um93U3RhcnQgPSB0aGF0LmludmVudG9yeVJvd1N0YXJ0O1xuICAgIHRoaXMuaW52ZW50b3J5Um93TGVuZ3RoID0gdGhhdC5pbnZlbnRvcnlSb3dMZW5ndGg7XG4gICAgdGhpcy5hY3F1aXNpdGlvbkFjdGlvbiA9IHRoYXQuYWNxdWlzaXRpb25BY3Rpb247XG4gICAgdGhpcy5mbGFncyA9IFsuLi50aGF0LmZsYWdzXTtcbiAgICB0aGlzLmtleSA9IHRoYXQua2V5O1xuICB9XG5cbiAgYXN5bmMgd3JpdGUod3JpdGVyOiBXcml0ZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBGaXJzdCB3cml0ZSAoaXRlbWdldCAtPiBpdGVtKSBtYXBwaW5nXG4gICAgd3JpdGVyLnJvbVt0aGlzLml0ZW1Qb2ludGVyXSA9IHRoaXMuaXRlbUlkO1xuICAgIGNvbnN0IHRhYmxlID0gW1xuICAgICAgdGhpcy5pbnZlbnRvcnlSb3dTdGFydCwgdGhpcy5pbnZlbnRvcnlSb3dMZW5ndGgsXG4gICAgICAuLi50aGlzLmFjcXVpc2l0aW9uQWN0aW9uLmRhdGEsXG4gICAgICAuLi5JVEVNX0dFVF9GTEFHUy5ieXRlcyh0aGlzLmZsYWdzKSxcbiAgICAgIHRoaXMua2V5ID8gMHhmZSA6IDB4ZmYsICAvLyBUT0RPOiByZW1vdmUgdGhpcyBieXRlIHdoZW4gbm8gbG9uZ2VyIG5lZWRlZFxuICAgIF07XG4gICAgY29uc3QgYWRkcmVzcyA9IGF3YWl0IHdyaXRlci53cml0ZSh0YWJsZSwgMHgxZDAwMCwgMHgxZWZmZixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBJdGVtR2V0RGF0YSAke2hleCh0aGlzLmlkKX1gKTtcbiAgICB3cml0ZUxpdHRsZUVuZGlhbih3cml0ZXIucm9tLCB0aGlzLnRhYmxlUG9pbnRlciwgYWRkcmVzcyAtIDB4MTQwMDApO1xuICB9XG59XG4iXX0=
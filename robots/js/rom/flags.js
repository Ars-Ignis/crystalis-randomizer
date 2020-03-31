export class Flags {
    constructor(rom) {
        this.rom = rom;
        this.available = new Set([
            0x280, 0x281, 0x288, 0x289, 0x28a, 0x28b, 0x28c,
            0x2a7, 0x2ab, 0x2b4,
        ]);
    }
    alloc(segment, mask = 0xf00) {
        for (const flag of this.available) {
            if (segment == null || (flag & mask) === segment) {
                this.available.delete(flag);
                return flag;
            }
        }
        throw new Error(`No free flags.`);
    }
    allocMapFlag() {
        return this.alloc(0x280, 0xf80);
    }
    free(flag) {
        this.available.add(flag);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxhZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvanMvcm9tL2ZsYWdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUdBLE1BQU0sT0FBTyxLQUFLO0lBVWhCLFlBQXFCLEdBQVE7UUFBUixRQUFHLEdBQUgsR0FBRyxDQUFLO1FBVFosY0FBUyxHQUFHLElBQUksR0FBRyxDQUFTO1lBSzNDLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUs7WUFDL0MsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLO1NBQ3BCLENBQUMsQ0FBQztJQUU2QixDQUFDO0lBRWpDLEtBQUssQ0FBQyxPQUFnQixFQUFFLElBQUksR0FBRyxLQUFLO1FBQ2xDLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNqQyxJQUFJLE9BQU8sSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssT0FBTyxFQUFFO2dCQUNoRCxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDNUIsT0FBTyxJQUFJLENBQUM7YUFDYjtTQUNGO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxZQUFZO1FBQ1YsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVk7UUFDZixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzQixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1JvbX0gZnJvbSAnLi4vcm9tLmpzJztcblxuLyoqIFRyYWNrcyB1c2VkIGFuZCB1bnVzZWQgZmxhZ3MuICovXG5leHBvcnQgY2xhc3MgRmxhZ3Mge1xuICBwcml2YXRlIHJlYWRvbmx5IGF2YWlsYWJsZSA9IG5ldyBTZXQ8bnVtYmVyPihbXG4gICAgLy8gVE9ETyAtIHRoZXJlJ3MgYSB0b24gb2YgbG93ZXIgZmxhZ3MgYXMgd2VsbC5cbiAgICAvLyBUT0RPIC0gd2UgY2FuIHJlcHVycG9zZSBhbGwgdGhlIG9sZCBpdGVtIGZsYWdzLlxuICAgIC8vIDB4MjcwLCAweDI3MSwgMHgyNzIsIDB4MjczLCAweDI3NCwgMHgyNzUsIDB4Mjc2LCAweDI3NyxcbiAgICAvLyAweDI3OCwgMHgyNzksIDB4MjdhLCAweDI3YiwgMHgyN2MsIDB4MjdkLCAweDI3ZSwgMHgyN2YsXG4gICAgMHgyODAsIDB4MjgxLCAweDI4OCwgMHgyODksIDB4MjhhLCAweDI4YiwgMHgyOGMsXG4gICAgMHgyYTcsIDB4MmFiLCAweDJiNCxcbiAgXSk7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgcm9tOiBSb20pIHt9XG5cbiAgYWxsb2Moc2VnbWVudD86IG51bWJlciwgbWFzayA9IDB4ZjAwKTogbnVtYmVyIHtcbiAgICBmb3IgKGNvbnN0IGZsYWcgb2YgdGhpcy5hdmFpbGFibGUpIHtcbiAgICAgIGlmIChzZWdtZW50ID09IG51bGwgfHwgKGZsYWcgJiBtYXNrKSA9PT0gc2VnbWVudCkge1xuICAgICAgICB0aGlzLmF2YWlsYWJsZS5kZWxldGUoZmxhZyk7XG4gICAgICAgIHJldHVybiBmbGFnO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIGZyZWUgZmxhZ3MuYCk7XG4gIH1cblxuICBhbGxvY01hcEZsYWcoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5hbGxvYygweDI4MCwgMHhmODApO1xuICB9XG5cbiAgZnJlZShmbGFnOiBudW1iZXIpIHtcbiAgICB0aGlzLmF2YWlsYWJsZS5hZGQoZmxhZyk7XG4gIH1cbn1cbiJdfQ==
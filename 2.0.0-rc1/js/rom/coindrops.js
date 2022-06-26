import { Address, Segment, tuple } from './util.js';
export class CoinDrops {
    constructor(rom) {
        this.rom = rom;
        this.values = tuple(rom.prg, ADDRESS.offset, COUNT);
    }
    write() {
        const a = this.rom.assembler();
        ADDRESS.loc(a);
        a.word(...this.values);
        return [a.module()];
    }
}
const ADDRESS = Address.of(Segment.$1a, 0x8bde);
const COUNT = 16;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29pbmRyb3BzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2pzL3JvbS9jb2luZHJvcHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBR2xELE1BQU0sT0FBTyxTQUFTO0lBSXBCLFlBQXFCLEdBQVE7UUFBUixRQUFHLEdBQUgsR0FBRyxDQUFLO1FBQzNCLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQsS0FBSztRQUNILE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDL0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNmLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkIsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNoRCxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge01vZHVsZX0gZnJvbSAnLi4vYXNtL21vZHVsZS5qcyc7XG5pbXBvcnQge1JvbX0gZnJvbSAnLi4vcm9tLmpzJztcbmltcG9ydCB7QWRkcmVzcywgU2VnbWVudCwgdHVwbGV9IGZyb20gJy4vdXRpbC5qcyc7XG5cbi8vIExpc3Qgb2YgY29pbiBkcm9wc1xuZXhwb3J0IGNsYXNzIENvaW5Ecm9wcyB7XG5cbiAgdmFsdWVzOiBudW1iZXJbXTtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSByb206IFJvbSkge1xuICAgIHRoaXMudmFsdWVzID0gdHVwbGUocm9tLnByZywgQUREUkVTUy5vZmZzZXQsIENPVU5UKTtcbiAgfVxuXG4gIHdyaXRlKCk6IE1vZHVsZVtdIHtcbiAgICBjb25zdCBhID0gdGhpcy5yb20uYXNzZW1ibGVyKCk7XG4gICAgQUREUkVTUy5sb2MoYSk7XG4gICAgYS53b3JkKC4uLnRoaXMudmFsdWVzKTtcbiAgICByZXR1cm4gW2EubW9kdWxlKCldO1xuICB9XG59XG5cbmNvbnN0IEFERFJFU1MgPSBBZGRyZXNzLm9mKFNlZ21lbnQuJDFhLCAweDhiZGUpO1xuY29uc3QgQ09VTlQgPSAxNjtcbiJdfQ==
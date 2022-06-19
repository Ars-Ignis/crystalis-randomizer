import { tuple } from './util.js';
export class TownWarp {
    constructor(rom) {
        this.rom = rom;
        this.locations = tuple(rom.prg, ADDRESS, COUNT);
        this.thunderSwordWarp = [rom.prg[0x3d5ca], rom.prg[0x3d5ce]];
    }
    write(w) {
        w.rom.subarray(ADDRESS, ADDRESS + COUNT).set(this.locations);
        [w.rom[0x3d5ca], w.rom[0x3d5ce]] = this.thunderSwordWarp;
    }
}
const ADDRESS = 0x3dc58;
const COUNT = 12;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG93bndhcnAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvanMvcm9tL3Rvd253YXJwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFJaEMsTUFBTSxPQUFPLFFBQVE7SUFPbkIsWUFBcUIsR0FBUTtRQUFSLFFBQUcsR0FBSCxHQUFHLENBQUs7UUFDM0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVELEtBQUssQ0FBQyxDQUFTO1FBQ2IsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLE9BQU8sR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzdELENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDO0lBQzNELENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQztBQUN4QixNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1JvbX0gZnJvbSAnLi4vcm9tLmpzJztcbmltcG9ydCB7dHVwbGV9IGZyb20gJy4vdXRpbC5qcyc7XG5pbXBvcnQge1dyaXRlcn0gZnJvbSAnLi93cml0ZXIuanMnO1xuXG4vLyBMaXN0IG9mIHRvd24gd2FycCBsb2NhdGlvbnMuXG5leHBvcnQgY2xhc3MgVG93bldhcnAge1xuXG4gIGxvY2F0aW9uczogbnVtYmVyW107XG5cbiAgLy8gKGxvY2F0aW9uLCBlbnRyYW5jZSkgcGFpciBmb3Igd2FycCBwb2ludC5cbiAgdGh1bmRlclN3b3JkV2FycDogcmVhZG9ubHkgW251bWJlciwgbnVtYmVyXTtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSByb206IFJvbSkge1xuICAgIHRoaXMubG9jYXRpb25zID0gdHVwbGUocm9tLnByZywgQUREUkVTUywgQ09VTlQpO1xuICAgIHRoaXMudGh1bmRlclN3b3JkV2FycCA9IFtyb20ucHJnWzB4M2Q1Y2FdLCByb20ucHJnWzB4M2Q1Y2VdXTtcbiAgfVxuXG4gIHdyaXRlKHc6IFdyaXRlcik6IHZvaWQge1xuICAgIHcucm9tLnN1YmFycmF5KEFERFJFU1MsIEFERFJFU1MgKyBDT1VOVCkuc2V0KHRoaXMubG9jYXRpb25zKTtcbiAgICBbdy5yb21bMHgzZDVjYV0sIHcucm9tWzB4M2Q1Y2VdXSA9IHRoaXMudGh1bmRlclN3b3JkV2FycDtcbiAgfVxufVxuXG5jb25zdCBBRERSRVNTID0gMHgzZGM1ODtcbmNvbnN0IENPVU5UID0gMTI7XG4iXX0=
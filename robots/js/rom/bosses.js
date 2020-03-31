import { readLittleEndian } from './util.js';
export class Bosses {
    constructor(rom) {
        this.rom = rom;
        this.all = [
            this.vampire1 = new Boss(this, 'Vampire 1', 0x100, 0xc0, 0x0, true),
            this.insect = new Boss(this, 'Insect', 0x101, 0xc1, 0x1),
            this.kelbesque1 = new Boss(this, 'Kelbesque 1', 0x102, 0xc2, 0x2, true).sword(3),
            this.rage = new Boss(this, 'Rage', 0x103, 0xc3, 0x3),
            this.sabera1 = new Boss(this, 'Sabera 1', 0x013, 0x84, 0x4, true, 0x3656e).sword(3),
            this.vampire2 = new Boss(this, 'Vampire 2', 0x10c, 0xcc, 0xc, true),
            this.mado1 = new Boss(this, 'Mado 1', 0x067, -1, 0x5, true, 0x3d820).sword(3),
            this.kelbesque2 = new Boss(this, 'Kelbesque 2', 0x105, 0xc5, 0x6, true).sword(3),
            this.sabera2 = new Boss(this, 'Sabera 2', 0x106, 0xc6, 0x7, true).sword(3),
            this.mado2 = new Boss(this, 'Mado 2', 0x107, 0xc7, 0x8, true).sword(3),
            this.karmine = new Boss(this, 'Karmine', 0x108, 0xc8, 0x9, true).sword(2),
            this.draygon1 = new Boss(this, 'Draygon 1', 0x10b, 0xcb, 0xa).sword(2),
            this.statueOfMoon = new Boss(this, 'Statue of Moon', 0x109, 0xc9),
            this.statueOfSun = new Boss(this, 'Statue of Sun', 0x10a, 0xca),
            this.draygon2 = new Boss(this, 'Draygon 2', 0x28d, 0xcb, 0xb).sword(3),
            this.dyna = new Boss(this, 'Dyna', 0x300, -1, 0xd),
        ];
    }
    isBossFlag(flag) {
        const flags = this.flags || (this.flags = (() => {
            const f = new Set();
            for (const boss of this.all) {
                f.add(boss.flag);
            }
            return f;
        })());
        return flags.has(flag);
    }
    fromLocation(id) {
        return this.all.find(b => b.location === id);
    }
    fromBossKill(num) {
        return this.all.find(b => b.kill === num);
    }
    fromObject(id) {
        return this.all.find(b => b.object === id);
    }
    [Symbol.iterator]() {
        return this.all[Symbol.iterator]();
    }
}
export class Boss {
    constructor(bosses, name, flag, npc, kill, shuffled, address) {
        this.bosses = bosses;
        this.name = name;
        this.flag = flag;
        this.npc = npc;
        this.kill = kill;
        this.shuffled = shuffled;
        this.swordLevel = 1;
        this.objectAddress = address || (0x80f0 | (npc & 0xfc) << 6 | (npc & 3) << 2 | 1);
        this.object = bosses.rom.prg[this.objectAddress];
        const { prg } = bosses.rom;
        if (kill != null) {
            const killAddr = 0x14000 + readLittleEndian(prg, 0x1f96b + 2 * kill);
            const drop = prg[killAddr + 4];
            if (drop !== 0xff)
                this.drop = drop;
            this.location = prg[0x1f95d + kill];
        }
    }
    sword(level) {
        this.swordLevel = level;
        return this;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9zc2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2pzL3JvbS9ib3NzZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBTzNDLE1BQU0sT0FBTyxNQUFNO0lBc0JqQixZQUFxQixHQUFRO1FBQVIsUUFBRyxHQUFILEdBQUcsQ0FBSztRQUMzQixJQUFJLENBQUMsR0FBRyxHQUFHO1lBQ1QsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQztZQUNuRSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUM7WUFDeEQsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDaEYsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3BELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNuRixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO1lBQ25FLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzdFLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzFFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3RFLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3pFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDdEUsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQztZQUNqRSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQztZQUUvRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3RFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDO1NBQ25ELENBQUM7SUFDSixDQUFDO0lBRUQsVUFBVSxDQUFDLElBQVk7UUFDckIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxHQUFHLEVBQUU7WUFDOUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztZQUM1QixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQzNCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2xCO1lBQ0QsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDTixPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUVELFlBQVksQ0FBQyxFQUFVO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRCxZQUFZLENBQUMsR0FBVztRQUN0QixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsVUFBVSxDQUFDLEVBQVU7UUFDbkIsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVELENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNmLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztJQUNyQyxDQUFDO0NBQ0Y7QUFHRCxNQUFNLE9BQU8sSUFBSTtJQVdmLFlBQXFCLE1BQWMsRUFDZCxJQUFZLEVBQ1osSUFBWSxFQUNaLEdBQVcsRUFDWCxJQUFhLEVBQ2IsUUFBa0IsRUFDM0IsT0FBZ0I7UUFOUCxXQUFNLEdBQU4sTUFBTSxDQUFRO1FBQ2QsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUNaLFNBQUksR0FBSixJQUFJLENBQVE7UUFDWixRQUFHLEdBQUgsR0FBRyxDQUFRO1FBQ1gsU0FBSSxHQUFKLElBQUksQ0FBUztRQUNiLGFBQVEsR0FBUixRQUFRLENBQVU7UUFQdkMsZUFBVSxHQUFHLENBQUMsQ0FBQztRQVNiLElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDakQsTUFBTSxFQUFDLEdBQUcsRUFBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUM7UUFDekIsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO1lBQ2hCLE1BQU0sUUFBUSxHQUFHLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsT0FBTyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUNyRSxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQy9CLElBQUksSUFBSSxLQUFLLElBQUk7Z0JBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7WUFDcEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDO1NBQ3JDO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFhO1FBQ2pCLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtSb219IGZyb20gJy4uL3JvbS5qcyc7XG5pbXBvcnQge3JlYWRMaXR0bGVFbmRpYW59IGZyb20gJy4vdXRpbC5qcyc7XG5cbi8vIFRPRE8gLSB3ZSBuZWVkIGEgY29uc2lzdGVudCB3YXkgdG8gcmVmZXIgdG8gYm9zc2VzLi4uXG4vLyAgLSBtYXliZSBib3NzZXMuZnJvbU5wY0lkKCksIGJvc3Nlcy5mcm9tT2JqZWN0SWQoKSwgYm9zc2VzLmZyb21Cb3NzS2lsbCgpXG5cbi8vIFJlcHJlc2VudHMgYSBib3NzIHNsb3QuICBOb3RlIHRoYXQgdGhlIHNwZWNpZmljIG9iamVjdCBpcyB0aWVkIG1vc3QgdGlnaHRseVxuLy8gdG8gdGhlIGJvc3Mga2lsbCAoZHJvcCksIHJhdGhlciB0aGFuIHRoZSBzcGVjaWZpYyBpZGVudGl0eSBvZiB0aGUgYm9zcy5cbmV4cG9ydCBjbGFzcyBCb3NzZXMgaW1wbGVtZW50cyBJdGVyYWJsZTxCb3NzPiB7XG5cbiAgcmVhZG9ubHkgdmFtcGlyZTE6IEJvc3M7XG4gIHJlYWRvbmx5IGluc2VjdDogQm9zcztcbiAgcmVhZG9ubHkga2VsYmVzcXVlMTogQm9zcztcbiAgcmVhZG9ubHkgcmFnZTogQm9zcztcbiAgcmVhZG9ubHkgc2FiZXJhMTogQm9zcztcbiAgcmVhZG9ubHkgdmFtcGlyZTI6IEJvc3M7XG4gIHJlYWRvbmx5IG1hZG8xOiBCb3NzO1xuICByZWFkb25seSBrZWxiZXNxdWUyOiBCb3NzO1xuICByZWFkb25seSBzYWJlcmEyOiBCb3NzO1xuICByZWFkb25seSBtYWRvMjogQm9zcztcbiAgcmVhZG9ubHkga2FybWluZTogQm9zcztcbiAgcmVhZG9ubHkgZHJheWdvbjE6IEJvc3M7XG4gIHJlYWRvbmx5IHN0YXR1ZU9mTW9vbjogQm9zcztcbiAgcmVhZG9ubHkgc3RhdHVlT2ZTdW46IEJvc3M7XG4gIHJlYWRvbmx5IGRyYXlnb24yOiBCb3NzO1xuICByZWFkb25seSBkeW5hOiBCb3NzO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgYWxsOiBCb3NzW107XG4gIHByaXZhdGUgZmxhZ3M/OiBTZXQ8bnVtYmVyPjtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSByb206IFJvbSkge1xuICAgIHRoaXMuYWxsID0gW1xuICAgICAgdGhpcy52YW1waXJlMSA9IG5ldyBCb3NzKHRoaXMsICdWYW1waXJlIDEnLCAweDEwMCwgMHhjMCwgMHgwLCB0cnVlKSxcbiAgICAgIHRoaXMuaW5zZWN0ID0gbmV3IEJvc3ModGhpcywgJ0luc2VjdCcsIDB4MTAxLCAweGMxLCAweDEpLFxuICAgICAgdGhpcy5rZWxiZXNxdWUxID0gbmV3IEJvc3ModGhpcywgJ0tlbGJlc3F1ZSAxJywgMHgxMDIsIDB4YzIsIDB4MiwgdHJ1ZSkuc3dvcmQoMyksXG4gICAgICB0aGlzLnJhZ2UgPSBuZXcgQm9zcyh0aGlzLCAnUmFnZScsIDB4MTAzLCAweGMzLCAweDMpLFxuICAgICAgdGhpcy5zYWJlcmExID0gbmV3IEJvc3ModGhpcywgJ1NhYmVyYSAxJywgMHgwMTMsIDB4ODQsIDB4NCwgdHJ1ZSwgMHgzNjU2ZSkuc3dvcmQoMyksXG4gICAgICB0aGlzLnZhbXBpcmUyID0gbmV3IEJvc3ModGhpcywgJ1ZhbXBpcmUgMicsIDB4MTBjLCAweGNjLCAweGMsIHRydWUpLFxuICAgICAgdGhpcy5tYWRvMSA9IG5ldyBCb3NzKHRoaXMsICdNYWRvIDEnLCAweDA2NywgLTEsIDB4NSwgdHJ1ZSwgMHgzZDgyMCkuc3dvcmQoMyksXG4gICAgICB0aGlzLmtlbGJlc3F1ZTIgPSBuZXcgQm9zcyh0aGlzLCAnS2VsYmVzcXVlIDInLCAweDEwNSwgMHhjNSwgMHg2LCB0cnVlKS5zd29yZCgzKSxcbiAgICAgIHRoaXMuc2FiZXJhMiA9IG5ldyBCb3NzKHRoaXMsICdTYWJlcmEgMicsIDB4MTA2LCAweGM2LCAweDcsIHRydWUpLnN3b3JkKDMpLFxuICAgICAgdGhpcy5tYWRvMiA9IG5ldyBCb3NzKHRoaXMsICdNYWRvIDInLCAweDEwNywgMHhjNywgMHg4LCB0cnVlKS5zd29yZCgzKSxcbiAgICAgIHRoaXMua2FybWluZSA9IG5ldyBCb3NzKHRoaXMsICdLYXJtaW5lJywgMHgxMDgsIDB4YzgsIDB4OSwgdHJ1ZSkuc3dvcmQoMiksXG4gICAgICB0aGlzLmRyYXlnb24xID0gbmV3IEJvc3ModGhpcywgJ0RyYXlnb24gMScsIDB4MTBiLCAweGNiLCAweGEpLnN3b3JkKDIpLFxuICAgICAgdGhpcy5zdGF0dWVPZk1vb24gPSBuZXcgQm9zcyh0aGlzLCAnU3RhdHVlIG9mIE1vb24nLCAweDEwOSwgMHhjOSksXG4gICAgICB0aGlzLnN0YXR1ZU9mU3VuID0gbmV3IEJvc3ModGhpcywgJ1N0YXR1ZSBvZiBTdW4nLCAweDEwYSwgMHhjYSksXG4gICAgICAvLyBUT0RPIC0gZ2l2ZSBEcmF5Z29uIDIgYSBkaWZmZXJlbnQgTlBDIGlkIChzYXksIGM0PylcbiAgICAgIHRoaXMuZHJheWdvbjIgPSBuZXcgQm9zcyh0aGlzLCAnRHJheWdvbiAyJywgMHgyOGQsIDB4Y2IsIDB4Yikuc3dvcmQoMyksXG4gICAgICB0aGlzLmR5bmEgPSBuZXcgQm9zcyh0aGlzLCAnRHluYScsIDB4MzAwLCAtMSwgMHhkKSwgLy8gbm90ZTogZmxhZyBpcyBhIGZha2VcbiAgICBdO1xuICB9XG5cbiAgaXNCb3NzRmxhZyhmbGFnOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCBmbGFncyA9IHRoaXMuZmxhZ3MgfHwgKHRoaXMuZmxhZ3MgPSAoKCkgPT4ge1xuICAgICAgY29uc3QgZiA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuICAgICAgZm9yIChjb25zdCBib3NzIG9mIHRoaXMuYWxsKSB7XG4gICAgICAgIGYuYWRkKGJvc3MuZmxhZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZjtcbiAgICB9KSgpKTtcbiAgICByZXR1cm4gZmxhZ3MuaGFzKGZsYWcpO1xuICB9XG5cbiAgZnJvbUxvY2F0aW9uKGlkOiBudW1iZXIpOiBCb3NzfHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuYWxsLmZpbmQoYiA9PiBiLmxvY2F0aW9uID09PSBpZCk7XG4gIH1cblxuICBmcm9tQm9zc0tpbGwobnVtOiBudW1iZXIpOiBCb3NzfHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuYWxsLmZpbmQoYiA9PiBiLmtpbGwgPT09IG51bSk7XG4gIH1cblxuICBmcm9tT2JqZWN0KGlkOiBudW1iZXIpOiBCb3NzfHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuYWxsLmZpbmQoYiA9PiBiLm9iamVjdCA9PT0gaWQpO1xuICB9XG5cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmFibGVJdGVyYXRvcjxCb3NzPiB7XG4gICAgcmV0dXJuIHRoaXMuYWxsW1N5bWJvbC5pdGVyYXRvcl0oKTtcbiAgfVxufVxuXG4vLyBOT1RFOiBjdXJyZW50bHkgdGhpcyBkYXRhIGlzIHJlYWQtb25seS5cbmV4cG9ydCBjbGFzcyBCb3NzIHtcblxuICByZWFkb25seSBvYmplY3RBZGRyZXNzOiBudW1iZXI7XG4gIC8vIFRPRE8gLSBtYWtlIG9iamVjdCBzZXR0YWJsZT9cbiAgcmVhZG9ubHkgb2JqZWN0OiBudW1iZXI7XG4gIHJlYWRvbmx5IGRyb3A/OiBudW1iZXI7XG4gIHJlYWRvbmx5IGxvY2F0aW9uPzogbnVtYmVyO1xuXG4gIC8vIE9ubHkgdXNlZCBmb3IgbG9naWMuXG4gIHN3b3JkTGV2ZWwgPSAxO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGJvc3NlczogQm9zc2VzLFxuICAgICAgICAgICAgICByZWFkb25seSBuYW1lOiBzdHJpbmcsXG4gICAgICAgICAgICAgIHJlYWRvbmx5IGZsYWc6IG51bWJlcixcbiAgICAgICAgICAgICAgcmVhZG9ubHkgbnBjOiBudW1iZXIsXG4gICAgICAgICAgICAgIHJlYWRvbmx5IGtpbGw/OiBudW1iZXIsXG4gICAgICAgICAgICAgIHJlYWRvbmx5IHNodWZmbGVkPzogYm9vbGVhbixcbiAgICAgICAgICAgICAgYWRkcmVzcz86IG51bWJlcikge1xuICAgIHRoaXMub2JqZWN0QWRkcmVzcyA9IGFkZHJlc3MgfHwgKDB4ODBmMCB8IChucGMgJiAweGZjKSA8PCA2IHwgKG5wYyAmIDMpIDw8IDIgfCAxKTtcbiAgICB0aGlzLm9iamVjdCA9IGJvc3Nlcy5yb20ucHJnW3RoaXMub2JqZWN0QWRkcmVzc107XG4gICAgY29uc3Qge3ByZ30gPSBib3NzZXMucm9tO1xuICAgIGlmIChraWxsICE9IG51bGwpIHtcbiAgICAgIGNvbnN0IGtpbGxBZGRyID0gMHgxNDAwMCArIHJlYWRMaXR0bGVFbmRpYW4ocHJnLCAweDFmOTZiICsgMiAqIGtpbGwpO1xuICAgICAgY29uc3QgZHJvcCA9IHByZ1traWxsQWRkciArIDRdO1xuICAgICAgaWYgKGRyb3AgIT09IDB4ZmYpIHRoaXMuZHJvcCA9IGRyb3A7XG4gICAgICB0aGlzLmxvY2F0aW9uID0gcHJnWzB4MWY5NWQgKyBraWxsXTtcbiAgICB9XG4gIH1cblxuICBzd29yZChsZXZlbDogbnVtYmVyKTogdGhpcyB7XG4gICAgdGhpcy5zd29yZExldmVsID0gbGV2ZWw7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cbiJdfQ==
import { CaveShuffle } from './cave.js';
import { coordToPos } from './grid.js';
import { iters } from '../util.js';
import { OK } from './maze.js';
export function bridgeCaveShuffle(underpass, overpass, reverse = false) {
    const under = new UnderpassShuffle(underpass, overpass, reverse);
    const over = new OverpassShuffle(overpass, under, reverse);
    return [under, over];
}
class OverpassShuffle extends CaveShuffle {
    constructor(location, under, reverse) {
        super(location);
        this.location = location;
        this.under = under;
        this.reverse = reverse;
        this.downStairs = [];
    }
    init() {
        this.downStairs = [];
    }
    build() {
        if (this.under.attempt < this.attempt) {
            this.under.meta = undefined;
            this.under.shuffle(this.random);
            if (!this.under.meta)
                return { ok: false, fail: `dependent failed` };
        }
        return super.build();
    }
    finishInternal() {
        if (!this.meta || !this.under.meta)
            throw new Error(`impossible`);
        this.under.finish();
        super.finishInternal();
        for (const [up, down] of iters.zip(this.under.upStairs, this.downStairs)) {
            this.meta.attach(down, this.under.meta, up);
        }
    }
    addEarlyFeatures() {
        const result = super.addEarlyFeatures();
        if (!result.ok)
            return result;
        let xMin = 16;
        let xMax = 0;
        let yMin = 16;
        let yMax = 0;
        let bridge = 1;
        for (const pos of [...this.under.underBridges,
            -1,
            ...this.under.upStairs]) {
            if (pos === -1) {
                bridge = 0;
                continue;
            }
            const y = pos >>> 4;
            const x = pos & 0xf;
            xMin = Math.min(x, xMin);
            xMax = Math.max(x, xMax);
            yMin = Math.min(y - bridge, yMin);
            yMax = Math.max(y + bridge, yMax);
        }
        OUTER: for (let attempt = 0; attempt < 10; attempt++) {
            const mods = [];
            const x = this.random.nextInt(this.w - (xMax - xMin)) + xMin;
            const y = this.random.nextInt(this.h - (yMax - yMin)) + yMin;
            const delta = (y - yMin) << 4 + (x - xMin);
            for (const bridge of this.under.underBridges) {
                const pos = bridge + delta;
                const sy = pos >>> 4;
                const sx = pos & 0xf;
                const c = (sy << 12 | sx << 4 | 0x808);
                if (this.grid.get(c) !== 'c')
                    continue OUTER;
                mods.push([c, 'b']);
                mods.push([c - 8, '']);
                mods.push([c + 8, '']);
            }
            for (const stair of this.under.upStairsEffective) {
                const pos = stair + delta;
                const sy = pos >>> 4;
                const sx = pos & 0xf;
                const c = (sy << 12 | sx << 4 | 0x808);
                if (this.grid.get(c) !== 'c')
                    continue OUTER;
                mods.push([c, this.reverse ? '<' : '>']);
                mods.push([c + (this.reverse ? -0x800 : 0x800), '']);
                const stairMods = this.addEarlyStair(c, this.reverse ? '<' : '>');
                if (!stairMods.length)
                    continue OUTER;
                mods.push(...stairMods);
            }
            for (const [c, v] of mods) {
                if (v)
                    this.fixed.add(c);
                if (v === '<' || v === '>') {
                    this.downStairs.push(coordToPos(c));
                }
                this.grid.set(c, v);
            }
            return OK;
        }
        return { ok: false, fail: 'add fixed stairs with early features' };
    }
    addStairs(up = 0, down = 0) {
        if (this.reverse) {
            return super.addStairs(up - this.under.upStairs.length, down);
        }
        return super.addStairs(up, down - this.under.upStairs.length);
    }
    addOverpasses() {
        return true;
    }
}
class UnderpassShuffle extends CaveShuffle {
    constructor(loc, overpass, reverse) {
        super(loc);
        this.loc = loc;
        this.overpass = overpass;
        this.reverse = reverse;
        this.underBridges = [];
        this.upStairs = [];
        this.upStairsEffective = [];
    }
    init() {
        this.underBridges = [];
        this.upStairs = [];
        this.upStairsEffective = [];
    }
    build() {
        const result = super.build();
        if (!result.ok)
            return result;
        if (!this.meta)
            throw new Error('impossible');
        const upStair = this.reverse ? 'stair:down' : 'stair:up';
        for (const pos of this.meta.allPos()) {
            const scr = this.meta.get(pos);
            if (scr.hasFeature('underpass'))
                this.underBridges.push(pos);
            if (scr.hasFeature(upStair)) {
                let delta = 0;
                for (const exit of scr.data.exits) {
                    if (exit.type === 'stair:up' && exit.entrance < 0x8000)
                        delta = -16;
                    if (exit.type === 'stair:down' && exit.entrance > 0x8000)
                        delta = 16;
                }
                this.upStairsEffective.push(pos + delta);
                this.upStairs.push(pos);
            }
        }
        if (!this.underBridges.length) {
            throw new Error(`Expected bridge in ${this.loc}\n${this.meta.show()}`);
        }
        if (!this.upStairs.length) {
            throw new Error(`Expected stair in ${this.loc}\n${this.meta.show()}`);
        }
        let stairsLen = 0;
        for (const [, type, [dest]] of this.orig.exits()) {
            if (type === upStair && (dest >>> 8) === this.overpass.id)
                stairsLen++;
        }
        this.upStairs = this.random.shuffle(this.upStairs).slice(0, stairsLen);
        return OK;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG91YmxlY2F2ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9qcy9tYXplL2RvdWJsZWNhdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUN4QyxPQUFPLEVBQWEsVUFBVSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBR2xELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDbkMsT0FBTyxFQUFVLEVBQUUsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQU92QyxNQUFNLFVBQVUsaUJBQWlCLENBQUMsU0FBbUIsRUFDdkIsUUFBa0IsRUFDbEIsT0FBTyxHQUFHLEtBQUs7SUFDM0MsTUFBTSxLQUFLLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sSUFBSSxHQUFHLElBQUksZUFBZSxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDM0QsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN2QixDQUFDO0FBR0QsTUFBTSxlQUFnQixTQUFRLFdBQVc7SUFJdkMsWUFBcUIsUUFBa0IsRUFBVyxLQUF1QixFQUNwRCxPQUFnQjtRQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQURwQyxhQUFRLEdBQVIsUUFBUSxDQUFVO1FBQVcsVUFBSyxHQUFMLEtBQUssQ0FBa0I7UUFDcEQsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUhyQyxlQUFVLEdBQVUsRUFBRSxDQUFDO0lBR21DLENBQUM7SUFFM0QsSUFBSTtRQUVGLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxLQUFLO1FBQ0gsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ3JDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQztZQUM1QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSTtnQkFBRSxPQUFPLEVBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUMsQ0FBQztTQUNwRTtRQUNELE9BQU8sS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxjQUFjO1FBQ1osSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUk7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDcEIsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBRXZCLEtBQUssTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUNuQixJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDbkQsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQzdDO0lBQ0gsQ0FBQztJQUVELGdCQUFnQjtRQUNkLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUFFLE9BQU8sTUFBTSxDQUFDO1FBRzlCLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNkLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQTtRQUNaLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNkLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztRQUdiLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNmLEtBQUssTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWTtZQUMxQixDQUFDLENBQUM7WUFDRixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDMUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQ2QsTUFBTSxHQUFHLENBQUMsQ0FBQztnQkFDWCxTQUFTO2FBQ1Y7WUFDRCxNQUFNLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDO1lBQ3BCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7WUFDcEIsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3pCLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN6QixJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDbkM7UUFFRCxLQUFLLEVBQ0wsS0FBSyxJQUFJLE9BQU8sR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRSxPQUFPLEVBQUUsRUFBRTtZQUM3QyxNQUFNLElBQUksR0FBK0IsRUFBRSxDQUFDO1lBQzVDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDN0QsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztZQUM3RCxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDM0MsS0FBSyxNQUFNLE1BQU0sSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRTtnQkFDNUMsTUFBTSxHQUFHLEdBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQztnQkFDM0IsTUFBTSxFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQztnQkFDckIsTUFBTSxFQUFFLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztnQkFDckIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFjLENBQUM7Z0JBQ3BELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRztvQkFBRSxTQUFTLEtBQUssQ0FBQztnQkFDN0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNwQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQ3JDO1lBQ0QsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixFQUFFO2dCQUNoRCxNQUFNLEdBQUcsR0FBRyxLQUFLLEdBQUcsS0FBSyxDQUFDO2dCQUMxQixNQUFNLEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDO2dCQUNyQixNQUFNLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO2dCQUNyQixNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxLQUFLLENBQWMsQ0FBQztnQkFDcEQsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHO29CQUFFLFNBQVMsS0FBSyxDQUFDO2dCQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDekMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQU1sRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNsRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU07b0JBQUUsU0FBUyxLQUFLLENBQUM7Z0JBQ3RDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQzthQUN6QjtZQUVELEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUU7Z0JBQ3pCLElBQUksQ0FBQztvQkFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUU7b0JBQzFCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNyQztnQkFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7YUFDckI7WUFDRCxPQUFPLEVBQUUsQ0FBQztTQUNYO1FBQ0QsT0FBTyxFQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLHNDQUFzQyxFQUFDLENBQUM7SUFDbkUsQ0FBQztJQUVELFNBQVMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDO1FBQ3hCLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNoQixPQUFPLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztTQUMvRDtRQUNELE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFFRCxhQUFhO1FBQ1gsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0NBSUY7QUFFRCxNQUFNLGdCQUFpQixTQUFRLFdBQVc7SUFPeEMsWUFBcUIsR0FBYSxFQUFXLFFBQWtCLEVBQzFDLE9BQWdCO1FBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRC9CLFFBQUcsR0FBSCxHQUFHLENBQVU7UUFBVyxhQUFRLEdBQVIsUUFBUSxDQUFVO1FBQzFDLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFMckMsaUJBQVksR0FBVSxFQUFFLENBQUM7UUFDekIsYUFBUSxHQUFVLEVBQUUsQ0FBQztRQUNyQixzQkFBaUIsR0FBVSxFQUFFLENBQUM7SUFHdUIsQ0FBQztJQUV0RCxJQUFJO1FBQ0YsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7UUFDbkIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztJQUM5QixDQUFDO0lBRUQsS0FBSztRQUNILE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFBRSxPQUFPLE1BQU0sQ0FBQztRQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUk7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRzlDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO1FBQ3pELEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUNwQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMvQixJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO2dCQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzdELElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDM0IsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO2dCQUNkLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFNLEVBQUU7b0JBRWxDLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNO3dCQUFFLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDcEUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFlBQVksSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU07d0JBQUUsS0FBSyxHQUFHLEVBQUUsQ0FBQztpQkFDdEU7Z0JBQ0QsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUM7Z0JBQ3pDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ3pCO1NBR0Y7UUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUU7WUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztTQUN4RTtRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRTtZQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLHFCQUFxQixJQUFJLENBQUMsR0FBRyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ3ZFO1FBRUQsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLEtBQUssTUFBTSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQ2hELElBQUksSUFBSSxLQUFLLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQUUsU0FBUyxFQUFFLENBQUM7U0FDeEU7UUFDRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXZFLE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztDQUlGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2F2ZVNodWZmbGUgfSBmcm9tICcuL2NhdmUuanMnO1xuaW1wb3J0IHsgR3JpZENvb3JkLCBjb29yZFRvUG9zIH0gZnJvbSAnLi9ncmlkLmpzJztcbmltcG9ydCB7IExvY2F0aW9uIH0gZnJvbSAnLi4vcm9tL2xvY2F0aW9uLmpzJztcbmltcG9ydCB7IFBvcyB9IGZyb20gJy4uL3JvbS9tZXRhbG9jYXRpb24uanMnO1xuaW1wb3J0IHsgaXRlcnMgfSBmcm9tICcuLi91dGlsLmpzJztcbmltcG9ydCB7IFJlc3VsdCwgT0sgfSBmcm9tICcuL21hemUuanMnO1xuXG4vLyBCYXNpYyBpZGVhOiBPdmVycGFzcyBydW5zIHVuZGVycGFzcyBmaXJzdC5cbi8vIFVuZGVycGFzcyBzYXZlcyBpdHMgcmVzdWx0LCBpcyByZWFkIGJ5IG92ZXJwYXNzIGF0dGVtcHQuXG4vLyBUT0RPIC0gdGhlIGN1cnJlbnQgc2V0dXAgaXMgTyhuXjIpIGF0dGVtcHRzOyB3ZSBjb3VsZCBzd2l0Y2ggdG8gYW5cbi8vICAgICAgICBpbnRlcnNlY3Rpb24gd2hlcmUgYm90aCBhdHRlbXB0cyBuZWVkIHRvIHBhc3MgYXQgdGhlIHNhbWUgdGltZS5cblxuZXhwb3J0IGZ1bmN0aW9uIGJyaWRnZUNhdmVTaHVmZmxlKHVuZGVycGFzczogTG9jYXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdmVycGFzczogTG9jYXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlID0gZmFsc2UpOiBDYXZlU2h1ZmZsZVtdIHtcbiAgY29uc3QgdW5kZXIgPSBuZXcgVW5kZXJwYXNzU2h1ZmZsZSh1bmRlcnBhc3MsIG92ZXJwYXNzLCByZXZlcnNlKTtcbiAgY29uc3Qgb3ZlciA9IG5ldyBPdmVycGFzc1NodWZmbGUob3ZlcnBhc3MsIHVuZGVyLCByZXZlcnNlKTtcbiAgcmV0dXJuIFt1bmRlciwgb3Zlcl07XG59XG5cblxuY2xhc3MgT3ZlcnBhc3NTaHVmZmxlIGV4dGVuZHMgQ2F2ZVNodWZmbGUge1xuXG4gIGRvd25TdGFpcnM6IFBvc1tdID0gW107XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgbG9jYXRpb246IExvY2F0aW9uLCByZWFkb25seSB1bmRlcjogVW5kZXJwYXNzU2h1ZmZsZSxcbiAgICAgICAgICAgICAgcmVhZG9ubHkgcmV2ZXJzZTogYm9vbGVhbikgeyBzdXBlcihsb2NhdGlvbik7IH1cblxuICBpbml0KCkge1xuICAgIC8vIHN0YXJ0IGZyZXNoXG4gICAgdGhpcy5kb3duU3RhaXJzID0gW107XG4gIH1cblxuICBidWlsZCgpOiBSZXN1bHQ8dm9pZD4ge1xuICAgIGlmICh0aGlzLnVuZGVyLmF0dGVtcHQgPCB0aGlzLmF0dGVtcHQpIHtcbiAgICAgIHRoaXMudW5kZXIubWV0YSA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudW5kZXIuc2h1ZmZsZSh0aGlzLnJhbmRvbSk7XG4gICAgICBpZiAoIXRoaXMudW5kZXIubWV0YSkgcmV0dXJuIHtvazogZmFsc2UsIGZhaWw6IGBkZXBlbmRlbnQgZmFpbGVkYH07XG4gICAgfVxuICAgIHJldHVybiBzdXBlci5idWlsZCgpO1xuICB9XG5cbiAgZmluaXNoSW50ZXJuYWwoKSB7XG4gICAgaWYgKCF0aGlzLm1ldGEgfHwgIXRoaXMudW5kZXIubWV0YSkgdGhyb3cgbmV3IEVycm9yKGBpbXBvc3NpYmxlYCk7XG4gICAgdGhpcy51bmRlci5maW5pc2goKTtcbiAgICBzdXBlci5maW5pc2hJbnRlcm5hbCgpO1xuICAgIC8vIEF0dGFjaCB0aGUgc3RhaXJzLiAgbmV3TWV0YSBpcyB0aGUgb3ZlcnBhc3MuXG4gICAgZm9yIChjb25zdCBbdXAsIGRvd25dIG9mIGl0ZXJzLnppcCh0aGlzLnVuZGVyLnVwU3RhaXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kb3duU3RhaXJzKSkge1xuICAgICAgdGhpcy5tZXRhLmF0dGFjaChkb3duLCB0aGlzLnVuZGVyLm1ldGEsIHVwKTtcbiAgICB9XG4gIH1cblxuICBhZGRFYXJseUZlYXR1cmVzKCk6IFJlc3VsdDx2b2lkPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuYWRkRWFybHlGZWF0dXJlcygpO1xuICAgIGlmICghcmVzdWx0Lm9rKSByZXR1cm4gcmVzdWx0O1xuLy9pZih0aGlzLnBhcmFtcy5pZD09PTUpZGVidWdnZXI7XG4gICAgLy8gRmluZCB0aGUgYnJpZGdlIHRoYXQgd2FzIGFkZGVkLlxuICAgIGxldCB4TWluID0gMTY7XG4gICAgbGV0IHhNYXggPSAwXG4gICAgbGV0IHlNaW4gPSAxNjtcbiAgICBsZXQgeU1heCA9IDA7XG5cbiAgICAvLyBCcmFja2V0IHRoZSB3aG9sZSB0aGluZyB0byBlbnN1cmUgdGhlIHBsYWNlbWVudHMgYXJlIGV2ZW4gZmVhc2libGUuXG4gICAgbGV0IGJyaWRnZSA9IDE7XG4gICAgZm9yIChjb25zdCBwb3Mgb2YgWy4uLnRoaXMudW5kZXIudW5kZXJCcmlkZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAtMSxcbiAgICAgICAgICAgICAgICAgICAgICAgLi4udGhpcy51bmRlci51cFN0YWlyc10pIHtcbiAgICAgIGlmIChwb3MgPT09IC0xKSB7XG4gICAgICAgIGJyaWRnZSA9IDA7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgeSA9IHBvcyA+Pj4gNDtcbiAgICAgIGNvbnN0IHggPSBwb3MgJiAweGY7XG4gICAgICB4TWluID0gTWF0aC5taW4oeCwgeE1pbik7XG4gICAgICB4TWF4ID0gTWF0aC5tYXgoeCwgeE1heCk7XG4gICAgICB5TWluID0gTWF0aC5taW4oeSAtIGJyaWRnZSwgeU1pbik7XG4gICAgICB5TWF4ID0gTWF0aC5tYXgoeSArIGJyaWRnZSwgeU1heCk7XG4gICAgfVxuXG4gICAgT1VURVI6XG4gICAgZm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPCAxMDsgYXR0ZW1wdCsrKSB7XG4gICAgICBjb25zdCBtb2RzOiBBcnJheTxbR3JpZENvb3JkLCBzdHJpbmddPiA9IFtdO1xuICAgICAgY29uc3QgeCA9IHRoaXMucmFuZG9tLm5leHRJbnQodGhpcy53IC0gKHhNYXggLSB4TWluKSkgKyB4TWluO1xuICAgICAgY29uc3QgeSA9IHRoaXMucmFuZG9tLm5leHRJbnQodGhpcy5oIC0gKHlNYXggLSB5TWluKSkgKyB5TWluO1xuICAgICAgY29uc3QgZGVsdGEgPSAoeSAtIHlNaW4pIDw8IDQgKyAoeCAtIHhNaW4pO1xuICAgICAgZm9yIChjb25zdCBicmlkZ2Ugb2YgdGhpcy51bmRlci51bmRlckJyaWRnZXMpIHtcbiAgICAgICAgY29uc3QgcG9zID0gYnJpZGdlICsgZGVsdGE7XG4gICAgICAgIGNvbnN0IHN5ID0gcG9zID4+PiA0O1xuICAgICAgICBjb25zdCBzeCA9IHBvcyAmIDB4ZjtcbiAgICAgICAgY29uc3QgYyA9IChzeSA8PCAxMiB8IHN4IDw8IDQgfCAweDgwOCkgYXMgR3JpZENvb3JkO1xuICAgICAgICBpZiAodGhpcy5ncmlkLmdldChjKSAhPT0gJ2MnKSBjb250aW51ZSBPVVRFUjsgLy8gb3V0IG9mIGJvdW5kcy5cbiAgICAgICAgbW9kcy5wdXNoKFtjLCAnYiddKTtcbiAgICAgICAgbW9kcy5wdXNoKFtjIC0gOCBhcyBHcmlkQ29vcmQsICcnXSk7XG4gICAgICAgIG1vZHMucHVzaChbYyArIDggYXMgR3JpZENvb3JkLCAnJ10pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBzdGFpciBvZiB0aGlzLnVuZGVyLnVwU3RhaXJzRWZmZWN0aXZlKSB7XG4gICAgICAgIGNvbnN0IHBvcyA9IHN0YWlyICsgZGVsdGE7XG4gICAgICAgIGNvbnN0IHN5ID0gcG9zID4+PiA0O1xuICAgICAgICBjb25zdCBzeCA9IHBvcyAmIDB4ZjtcbiAgICAgICAgY29uc3QgYyA9IChzeSA8PCAxMiB8IHN4IDw8IDQgfCAweDgwOCkgYXMgR3JpZENvb3JkO1xuICAgICAgICBpZiAodGhpcy5ncmlkLmdldChjKSAhPT0gJ2MnKSBjb250aW51ZSBPVVRFUjtcbiAgICAgICAgbW9kcy5wdXNoKFtjLCB0aGlzLnJldmVyc2UgPyAnPCcgOiAnPiddKTtcbiAgICAgICAgbW9kcy5wdXNoKFtjICsgKHRoaXMucmV2ZXJzZSA/IC0weDgwMCA6IDB4ODAwKSBhcyBHcmlkQ29vcmQsICcnXSk7XG4gICAgICAgIC8vIFBpY2sgYSBzaW5nbGUgZGlyZWN0aW9uIGZvciB0aGUgc3RhaXIuXG4gICAgICAgIC8vIE5PVEU6IGlmIHdlIGRlbGV0ZSB0aGVuIHdlIGZvcmdldCB0byB6ZXJvIGl0IG91dC4uLlxuICAgICAgICAvLyBCdXQgaXQgd291bGQgc3RpbGwgYmUgbmljZSB0byBcInBvaW50XCIgdGhlbSBpbiB0aGUgZWFzeSBkaXJlY3Rpb24/XG4gICAgICAgIC8vIGlmICh0aGlzLmRlbHRhIDwgLTE2KSBuZWlnaGJvcnMuc3BsaWNlKDIsIDEpO1xuICAgICAgICAvLyBpZiAoKHRoaXMuZGVsdGEgJiAweGYpIDwgOCkgbmVpZ2hib3JzLnNwbGljZSgxLCAxKTtcbiAgICAgICAgY29uc3Qgc3RhaXJNb2RzID0gdGhpcy5hZGRFYXJseVN0YWlyKGMsIHRoaXMucmV2ZXJzZSA/ICc8JyA6ICc+Jyk7XG4gICAgICAgIGlmICghc3RhaXJNb2RzLmxlbmd0aCkgY29udGludWUgT1VURVI7XG4gICAgICAgIG1vZHMucHVzaCguLi5zdGFpck1vZHMpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IFtjLCB2XSBvZiBtb2RzKSB7XG4gICAgICAgIGlmICh2KSB0aGlzLmZpeGVkLmFkZChjKTtcbiAgICAgICAgaWYgKHYgPT09ICc8JyB8fCB2ID09PSAnPicpIHtcbiAgICAgICAgICB0aGlzLmRvd25TdGFpcnMucHVzaChjb29yZFRvUG9zKGMpKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmdyaWQuc2V0KGMsIHYpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIE9LO1xuICAgIH1cbiAgICByZXR1cm4ge29rOiBmYWxzZSwgZmFpbDogJ2FkZCBmaXhlZCBzdGFpcnMgd2l0aCBlYXJseSBmZWF0dXJlcyd9O1xuICB9XG5cbiAgYWRkU3RhaXJzKHVwID0gMCwgZG93biA9IDApOiBSZXN1bHQ8dm9pZD4ge1xuICAgIGlmICh0aGlzLnJldmVyc2UpIHtcbiAgICAgIHJldHVybiBzdXBlci5hZGRTdGFpcnModXAgLSB0aGlzLnVuZGVyLnVwU3RhaXJzLmxlbmd0aCwgZG93bik7XG4gICAgfVxuICAgIHJldHVybiBzdXBlci5hZGRTdGFpcnModXAsIGRvd24gLSB0aGlzLnVuZGVyLnVwU3RhaXJzLmxlbmd0aCk7XG4gIH1cblxuICBhZGRPdmVycGFzc2VzKCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gRXhwZWN0ZWQgdG8gaGF2ZSBzZXZlcmFsIGZhaWx1cmVzXG4gIC8vcmVwb3J0RmFpbHVyZSgpIHt9XG59XG5cbmNsYXNzIFVuZGVycGFzc1NodWZmbGUgZXh0ZW5kcyBDYXZlU2h1ZmZsZSB7XG5cbiAgLy8gVGhlc2UgYXJlIGZpbGxlZCBpbiBieSB0aGlzLmZpbmlzaFxuICB1bmRlckJyaWRnZXM6IFBvc1tdID0gW107XG4gIHVwU3RhaXJzOiBQb3NbXSA9IFtdO1xuICB1cFN0YWlyc0VmZmVjdGl2ZTogUG9zW10gPSBbXTsgLy8gZm9yIG1hdGNoaW5nIHB1cnBvc2VzLCBzaGlmdCBzb21lIHN0YWlycy5cblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSBsb2M6IExvY2F0aW9uLCByZWFkb25seSBvdmVycGFzczogTG9jYXRpb24sXG4gICAgICAgICAgICAgIHJlYWRvbmx5IHJldmVyc2U6IGJvb2xlYW4pIHsgc3VwZXIobG9jKTsgfVxuXG4gIGluaXQoKSB7XG4gICAgdGhpcy51bmRlckJyaWRnZXMgPSBbXTtcbiAgICB0aGlzLnVwU3RhaXJzID0gW107XG4gICAgdGhpcy51cFN0YWlyc0VmZmVjdGl2ZSA9IFtdO1xuICB9XG5cbiAgYnVpbGQoKTogUmVzdWx0PHZvaWQ+IHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5idWlsZCgpO1xuICAgIGlmICghcmVzdWx0Lm9rKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmICghdGhpcy5tZXRhKSB0aHJvdyBuZXcgRXJyb3IoJ2ltcG9zc2libGUnKTtcblxuICAgIC8vIFJlY29yZCB0aGUgcG9zaXRpb25zIG9mIHRoZSByZWxldmFudCBzdGFpcnMgYW5kIGJyaWRnZXNcbiAgICBjb25zdCB1cFN0YWlyID0gdGhpcy5yZXZlcnNlID8gJ3N0YWlyOmRvd24nIDogJ3N0YWlyOnVwJztcbiAgICBmb3IgKGNvbnN0IHBvcyBvZiB0aGlzLm1ldGEuYWxsUG9zKCkpIHtcbiAgICAgIGNvbnN0IHNjciA9IHRoaXMubWV0YS5nZXQocG9zKTtcbiAgICAgIGlmIChzY3IuaGFzRmVhdHVyZSgndW5kZXJwYXNzJykpIHRoaXMudW5kZXJCcmlkZ2VzLnB1c2gocG9zKTtcbiAgICAgIGlmIChzY3IuaGFzRmVhdHVyZSh1cFN0YWlyKSkge1xuICAgICAgICBsZXQgZGVsdGEgPSAwO1xuICAgICAgICBmb3IgKGNvbnN0IGV4aXQgb2Ygc2NyLmRhdGEuZXhpdHMhKSB7XG4gICAgICAgICAgLy8gXCJFZmZlY3RpdmVcIiBwb3MgaXMgc2hpZnRlZCB1cCBvciBkb3duIG9uZSBmb3Igbm9uLWRvdWJsZSBzdGFpcnNcbiAgICAgICAgICBpZiAoZXhpdC50eXBlID09PSAnc3RhaXI6dXAnICYmIGV4aXQuZW50cmFuY2UgPCAweDgwMDApIGRlbHRhID0gLTE2O1xuICAgICAgICAgIGlmIChleGl0LnR5cGUgPT09ICdzdGFpcjpkb3duJyAmJiBleGl0LmVudHJhbmNlID4gMHg4MDAwKSBkZWx0YSA9IDE2O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBTdGFpcnNFZmZlY3RpdmUucHVzaChwb3MgKyBkZWx0YSk7XG4gICAgICAgIHRoaXMudXBTdGFpcnMucHVzaChwb3MpO1xuICAgICAgfVxuICAgICAgLy8gY29uc3QgZXhpdCA9IG5ld01ldGEuZ2V0RXhpdChwb3MsICdzdGFpcjp1cCcpO1xuICAgICAgLy8gaWYgKChleGl0ICYmIChleGl0WzBdID4+PiA4KSkgPT09IHRoaXMub3ZlcnBhc3MuaWQpIHN0YWlyID0gcG9zO1xuICAgIH1cbiAgICAvLyBodHRwOi8vbG9jYWxob3N0OjgwODIvI2ZsYWdzPURzRXJzR3RSb3N0V20mc2VlZD1iNjNjNGIwMiZkZWJ1Z1xuICAgIGlmICghdGhpcy51bmRlckJyaWRnZXMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGJyaWRnZSBpbiAke3RoaXMubG9jfVxcbiR7dGhpcy5tZXRhLnNob3coKX1gKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLnVwU3RhaXJzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBzdGFpciBpbiAke3RoaXMubG9jfVxcbiR7dGhpcy5tZXRhLnNob3coKX1gKTtcbiAgICB9XG5cbiAgICBsZXQgc3RhaXJzTGVuID0gMDtcbiAgICBmb3IgKGNvbnN0IFssIHR5cGUsIFtkZXN0XV0gb2YgdGhpcy5vcmlnLmV4aXRzKCkpIHtcbiAgICAgIGlmICh0eXBlID09PSB1cFN0YWlyICYmIChkZXN0ID4+PiA4KSA9PT0gdGhpcy5vdmVycGFzcy5pZCkgc3RhaXJzTGVuKys7XG4gICAgfVxuICAgIHRoaXMudXBTdGFpcnMgPSB0aGlzLnJhbmRvbS5zaHVmZmxlKHRoaXMudXBTdGFpcnMpLnNsaWNlKDAsIHN0YWlyc0xlbik7XG5cbiAgICByZXR1cm4gT0s7XG4gIH1cblxuICAvLyBUT0RPIC0gY29uc2lkZXIgaW5zdGVhZCBwaWNrRXhpdEZvclBvcyhwb3M6IFBvcywgb2xkTG9jOiBNZXRhbG9jYXRpb24pXG4gIC8vIHRoYXQgd2UgY2FuIGNoYW5nZSB0aGUgbG9naWMgZm9yLCBhbmQgY2FsbCBzdXBlcigpLlxufVxuXG5cbi8vLy8gT1ZFUlBBU1M6XG4gIC8vIGFkZEVhcmx5RmVhdHVyZXNfb2xkKCk6IGJvb2xlYW4ge1xuICAvLyAgIGlmICghc3VwZXIuYWRkRWFybHlGZWF0dXJlcygpKSByZXR1cm4gZmFsc2U7XG4gIC8vICAgbGV0IGRlbHRhOiBQb3N8dW5kZWZpbmVkO1xuICAvLyAgIGZvciAobGV0IHkgPSAwOyB5IDwgdGhpcy5oOyB5KyspIHtcbiAgLy8gICAgIGZvciAobGV0IHggPSAwOyB4IDwgdGhpcy53OyB4KyspIHtcbiAgLy8gICAgICAgaWYgKHRoaXMuZ3JpZC5nZXQyKHkgKyAuNSwgeCArIC41KSA9PT0gJ2InKSB7XG4gIC8vICAgICAgICAgZGVsdGEgPSAoeSA8PCA0IHwgeCkgYXMgUG9zIC0gdGhpcy51bmRlcnBhc3MudW5kZXJCcmlkZ2VzWzBdO1xuICAvLyAgICAgICAgIGJyZWFrO1xuICAvLyAgICAgICB9XG4gIC8vICAgICB9XG4gIC8vICAgICBpZiAoZGVsdGEgIT0gbnVsbCkgYnJlYWs7XG4gIC8vICAgfVxuICAvLyAgIGlmIChkZWx0YSA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoYE5ldmVyIGZvdW5kIHRoZSBmaXJzdCBvdmVycGFzc2ApO1xuXG4gIC8vICAgLy8gQWRkIHRoZSByZW1haW5pbmcgYnJpZGdlcyBhbmQgc3RhaXJzLlxuICAvLyAgIGZvciAoY29uc3QgYnJpZGdlIG9mIHRoaXMudW5kZXJwYXNzLnVuZGVyQnJpZGdlcy5zbGljZSgxKSkge1xuICAvLyAgICAgY29uc3QgcG9zID0gYnJpZGdlICsgZGVsdGE7XG4gIC8vICAgICBjb25zdCBzeSA9IHBvcyA+Pj4gNDtcbiAgLy8gICAgIGNvbnN0IHN4ID0gcG9zICYgMHhmO1xuICAvLyAgICAgY29uc3QgaSA9IHRoaXMuZ3JpZC5pbmRleDIoc3kgKyAuNSwgc3ggKyAuNSk7XG4gIC8vICAgICBpZiAodGhpcy5ncmlkLmRhdGFbaV0gIT09ICdjJykgcmV0dXJuIGZhbHNlOyAvLyBvdXQgb2YgYm91bmRzLlxuICAvLyAgICAgY29uc3QgYyA9IHRoaXMuZ3JpZC5jb29yZChpKTtcbiAgLy8gICAgIHRoaXMuZml4ZWQuYWRkKGMpO1xuICAvLyAgICAgdGhpcy5ncmlkLmRhdGFbaV0gPSAnYic7XG4gIC8vICAgICB0aGlzLmdyaWQuZGF0YVtpIC0gMV0gPSAnJztcbiAgLy8gICAgIHRoaXMuZ3JpZC5kYXRhW2kgKyAxXSA9ICcnO1xuICAvLyAgIH1cbiAgLy8gICBmb3IgKGNvbnN0IHN0YWlyIG9mIHRoaXMudW5kZXJwYXNzLnVwU3RhaXJzRWZmZWN0aXZlKSB7XG4gIC8vICAgICBjb25zdCBwb3MgPSBzdGFpciArIGRlbHRhO1xuICAvLyAgICAgY29uc3Qgc3kgPSBwb3MgPj4+IDQ7XG4gIC8vICAgICBjb25zdCBzeCA9IHBvcyAmIDB4ZjtcbiAgLy8gICAgIGNvbnN0IGkgPSB0aGlzLmdyaWQuaW5kZXgyKHN5ICsgLjUsIHN4ICsgLjUpO1xuICAvLyAgICAgaWYgKHRoaXMuZ3JpZC5kYXRhW2ldICE9PSAnYycpIHJldHVybiBmYWxzZTtcbiAgLy8gICAgIGNvbnN0IGMgPSB0aGlzLmdyaWQuY29vcmQoaSk7XG4gIC8vICAgICB0aGlzLmZpeGVkLmFkZChjKTtcbiAgLy8gICAgIHRoaXMudW5kZXJwYXNzLmRvd25TdGFpcnMucHVzaChjb29yZFRvUG9zKGMpKTtcbiAgLy8gICAgIHRoaXMuZ3JpZC5kYXRhW2ldID0gdGhpcy5yZXZlcnNlID8gJzwnIDogJz4nO1xuICAvLyAgICAgdGhpcy5ncmlkLmRhdGFbaSArIHRoaXMuZ3JpZC5yb3ddID0gJyc7XG4gIC8vICAgICAvLyBQaWNrIGEgc2luZ2xlIGRpcmVjdGlvbiBmb3IgdGhlIHN0YWlyLlxuICAvLyAgICAgbGV0IG5laWdoYm9ycyA9IFtjIC0gOCwgYyArIDgsIGMgLSAweDgwMF0gYXMgR3JpZENvb3JkW107XG4gIC8vICAgICAvLyBOT1RFOiBpZiB3ZSBkZWxldGUgdGhlbiB3ZSBmb3JnZXQgdG8gemVybyBpdCBvdXQuLi5cbiAgLy8gICAgIC8vIGlmICh0aGlzLmRlbHRhIDwgLTE2KSBuZWlnaGJvcnMuc3BsaWNlKDIsIDEpO1xuICAvLyAgICAgLy8gaWYgKCh0aGlzLmRlbHRhICYgMHhmKSA8IDgpIG5laWdoYm9ycy5zcGxpY2UoMSwgMSk7XG4gIC8vICAgICBuZWlnaGJvcnMgPSBuZWlnaGJvcnMuZmlsdGVyKGMgPT4gdGhpcy5ncmlkLmdldChjKSA9PT0gJ2MnKTtcbiAgLy8gICAgIGlmICghbmVpZ2hib3JzLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAvLyAgICAgY29uc3Qga2VlcCA9IHRoaXMucmFuZG9tLm5leHRJbnQobmVpZ2hib3JzLmxlbmd0aCk7XG4gIC8vICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG5laWdoYm9ycy5sZW5ndGg7IGorKykge1xuICAvLyAgICAgICBpZiAoaiAhPT0ga2VlcCkgdGhpcy5ncmlkLnNldChuZWlnaGJvcnNbal0sICcnKTtcbiAgLy8gICAgIH1cbiAgLy8gICB9XG4gIC8vICAgcmV0dXJuIHRydWU7XG4gIC8vIH1cbiJdfQ==
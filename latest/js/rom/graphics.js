import { DefaultMap } from '../util.js';
import { ACTION_SCRIPTS, Monster } from './monster.js';
import { Constraint } from './constraint.js';
export class Graphics {
    constructor(rom) {
        this.rom = rom;
        this.monsterConstraints = new Map();
        this.npcConstraints = new Map();
        this.allSpritePalettes = new Set();
        const allSpawns = new DefaultMap(() => []);
        for (const l of rom.locations) {
            if (!l.used)
                continue;
            for (let i = 0; i < l.spawns.length; i++) {
                const s = l.spawns[i];
                if (!s.used)
                    continue;
                if (s.isMonster()) {
                    allSpawns.get(s.monsterId).push([l, i, s]);
                }
                else if (s.isNpc() || s.isBoss()) {
                    allSpawns.get(~s.id).push([l, i, s]);
                }
            }
        }
        for (const [m, spawns] of allSpawns) {
            if (m < 0) {
                const npc = rom.npcs[~m];
                const metaspriteIds = [npc.data[3]];
                const metasprite = rom.metasprites[metaspriteIds[0]];
                if (!metasprite)
                    throw new Error(`bad NPC: ${~m}`);
                if (npc.data[2] === 0xd0)
                    metaspriteIds.push(0xc0);
                const offset = npc.data[2] < 0x80 ? npc.data[2] & 0x70 : 0;
                let constraint = this.computeConstraint(metaspriteIds, spawns, true, offset);
                if (~m === 0x5f)
                    constraint = constraint.ignorePalette();
                this.npcConstraints.set(~m, constraint);
            }
            else {
                let constraint = Constraint.ALL;
                const parent = this.rom.objects[m];
                if (!(parent instanceof Monster)) {
                    throw new Error(`expected monster: ${parent} from ${spawns}`);
                }
                for (const obj of allObjects(rom, parent)) {
                    const action = ACTION_SCRIPTS.get(obj.action);
                    const metaspriteFn = action && action.metasprites || (() => [obj.metasprite]);
                    const child = this.computeConstraint(metaspriteFn(obj), spawns, obj.id === m, obj.data[1]);
                    const meet = constraint.meet(child);
                    if (!meet)
                        throw new Error(`Bad meet for ${m} with ${obj.id}`);
                    if (meet)
                        constraint = meet;
                    if (obj.data[4] & 0x02) {
                        const child2 = this.computeConstraint([obj.data[0x14]], spawns, false, obj.data[1]);
                        const meet2 = constraint.meet(child2);
                        if (!meet2)
                            throw new Error(`Bad meet for ${m} bonus ${obj.id}`);
                        constraint = meet2;
                    }
                }
                this.monsterConstraints.set(parent.id, constraint);
                parent.constraint = constraint;
            }
        }
    }
    getMonsterConstraint(locationId, monsterId) {
        const c = this.monsterConstraints.get(monsterId) || Constraint.NONE;
        if ((locationId & 0x58) === 0x58)
            return c;
        const m = this.rom.objects[monsterId].goldDrop;
        if (!m)
            return c;
        return c.meet(Constraint.COIN) || Constraint.NONE;
    }
    getNpcConstraint(locationId, npcId) {
        const c = this.npcConstraints.get(npcId) || Constraint.NONE;
        if (locationId === 0x1e && npcId === 0x60) {
            return c.meet(Constraint.STOM_FIGHT);
        }
        else if (locationId === 0xa0 && npcId === 0xc9) {
            return c.meet(Constraint.GUARDIAN_STATUE);
        }
        return c;
    }
    shufflePalettes(random) {
        const pal = [...this.allSpritePalettes];
        for (const [k, c] of this.monsterConstraints) {
            this.monsterConstraints.set(k, c.shufflePalette(random, pal));
        }
        for (const [k, c] of this.npcConstraints) {
            this.npcConstraints.set(k, c.shufflePalette(random, pal));
        }
    }
    configure(location, spawn) {
        if (!spawn.used)
            return;
        const c = spawn.isMonster() ? this.monsterConstraints.get(spawn.monsterId) :
            spawn.isNpc() ? this.npcConstraints.get(spawn.id) :
                spawn.isChest() ? (spawn.id < 0x70 ? Constraint.TREASURE_CHEST :
                    Constraint.MIMIC) :
                    undefined;
        if (!c)
            return;
        if (c.shift === 3 || c.float.length >= 2) {
            throw new Error(`don't know what to do with two floats`);
        }
        else if (!c.float.length) {
            spawn.patternBank = Number(c.shift === 2);
        }
        else if (c.float[0].has(location.spritePatterns[0])) {
            spawn.patternBank = 0;
        }
        else if (c.float[0].has(location.spritePatterns[1])) {
            spawn.patternBank = 1;
        }
        else if (spawn.isMonster()) {
            throw new Error(`no matching pattern bank`);
        }
    }
    computeConstraint(metaspriteIds, spawns, shiftable, offset = 0) {
        const patterns = new Set();
        const palettes = new Set();
        for (const metasprite of metaspriteIds.map(s => this.rom.metasprites[s])) {
            for (const p of metasprite.palettes()) {
                palettes.add(p);
            }
            for (const p of metasprite.patternBanks(offset)) {
                patterns.add(p);
            }
        }
        shiftable = shiftable && patterns.size == 1 && [...patterns][0] === 2;
        const locs = new Map();
        for (const [l, , spawn] of spawns) {
            locs.set(spawn.patternBank && shiftable ? ~l.id : l.id, spawn);
        }
        let child = undefined;
        for (let [l, spawn] of locs) {
            const loc = this.rom.locations[l < 0 ? ~l : l];
            for (const pal of palettes) {
                if (pal > 1)
                    this.allSpritePalettes.add(loc.spritePalettes[pal - 2]);
            }
            const c = Constraint.fromSpawn(palettes, patterns, loc, spawn, shiftable);
            child = child ? child.join(c) : c;
            if (!shiftable && spawn.patternBank)
                child = child.shifted();
        }
        if (!child)
            throw new Error(`Expected child to appear`);
        return child;
    }
}
function* allObjects(rom, parent) {
    yield parent;
    const repl = parent.spawnedReplacement();
    if (repl)
        yield* allObjects(rom, repl);
    const child = parent.spawnedChild();
    if (child)
        yield* allObjects(rom, child);
    if (parent.id === 0x50)
        yield rom.objects[0x5f];
    if (parent.id === 0x53)
        yield rom.objects[0x69];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhpY3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvanMvcm9tL2dyYXBoaWNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFFdEMsT0FBTyxFQUFDLGNBQWMsRUFBRSxPQUFPLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDckQsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBUTNDLE1BQU0sT0FBTyxRQUFRO0lBT25CLFlBQXFCLEdBQVE7UUFBUixRQUFHLEdBQUgsR0FBRyxDQUFLO1FBTHJCLHVCQUFrQixHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO1FBQ25ELG1CQUFjLEdBQUcsSUFBSSxHQUFHLEVBQXNCLENBQUM7UUFFdkQsc0JBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUtwQyxNQUFNLFNBQVMsR0FDWCxJQUFJLFVBQVUsQ0FBb0QsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFaEYsS0FBSyxNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsU0FBUyxFQUFFO1lBQzdCLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtnQkFBRSxTQUFTO1lBQ3RCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDeEMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO29CQUFFLFNBQVM7Z0JBQ3RCLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxFQUFFO29CQUNqQixTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFF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TUFBZTtJQUM1QyxNQUFNLE1BQU0sQ0FBQztJQUNiLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQ3pDLElBQUksSUFBSTtRQUFFLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdkMsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3BDLElBQUksS0FBSztRQUFFLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFNekMsSUFBSSxNQUFNLENBQUMsRUFBRSxLQUFLLElBQUk7UUFBRSxNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFZLENBQUM7SUFDM0QsSUFBSSxNQUFNLENBQUMsRUFBRSxLQUFLLElBQUk7UUFBRSxNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFZLENBQUM7QUFDN0QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7Um9tfSBmcm9tICcuLi9yb20uanMnO1xuaW1wb3J0IHtEZWZhdWx0TWFwfSBmcm9tICcuLi91dGlsLmpzJztcbmltcG9ydCB7TG9jYXRpb24sIFNwYXdufSBmcm9tICcuL2xvY2F0aW9uLmpzJztcbmltcG9ydCB7QUNUSU9OX1NDUklQVFMsIE1vbnN0ZXJ9IGZyb20gJy4vbW9uc3Rlci5qcyc7XG5pbXBvcnQge0NvbnN0cmFpbnR9IGZyb20gJy4vY29uc3RyYWludC5qcyc7XG5pbXBvcnQge1JhbmRvbX0gZnJvbSAnLi4vcmFuZG9tLmpzJztcblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vLyBUaGlzIGFjdHVhbGx5IGFwcGVhcnMgdG8gYmUgbW9yZSBvZiBhIEdyYXBoaWNzQ29uc3RyYWludHMgY2xhc3M/XG4vLyAgIC0gbWF5YmUgZG9uJ3Qgc3RvcmUgdGhlIGNvbnN0cmFpbnRzIG9uIE1vbnN0ZXI/XG5cbmV4cG9ydCBjbGFzcyBHcmFwaGljcyB7XG5cbiAgcHJpdmF0ZSBtb25zdGVyQ29uc3RyYWludHMgPSBuZXcgTWFwPG51bWJlciwgQ29uc3RyYWludD4oKTtcbiAgcHJpdmF0ZSBucGNDb25zdHJhaW50cyA9IG5ldyBNYXA8bnVtYmVyLCBDb25zdHJhaW50PigpO1xuXG4gIGFsbFNwcml0ZVBhbGV0dGVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgcm9tOiBSb20pIHtcbiAgICAvLyBJdGVyYXRlIG92ZXIgbG9jYXRpb25zL3NwYXducyB0byBidWlsZCBtdWx0aW1hcCBvZiB3aGVyZSBtb25zdGVycyBhcHBlYXIuXG4gICAgLy8gUG9zdGl2ZSBrZXlzIGFyZSBtb25zdGVycywgbmVnYXRpdmUga2V5cyBhcmUgTlBDcy5cbiAgICBjb25zdCBhbGxTcGF3bnMgPVxuICAgICAgICBuZXcgRGVmYXVsdE1hcDxudW1iZXIsIEFycmF5PHJlYWRvbmx5IFtMb2NhdGlvbiwgbnVtYmVyLCBTcGF3bl0+PigoKSA9PiBbXSk7XG5cbiAgICBmb3IgKGNvbnN0IGwgb2Ygcm9tLmxvY2F0aW9ucykge1xuICAgICAgaWYgKCFsLnVzZWQpIGNvbnRpbnVlO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsLnNwYXducy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBzID0gbC5zcGF3bnNbaV07XG4gICAgICAgIGlmICghcy51c2VkKSBjb250aW51ZTtcbiAgICAgICAgaWYgKHMuaXNNb25zdGVyKCkpIHtcbiAgICAgICAgICBhbGxTcGF3bnMuZ2V0KHMubW9uc3RlcklkKS5wdXNoKFtsLCBpLCBzXSk7XG4gICAgICAgIH0gZWxzZSBpZiAocy5pc05wYygpIHx8IHMuaXNCb3NzKCkpIHtcbiAgICAgICAgICBhbGxTcGF3bnMuZ2V0KH5zLmlkKS5wdXNoKFtsLCBpLCBzXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRm9yIGVhY2ggbW9uc3RlciwgZGV0ZXJtaW5lIHdoaWNoIHBhdHRlcm5zIGFuZCBwYWxldHRlcyBhcmUgdXNlZC5cbiAgICBmb3IgKGNvbnN0IFttLCBzcGF3bnNdIG9mIGFsbFNwYXducykge1xuICAgICAgLy8gVE9ETyAtIGZvbGQgaW50byBwYXRjaC5zaHVmZmxlTW9uc3RlcnNcbiAgICAgIC8vaWYgKG0gPT09IDApIGNvbnRpbnVlOyAvLyB1c2VkIHRvIHN1cHByZXNzIGJ1Z2d5IHN0cmF5IHNwYXduc1xuICAgICAgaWYgKG0gPCAwKSB7IC8vIE5QQ1xuICAgICAgICBjb25zdCBucGMgPSByb20ubnBjc1t+bV07XG4gICAgICAgIGNvbnN0IG1ldGFzcHJpdGVJZHMgPSBbbnBjLmRhdGFbM11dO1xuICAgICAgICBjb25zdCBtZXRhc3ByaXRlID0gcm9tLm1ldGFzcHJpdGVzW21ldGFzcHJpdGVJZHNbMF1dO1xuICAgICAgICBpZiAoIW1ldGFzcHJpdGUpIHRocm93IG5ldyBFcnJvcihgYmFkIE5QQzogJHt+bX1gKTtcbiAgICAgICAgLy8gSGFyZGNvZGUgZXhjZXB0aW9uIGZvciBqdW1waW5nIG1hbiAoYWN0aW9uIHNjcmlwdCAkNTApXG4gICAgICAgIGlmIChucGMuZGF0YVsyXSA9PT0gMHhkMCkgbWV0YXNwcml0ZUlkcy5wdXNoKDB4YzApO1xuICAgICAgICAvLyBDb21wdXRlIGNvbnN0cmFpbnRcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gbnBjLmRhdGFbMl0gPCAweDgwID8gbnBjLmRhdGFbMl0gJiAweDcwIDogMDtcbiAgICAgICAgbGV0IGNvbnN0cmFpbnQgPVxuICAgICAgICAgICAgdGhpcy5jb21wdXRlQ29uc3RyYWludChtZXRhc3ByaXRlSWRzLCBzcGF3bnMsIHRydWUsIG9mZnNldCk7XG4gICAgICAgIC8vIFRPRE8gLSBiZXR0ZXIgd2F5IHN0cmVhbWxpbmUgdGhpcy4uLj8gKHRvcm5lbCBvbiBzYWJyZSlcbiAgICAgICAgaWYgKH5tID09PSAweDVmKSBjb25zdHJhaW50ID0gY29uc3RyYWludC5pZ25vcmVQYWxldHRlKCk7XG4gICAgICAgIHRoaXMubnBjQ29uc3RyYWludHMuc2V0KH5tLCBjb25zdHJhaW50KTtcbiAgICAgIH0gZWxzZSB7IC8vIG1vbnN0ZXJcbiAgICAgICAgbGV0IGNvbnN0cmFpbnQgPSBDb25zdHJhaW50LkFMTDtcbiAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5yb20ub2JqZWN0c1ttXTtcbiAgICAgICAgaWYgKCEocGFyZW50IGluc3RhbmNlb2YgTW9uc3RlcikpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGV4cGVjdGVkIG1vbnN0ZXI6ICR7cGFyZW50fSBmcm9tICR7c3Bhd25zfWApO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3Qgb2JqIG9mIGFsbE9iamVjdHMocm9tLCBwYXJlbnQpKSB7XG4gICAgICAgICAgY29uc3QgYWN0aW9uID0gQUNUSU9OX1NDUklQVFMuZ2V0KG9iai5hY3Rpb24pO1xuICAgICAgICAgIGNvbnN0IG1ldGFzcHJpdGVGbjogKG06IE1vbnN0ZXIpID0+IHJlYWRvbmx5IG51bWJlcltdID1cbiAgICAgICAgICAgICAgYWN0aW9uICYmIGFjdGlvbi5tZXRhc3ByaXRlcyB8fCAoKCkgPT4gW29iai5tZXRhc3ByaXRlXSk7XG4gICAgICAgICAgY29uc3QgY2hpbGQgPSB0aGlzLmNvbXB1dGVDb25zdHJhaW50KG1ldGFzcHJpdGVGbihvYmopLCBzcGF3bnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iai5pZCA9PT0gbSwgb2JqLmRhdGFbMV0pO1xuICAgICAgICAgIGNvbnN0IG1lZXQgPSBjb25zdHJhaW50Lm1lZXQoY2hpbGQpO1xuICAgICAgICAgIGlmICghbWVldCkgdGhyb3cgbmV3IEVycm9yKGBCYWQgbWVldCBmb3IgJHttfSB3aXRoICR7b2JqLmlkfWApO1xuICAgICAgICAgIGlmIChtZWV0KSBjb25zdHJhaW50ID0gbWVldDtcbiAgICAgICAgICAvLyBOT1RFOiBpZiAkMzgwLHggJiAjJDAyIHRoZW4gd2UgZHJhdyBhIGJvbnVzIHNwcml0ZSAoZS5nLlxuICAgICAgICAgIC8vIG1vc3F1aXRvIHdpbmdzKSBmcm9tICQ1ODAseCB3aXRoIG5vIHNoaWZ0LlxuICAgICAgICAgIGlmIChvYmouZGF0YVs0XSAmIDB4MDIpIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkMiA9IHRoaXMuY29tcHV0ZUNvbnN0cmFpbnQoW29iai5kYXRhWzB4MTRdXSwgc3Bhd25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSwgb2JqLmRhdGFbMV0pO1xuICAgICAgICAgICAgY29uc3QgbWVldDIgPSBjb25zdHJhaW50Lm1lZXQoY2hpbGQyKTtcbiAgICAgICAgICAgIGlmICghbWVldDIpIHRocm93IG5ldyBFcnJvcihgQmFkIG1lZXQgZm9yICR7bX0gYm9udXMgJHtvYmouaWR9YCk7XG4gICAgICAgICAgICBjb25zdHJhaW50ID0gbWVldDI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMubW9uc3RlckNvbnN0cmFpbnRzLnNldChwYXJlbnQuaWQsIGNvbnN0cmFpbnQpO1xuICAgICAgICBwYXJlbnQuY29uc3RyYWludCA9IGNvbnN0cmFpbnQ7ICAvLyBmb3IgZGVidWdnaW5nXG4gICAgICB9XG4gICAgfSAgICBcbiAgfVxuXG4gIGdldE1vbnN0ZXJDb25zdHJhaW50KGxvY2F0aW9uSWQ6IG51bWJlciwgbW9uc3RlcklkOiBudW1iZXIpOiBDb25zdHJhaW50IHtcbiAgICBjb25zdCBjID0gdGhpcy5tb25zdGVyQ29uc3RyYWludHMuZ2V0KG1vbnN0ZXJJZCkgfHwgQ29uc3RyYWludC5OT05FO1xuICAgIGlmICgobG9jYXRpb25JZCAmIDB4NTgpID09PSAweDU4KSByZXR1cm4gYztcbiAgICBjb25zdCBtID0gdGhpcy5yb20ub2JqZWN0c1ttb25zdGVySWRdLmdvbGREcm9wO1xuICAgIGlmICghbSkgcmV0dXJuIGM7XG4gICAgcmV0dXJuIGMubWVldChDb25zdHJhaW50LkNPSU4pIHx8IENvbnN0cmFpbnQuTk9ORTtcbiAgfVxuXG4gIGdldE5wY0NvbnN0cmFpbnQobG9jYXRpb25JZDogbnVtYmVyLCBucGNJZDogbnVtYmVyKTogQ29uc3RyYWludCB7XG4gICAgY29uc3QgYyA9IHRoaXMubnBjQ29uc3RyYWludHMuZ2V0KG5wY0lkKSB8fCBDb25zdHJhaW50Lk5PTkU7XG4gICAgaWYgKGxvY2F0aW9uSWQgPT09IDB4MWUgJiYgbnBjSWQgPT09IDB4NjApIHtcbiAgICAgIC8vIFRPRE86IGNoYW5nZSB0aGlzIHRvIGFjdHVhbGx5IGxvb2sgYXQgdGhlIGxvY2F0aW9uJ3MgdHJpZ2dlcnM/XG4gICAgICByZXR1cm4gYy5tZWV0KENvbnN0cmFpbnQuU1RPTV9GSUdIVCk7XG4gICAgfSBlbHNlIGlmIChsb2NhdGlvbklkID09PSAweGEwICYmIG5wY0lkID09PSAweGM5KSB7XG4gICAgICByZXR1cm4gYy5tZWV0KENvbnN0cmFpbnQuR1VBUkRJQU5fU1RBVFVFKTtcbiAgICB9XG4gICAgcmV0dXJuIGM7XG4gIH1cblxuICBzaHVmZmxlUGFsZXR0ZXMocmFuZG9tOiBSYW5kb20pOiB2b2lkIHtcbiAgICBjb25zdCBwYWwgPSBbLi4udGhpcy5hbGxTcHJpdGVQYWxldHRlc107XG4gICAgZm9yIChjb25zdCBbaywgY10gb2YgdGhpcy5tb25zdGVyQ29uc3RyYWludHMpIHtcbiAgICAgIHRoaXMubW9uc3RlckNvbnN0cmFpbnRzLnNldChrLCBjLnNodWZmbGVQYWxldHRlKHJhbmRvbSwgcGFsKSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2ssIGNdIG9mIHRoaXMubnBjQ29uc3RyYWludHMpIHtcbiAgICAgIHRoaXMubnBjQ29uc3RyYWludHMuc2V0KGssIGMuc2h1ZmZsZVBhbGV0dGUocmFuZG9tLCBwYWwpKTtcbiAgICB9XG4gIH1cblxuICBjb25maWd1cmUobG9jYXRpb246IExvY2F0aW9uLCBzcGF3bjogU3Bhd24pIHtcbiAgICBpZiAoIXNwYXduLnVzZWQpIHJldHVybjtcbiAgICBjb25zdCBjID0gc3Bhd24uaXNNb25zdGVyKCkgPyB0aGlzLm1vbnN0ZXJDb25zdHJhaW50cy5nZXQoc3Bhd24ubW9uc3RlcklkKSA6XG4gICAgICAgIHNwYXduLmlzTnBjKCkgPyB0aGlzLm5wY0NvbnN0cmFpbnRzLmdldChzcGF3bi5pZCkgOlxuICAgICAgICBzcGF3bi5pc0NoZXN0KCkgPyAoc3Bhd24uaWQgPCAweDcwID8gQ29uc3RyYWludC5UUkVBU1VSRV9DSEVTVCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICBDb25zdHJhaW50Lk1JTUlDKSA6XG4gICAgICAgIHVuZGVmaW5lZDtcbiAgICBpZiAoIWMpIHJldHVybjtcbiAgICBpZiAoYy5zaGlmdCA9PT0gMyB8fCBjLmZsb2F0Lmxlbmd0aCA+PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGRvbid0IGtub3cgd2hhdCB0byBkbyB3aXRoIHR3byBmbG9hdHNgKTtcbiAgICB9IGVsc2UgaWYgKCFjLmZsb2F0Lmxlbmd0aCkge1xuICAgICAgc3Bhd24ucGF0dGVybkJhbmsgPSBOdW1iZXIoYy5zaGlmdCA9PT0gMik7XG4gICAgfSBlbHNlIGlmIChjLmZsb2F0WzBdLmhhcyhsb2NhdGlvbi5zcHJpdGVQYXR0ZXJuc1swXSkpIHtcbiAgICAgIHNwYXduLnBhdHRlcm5CYW5rID0gMDtcbiAgICB9IGVsc2UgaWYgKGMuZmxvYXRbMF0uaGFzKGxvY2F0aW9uLnNwcml0ZVBhdHRlcm5zWzFdKSkge1xuICAgICAgc3Bhd24ucGF0dGVybkJhbmsgPSAxO1xuICAgIH0gZWxzZSBpZiAoc3Bhd24uaXNNb25zdGVyKCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbm8gbWF0Y2hpbmcgcGF0dGVybiBiYW5rYCk7XG4gICAgfVxuICB9XG5cbiAgY29tcHV0ZUNvbnN0cmFpbnQobWV0YXNwcml0ZUlkczogcmVhZG9ubHkgbnVtYmVyW10sXG4gICAgICAgICAgICAgICAgICAgIHNwYXduczogU3Bhd25zLFxuICAgICAgICAgICAgICAgICAgICBzaGlmdGFibGU6IGJvb2xlYW4sXG4gICAgICAgICAgICAgICAgICAgIG9mZnNldCA9IDApOiBDb25zdHJhaW50IHtcbiAgICBjb25zdCBwYXR0ZXJucyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuICAgIGNvbnN0IHBhbGV0dGVzID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBtZXRhc3ByaXRlIG9mIG1ldGFzcHJpdGVJZHMubWFwKHMgPT4gdGhpcy5yb20ubWV0YXNwcml0ZXNbc10pKSB7XG4gICAgICAvLyBXaGljaCBwYWxldHRlIGFuZCBwYXR0ZXJuIGJhbmtzIGFyZSByZWZlcmVuY2VkP1xuICAgICAgZm9yIChjb25zdCBwIG9mIG1ldGFzcHJpdGUucGFsZXR0ZXMoKSkge1xuICAgICAgICBwYWxldHRlcy5hZGQocCk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHAgb2YgbWV0YXNwcml0ZS5wYXR0ZXJuQmFua3Mob2Zmc2V0KSkge1xuICAgICAgICBwYXR0ZXJucy5hZGQocCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gb2JqLnVzZWRQYWxldHRlcyA9IFsuLi5wYWxldHRlc107XG4gICAgLy8gb2JqLnVzZWRQYXR0ZXJucyA9IFsuLi5wYXR0ZXJuc107XG5cbiAgICAvLyBJZiBvbmx5IHRoaXJkLWJhbmsgcGF0dGVybnMgYXJlIHVzZWQsIHRoZW4gdGhlIG1ldGFzcHJpdGUgY2FuIGJlXG4gICAgLy8gc2hpZnRlZCB0byBmb3VydGggYmFuayB3aGVuIG5lY2Vzc2FyeS4gIFRoaXMgaXMgb25seSB0cnVlIGZvciBOUENcbiAgICAvLyBzcGF3bnMuICBBZCBob2Mgc3Bhd25zIGNhbm5vdCBiZSBzaGlmdGVkICh5ZXQ/KS5cbiAgICBzaGlmdGFibGUgPSBzaGlmdGFibGUgJiYgcGF0dGVybnMuc2l6ZSA9PSAxICYmIFsuLi5wYXR0ZXJuc11bMF0gPT09IDI7XG5cbiAgICAvLyBJZiB0aGUgc3Bhd24gc2V0cyBwYXR0ZXJuQmFuayB0aGVuIHdlIG5lZWQgdG8gaW5jcmVtZW50IGVhY2ggcGF0dGVybi5cbiAgICAvLyBXZSBoYXZlIHRoZSBmcmVlZG9tIHRvIHNldCB0aGlzIHRvIGVpdGhlciwgZGVwZW5kaW5nLlxuICAgIGNvbnN0IGxvY3MgPSBuZXcgTWFwPG51bWJlciwgU3Bhd24+KCk7XG4gICAgZm9yIChjb25zdCBbbCwgLCBzcGF3bl0gb2Ygc3Bhd25zKSB7XG4gICAgICBsb2NzLnNldChzcGF3bi5wYXR0ZXJuQmFuayAmJiBzaGlmdGFibGUgPyB+bC5pZCA6IGwuaWQsIHNwYXduKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPIC0gQ29uc3RyYWludEJ1aWxkZXJcbiAgICAvLyAgIC0tIGtlZXBzIHRyYWNrIG9ubHkgb2YgcmVsZXZhbnQgZmFjdG9ycywgaW4gYSBqb2luLlxuICAgIC8vICAgICAgLS0+IG5vIG1lZXRpbmcgaW52b2x2ZWQhXG4gICAgbGV0IGNoaWxkID0gdW5kZWZpbmVkO1xuXG4gICAgZm9yIChsZXQgW2wsIHNwYXduXSBvZiBsb2NzKSB7XG4gICAgICBjb25zdCBsb2MgPSB0aGlzLnJvbS5sb2NhdGlvbnNbbCA8IDAgPyB+bCA6IGxdO1xuICAgICAgZm9yIChjb25zdCBwYWwgb2YgcGFsZXR0ZXMpIHtcbiAgICAgICAgaWYgKHBhbCA+IDEpIHRoaXMuYWxsU3ByaXRlUGFsZXR0ZXMuYWRkKGxvYy5zcHJpdGVQYWxldHRlc1twYWwgLSAyXSk7XG4gICAgICB9XG4gICAgICBjb25zdCBjID0gQ29uc3RyYWludC5mcm9tU3Bhd24ocGFsZXR0ZXMsIHBhdHRlcm5zLCBsb2MsIHNwYXduLCBzaGlmdGFibGUpO1xuICAgICAgY2hpbGQgPSBjaGlsZCA/IGNoaWxkLmpvaW4oYykgOiBjO1xuICAgICAgaWYgKCFzaGlmdGFibGUgJiYgc3Bhd24ucGF0dGVybkJhbmspIGNoaWxkID0gY2hpbGQuc2hpZnRlZCgpO1xuXG4gICAgICAvLyAtLS0gaGFuZGxlIHNoaWZ0cyBiZXR0ZXIuLi4/IHN1cHBvc2UgZS5nLiBtdWx0aXBsZSBwYWwyJ3NcbiAgICAgIC8vICAgIC0+IHdlIHdhbnQgdG8gam9pbiB0aGVtIC0gd2lsbCBoYXZlIG11bHRpcGxlIHNoaWZ0YWJsZXMuLi5cbiAgICAgIC8vY29uc3RyYWludCA9IGNvbnN0cmFpbnQuXG4gICAgfVxuXG4gICAgLy8gSWYgd2UncmUgc2hpZnRhYmxlLCBzYXZlIHRoZSBzZXQgb2YgcG9zc2libGUgc2hpZnQgYmFua3NcbiAgICBpZiAoIWNoaWxkKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGNoaWxkIHRvIGFwcGVhcmApO1xuICAgIC8vIGlmIChjaGlsZC5mbG9hdC5sZW5ndGggPT09IDEpIHtcbiAgICAvLyAgIHBhcmVudC5zaGlmdFBhdHRlcm5zID0gbmV3IFNldChjaGlsZC5mbG9hdFswXSk7XG4gICAgLy8gfVxuICAgIHJldHVybiBjaGlsZDtcbiAgfVxufVxuXG5mdW5jdGlvbiogYWxsT2JqZWN0cyhyb206IFJvbSwgcGFyZW50OiBNb25zdGVyKTogSXRlcmFibGU8TW9uc3Rlcj4ge1xuICB5aWVsZCBwYXJlbnQ7XG4gIGNvbnN0IHJlcGwgPSBwYXJlbnQuc3Bhd25lZFJlcGxhY2VtZW50KCk7XG4gIGlmIChyZXBsKSB5aWVsZCogYWxsT2JqZWN0cyhyb20sIHJlcGwpO1xuICBjb25zdCBjaGlsZCA9IHBhcmVudC5zcGF3bmVkQ2hpbGQoKTtcbiAgaWYgKGNoaWxkKSB5aWVsZCogYWxsT2JqZWN0cyhyb20sIGNoaWxkKTtcbiAgLy8gVE9ETyAtIHRoZXNlIGRvbid0IG1ha2Ugc2Vuc2UgdG8gcHV0IGluIHNwYXduZWRSZXBsYWNlbWVudCBiZWNhdXNlXG4gIC8vIHdlIGRvbid0IHdhbnQgdG8gb3Zlci1pbmZsYXRlIHJlZCBzbGltZXMgZHVlIHRvIGdpYW50IHJlZCBzbGltZXMnXG4gIC8vIGRpZmZpY3VsdHksIHNpbmNlIG1vc3QgZm9sa3Mgd2lsbCBuZXZlciBoYXZlIHRvIGRlYWwgd2l0aCB0aGF0LlxuICAvLyBCdXQgd2UgZG8gbmVlZCB0byBtYWtlIHN1cmUgdGhhdCB0aGV5IGdldCBcInVuLWZsb2F0ZWRcIiBzaW5jZSB0aGVcbiAgLy8gcmVwbGFjZW1lbnQgc3Bhd24gd2lsbCBub3Qgc2hhcmUgdGhlIHNhbWUgMzgwOjIwIChmb3Igbm93KS5cbiAgaWYgKHBhcmVudC5pZCA9PT0gMHg1MCkgeWllbGQgcm9tLm9iamVjdHNbMHg1Zl0gYXMgTW9uc3RlcjsgLy8gYmx1ZSBzbGltZVxuICBpZiAocGFyZW50LmlkID09PSAweDUzKSB5aWVsZCByb20ub2JqZWN0c1sweDY5XSBhcyBNb25zdGVyOyAvLyByZWQgc2xpbWVcbn1cblxudHlwZSBTcGF3bnMgPSBSZWFkb25seUFycmF5PHJlYWRvbmx5IFtMb2NhdGlvbiwgbnVtYmVyLCBTcGF3bl0+O1xuIl19
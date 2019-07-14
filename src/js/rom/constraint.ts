import {Location, Spawn} from "./location.js";
import {seq} from "./util.js";
import { iters } from "../util.js";

// Constraint for pattern and palette pages.
// Allows multiple possibilities, and a callback when one is picked.

interface CSet {
  readonly size: number;
  has: (x: number) => boolean;
  [Symbol.iterator]: () => Iterator<number>;
}

const EMPTY_ITERATOR: Iterator<number> = {
  next() { return {done: true} as any; },
};

const NONE: CSet = {
  get size() { return 0; },
  has() { return false; },
  [Symbol.iterator]() { return EMPTY_ITERATOR; },
};

const ALL: CSet = {
  get size() { return Infinity; },
  has() { return true; },
  [Symbol.iterator]() { throw new Error('cannot iterate'); },
}

class Bit implements CSet {
  constructor(readonly bit: number) {}
  get size() { return 1; }
  has(x: number) { return x === this.bit; }
  [Symbol.iterator]() { return [this.bit][Symbol.iterator](); }
}

function bit(x: number): Bit {
  return new Bit(x);
}

namespace CSet {
  export function intersect(a: CSet, b: CSet): CSet {
    if (a === ALL || !b.size) return b;
    if (b === ALL || !a.size) return a;
    const out = new Set<number>();
    for (const x of a) {
      if (b.has(x)) out.add(x);
    }
    if (!out.size) return NONE;
    return out;
  }
  export function union(a: CSet, b: CSet): CSet {
    if (a === ALL || !b.size) return a;
    if (b === ALL || !a.size) return b;
    const out = new Set(a);
    for (const x of b) {
      out.add(x);
    }
    return out;
  }
  export function label(x: CSet): string {
    return x === ALL ? 'all' : [...x].sort().join(' ');
  }
}

// class ConstraintSet {
//   constructor(readonly allowed?: Set<number>) {}

//   get size() { return this.allowed ? this.allowed.size : Infinity; }
//   has(x: number) { return this.allowed ? this.allowed.has(x) : true; }
//   intersect(that: ConstraintSet): ConstraintSet {
//     if (!this.allowed) return that;
//     if (!that.allowed) return this;
//     const out = new Set<number>();
//     for (const x of this.allowed) {
//       if (that.allowed.has(x)) out.add(x);
//     }
//     return new ConstraintSet(out);
//   }    
//   union(that: ConstraintSet): ConstraintSet {
//     if (!this.allowed) return this;
//     if (!that.allowed) return that;
//     const out = new Set(this.allowed);
//     for (const x of that.allowed) {
//       out.add(x);
//     }
//     return new ConstraintSet(out);
//   }
// }

// const UNCONSTRAINED = new ConstraintSet();

// function constraint(x: number): ConstraintSet {
//   return new ConstraintSet(new Set([x]));
// }

export class Constraint {
  constructor(readonly fixed: ReadonlyArray<CSet>, // length always 4
              readonly float: ReadonlyArray<CSet>) {}

  get pat0(): CSet { return this.fixed[0]; }
  get pat1(): CSet { return this.fixed[1]; }
  get pal2(): CSet { return this.fixed[2]; }
  get pal3(): CSet { return this.fixed[3]; }

  static get ALL() {
    return new Constraint([ALL, ALL, ALL, ALL], []);
  }

  static get NONE() {
    return new Constraint([NONE, NONE, NONE, NONE], []);
  }

  // NOTE: Static spawns may be shiftable; ad-hoc spawns are not.
  static fromSpawn(palettes: Set<number>, patterns: Set<number>, location: Location, spawn: Spawn, shiftable: boolean): Constraint {
    const [firstPattern, ...rest] = patterns;
    shiftable = shiftable && firstPattern === 2 && !rest.length;
    const pat0 = shiftable || !patterns.has(2) ? ALL : bit(location.spritePatterns[0]);
    const pat1 = shiftable || !patterns.has(3) ? ALL : bit(location.spritePatterns[1]);
    const float = shiftable ? [bit(location.spritePatterns[spawn.patternBank])] : [];
    const pal2 = palettes.has(2) ? bit(location.spritePalettes[0]) : ALL;
    const pal3 = palettes.has(3) ? bit(location.spritePalettes[1]) : ALL;
    return new Constraint([pat0, pat1, pal2, pal3], float);
  }

  // TODO - combine these...

  // All the possible constraints for a given monster are joined together.
  // So if the same monster shows up with two different palettes, then we
  // end up with a two-element set for its palette.
  join(that: Constraint): Constraint {
    const fixed = seq(4, i => CSet.union(this.fixed[i], that.fixed[i]));
    if (this.float.length != that.float.length) {
      console.dir(this); console.dir(that);
      throw new Error(`incompatible float: ${this.float} ${that.float}`);
    }
    const float = seq(this.float.length, i => CSet.union(this.float[i], that.float[i]));
    return new Constraint(fixed, float);

    // const floatMap = new Map<string, CSet>();
    // for (const s of iters.concat(this.float, that.float)) {
    //   floatMap.set(CSet.label(s), s);
    // }
    // const float = [...floatMap.values()];
    // if (float.length > 2) {
    //   // need to do something?
    // }

    // const pat0 = this.pat0 && that.pat0 && this.pat0.union(that.pat0);
    // const pat1 = this.pat1 && that.pat1 && this.pat1.union(that.pat1);
    // const patX = this.patX && that.patX && this.patX.union(that.patX);
    // const patY = this.patY && that.patY && this.patY.union(that.patY);
    // const pal2 = this.pal2 && that.pal2 && this.pal2.union(that.pal2);
    // const pal3 = this.pal3 && that.pal3 && this.pal3.union(that.pal3);
    // const shiftable = this.shiftable || that.shiftable;
    // return new Constraint(pat0, pat1, patX, patY, pal2, pal3, shiftable);
  }

  meet(that: Constraint): Constraint | undefined {
    // This is the tricky one.  It's used (a) to combine projectiles with
    // their parents, and (b) to add additional monsters to a location.
    // We need to maintain some invariants: (1) If pat0 or pat1 is set,
    // then patX and patY must intersect it.  Otherwise we collapse the
    // non-intersecting one down.  If any constraint is empty, return
    // undefined.

    const fixed = [];
    for (let i = 0; i < 4; i++) {
      const meet = CSet.intersect(this.fixed[i], that.fixed[i]);
      if (!meet.size) return undefined;
      fixed.push(meet);
    }

    // Now deal with the float slots.
    // We may need to do some merging, i.e. if this.float and that.float both
    // have elements.  If they're the same element then we're okay...  We should
    // eagerly meet any pairs possible...

    // Invariant: all elements in float are disjoint from one another.
    // Invariant: all elements in float overlap with at least one fixed set.

    const inverseFloat = new Map<number, number>();
    const float: CSet[] = [];
    for (const s of iters.concat(this.float, that.float)) {
      if (s === ALL) throw new Error(`Unexpected unconstrained float`);
      let found = false;
      for (const p of s) {
        const prev = inverseFloat.get(p);
        if (prev != null) {
          float[prev] = CSet.intersect(float[prev], s);
          found = true;
          break;
        }
      }
      if (found) break;

      // No intersection between this floating constraint and any previous,
      // so add it.  If there's more than two, we're out of luck.
      float.push(s);
      if (float.length > 2) return undefined;
    }

    // Now that float is complete, check the invariant that every floating
    // set intersects with both fixed slots.
    for (let i = 0; i < float.length; i++) {
      for (let j = 0; j < 2; j++) {
        const intersect = CSet.intersect(float[i], fixed[j]);
        if (!intersect.size) {
          // A float is disjoint from a fixed: resolve the other fixed slot.
          const c = fixed[1 - j] = CSet.intersect(float[i], fixed[1 - j]);
          if (!c.size) return undefined;
          float.splice(i, 1);
          // Reset the outer for loop and check again.
          i = -1;
          break;
        }
      }
    }

    // At this point, the invariants are satisfied, so we can return.
    return new Constraint(fixed, float);

    // const pal2 = (this.pal2 || UNCONSTRAINED).intersect(that.pal2 || UNCONSTRAINED);
    // const pal3 = (this.pal3 || UNCONSTRAINED).intersect(that.pal3 || UNCONSTRAINED);

    // let pat0 = (this.pat0 || UNCONSTRAINED).intersect(that.pat0 || UNCONSTRAINED);
    // let pat1 = (this.pat1 || UNCONSTRAINED).intersect(that.pat1 || UNCONSTRAINED);

    // let patX = undefined;
    // let patY = undefined;

    // // Instead - list of floating patterns?
    // // 

    // if (this.patX && that.patX) {
    //   // is there any overlap?
    //   const meet = this.patX.intersect(that.patX);
    //   if (meet.size) {
    //     patX = meet;
    //   } else if (!this.patY && !that.patY) {
    //     patX = this.patX;
    //     patY = that.patX;
    //   }
    // }

    // let patX = (this.patX || UNCONSTRAINED).intersect(that.patX || UNCONSTRAINED);
    // let patY = (this.patY || UNCONSTRAINED).intersect(that.patY || UNCONSTRAINED);
  }
}

// MIGHT be possible to have a combination?
//   -- suppose we have orcs with patX = 1|2 and axe has pat2 = 1|3.
//      then pat1=2,pat2=3 is an option... but it's less obvious.
//   -- we need a "meet" functionality for combining monsters w/ projectiles

// Two different constraints, with (slightly different)? behavior:
//   - 5 sets
//   - rules for interaction of pat0, pat1, patX
//   - (pat0,pat1) and patX must not be disjoint
//     if pat0 disjoint from patX then pat1 <- patX.
//   - if any set reduced to 1 element, it's fixed
//   - also patY but it's never stored??  it's possible
//     that it is stored and has the same rules
//     -> collase as soon as possible...

// class StaticConstraint extends GraphicsConstraint {
//   readonly pat0?: Set<number>;
//   readonly pat1?: Set<number>;
// }

// class ShiftConstraint extends GraphicsConstraint {
//   readonly patX: Set<number>;
// }

// export class XConstraint {

//   readonly options = new Map<string, Option>();

//   constructor(options: readonly Option[] | Map<string, Option> = [ALL],
//               readonly shiftable?: number) {
//     if (options instanceof Map) {
//       this.options = options;
//     } else {
//       for (let option of options) {
//         const label = option.label();
//         const prev = this.options.get(label);
//         if (prev) option = prev.meet(option)!;
//         this.options.set(label, option);
//       }
//     }
//   }

//   static shiftable(page: number): Constraint {
//     return new Constraint([], page);
//   }

//   static pat0(pages: Iterable<number>): Constraint {
//     return new Constraint([...pages].map(p => new Option(p)));
//   }

//   static pat1(pages: Iterable<number>): Constraint {
//     return new Constraint([...pages].map(p => new Option(-1, p)));
//   }

//   static pal2(pages: Iterable<number>): Constraint {
//     return new Constraint([...pages].map(p => new Option(-1, -1, p)));
//   }

//   static pal3(pages: Iterable<number>): Constraint {
//     return new Constraint([...pages].map(p => new Option(-1, -1, -1, p)));
//   }

//   spawn(slot: number): Constraint {
//     // realize a shiftable into a concrete constraint
//     if (this.shiftable == null) return this;
//     return new Constraint([
//       new Option(this.shiftable, -1, -1, -1, new Map([[slot, 0]])),
//       new Option(-1, this.shiftable, -1, -1, new Map([[slot, 1]]))
//     ]).meet(new Constraint(this.options));
//   }

//   join(that: Constraint): Constraint {
//     if (this.shiftable != null && that.shiftable != null) throw new Error('both shift');
//     const out = new Map<string, Option>();
//     for (let [label, option] of [...this.options, ...that.options]) {
//       const prev = out.get(label);
//       if (prev) option = prev.meet(option)!;
//       out.set(label, option);
//     }
//     return new Constraint(out, this.shiftable != null ? this.shiftable : that.shiftable);
//   }

//   meet(that: Constraint): Constraint {
//     // Take the cross product of both sets of options.
//     if (this.shiftable != null && that.shiftable != null) throw new Error('both shift');
//     const out = new Map<string, Option>();
//     for (const a of this.options.values()) {
//       for (const b of that.options.values()) {
//         let option = a.meet(b);
//         if (!option) continue;
//         const label = option.label();
//         const prev = out.get(label);
//         if (prev) option = prev.meet(option)!;
//         out.set(label, option);
//       }
//     }
//     return new Constraint(out, this.shiftable != null ? this.shiftable : that.shiftable);
//   }
// }

// export class Option {
//   constructor(readonly pat0: number = -1,
//               readonly pat1: number = -1,
//               readonly pal2: number = -1,
//               readonly pal3: number = -1,
//               readonly pages = new Map<number, number>()) {}

//   meet(that: Option): Option | null {
//     const pat0 = meet(this.pat0, that.pat0);
//     const pat1 = meet(this.pat1, that.pat1);
//     const pal2 = meet(this.pal2, that.pal2);
//     const pal3 = meet(this.pal3, that.pal3);
//     if (isNaN(pat0) || isNaN(pat1) || isNaN(pal2) || isNaN(pal3)) return null;
//     return new Option(pat0, pat1, pal2, pal3, new Map([...this.pages, ...that.pages]));
//   }

//   label(): string {
//     return `${this.pat0} ${this.pat1} ${this.pal2} ${this.pal3}`;
//   }
// }

// const ALL = new Option();

// function meet(a: number, b: number): number {
//   if (a < 0) return b;
//   if (b < 0) return a;
//   if (a === b) return a;
//   return NaN;
// }

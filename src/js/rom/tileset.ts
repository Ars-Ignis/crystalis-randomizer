import {Module} from '../asm/module.js';
import {Rom} from '../rom.js';
import {Entity} from './entity.js';
import {MapScreen} from './mapscreen.js';
import {TileEffects} from './tileeffects.js';
import {seq, tuple} from './util.js';

export class Tilesets implements Iterable<Tileset> {

  private tilesets: Tileset[] = [];

  readonly [id: number]: Tileset;

  constructor(readonly rom: Rom) {
    for (let i = 0x80; i < 0xb0; i += 4) {
      this.tilesets.push(((this as any)[i] = new Tileset(rom, i)));
    }
  }

  [Symbol.iterator](): IterableIterator<Tileset> {
    return this.tilesets[Symbol.iterator]();
  }
}

// Mappping from metatile ID to tile quads and palette number.
export class Tileset extends Entity {

  // TODO - permanently attach behavior
  // Store more information, such as screen types, edge types, etc.
  // Names...
  // Does palette info belong here?  Maybe...

  tiles: number[][];    // tile info, outer is 4 quadrants (TL, TR, BL, BR)
  attrs: number[];      // palette info
  alternates: number[]; // 32-element mapping for flag-based alternates

  private lazyScreens?: readonly MapScreen[];

  constructor(rom: Rom, id: number) {
    // `id` is MapData[1][3], ranges from $80..$bc in increments of 4.
    super(rom, id);
    this.tiles = seq(4, q => tuple(rom.prg, this.tileBase | q << 8 , 256));
    this.attrs = seq(256, i => rom.prg[this.attrBase | i >> 2] >> ((i & 3) << 1) & 3);
    this.alternates = tuple(rom.prg, this.alternatesBase, 32);
  }

  private get map(): number {
    return this.id & 0x3f;
  }

  get tileBase(): number {
    return 0x10000 | this.map << 8;
  }

  get attrBase(): number {
    return 0x13000 | this.map << 4;
  }

  get alternatesBase(): number {
    return 0x13e00 | this.map << 3;
  }

  // TODO - is this unused?
  get screens(): readonly MapScreen[] {
    if (this.lazyScreens) return this.lazyScreens;
    return this.lazyScreens =
        seq(256, i => new MapScreen(this.rom.screens[i], this));
  }

  write(): Module[] {
    const attr = seq(0x40, i => {
      const j = i << 2;
      return (this.attrs[j] & 3) | (this.attrs[j + 1] & 3) << 2 |
             (this.attrs[j + 2] & 3) << 4 | (this.attrs[j + 3] & 3) << 6;
    });
    const a = this.rom.assembler();
    a.segment('08', '09');
    a.org(0x8000 | this.map << 8);
    a.byte(...([] as number[]).concat(...this.tiles));
    a.org(0xb000 | this.map << 4);
    a.byte(...attr);
    a.org(0xbe00 | this.map << 3);
    a.byte(...this.alternates);
    return [a.module()];
  }

  effects(): TileEffects {
    // NOTE: it's possible this could get out of sync...
    let index = (this.id >>> 2) & 0xf;
    if (this.id === 0xa8) index = 2;
    if (this.id === 0xac) index--;
    return this.rom.tileEffects[index];
  }

  // passage(tileId: number, tileEffects = this.effects()): Terrain {
  //   const effects = tileEffects.effects;
  //   // Note: for this purpose, pits can be traversed because there should always
  //   // be a platform across it.  The dolphin counts as flying, and we have
  //   // special logic to translate that.
  //   const bits = effects[tileId] & 0x26;
  //   if (!bits) return Passage.ALWAYS;
  //   // Note: this will lose the flight bit from angry sea waterfall, but
  //   // that's probably fine.
  //   if (bits & 0x20) return Passage.SLOPE;
  //   // TODO - require the 0x08 bit before checking alternate?
  //   if (tileId < 0x20 && this.alternates[tileId] !== tileId) {
  //     const altBits = effects[this.alternates[tileId]] & 0x26;
  //     if (!altBits) return Passage.FLAG;
  //   }
  //   if (!(bits & 0x04)) return Passage.FLY;
  //   return Passage.NEVER;
  // }
}

// export class Metatileset {
//   // TODO - extra stuff, info about capabilities, etc?

//   constructor(readonly tileset: Tileset, readonly data: MetatilesetData) {}

//   getTile(id: number): Metatile {
//     return new Metatile(this.tileset, id);
//   }

// }

// export class Metatile {
//   private copiedFrom = -1;
//   constructor(readonly tileset: Tileset, readonly id: number) {}

//   // get topLeft(): number { return this.tileset.tileset.tiles[0][this.id]; }
//   // set topLeft(x: number) { this.tileset.tileset.tiles[0][this.id] = x; }

//   // get topRight(): number { return this.tileset.tileset.tiles[1][this.id]; }
//   // set topRight(x: number) { this.tileset.tileset.tiles[1][this.id] = x; }

//   // get bottomLeft(): number { return this.tileset.tileset.tiles[2][this.id]; }
//   // set bottomLeft(x: number) { this.tileset.tileset.tiles[2][this.id] = x; }

//   // get bottomRight(): number { return this.tileset.tileset.tiles[3][this.id]; }
//   // set bottomRight(x: number) { this.tileset.tileset.tiles[3][this.id] = x; }

//   // TODO - getters?

//   get tiles(): readonly number[] {
//     return [0, 1, 2, 3].map(i => this.tileset.tiles[i][this.id]);
//   }
//   setTiles(tiles: ReadonlyArray<number|undefined>): this {
//     for (let i = 0; i < 4; i++) {
//       const tile = tiles[i];
//       if (tile != null) this.tileset.tiles[i][this.id] = tile;
//     }
//     return this;
//   }

//   get alternative(): number|null {
//     const alt = this.id < 0x20 ? this.tileset.alternates[this.id] : this.id;
//     return alt !== this.id ? alt : null;
//   }
//   setAlternative(tile: number|null): this {
//     if (this.id >= 0x20) return this;
//     this.tileset.alternates[this.id] = tile != null ? tile : this.id;
//     return this;
//   }

//   get attrs(): number {
//     return this.tileset.attrs[this.id];
//   }
//   setAttrs(attrs: number): this {
//     this.tileset.attrs[this.id] = attrs;
//     return this;
//   }

//   get effects(): number {
//     return this.tileset.effects().effects[this.id];
//   }
//   setEffects(effects: number): this {
//     this.tileset.effects().effects[this.id] = effects;
//     return this;
//   }

//   copyFrom(other: number): this {
//     const that = new Metatile(this.tileset, other);
//     this.copiedFrom = other;
//     this.setTiles(that.tiles);
//     if ((this.id | that.id) < 0x20) {
//       this.setAlternative(that.alternative);
//     }
//     this.setAttrs(that.attrs);
//     this.setEffects(that.effects);
//     return this;
//   }

//   replaceIn(...screens: Metascreen[]): this {
//     if (this.copiedFrom < 0) throw new Error(`Must copyFrom first.`);
//     for (const screen of screens) {
//       screen.replace(this.copiedFrom, this.id);
//     }
//     return this;
//   }
// }

// interface MetatilesetData {
//   id: number;
//   patterns?: readonly [number, number];
//   animated?: readonly number[];
// }

// // TODO - Tilesets class extending SparseArray<Tileset>
// //      - some Tileset are MultiTileset with separate semantic tilesets inside?
// const TILESETS = {
//   grass: { // has various features: windmill, fortress, flowers
//     id: 0x80,
//     // tiles: { // } as Filter<{grass:true}>,
//     //   mountain: 0x00,
//     // },
//     patterns: [0x00, 0x0c],
//   },
//   town: {
//     id: 0x84,
//   },
//   cave: { // supports water, but has ugly wall
//     id: 0x88,
//   },
//   pyramid: {
//     id: 0x8c,
//   },
//   river: {
//     id: 0x90,
//     patterns: [0x14, 0x00], // TODO - animated clobbers 2nd entry anyway
//     animated: [0, 1],
//   },
//   sea: {
//     id: 0x94, // primarily tiles 80..ff
//   },
//   mountain: { // parts with "features" like entrancways and houses
//     id: 0x94, // primarily tiles 0..5f
//   },
//   shrine: {
//     id: 0x98, // NOTE: free space from 90..ff
//   },
//   desert: {
//     id: 0x9c, // primarily tiles 50..ff
//   },
//   mountainRiver: { // gives up other features to allow crossable rivers
//     id: 0x9c, // primarily tiles 00..4f
//   },
//   swamp: {
//     id: 0x1a0, // tiles a0..ff
//   },
//   house: {
//     id: 0xa0, // tiles 00..9f
//   },
//   fortress: {
//     id: 0xa4,
//   },
//   goa1: {
//     id: 0xa4,
//   },
//   iceCave: { // no water, but prettier ice wall - same behavior as 88
//     id: 0xa8,
//   },
//   tower: {
//     id: 0xac,
//   },
// } as const;
// const indexedTilesets: {[name: string]: MetatilesetData} = TILESETS as any;

// assertType<{[name in keyof typeof TILESETS]: MetatilesetData}>(TILESETS);

// NOTE: This could automatically convert the above names into
// properties on exactly the correct tilesets, though we likely
// want to change them dynamically, so it's maybe less relevant?
//   - though we should set them all upfront, including unavailable ones...
// const X = {
//   a: {
//     grass: true,
//   },
//   b: {
//     tower: true,
//   },
// } as const;
// type XType = typeof X;
// type Filter1<T> = {[K in keyof XType]: XType[K]['tilesets'] extends T ? number : never};
// type Filter2<T> = ({[P in keyof T]: T[P] extends never ? never : P})[keyof T]; 
// type Filter<T> = Pick<Filter1<T>, Filter2<Filter1<T>>>;
// interface S {
//   tower: Filter<{tower: true}>;
//   grass: Filter<{grass: true}>;
// }
// type Filter<T> = {[K in typeof X]: (typeof X)[K] extends T ? number : never;
// interface S {
//   tower: Filter<{tower: true}>;
//   grass: Filter<{grass: true}>;
// }


// export enum Passage {
//   ALWAYS = 0,
//   SLOPE = 1,
//   FLAG = 2,
//   FLY = 3,
//   NEVER = 4,
// }

// interface PaletteHandler {
//   donor: string[];
//   receiver: string[];
// }

// const MAIN = {donor: ['main', 'trim'], receiver: ['main']};
// const TRIM = {donor: ['trim'], receiver: ['trim']};
// const NONE = {donor: [], receiver: []};
const NONE = 0;
const TRIM = 1;
const MAIN = 2;
type PaletteHandler = number;

type Palette = readonly [number, number, number, number];
type PaletteValidator = (p0: Palette, p1: Palette, p2: Palette) => boolean;

type PaletteSpec = readonly [PaletteHandler,
                             PaletteHandler,
                             PaletteHandler,
                             PaletteValidator?];

export function paletteTypes(tileset: number, location: number): PaletteSpec {
  // Pull out a few special-case locations.
  // NOTE: underground cavern $64 has middle for water, must be $1f
  switch (location) {
  case 0x1a: // tileset a0 swamp
    return [MAIN, MAIN, TRIM, (p0, p1, p2) => p0[3] === p1[3] && p1[3] === p2[3]];
  case 0x43: // tileset 94
    return [MAIN, TRIM, TRIM];
  case 0x57: // tileet 88
    // don't include the water in the normal pool...
    return [MAIN, NONE, NONE];
  case 0x60: // tileset 94
    return [MAIN, MAIN, MAIN, (p0, _p1, p2) => p0[2] === p2[2]];
  case 0x64: case 0x68: // tileset 88
    // some water in this cave uses the HUD's palette so don't shuffle it
    return [MAIN, NONE, TRIM];
  case 0x7c: // tileset 9c
    return [MAIN, TRIM, TRIM];
  }

  switch (tileset) {
  case 0x80: case 0x84:
    return [MAIN, MAIN, TRIM, (p0, p1) => p0[3] === p1[3]];
  case 0x88:
    return [MAIN, TRIM, NONE];
  case 0x8c: return [MAIN, TRIM, MAIN];
  case 0x90: return [MAIN, MAIN, MAIN];
  case 0x94: return [MAIN, TRIM, TRIM, (p0, p1) => p0[3] === p1[3]];
  case 0x98: return [TRIM, TRIM, TRIM]; // TODO - validate?!?
  case 0x9c: return [MAIN, TRIM, MAIN];
  case 0xa0: return [TRIM, TRIM, TRIM];
  case 0xa4: return [MAIN, MAIN, TRIM];
  case 0xa8: return [MAIN, MAIN, TRIM];
  case 0xac: return [MAIN, TRIM, MAIN];
  }
  throw new Error(`unxpected: ${tileset}`);
}
//   [0x98, ['door', 'room', 'rocks']], // shrine
//   // NOTE: hydra very diff: (rock/ground, bridge, river)
//   [0x9c, ['mountain/ground', 'trees', 'desert']],
//   // NOTE: this is swamp, but also includes all indoors
//   // all 3 need same bg for swamp
//   [0xa0, ['ground', 'trees', 'some haze']],
//   [0xa4, ['', '', '']], // fortress
//   [0xa8, ['', '', '']], // ice cave
//   [0xac, ['', '', '']], // endgame
// ]);

const ALLOWED_PALETTES = new Map<string, readonly number[]>([
  ['path', [...r(0x00, 0x12), ...r(0x15, 0x1b), ...r(0x1e, 0x25),
            ...r(0x26, 0x2b), ...r(0x2c, 0x30), ...r(0x39, 0x3f),
            0x42, ...r(0x44, 0x48), ...r(0x4d, 0x59), ...r(0x80, 0x84),
            0x87, ...r(0x8b, 0x93)]],
  ['mountain', [0x01, ...r(0x03, 0x07), ...r(0x08, 0x0b), 0x0c, 0x0d, 0x0e,
               ...r(0x11, 0x18), 0x19, 0x1a, 0x1c, 0x1d, 0x1e, 0x20, 0x21,
               0x23, 0x27, 0x2a, 0x2b, 0x2f, 0x31, 0x33, 0x36, 0x37, 0x38,
               0x39, 0x3c, 0x42, 0x44, 0x46, 0x4b, 0x4c, 0x4f, 0x53, 0x58,
               ...r(0x80, 0x85), 0x87, 0x88, 0x8b, 0x8e]],
  ['trees', [0x01, 0x02, 0x04, 0x06, ...r(0x07, 0x0f), ...r(0x14, 0x18),
             0x1a, 0x1c, 0x1e, 0x20, 0x23, 0x27, 0x29, 0x2a, 0x2b, 0x2e,
             0x2f, 0x31, 0x33, 0x37, 0x38, 0x39, 0x3c, 0x3d, 0x43, 0x44,
             0x46, 0x49, 0x4a, 0x4b, 0x4f, 0x52, 0x57, 0x6e,
             ...r(0x80, 0x85), 0x87, 0x88, ...r(0x8b, 0x90)]],

]);

// infer constraints?
//  - treat BG color separately
//    - figure out which pals on a map share same bg
//    - keep black ones black
//    - keep light ones light, dark ones dark?
//  - all shared colors moved in lockstep?
//  - categorize individual colors?
//    look at how much is used?  no bright colors for very common?
//  TODO - fix the no-ice BG for hydra/stxy/goa in the tileset

// next step - make pattern/palette viewer (editor?)

const TERRAIN_BY_PALETTE = new Map<number, readonly [string, string, string]>([
  [0x80, ['path', 'mountain', 'trees']],
  [0x84, ['mountain-path', 'brick', 'trees']],
  [0x88, ['cave wall/ground', 'cave bridge', '']],
  // NOTE: underground cavern $64 has middle for water, must be $1f
  [0x8c, ['floor', 'fire', 'accept']],
  [0x90, ['trees', 'mountain', 'grass']],
  // NOTE: 0 and 2 need same background for ocean
  // lime tree is very different usage: (water, tree trunk, trees).
  // mountains also different (rock, trim (on 28/7c), bridge)
  // for mountains, 0 and 1 are same-bg
  [0x94, ['water/ground', 'mountain', 'shallows']],
  [0x98, ['door', 'room', 'rocks']], // shrine
  // NOTE: hydra very diff: (rock/ground, bridge, river)
  [0x9c, ['mountain/ground', 'trees', 'desert']],
  // NOTE: this is swamp, but also includes all indoors
  // all 3 need same bg for swamp
  [0xa0, ['ground', 'trees', 'some haze']],
  [0xa4, ['', '', '']], // fortress
  [0xa8, ['', '', '']], // ice cave
  [0xac, ['', '', '']], // endgame
]);

function r(a: number, b: number): readonly number[] {
  return new Array(b - a).fill(0).map((_x, i) => i + a);
}

const [] = [TERRAIN_BY_PALETTE, ALLOWED_PALETTES];

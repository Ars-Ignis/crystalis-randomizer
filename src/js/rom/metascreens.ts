import {Rom} from '../rom.js';
//import {Screen} from './screen.js';
import {Mutable} from './util.js';
import {DefaultMap} from '../util.js';
import {Metascreen, Uid} from './metascreen.js';
import {MetascreenData, ConnectionType,
        bottomEdge, bottomEdgeHouse, cave, door, downStair, icon, leftEdge,
        rightEdge, seamlessDown, seamlessUp, topEdge, upStair, waterfallCave,
       } from './metascreendata.js';
import {Metatileset, Metatilesets} from './metatileset.js';
import {ScreenFix, withRequire} from './screenfix.js';

// BASIC PLAN: Screen is the physical array, Metascreen has the extra info.
//             Only Metascreen is tied to specific (Meta)tilesets.

/**
 * Adds a flag-togglable wall into a labyrinth screen.
 * @param bit     Unique number for each choice. Use -1 for unconditional.
 * @param variant 0 or 1 for each option. Use 0 with bit=-1 for unconditional.
 * @param flag    Position(s) of flag wall.
 * @param unflag  Position(s) of an existing wall to remove completely.
 * @return A function to generate the variant.
 */
function labyrinthVariant(parentFn: (s: Metascreens) => Metascreen,
                          bit: number, variant: 0|1,
                          flag: number|number[], unflag?: number|number[]) {
  return (s: Metascreen, seed: number, rom: Rom): boolean => {
    // check variant
    if (((seed >>> bit) & 1) !== variant) return false;
    const parent = parentFn(rom.metascreens);
    for (const pos of typeof flag === 'number' ? [flag] : flag) {
      rom.screens[s.data.id].set2d(pos, [[0x19, 0x19], [0x1b, 0x1b]]);
    }
    for (const pos of typeof unflag === 'number' ? [unflag] : unflag || []) {
      rom.screens[s.data.id].set2d(pos, [[0xc5, 0xc5], [0xd0, 0xc5]]);
    }
    if (s.flag !== 'always') {
      // parent is a normally-open screen and we're closing it.
      parent.flag = 'always';
    } else if (unflag != null) {
      // parent is the other alternative - delete it.
      parent.remove();
    }
    return true;    
  };
}

// extends Set<Metascreen> ???
export class Metascreens {

  readonly [index: number]: Metascreen;
  readonly length = 0;

  private readonly screensByFix = new DefaultMap<ScreenFix, Metascreen[]>(() => []);
  private readonly screensById = new DefaultMap<number, Metascreen[]>(() => []);

  constructor(readonly rom: Rom) {
    for (const key in this) { // add names
      const val = this[key];
      if (val instanceof Metascreen) val.name = key;
    }
  }

  private metascreen(data: MetascreenData): Metascreen {
    const mut = this as Mutable<this>;
    const screen = new Metascreen(this.rom, mut.length as Uid, data);
    mut[mut.length++] = screen;
    this.screensById.get(screen.id).push(screen);
    for (const tilesetName in data.tilesets) {
      const key = tilesetName as keyof Metatilesets;
      const tilesetData = data.tilesets[key]!;
      if (tilesetData.requires) {
        for (const fix of tilesetData.requires) {
          this.screensByFix.get(fix).push(screen);
        }
      } else {
        (this.rom.metatilesets[key] as Metatileset).addScreen(screen)
      }
    }
    return screen;
  }

  getById(id: number, tileset?: number): Metascreen[] {
    let out = this.screensById.has(id) ? [...this.screensById.get(id)] : [];
    if (tileset != null) {
      out = out.filter(s => s.isCompatibleWithTileset(tileset));
    }
    return out;
  }

  registerFix(fix: ScreenFix, seed?: number) {
    for (const screen of this.screensByFix.get(fix)) {
      // Look for an update script and run it first.  If it returns false then
      // cancel the operation on this screen.
      const update =
          (screen.data.update || []).find((update) => update[0] === fix);
      if (update) {
        if (seed == null) throw new Error(`Seed required for update`);
        if (!update[1](screen, seed, this.rom)) continue;
      }
      // For each tileset, remove the requirement, and if it's empty, add the
      // screen to the tileset.
      for (const tilesetName in screen.data.tilesets) {
        const key = tilesetName as keyof Metatilesets;
        const data = screen.data.tilesets[key]!;
        if (!data.requires) continue;
        const index = data.requires.indexOf(fix);
        if (index < 0) continue;
        data.requires.splice(index, 1);
        if (!data.requires.length) {
          (this.rom.metatilesets[key] as Metatileset).addScreen(screen);
        }
      }
    }
  }

  /**
   * Change the screen whose current id is `oldId` to have `newId` as its
   * screen ID.  Updates all relevant links.
   */
  renumber(oldId: number, newId: number) {
    const dest = this.screensById.get(newId);
    if (dest.length) throw new Error(`ID already used: ${newId}: ${dest}`);
    for (const screen of this.getById(oldId)) {
      screen.unsafeSetId(newId);
      dest.push(screen);
    }
    this.screensById.delete(oldId);
    // TODO - should this be encapsulated in Screens? probably...
    const oldScreen = this.rom.screens.getScreen(oldId);
    const clone = oldScreen.clone(newId);
    this.rom.screens.setScreen(newId, clone);
    oldScreen.used = false;
    if (oldId < 0) this.rom.screens.deleteScreen(oldId);
    this.rom.locations.renumberScreen(oldId, newId);
  }

  readonly overworldEmpty = this.metascreen({
    id: 0x00,
    icon: icon`
      |███|
      |███|
      |███|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    feature: ['empty'],
    edges: '    ',
  });
  // boundaryW_trees: ???
  readonly boundaryW_trees = this.metascreen({
    id: 0x01,
    icon: icon`
      |█▌ |
      |█▌^|
      |█▌ |`,
    tilesets: {grass: {}, river: {},
               desert: {requires: [ScreenFix.DesertRocks]},
               sea: {requires: [ScreenFix.SeaTrees]}},
    edges: '> >o', // o = open
  });
  readonly boundaryW = this.metascreen({
    id: 0x02,
    icon: icon`
      |█▌ |
      |█▌ |
      |█▌ |`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: '> >o',
  });
  readonly boundaryE_rocks = this.metascreen({
    id: 0x03,
    icon: icon`
      |.▐█|
      | ▐█|
      |.▐█|`,
    tilesets: {grass: {}, river: {},
               desert: {requires: [ScreenFix.DesertRocks]},
               sea: {requires: [ScreenFix.SeaRocks]}},
    edges: '<o< ',
  });
  readonly boundaryE = this.metascreen({
    id: 0x04,
    icon: icon`
      | ▐█|
      | ▐█|
      | ▐█|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: '<o< ',
  });
  readonly longGrassS = this.metascreen({
    id: 0x05,
    icon: icon`
      |vv |
      | vv|
      |   |`,
    tilesets: {river: {},
               grass: {requires: [ScreenFix.GrassLongGrass]}},
    edges: 'looo', // l = long grass
  });
  readonly longGrassN = this.metascreen({
    id: 0x06,
    icon: icon`
      |   |
      | vv|
      |vv |`,
    tilesets: {river: {},
               grass: {requires: [ScreenFix.GrassLongGrass]}},
    edges: 'oolo',
  });
  readonly boundaryS_rocks = this.metascreen({
    id: 0x07,
    icon: icon`
      | . |
      |▄▄▄|
      |███|`,
    tilesets: {grass: {}, river: {},
               desert: {requires: [ScreenFix.DesertRocks]},
               sea: {requires: [ScreenFix.SeaRocks]}},
    edges: 'o^ ^',
  });
  readonly fortressTownEntrance = this.metascreen({ // goa
    id: 0x08,
    icon: icon`
      |███|
      |█∩█|
      |   |`,
    // TODO - entrance!
    // TODO - right edge wants top-half mountain; left edge top can have
    //        any top half (bottom half plain), top edge can have any
    //        left-half (right-half mountain)
    tilesets: {grass: {}},
    edges: ' vov',
    exits: [{...upStair(0xa6, 3), type: 'fortress'}],
  });
  readonly bendSE_longGrass = this.metascreen({
    id: 0x09,
    icon: icon`▗
      | v |
      |vv▄|
      | ▐█|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: 'oo<^',
  });
  readonly exitW_cave = this.metascreen({ // near sahara, fog lamp
    id: 0x0a,
    icon: icon`∩
      |█∩█|
      |  █|
      |███|`,
    tilesets: {grass: {}, river: {}, desert: {},
               sea: {requires: [ScreenFix.SeaCaveEntrance]}},
    edges: ' n  ', // n = narrow
    exits: [cave(0x48), leftEdge({top: 6})],
  });
  readonly bendNE_grassRocks = this.metascreen({
    id: 0x0b,
    icon: icon`▝
      |.▐█|
      |  ▀|
      |;;;|`,
    tilesets: {grass: {},
               river: {requires: [ScreenFix.RiverShortGrass]},
               desert: {requires: [ScreenFix.DesertShortGrass,
                                   ScreenFix.DesertRocks]}},
    edges: '<osv', // s = short grass
  });
  readonly cornerNW = this.metascreen({
    id: 0x0c,
    icon: icon`▛
      |███|
      |█ ▀|
      |█▌ |`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: '  >v',
  });
  // NOTE: this version has slightly nicer mountains in some cases.
  readonly overworldEmpty_alt = this.metascreen({
    id: 0x0c,
    icon: icon`
      |███|
      |███|
      |███|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    feature: ['empty'],
    edges: '    ',
    match: () => false,
  });
  readonly cornerNE = this.metascreen({
    id: 0x0d,
    icon: icon`▜
      |███|
      |▀██|
      | ▐█|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: ' v< ',
  });
  readonly cornerSW = this.metascreen({
    id: 0x0e,
    icon: icon`▙
      |█▌ |
      |██▄|
      |███|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: '>  ^',
  });
  readonly cornerSE = this.metascreen({
    id: 0x0f,
    icon: icon`▟
      | ▐█|
      |▄██|
      |███|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: '<^  ',
  });
  readonly exitE = this.metascreen({
    id: 0x10,
    icon: icon`╶
      | ▐█|
      |   |
      | ▐█|`,
    tilesets: {grass: {}, river: {},
               desert: {requires: [ScreenFix.DesertRocks]}},
    edges: '<o<n',
    exits: [rightEdge({top: 6})],
    // TODO - edge
  });
  readonly boundaryN_trees = this.metascreen({
    id: 0x11,
    icon: icon`
      |███|
      |▀▀▀|
      | ^ |`,
    tilesets: {grass: {}, river: {}, desert: {},
               sea: {requires: [ScreenFix.SeaTrees]}},
    edges: ' vov',
  });
  readonly bridgeToPortoa = this.metascreen({
    id: 0x12,
    icon: icon`╴
      |═  |
      |╞══|
      |│  |`,
    tilesets: {river: {}},
    // TODO - this is super custom, no edges for it?
    // It needs special handling, at least.
    feature: ['portoa3'],
    edges: '2*>r',
    exits: [leftEdge({top: 1})],
  });
  readonly slopeAbovePortoa = this.metascreen({
    id: 0x13,
    icon: icon`
      |█↓█|
      |█↓▀|
      |│  |`,
    tilesets: {river: {}},
    feature: ['portoa2'],
    edges: '1*2v',
  });
  readonly riverBendSE = this.metascreen({
    id: 0x14,
    icon: icon`
      |w  |
      | ╔═|
      | ║ |`,
    tilesets: {river: {}},
    edges: 'oorr',
  });
  readonly boundaryW_cave = this.metascreen({
    id: 0x15,
    icon: icon`
      |█▌ |
      |█∩ |
      |█▌ |`,
    tilesets: {grass: {}, river: {}, desert: {},
               sea: {requires: [ScreenFix.SeaCaveEntrance]}},
    edges: '> >o',
    exits: [cave(0x89)],
  });
  readonly exitN = this.metascreen({
    id: 0x16,
    icon: icon`╵
      |█ █|
      |▀ ▀|
      | ^ |`,
    tilesets: {grass: {}, river: {}, desert: {}}, // sea has no need for exits?
    edges: 'nvov',
    exits: [topEdge()],
    // TODO - edge
  });
  readonly riverWE_woodenBridge = this.metascreen({
    id: 0x17,
    icon: icon`═
      |   |
      |═║═|
      |   |`,
    tilesets: {river: {}},
    edges: 'oror',
    exits: [seamlessUp(0x77), seamlessDown(0x87)],
  });
  readonly riverBoundaryE_waterfall = this.metascreen({
    id: 0x18,
    icon: icon`╡
      | ▐█|
      |══/|
      | ▐█|`,
    tilesets: {river: {}},
    edges: '<r< ',
  });
  readonly boundaryE_cave = this.metascreen({
    id: 0x19,
    icon: icon`
      | ▐█|
      |v∩█|
      |v▐█|`,
    tilesets: {river: {},
               grass: {requires: [ScreenFix.GrassLongGrass]},
               desert: {requires: [ScreenFix.DesertLongGrass]}},
    edges: '<o< ',
    exits: [cave(0x58)],
  });
  readonly exitW_southwest = this.metascreen({
    id: 0x1a,
    icon: icon`╴
      |█▌ |
      |▀ ▄|
      |▄██|`,
    tilesets: {grass: {}, river: {},
               desert: {requires: [ScreenFix.DesertRocks]},
               // Sea has no need for this screen?  Go to some other beach?
               sea: {requires: [ScreenFix.SeaRocks]}},
    // NOTE: the edge is not 'n' because it's off-center.
    edges: '>* ^',
    exits: [leftEdge({top: 0xb})],
  });
  readonly nadare = this.metascreen({
    id: 0x1b,
    //icon: '?',
    //migrated: 0x2000,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse(), door(0x23),
            door(0x25, 'door2'), door(0x2a, 'door3')],
  });
  readonly townExitW = this.metascreen({
    id: 0x1c,
    icon: icon`╴
      |█▌ |
      |▀ ^|
      |█▌ |`,
    tilesets: {grass: {}, river: {}},
    edges: '>n>o',
    exits: [leftEdge({top: 8})],
  });
  readonly shortGrassS = this.metascreen({
    id: 0x1d,
    icon: icon` |
      |;;;|
      | v |
      |   |`,
    tilesets: {grass: {},
               river: {requires: [ScreenFix.RiverShortGrass,
                                  ScreenFix.GrassLongGrassRemapping]}},
    edges: 'sooo',
  });
  readonly townExitS = this.metascreen({
    id: 0x1e,
    icon: icon`╷
      | ^ |
      |▄ ▄|
      |█ █|`,
    tilesets: {grass: {}, river: {},
               desert: {requires: [ScreenFix.DesertRocks,
                                   ScreenFix.DesertTownEntrance]}},
    edges: 'o^n^',
    exits: [bottomEdge()],
  });
  readonly swanGate = this.metascreen({
    id: 0x1f,
    //icon: '?',
    tilesets: {town: {}},
    exits: [leftEdge({top: 3}), rightEdge({top: 9})],
    flag: 'custom:false',
  }); 

  readonly riverBranchNSE = this.metascreen({
    id: 0x20,
    icon: icon`
      | ║ |
      | ╠═|
      | ║ |`,
    tilesets: {river: {}},
    edges: 'rorr',
  });
  readonly riverWE = this.metascreen({
    id: 0x21,
    icon: icon`
      |   |
      |═══|
      |   |`,
    tilesets: {river: {}},
    edges: 'oror',
  });
  readonly riverBoundaryS_waterfall = this.metascreen({
    id: 0x22,
    icon: icon`╨
      | ║ |
      |▄║▄|
      |█/█|`,
    tilesets: {river: {}},
    edges: 'r^ ^',
  });
  readonly shortGrassSE = this.metascreen({
    id: 0x23,
    icon: icon`
      |;;;|
      |;  |
      |; ^|`,
    tilesets: {grass: {}},
    edges: 'ssoo',
  });
  readonly shortGrassNE = this.metascreen({
    id: 0x24,
    icon: icon` |
      |;  |
      |;v |
      |;;;|`,
    tilesets: {grass: {}},
    edges: 'osso',
  });
  readonly stomHouseOutside = this.metascreen({
    id: 0x25,
    icon: icon`∩
      |███|
      |▌∩▐|
      |█ █|`,
    tilesets: {grass: {}},
    // NOTE: bottom edge entrance is cleverly shifted to align with the door.
    exits: [door(0x68), bottomEdge({shift: 0.5})],
  });
  readonly bendNW_trees = this.metascreen({
    id: 0x26,
    icon: icon`▘
      |█▌ |
      |▀ ^|
      | ^^|`,
    tilesets: {grass: {}, river: {},
               desert: {requires: [ScreenFix.DesertRocks,
                                   ScreenFix.DesertTrees]},
               sea: {requires: [ScreenFix.SeaRocks,
                                ScreenFix.SeaTrees]}},
    edges: '>voo',
  });
  readonly shortGrassSW = this.metascreen({
    id: 0x27,
    icon: icon`
      |;;;|
      |  ;|
      |^ ;|`,
    tilesets: {grass: {},
               river: {requires: [ScreenFix.RiverShortGrass]}},
    edges: 'soos',
  });
  readonly riverBranchNWS = this.metascreen({
    id: 0x28,
    icon: icon`
      | ║ |
      |═╣ |
      | ║ |`,
    tilesets: {river: {}},
    edges: 'rrro',
  });
  readonly shortGrassNW = this.metascreen({
    id: 0x29,
    icon: icon`
      |  ;|
      | v;|
      |;;;|`,
    tilesets: {grass: {},
               river: {requires: [ScreenFix.RiverShortGrass,
                                  ScreenFix.GrassLongGrassRemapping]}},
    edges: 'ooss',
  });
  readonly valleyBridge = this.metascreen({
    id: 0x2a,
    icon: icon` |
      |▛║▜|
      | ║ |
      |▙║▟|`,
    tilesets: {grass: {}, river: {}},
    edges: 'n n ',
    exits: [seamlessUp(0x77), seamlessDown(0x87), topEdge(), bottomEdge()],
  });
  readonly exitS_cave = this.metascreen({
    id: 0x2b,
    icon: icon`∩
      |█∩█|
      |▌ ▐|
      |█ █|`,
    tilesets: {grass: {}, river: {}, desert: {},
               // Not particularly useful since no connector on south end?
               sea: {requires: [ScreenFix.SeaCaveEntrance]}},
    edges: '  n ',
    exits: [cave(0x67), bottomEdge()]
  });
  readonly outsideWindmill = this.metascreen({
    id: 0x2c,
    icon: icon`╳
      |██╳|
      |█∩█|
      |█ █|`,
    tilesets: {grass: {}},
    // TODO - annotate 3 exits, spawn for windmill blade
    flag: 'custom:false',
    feature: ['windmill'],
    edges: '  n ',
    exits: [cave(0x63), bottomEdge(), door(0x89, 'windmill'), door(0x8c)],
  });
  readonly townExitW_cave = this.metascreen({ // outside leaf (TODO - consider just deleting?)
    id: 0x2d,
    icon: icon`∩
      |█∩█|
      |▄▄█|
      |███|`,
    tilesets: {grass: {}}, // cave entrance breaks river and others...
    edges: ' n  ',
    // NOTE: special case the odd entrance/exit here (should be 4a)
    exits: [cave(0x4a), leftEdge({top: 5})],
    flag: 'custom:true',
  });
  readonly riverNS = this.metascreen({
    id: 0x2e,
    icon: icon`
      | ║ |
      | ║ |
      | ║ |`,
    tilesets: {river: {}},
    edges: 'roro',
  });
  readonly riverNS_bridge = this.metascreen({
    id: 0x2f,
    icon: icon`
      | ║ |
      |w╏w|
      | ║ |`,
    tilesets: {river: {}},
    feature: ['bridge'],
    edges: 'roro',
    wall: 0x77,
  });
  readonly riverBendWS = this.metascreen({
    id: 0x30,
    icon: icon`
      | w▜|
      |═╗w|
      | ║ |`,
    tilesets: {river: {}},
    edges: '<rrv',
  });
  readonly boundaryN_waterfallCave = this.metascreen({
    id: 0x31,
    icon: icon`
      |▛/█|
      |▘║▀|
      | ║ |`,
    tilesets: {river: {}},
    // TODO - flag version without entrance?
    //  - will need a tileset fix
    edges: ' vrv',
    exits: [waterfallCave(0x75)],
  });
  readonly open_trees = this.metascreen({
    id: 0x32,
    icon: icon`
      | ^ |
      |^ ^|
      | ^ |`,
    tilesets: {grass: {}, river: {},
               desert: {requires: [ScreenFix.DesertTrees,
                                   ScreenFix.DesertRocks]}},
    edges: 'oooo',
  });
  readonly exitS = this.metascreen({
    id: 0x33,
    icon: icon`╷
      | w |
      |▄ ▄|
      |█ █|`,
    tilesets: {grass: {}, river: {},
               // NOTE: These fixes are not likely to ever land.
               desert: {requires: [ScreenFix.DesertMarsh]},
               sea: {requires: [ScreenFix.SeaMarsh]}},
    edges: 'o^n^',
    exits: [bottomEdge()],
  });
  readonly bendNW = this.metascreen({
    id: 0x34,
    icon: icon`▘
      |█▌ |
      |▀▀ |
      |   |`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: '>voo',
  });
  readonly bendNE = this.metascreen({
    id: 0x35,
    icon: icon`▝
      | ▐█|
      |  ▀|
      |   |`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: '<oov',
  });
  readonly bendSE = this.metascreen({
    id: 0x36,
    icon: icon`▗
      |   |
      | ▄▄|
      | ▐█|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: 'oo<^',
  });
  readonly bendWS = this.metascreen({
    id: 0x37,
    icon: icon`▖
      |   |
      |▄▄ |
      |█▌ |`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: 'o^>o',
  });
  readonly towerPlain_upStair = this.metascreen({
    id: 0x38,
    icon: icon`┴
      | ┊ |
      |─┴─|
      |   |`,
    tilesets: {tower: {}},
    edges: 'st t',
    exits: [seamlessDown(0x08, 2), topEdge({left: 8})],
    // TODO - annotate possible stairway w/ flag?
  });
  readonly towerRobotDoor_downStair = this.metascreen({
    id: 0x39,
    icon: icon`┬
      | ∩ |
      |─┬─|
      | ┊ |`,
    tilesets: {tower: {}},
    edges: ' tst',
    exits: [seamlessUp(0xe8, 2)],
  });
  readonly towerDynaDoor = this.metascreen({
    id: 0x3a,
    icon: icon`∩
      | ∩ |
      |└┬┘|
      | ┊ |`,
    tilesets: {tower: {}},
    edges: '  s ',
    exits: [cave(0x67, 'door')],
  });
  readonly towerLongStairs = this.metascreen({
    id: 0x3b,
    icon: icon`
      | ┊ |
      | ┊ |
      | ┊ |`,
    tilesets: {tower: {}},
    edges: 's s ',
    exits: [bottomEdge()],
    // TODO - connections
  });
  readonly towerMesiaRoom = this.metascreen({
    id: 0x3c,
    tilesets: {tower: {}},
    exits: [bottomEdgeHouse()],
  });
  readonly towerTeleporter = this.metascreen({
    id: 0x3d,
    tilesets: {tower: {}},
    exits: [bottomEdgeHouse(), cave(0x57, 'teleporter')],
  });
  readonly caveAbovePortoa = this.metascreen({
    id: 0x3e,
    icon: icon`
      |███|
      |█∩█|
      |█↓█|`,
    tilesets: {river: {}},
    edges: '  1 ',
    exits: [cave(0x66)],
  });
  readonly cornerNE_flowers = this.metascreen({
    id: 0x3f,
    icon: icon`▜
      |███|
      |▀*█|
      | ▐█|`,
    tilesets: {grass: {}},
    // NOTE: could extend this to desert/etc by swapping the 7e/7f tiles
    // with e.g. a windmill or castle tile that's not used in 9c, but
    // we still don't have a good sprite to use for it...
    edges: ' v< ',
  });
  readonly towerEdge = this.metascreen({
    id: 0x40,
    icon: icon` |
      |   |
      |┤ ├|
      |   |`,
    tilesets: {tower: {}},
    edges: ' t t',
  });
  readonly towerEdgeW = this.metascreen({
    id: 0x40,
    icon: icon` |
      |   |
      |┤  |
      |   |`,
    tilesets: {tower: {}},
    edges: ' t  ',
  });
  readonly towerEdgeE = this.metascreen({
    id: 0x40,
    icon: icon` |
      |   |
      |  ├|
      |   |`,
    tilesets: {tower: {}},
    edges: '   t',
  });
  readonly towerRobotDoor = this.metascreen({
    id: 0x41,
    icon: icon`─
      | O |
      |───|
      |   |`,
    tilesets: {tower: {}},
    edges: ' t t',
  });
  readonly towerDoor = this.metascreen({
    id: 0x42,
    icon: icon`∩
      | ∩ |
      |─┴─|
      |   |`,
    tilesets: {tower: {}},
    edges: ' t t',
    exits: [cave(0x58)],
    // TODO - connections
  });
  readonly house_bedroom = this.metascreen({
    id: 0x43,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse()],
  });
  readonly shed = this.metascreen({
    id: 0x44,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse(), cave(0x49)],
    flag: 'custom:false',
  });
  // TODO - separate metascreen for shedWithHiddenDoor
  readonly tavern = this.metascreen({
    id: 0x45,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse()],
  });
  readonly house_twoBeds = this.metascreen({
    id: 0x46,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse()],
  });
  readonly throneRoom_amazones = this.metascreen({
    id: 0x47,
    tilesets: {house: {}},
    // TODO - need to fix the single-width stair!
    exits: [bottomEdgeHouse({width: 3}), downStair(0x4c, 1)],
  });
  readonly house_ruinedUpstairs = this.metascreen({
    id: 0x48,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse(), downStair(0x9c, 1)],
  });
  readonly house_ruinedDownstairs = this.metascreen({
    id: 0x49,
    tilesets: {house: {}},
    exits: [upStair(0x56, 1)],
  });
  readonly foyer = this.metascreen({
    id: 0x4a,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse({shift: 0.5}),
            door(0x28), door(0x53, 'door2'), door(0x5c, 'door3')],
  });
  readonly throneRoom_portoa = this.metascreen({
    id: 0x4b,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse(), door(0x2b)],
  });
  readonly fortuneTeller = this.metascreen({
    id: 0x4c,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse(), door(0x56), door(0x59, 'door2')],
  });
  readonly backRoom = this.metascreen({
    id: 0x4d,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse()],
  });
  readonly dojo = this.metascreen({
    id: 0x4e,
    tilesets: {house: {}},
    // Edge entrance shifted to properly line up at start of stom fight.
    // (note that this causes us to shift all other uses as well).
    exits: [bottomEdgeHouse({shift: -0.5})],
  });
  readonly windmillInside = this.metascreen({
    id: 0x4f,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse({left: 9, width: 1})],
  });
  readonly horizontalTownMiddle = this.metascreen({
    // brynmaer + swan (TODO - split so we can move exits)
    id: 0x50,
    tilesets: {town: {}},
    exits: [door(0x4c), door(0x55, 'door2')],
  });
  readonly brynmaerRight_exitE = this.metascreen({
    // brynmaer
    id: 0x51,
    tilesets: {town: {type: 'horizontal'}},
    exits: [rightEdge({top: 8}), door(0x41)],
  });
  readonly brynmaerLeft_deadEnd = this.metascreen({
    // brynmaer
    id: 0x52,
    tilesets: {town: {type: 'horizontal'}},
    exits: [door(0x49), door(0x4c, 'door2')],
  });
  readonly swanLeft_exitW = this.metascreen({
    // swan
    id: 0x53,
    tilesets: {town: {type: 'horizontal'}},
    exits: [leftEdge({top: 9}), door(0x49), door(0x5e, 'door2')],
  });
  readonly swanRight_exitS = this.metascreen({
    // swan
    id: 0x54,
    tilesets: {town: {type: 'horizontal'}},
    exits: [bottomEdge({left: 3}), door(0x41),
            door(0x43, 'door2'), door(0x57, 'door3')],
  });
  readonly horizontalTownLeft_exitN = this.metascreen({
    // sahara, amazones (TODO - split so we can move exits)
    id: 0x55,
    tilesets: {town: {type: 'horizontal'}},
    exits: [topEdge({left: 0xd}), door(0x46), door(0x4b, 'door2')],
  });
  readonly amazonesRight_deadEnd = this.metascreen({
    // amazones
    id: 0x56,
    tilesets: {town: {type: 'horizontal'}},
    exits: [door(0x40), door(0x58, 'door2')],
  });
  readonly saharaRight_exitE = this.metascreen({
    // sahara
    id: 0x57,
    tilesets: {town: {type: 'horizontal'}},
    exits: [rightEdge({top: 7}), door(0x40), door(0x66, 'door2')],
  });
  readonly portoaNW = this.metascreen({
    // portoa
    id: 0x58,
    tilesets: {town: {type: 'square'}},
    exits: [cave(0x47, 'fortress'), bottomEdge()], // bottom just in case?
  });
  readonly portoaNE = this.metascreen({
    // portoa
    id: 0x59,
    tilesets: {town: {type: 'square'}},
    exits: [door(0x63), door(0x8a, 'door2'), bottomEdge({left: 3, width: 4})],
  });
  readonly portoaSW_exitW = this.metascreen({
    // portoa
    id: 0x5a,
    tilesets: {town: {type: 'square'}},
    exits: [leftEdge({top: 9}), door(0x86), topEdge()],
  });
  readonly portoaSE_exitE = this.metascreen({
    // portoa
    id: 0x5b,
    tilesets: {town: {type: 'square'}},
    exits: [rightEdge({top: 9}), door(0x7a), door(0x87, 'door2')],
  });
  readonly dyna = this.metascreen({
    id: 0x5c,
    tilesets: {tower: {}},
    // NOTE: not really a good exit type for this...
    exits: [{type: 'stair:down', manual: true, dir: 2,
             entrance: 0xbf80, exits: []}],
  });
  readonly portoaFisherman = this.metascreen({
    // portoa
    id: 0x5d,
    tilesets: {town: {type: 'square'}},
    exits: [rightEdge({top: 6}),
            leftEdge({top: 4, height: 6, shift: 0.5}),
            door(0x68)],
  });
  readonly verticalTownTop_fortress = this.metascreen({
    // shyron, zombie town (probably not worth splitting this one)
    id: 0x5e,
    tilesets: {town: {type: 'vertical'}},
    exits: [cave(0x47), bottomEdge()],
  });
  readonly shyronMiddle = this.metascreen({
    // shyron
    id: 0x5f,
    tilesets: {town: {type: 'vertical'}},
    exits: [door(0x54), door(0x5b, 'door2'), topEdge()],
  });
  readonly shyronBottom_exitS = this.metascreen({
    // shyron
    id: 0x60,
    tilesets: {town: {type: 'vertical'}},
    exits: [bottomEdge({left: 3}), door(0x04),
            door(0x06, 'door2'), door(0x99, 'door3')],
  });
  readonly zombieTownMiddle = this.metascreen({
    // zombie town
    id: 0x61,
    tilesets: {town: {type: 'vertical'}},
    exits: [door(0x99), topEdge()],
  });
  readonly zombieTownBottom_caveExit = this.metascreen({
    // zombie town
    id: 0x62,
    tilesets: {town: {type: 'vertical'}},
    exits: [cave(0x92), door(0x23), door(0x4d, 'door2')],
  });
  readonly leafNW_houseShed = this.metascreen({
    // leaf
    id: 0x63,
    tilesets: {town: {type: 'square'}},
    exits: [door(0x8c), door(0x95, 'door2')],
  });
  readonly squareTownNE_house = this.metascreen({
    // leaf, goa (TODO - split)
    id: 0x64,
    tilesets: {town: {type: 'square'}},
    exits: [topEdge({left: 1}), door(0xb7)],
  });
  readonly leafSW_shops = this.metascreen({
    // leaf
    id: 0x65,
    tilesets: {town: {type: 'square'}},
    exits: [door(0x77), door(0x8a, 'door2')],
  });
  readonly leafSE_exitE = this.metascreen({
    // leaf
    id: 0x66,
    tilesets: {town: {type: 'square'}},
    exits: [rightEdge({top: 3}), door(0x84)],
  });
  readonly goaNW_tavern = this.metascreen({
    // goa
    id: 0x67,
    tilesets: {town: {type: 'square'}},
    exits: [door(0xba)],
  });
  readonly squareTownSW_exitS = this.metascreen({
    // goa, joel (TODO - split)
    id: 0x68,
    tilesets: {town: {type: 'square'}},
    exits: [bottomEdge({left: 8}), door(0x84)],
  });
  readonly goaSE_shop = this.metascreen({
    // goa
    id: 0x69,
    tilesets: {town: {type: 'square'}},
    exits: [door(0x82)],
  });
  readonly joelNE_shop = this.metascreen({
    // joel
    id: 0x6a,
    tilesets: {town: {type: 'square'}},
    exits: [door(0xa7)],
  });
  readonly joelSE_lake = this.metascreen({
    // joel
    id: 0x6b,
    tilesets: {town: {type: 'square'}},
  });
  readonly oakNW = this.metascreen({
    // oak
    id: 0x6c,
    tilesets: {town: {type: 'square'}},
    exits: [door(0xe7)],
  });
  readonly oakNE = this.metascreen({
    // oak
    id: 0x6d,
    tilesets: {town: {type: 'square'}},
    exits: [door(0x60)],
  });
  readonly oakSW = this.metascreen({
    // oak
    id: 0x6e,
    tilesets: {town: {type: 'square'}},
    exits: [door(0x7c)],
  });
  readonly oakSE = this.metascreen({
    // oak
    id: 0x6f,
    tilesets: {town: {type: 'square'}},
    // Edge entrance shifted for child animation
    exits: [bottomEdge({left: 0, shift: 0.5}), door(0x97)],
  });
  readonly temple = this.metascreen({
    // shyron
    id: 0x70,
    tilesets: {house: {}},
    exits: [bottomEdgeHouse()],
  });
  readonly wideDeadEndN = this.metascreen({
    id: 0x71,
    icon: icon`
      | ┃ |
      | > |
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'w   ',
    connect: '2',
    exits: [downStair(0xc7)],
  });
  readonly goaWideDeadEndN = this.metascreen({
    id: 0x71,
    icon: icon`
      |╵┃╵|
      | > |
      |   |`,
    tilesets: {labyrinth: {}},
    edges: 'w   ',
    connect: '1|2|3',
    exits: [downStair(0xc7)],
  });
  readonly wideHallNS = this.metascreen({
    id: 0x72,
    icon: icon`
      | ┃ |
      | ┃ |
      | ┃ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'w w ',
    connect: '2a',
  });
  readonly goaWideHallNS = this.metascreen({
    id: 0x72,
    icon: icon`
      |│┃│|
      |│┃│|
      |│┃│|`,
    tilesets: {labyrinth: {}},
    edges: 'w w ',
    connect: '19|2a|3b',
  });
  readonly goaWideHallNS_blockedRight = this.metascreen({
    id: 0x72,
    icon: icon`
      |│┃│|
      |│┃ |
      |│┃│|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNS, 0, 0, 0x9d)]],
    edges: 'w w ',
    connect: '19|2a|3|b',
  });
  readonly goaWideHallNS_blockedLeft = this.metascreen({
    id: 0x72,
    icon: icon`
      |│┃│|
      | ┃│|
      |│┃│|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNS, 0, 1, 0x51)]],
    edges: 'w w ',
    connect: '1|9|2a|3b',
  });
  readonly goaWideArena = this.metascreen({
    id: 0x73,
    icon: icon`<
      |╻<╻|
      |┡━┩|
      |│╻│|`,
    tilesets: {labyrinth: {}},
    feature: ['arena'],
    edges: 'w*w*',
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    connect: '9b|a',
    exits: [upStair(0x37)],
  });
  readonly limeTreeLake = this.metascreen({
    id: 0x74,
    tilesets: {lime: {}},
    exits: [bottomEdgeHouse(), cave(0x47)],
    // TODO - bridge
  });
  // Swamp screens
  readonly swampNW = this.metascreen({
    id: 0x75,
    icon: icon`
      | │ |
      |─┘ |
      |   |`,
    tilesets: {swamp: {}},
    // TODO - do we actually want to put all these edges in?
    feature: ['consolidate'],
    edges: 'ss  ',
    connect: '26',
    exits: [topEdge({left: 6, width: 4}), leftEdge({top: 7, height: 3})],
  });
  readonly swampE = this.metascreen({
    id: 0x76,
    icon: icon`
      |   |
      | ╶─|
      |   |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: '   s',
    connect: 'e',
    exits: [],
  });
  readonly swampE_door = this.metascreen({
    id: 0x76,
    icon: icon`∩
      | ∩ |
      | ╶─|
      |   |`,
    tilesets: {swamp: {requires: [ScreenFix.SwampDoors]}},
    feature: ['consolidate'],
    flag: 'always',
    edges: '   s',
    connect: 'e',
    exits: [cave(0x5c, 'swamp')],
  });
  readonly swampNWSE = this.metascreen({
    id: 0x77,
    icon: icon`
      | │ |
      |─┼─|
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: 'ssss',
    connect: '26ae',
    exits: [topEdge({left: 6, width: 4}),
            leftEdge({top: 7, height: 3}),
            bottomEdge({left: 6, width: 4}),
            rightEdge({top: 7, height: 3})],
  });
  readonly swampNWS = this.metascreen({
    id: 0x78,
    icon: icon`
      | │ |
      |─┤ |
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: 'sss ',
    connect: '26a',
    exits: [topEdge({left: 6, width: 4}),
            leftEdge({top: 7, height: 3}),
            bottomEdge({left: 6, width: 4})],
  });
  readonly swampNE = this.metascreen({
    id: 0x79,
    icon: icon`
      | │ |
      | └─|
      |   |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: 's  s',
    connect: '2e',
    exits: [topEdge({left: 6, width: 4}), rightEdge({top: 7, height: 3})],
  });
  readonly swampWSE = this.metascreen({
    id: 0x7a,
    icon: icon`
      |   |
      |─┬─|
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: ' sss',
    connect: '6ae',
    exits: [leftEdge({top: 7, height: 3}),
            bottomEdge({left: 6, width: 4}),
            rightEdge({top: 7, height: 3})],
  });
  readonly swampWSE_door = this.metascreen({
    id: 0x7a,
    icon: icon`∩
      | ∩  |
      |─┬─|
      | │ |`,
    tilesets: {swamp: {requires: [ScreenFix.SwampDoors]}},
    feature: ['consolidate'],
    flag: 'always',
    edges: ' sss',
    connect: '6ae',
    // NOTE: door screens should not be on an exit edge!
    exits: [cave(0x56, 'swamp')],
  });
  readonly swampW = this.metascreen({
    id: 0x7b,
    icon: icon`
      |   |
      |─╴ |
      |   |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: ' s  ',
    connect: '6',
    // TODO - flaggable
  });
  readonly swampW_door = this.metascreen({
    id: 0x7b,
    icon: icon`∩
      | ∩ |
      |─╴ |
      |   |`,
    tilesets: {swamp: {requires: [ScreenFix.SwampDoors]}},
    feature: ['consolidate'],
    flag: 'always',
    edges: ' s  ',
    connect: '6',
    exits: [cave(0x54, 'swamp')],
    // TODO - flaggable
  });
  readonly swampArena = this.metascreen({
    id: 0x7c,
    icon: icon`
      |   |
      |┗┯┛|
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['arena'],
    edges: ' *s*',
    connect: 'a',
    // For left/right neighbors, only allow edge or empty.
    // TODO - check that this is still the case.
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    // NOTE: no edge exit since we don't want to go straight here...
    // TODO - constraint that we put solids on either side?
    // TODO - undo the attempt to allow this not on the right edge,
    //        maybe make a few custom combinations? (is it still broken?)
    //        --> looks like we did fix that earlier somehow?  maybe by moving
    //            the whole screen a column over, or else by changing the tiles?
    // TODO - NOTE SWAMP GRAPHICS STILL BROKEN!!
  });
  readonly swampNWE = this.metascreen({
    id: 0x7d,
    icon: icon`
      | │ |
      |─┴─|
      |   |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: 'ss s',
    connect: '26e',
    exits: [topEdge({left: 6, width: 4}),
            leftEdge({top: 7, height: 3}),
            rightEdge({top: 7, height: 3})],
  });
  readonly swampWS = this.metascreen({
    id: 0x7e,
    icon: icon`
      |   |
      |─┐ |
      | │ |`,
    tilesets: {swamp: {requires: [ScreenFix.SwampDoors]}},
    feature: ['consolidate'],
    update: [[ScreenFix.SwampDoors, (s, seed, rom) => {
      rom.metascreens.swampWS_door.flag = 'always';
      return true;
    }]],
    edges: ' ss ',
    connect: '6a',
    exits: [leftEdge({top: 7, height: 3}), bottomEdge({left: 6, width: 4})],
  });
  readonly swampWS_door = this.metascreen({
    id: 0x7e,
    icon: icon`∩
      | ∩ |
      |─┐ |
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: ' ss ',
    connect: '6a',
    exits: [cave(0x57, 'swamp')],
  });
  readonly swampEmpty = this.metascreen({
    id: 0x7f,
    icon: icon`
      |   |
      |   |
      |   |`,
    tilesets: {swamp: {}},
    feature: ['empty'],
    edges: '    ',
    connect: '',
  });
  // Missing swamp screens
  readonly swampN = this.metascreen({
    id: ~0x70,
    icon: icon`
      | │ |
      | ╵ |
      |   |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: 's   ',
    connect: '2',
  });
  readonly swampS = this.metascreen({
    id: ~0x71,
    icon: icon`
      |   |
      | ╷ |
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: '  s ',
    connect: 'a',
  });
  readonly swampNS = this.metascreen({
    id: ~0x72,
    icon: icon`
      | │ |
      | │ |
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: 's s ',
    connect: '2a',
    exits: [topEdge({left: 6, width: 4}), bottomEdge({left: 6, width: 4})],
  });
  readonly swampWE = this.metascreen({
    id: ~0x72,
    icon: icon`
      |   |
      |───|
      |   |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: ' s s',
    connect: '6e',
    exits: [leftEdge({top: 7, height: 3}), rightEdge({top: 7, height: 3})],
  });
  readonly swampWE_door = this.metascreen({
    id: ~0x72,
    icon: icon`∩
      | ∩ |
      |───|
      |   |`,
    tilesets: {swamp: {requires: [ScreenFix.SwampDoors]}},
    feature: ['consolidate'],
    flag: 'always',
    edges: ' s s',
    connect: '6e',
    exits: [upStair(0x56)],
    // TODO - how to link to swampWE to indicate flag=false?
  });
  readonly swampSE = this.metascreen({
    id: ~0x73,
    icon: icon`
      |   |
      | ┌─|
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: '  ss',
    connect: 'ae',
    exits: [leftEdge({top: 7, height: 3}), bottomEdge({left: 6, width: 4})],
  });
  readonly swampSE_door = this.metascreen({
    id: ~0x73,
    icon: icon`∩
      | ∩ |
      | ┌─|
      | │ |`,
    tilesets: {swamp: {requires: [ScreenFix.SwampDoors]}},
    feature: ['consolidate'],
    flag: 'always',
    edges: '  ss',
    connect: 'ae',
    exits: [cave(0x5a, 'swamp')],
  });
  readonly swampNSE = this.metascreen({
    id: ~0x74,
    icon: icon`
      | │ |
      | ├─|
      | │ |`,
    tilesets: {swamp: {}},
    feature: ['consolidate'],
    edges: 's ss',
    connect: '2ae',
    exits: [topEdge({left: 6, width: 4}),
            bottomEdge({left: 6, width: 4}),
            rightEdge({top: 7, height: 3})],
  });
  // Cave screens
  readonly caveEmpty = this.metascreen({
    id: 0x80,
    icon: icon`
      |   |
      |   |
      |   |`,
    tilesets: {cave: {}, fortress: {}, labyrinth: {}, pyramid: {},
               iceCave: {}, dolphinCave: {}},
    feature: ['empty'],
    edges: '    ',
  });
  readonly open = this.metascreen({ // NOTE: not cave
    id: 0x80,
    icon: icon`
      |   |
      |   |
      |   |`,
    tilesets: {desert: {}, sea: {}}, // NOTE: could add grass/river but trees nicer.
    edges: 'oooo',
  });
  readonly hallNS = this.metascreen({
    id: 0x81,
    icon: icon`
      | │ |
      | │ |
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'c c ',
    connect: '2a',
    poi: [[4]],
    exits: [bottomEdge({left: 6, width: 4, manual: true})],
  });
  readonly hallWE = this.metascreen({
    id: 0x82,
    icon: icon`
      |   |
      |───|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' c c',
    connect: '6e',
    poi: [[4]],
  });
  readonly hallSE = this.metascreen({
    id: 0x83,
    icon: icon`
      |   |
      | ┌─|
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: '  cc',
    connect: 'ae',
    poi: [[2]],
  });
  readonly hallWS = this.metascreen({
    id: 0x84,
    icon: icon`
      |   |
      |─┐ |
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' cc ',
    connect: '6a',
    poi: [[2]],
  });
  readonly hallNE = this.metascreen({
    id: 0x85,
    icon: icon`
      | │ |
      | └─|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'c  c',
    connect: '2e',
    poi: [[2]],
  });
  readonly hallNW = this.metascreen({
    id: 0x86,
    icon: icon`
      | │ |
      |─┘ |
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'cc  ',
    connect: '26',
    poi: [[2]],
  });
  readonly branchNSE = this.metascreen({
    id: 0x87,
    icon: icon`
      | │ |
      | ├─|
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'c cc',
    connect: '2ae',
    poi: [[3]],
  });
  readonly branchNWSE = this.metascreen({
    id: 0x88,
    icon: icon`
      | │ |
      |─┼─|
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'cccc',
    connect: '26ae',
    poi: [[3]],
  });
  readonly branchNWS = this.metascreen({
    id: 0x89,
    icon: icon`
      | │ |
      |─┤ |
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'ccc ',
    connect: '26a',
    poi: [[3]],
  });
  readonly branchWSE = this.metascreen({
    id: 0x8a,
    icon: icon`
      |   |
      |─┬─|
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' ccc',
    connect: '6ae',
    poi: [[3]],
  });
  readonly branchNWE = this.metascreen({
    id: 0x8b,
    icon: icon`
      | │ |
      |─┴─|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'cc c',
    connect: '26e',
    poi: [[3]],
    exits: [seamlessDown(0x06, 4)], // kensu
  });
  readonly hallNS_stairs = this.metascreen({
    id: 0x8c,
    icon: icon`
      | ┋ |
      | ┋ |
      | ┋ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['stairs'],
    edges: 'c c ',
    connect: '2a',
  });
  readonly hallNS_overBridge = this.metascreen({
    id: 0x8d,
    icon: icon`
      | ╽ |
      |─┃─|
      | ╿ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['overBridge'],
    edges: 'cbcb', // TODO - 'b' for other side of bridge??
    connect: '2a',
  });
  readonly hallWE_underBridge = this.metascreen({
    id: 0x8e,
    icon: icon`
      | ╽ |
      |───|
      | ╿ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['underBridge'],
    edges: 'bcbc',
    connect: '6e',
  });
  readonly hallNS_wall = this.metascreen({
    id: 0x8f,
    icon: icon`
      | │ |
      | ┆ |
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'c c ',
    feature: ['wall'],
    // TODO - can we just detect the connections?
    //      - for each tileset, map 1..f to various edge pos?
    //      - e.g. cave: 0x02 = 1, 0x08 = 2, 0x0c = 3,
    //                   0x20 = 5, 0x80 = 6, 0xc0 = 7, ...
    //        need to be WALKABLE
    //        may need to reevaluate each screen for each tileset...
    //        and need to wait until the screen is BUILT!
    connect: '2=a', // wall will always connect the first two?
    wall: 0x87, 
    // TODO - record the wall
  });
  readonly hallWE_wall = this.metascreen({
    id: 0x90,
    icon: icon`
      |   |
      |─┄─|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['wall'],
    edges: ' c c',
    connect: '6=e',
    wall: 0x67,
  });
  readonly hallNS_arena = this.metascreen({
    id: 0x91,
    icon: icon`
      |┌┸┐|
      |│&│|
      |└┬┘|`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['arena'],
    edges: 'n*c*', // 'n' for 'narrow'
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    connect: '2a',
    poi: [[1, 0x60, 0x78]],
    exits: [topEdge(), // vampire 1 room
            bottomEdge({left: 6, width: 4, manual: true}), // goa sages
            seamlessUp(0xe6, 4)], // kensu
  });
  readonly hallNS_arenaWall = this.metascreen({
    id: 0x92,
    icon: icon`
      |┌┄┐|
      |│&│|
      |└┬┘|`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['arena', 'wall'],
    edges: 'n*c*',
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    connect: '2=a',
    wall: 0x27,
    poi: [[1, 0x60, 0x78]],
    // NOTE: top exit needs to move up a tile...?
    exits: [bottomEdge({left: 6, width: 4, manual: true}),
            topEdge({top: 1})], // prisons need extra exits
  });
  // NOTE: screen 93 is missing!
  readonly branchNWE_wall = this.metascreen({
    id: 0x94,
    icon: icon`
      | ┆ |
      |─┴─|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'cc c',
    connect: '2=6e',
    exits: [topEdge({left: 6, width: 4})],
  });
  readonly branchNWE_upStair = this.metascreen({
    id: 0x95,
    icon: icon`<
      | < |
      |─┴─|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' c c',
    connect: '6e',
    exits: [upStair(0x47)],
  });
  readonly deadEndW_upStair = this.metascreen({
    id: 0x96,
    icon: icon`<
      | < |
      |─┘ |
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' c  ',
    connect: '6',
    exits: [upStair(0x42)],
  });
  readonly deadEndW_downStair = this.metascreen({
    id: 0x97,
    icon: icon`>
      |   |
      |─┐ |
      | > |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' c  ',
    connect: '6',
    exits: [downStair(0xa2)],
  });
  readonly deadEndE_upStair = this.metascreen({
    id: 0x98,
    icon: icon`<
      | < |
      | └─|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: '   c',
    connect: 'e',
    exits: [upStair(0x4c)],
  });
  readonly deadEndE_downStair = this.metascreen({
    id: 0x99,
    icon: icon`>
      |   |
      | ┌─|
      | > |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: '   c',
    connect: 'e',
    exits: [downStair(0xac)],
  });
  readonly deadEndNS_stairs = this.metascreen({
    id: 0x9a,
    icon: icon`
      | > |
      |   |
      | < |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: 'c c ',
    connect: '2|a',
    exits: [downStair(0x17), upStair(0xd7)],
  });
  readonly deadEndN_stairs = this.metascreen({
    id: 0x9a,
    icon: icon`
      | > |
      |   |
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: 'c   ',
    connect: '2',
    exits: [downStair(0x17)],
    match: (reachable) => !reachable(0x108, 0x78),
  });
  readonly deadEndS_stairs = this.metascreen({
    id: 0x9a,
    icon: icon`
      |   |
      |   |
      | < |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: '  c ',
    connect: 'a',
    exits: [upStair(0xd7)],
    match: (reachable) => !reachable(-0x30, 0x78),
  });
  readonly deadEndNS = this.metascreen({
    id: 0x9b,
    icon: icon`
      | ╵ |
      |   |
      | ╷ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: 'c c ',
    connect: '2|a',
    poi: [[0, 0x110, 0x78], [0, -0x30, 0x78]],
  });
  readonly deadEndN = this.metascreen({
    id: 0x9b,
    icon: icon`
      | ╵ |
      |   |
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: 'c   ',
    connect: '2',
    poi: [[0, -0x30, 0x78]],
    match: (reachable) => !reachable(0x110, 0x78),
  });
  readonly deadEndS = this.metascreen({
    id: 0x9b,
    icon: icon`
      |   |
      |   |
      | ╷ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: '  c ',
    connect: 'a',
    poi: [[0, 0x110, 0x78]],
    match: (reachable) => !reachable(-0x30, 0x78),
  });
  readonly deadEndWE = this.metascreen({
    id: 0x9c,
    icon: icon`
      |   |
      |╴ ╶|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: ' c c',
    connect: '6|e',
    poi: [[0, 0x70, 0x108], [0, 0x70, -0x28]],
  });
  readonly deadEndW = this.metascreen({
    id: 0x9c,
    icon: icon`
      |   |
      |╴  |
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: ' c  ',
    connect: '6',
    poi: [[0, 0x70, -0x28]],
    match: (reachable) => !reachable(0x70, 0x108),
  });
  readonly deadEndE = this.metascreen({
    id: 0x9c,
    icon: icon`
      |   |
      |  ╶|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['empty'],
    edges: '   c',
    connect: 'e',
    poi: [[0, 0x70, 0x108]],
    match: (reachable) => !reachable(0x70, -0x28),
  });
  // NOTE: 9d missing
  readonly hallNS_entrance = this.metascreen({
    id: 0x9e,
    icon: icon`╽
      | │ |
      | │ |
      | ╽ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'c n ',
    connect: '2a',
    exits: [bottomEdge()],
  });
  readonly channelExitSE = this.metascreen({
    id: 0x9f,
    icon: icon`
      |   |
      | ╔═|
      | ║ |`,
    tilesets: {dolphinCave: {}},
    //edges: '  rr',
    //connect: '9d:bf',  // : means water - flight needed
    exits: [bottomEdge({left: 5})],
  });
  readonly channelBendWS = this.metascreen({
    id: 0xa0,
    icon: icon`
      |█  |
      |═╗ |
      |█║ |`,
    tilesets: {dolphinCave: {}},
    //edges: ' rr ',
  });
  readonly channelHallNS = this.metascreen({
    id: 0xa1,
    icon: icon`
      | ║ |
      | ╠┈|
      | ║ |`,
    tilesets: {dolphinCave: {}},
  });
  readonly channelEntranceSE = this.metascreen({
    id: 0xa2,
    icon: icon`
      |   |
      | ╔┈|
      |╷║ |`,
    tilesets: {dolphinCave: {}},
    // NOTE: This would ALMOST work as a connection to the
    // normal river cave tiles, but the river is one tile
    // taller at the top, so there's no match!
    exits: [bottomEdge({left: 2})],
  });
  readonly channelCross = this.metascreen({
    id: 0xa3,
    icon: icon`
      | ║ |
      |═╬═|
      |╷║╷|`,
    tilesets: {dolphinCave: {}},
    // NOTE: two bottom edges on the same screen - call one a door
    exits: [bottomEdge({left: 3}), bottomEdge({left: 0xb, type: 'door'})],
  });
  readonly channelDoor = this.metascreen({
    id: 0xa4,
    icon: icon`∩
      | ∩█|
      |┈══|
      |  █|`,
    tilesets: {dolphinCave: {}},
    exits: [door(0x38)],
  });
  readonly mountainFloatingIsland = this.metascreen({
    id: 0xa5,
    icon: icon`*
      |═╗█|
      |*║ |
      |═╣█|`,
    tilesets: {mountainRiver: {}},
    edges: '  wp',  // w = waterfall, p = path
    connect: 'e',
  });
  readonly mountainPathNE_stair = this.metascreen({
    id: 0xa6,
    icon: icon`└
      |█┋█|
      |█  |
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: 'l  p',  // l = ladder (stairs)
    connect: '2e',
    exits: [topEdge()], // never used as an exit in vanilla
  });
  readonly mountainBranchNWE = this.metascreen({
    id: 0xa7,
    icon: icon`┴
      |█ █|
      |   |
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: 'pp p',
    connect: '26e',
  });
  readonly mountainPathWE_iceBridge = this.metascreen({
    id: 0xa8,
    icon: icon`╫
      |█║█|
      | ┆ |
      |█║█|`,
    tilesets: {mountainRiver: {}},
    feature: ['bridge'],
    edges: 'wpwp',
    allowed: s => s.hasFeature('empty') ? [2] : [],
    connect: '6-e:2a',
    wall: 0x87,
  });
  readonly mountainPathSE = this.metascreen({
    id: 0xa9,
    icon: icon`┌
      |███|
      |█  |
      |█ █|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: '  pp',
    connect: 'ae',
    exits: [rightEdge({top: 6, height: 4}), bottomEdge({left: 6, width: 4})],
  });
  readonly mountainDeadEndW_caveEmpty = this.metascreen({
    id: 0xaa,
    icon: icon`∩
      |█∩█|
      |▐ ▐|
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: ' p  ',
    connect: '6',
    exits: [cave(0x38)],
  });
  readonly mountainPathNE = this.metascreen({
    id: 0xab,
    icon: icon`└
      |█ █|
      |█  |
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: 'p  p',
    connect: '2e',
    exits: [rightEdge({top: 6, height: 4}), topEdge({left: 6, width: 4})],
  });
  readonly mountainBranchWSE = this.metascreen({
    id: 0xac,
    icon: icon`┬
      |███|
      |   |
      |█ █|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: ' ppp',
    connect: '6ae',
  });
  readonly mountainPathW_cave = this.metascreen({
    id: 0xad,
    icon: icon`∩
      |█∩█|
      |  ▐|
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: ' p  ',
    connect: '6',
    exits: [cave(0x55)],
  });
  readonly mountainPathE_slopeS = this.metascreen({
    id: 0xae,
    icon: icon`╓
      |███|
      |█  |
      |█↓█|`,
    tilesets: {mountain: {}},
    edges: '  sp', // s = slope
    connect: 'ae',
  });
  readonly mountainPathNW = this.metascreen({
    id: 0xaf,
    icon: icon`┘
      |█ █|
      |  █|
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: 'pp  ',
    connect: '26',
    exits: [leftEdge({top: 6, height: 4}), topEdge({left: 6, width: 4})],
  });
  readonly mountainCave_empty = this.metascreen({
    id: 0xb0,
    icon: icon`∩
      |█∩█|
      |▌ ▐|
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: '    ',
    connect: '',
    exits: [cave(0x58)],
  });
  readonly mountainPathE_cave = this.metascreen({
    id: 0xb1,
    icon: icon`∩
      |█∩█|
      |█  |
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: '   p',
    connect: 'e',
    exits: [cave(0x57)],
  });
  readonly mountainPathWE_slopeN = this.metascreen({
    id: 0xb2,
    icon: icon`╨
      |█↓█|
      |   |
      |███|`,
    tilesets: {mountain: {}},
    edges: 'sp p',
    connect: '26e',
  });
  readonly mountainDeadEndW = this.metascreen({
    id: 0xb3,
    icon: icon`╴
      |███|
      |  █|
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: ' p  ',
    connect: '6',
  });
  readonly mountainPathWE = this.metascreen({
    id: 0xb4,
    icon: icon`─
      |███|
      |   |
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: ' p p',
    connect: '6e',
    exits: [leftEdge({top: 6, height: 4}), rightEdge({top: 6, height: 4})],
  });
  readonly mountainArena_gate = this.metascreen({
    id: 0xb5,
    icon: icon`#
      |█#█|
      |▌ ▐|
      |█┋█|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    feature: ['arena'],
    edges: ' *l*',
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    connect: 'a',
    exits: [{...upStair(0x47, 3), type: 'cave'}],
    flag: 'custom:false',
  });
  readonly mountainPathN_slopeS_cave = this.metascreen({
    id: 0xb6,
    icon: icon`∩
      |█┋∩|
      |▌ ▐|
      |█↓█|`,
    tilesets: {mountain: {}},
    edges: 'l s ',
    connect: '2a',
    exits: [cave(0x5a), topEdge()],
  });
  readonly mountainPathWE_slopeNS = this.metascreen({
    id: 0xb7,
    icon: icon`╫
      |█↓█|
      |   |
      |█↓█|`,
    tilesets: {mountain: {}},
    edges: 'spsp',
    connect: '26ae',
  });
  readonly mountainPathWE_slopeN_cave = this.metascreen({
    id: 0xb8,
    icon: icon`∩
      |█↓∩|
      |   |
      |███|`,
    tilesets: {mountain: {}},
    edges: 'sp p',
    connect: '26e',
    exits: [cave(0x5c)],
  });
  readonly mountainPathWS = this.metascreen({
    id: 0xb9,
    icon: icon`┐
      |███|
      |  █|
      |█ █|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    edges: ' pp ',
    connect: '6a',
    exits: [leftEdge({top: 6, height: 4}), bottomEdge({left: 6, width: 4})],
  });
  readonly mountainSlope = this.metascreen({
    id: 0xba,
    icon: icon`↓
      |█↓█|
      |█↓█|
      |█↓█|`,
    tilesets: {mountain: {}},
    edges: 's s ',
    connect: '2a',
  });
  readonly mountainRiver = this.metascreen({
    id: 0xba,
    icon: icon`║
      |█║█|
      |█║█|
      |█║█|`,
    tilesets: {mountainRiver: {}},
    edges: 'w w ',
    allowed: s => s.hasFeature('empty') ? [2] : [],
    connect: '2:e',
  });
  readonly mountainPathE_gate = this.metascreen({
    id: 0xbb,
    icon: icon`∩
      |█∩█|
      |█  |
      |███|`,
    tilesets: {mountain: {}},
    edges: '   p',
    connect: 'e',
    exits: [cave(0x57, 'gate')],
  });
  readonly mountainPathWE_inn = this.metascreen({
    id: 0xbc,
    icon: icon`∩
      |█∩█|
      |   |
      |███|`,
    tilesets: {mountain: {}},
    edges: ' p p',
    connect: '6e',
    exits: [door(0x76)],
  });
  readonly mountainPathWE_bridgeOverSlope = this.metascreen({
    id: 0xbd,
    icon: icon`═
      |█↓█|
      | ═ |
      |█↓█|`,
    tilesets: {mountain: {}},
    edges: 'spsp',
    connect: '6e', // '2a|6e',
    exits: [seamlessUp(0xb6, 4)],
  });
  readonly mountainPathWE_bridgeOverRiver = this.metascreen({
    id: 0xbd,
    icon: icon`═
      |█║█|
      | ═ |
      |█║█|`,
    tilesets: {mountainRiver: {}},
    edges: 'wpwp',
    allowed: s => s.hasFeature('empty') ? [2] : [],
    connect: '6e|2|a',
  });
  readonly mountainSlope_underBridge = this.metascreen({
    id: 0xbe,
    icon: icon`↓
      |█↓█|
      | ═ |
      |█↓█|`,
    tilesets: {mountain: {}},
    // TODO - could fly under bridge on mountainRiver
    edges: 'spsp',
    connect: '2a', // '2a|6e',
    exits: [seamlessDown(0xc6, 4)],
  });
  readonly mountainEmpty = this.metascreen({
    id: 0xbf,
    icon: icon`
      |███|
      |███|
      |███|`,
    tilesets: {mountain: {}, mountainRiver: {}},
    feature: ['empty'],
    edges: '    ',
  });
  readonly boundaryS = this.metascreen({
    id: 0xc0,
    icon: icon`
      |   |
      |▄▄▄|
      |███|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    // TODO - grass/river should maybe use rocks instead?
    edges: 'o^ ^', // o = open, ^ = open up
    //connect: '26e',
  });
  readonly boundaryN_cave = this.metascreen({
    id: 0xc1,
    icon: icon`
      |███|
      |▀∩▀|
      |   |`,
    tilesets: {grass: {}, sea: {}, desert: {},
               river: {requires: [ScreenFix.SeaCaveEntrance]}},
    edges: ' vov', // o = open, v = open down
    exits: [cave(0x49)],
  });
  readonly cornerSE_cave = this.metascreen({
    id: 0xc2,
    icon: icon`
      | ▐█|
      |▄∩█|
      |███|`,
    tilesets: {grass: {}, river: {}, sea: {}, desert: {}},
    edges: '<^  ',
    exits: [cave(0x5a)],
  });
  readonly waterfall = this.metascreen({
    id: 0xc3,
    icon: icon`
      |   |
      |↓↓↓|
      |   |`,
    tilesets: {sea: {}},
    edges: 'oooo',
  });
  readonly whirlpoolBlocker = this.metascreen({
    id: 0xc4,
    icon: icon`
      |   |
      |█╳█|
      |   |`,
    tilesets: {sea: {}},
    // TODO - indicate flag
    feature: ['whirlpool'],
    flag: 'calm', // calmed sea
    edges: 'oooo',
  });
  readonly beachExitN = this.metascreen({
    id: 0xc5,
    icon: icon`
      |█ █|
      |█╱▀|
      |█▌ |`,
    tilesets: {sea: {}},
    edges: 'n >v', // n = "narrow"
    exits: [topEdge({left: 9})],
  });
  readonly whirlpoolOpen = this.metascreen({
    id: 0xc6,
    icon: icon`
      |   |
      | ╳ |
      |   |`,
    tilesets: {sea: {}},
    feature: ['whirlpool'],
    edges: 'oooo',
    flag: 'calm', // but only if on angry sea - not desert...
  });
  readonly quicksandOpen = this.metascreen({
    id: 0xc6,
    icon: icon`
      |   |
      | ╳ |
      |   |`,
    tilesets: {desert: {}},
    feature: ['whirlpool'],
    edges: 'oooo',
  });
  readonly lighthouseEntrance = this.metascreen({
    id: 0xc7,
    icon: icon`
      |▗▟█|
      |▐∩▛|
      |▝▀▘|`,
    tilesets: {sea: {}},
    // TODO - indicate uniqueness?
    feature: ['lighthouse'],
    edges: '<oov',
    exits: [cave(0x2a), door(0x75)],
  });
  readonly beachCave = this.metascreen({
    id: 0xc8,
    icon: icon`
      |█∩█|
      |▀╲█|
      |   |`,
    tilesets: {sea: {}},
    edges: ' vov',
    exits: [cave(0x28)],
  });
  readonly beachCabinEntrance = this.metascreen({
    id: 0xc9,
    icon: icon`
      | ∩█|
      | ╲▀|
      |█▄▄|`,
    tilesets: {sea: {}},
    feature: ['cabin'],
    edges: '<^ b', // b = "boat"
    exits: [door(0x55), rightEdge({top: 8, height: 3})],
  });
  readonly oceanShrine = this.metascreen({
    id: 0xca,
    icon: icon`
      |▗▄▖|
      |▐*▌|
      |▝ ▘|`,
    tilesets: {sea: {}},
    // TODO - indicate uniqueness?
    feature: ['altar'],
    edges: 'oooo',
  });
  readonly pyramidEntrance = this.metascreen({
    id: 0xcb,
    icon: icon`
      | ▄ |
      |▟∩▙|
      | ╳ |`,
    tilesets: {desert: {}},
    // TODO - indicate uniqueness?
    feature: ['pyramid'],
    edges: 'oooo',
    exits: [cave(0xa7)],
  });
  readonly cryptEntrance = this.metascreen({
    id: 0xcc,
    icon: icon`
      | ╳ |
      |▐>▌|
      |▝▀▘|`,
    tilesets: {desert: {}},
    feature: ['crypt'],
    edges: 'oooo',
    exits: [downStair(0x67)],
  });
  readonly oasisLake = this.metascreen({
    id: 0xcd,
    icon: icon`
      | ^ |
      |vOv|
      | vv|`,
    tilesets: {desert: {}},
    feature: ['lake'],
    edges: 'oo3o',
  });
  readonly desertCaveEntrance = this.metascreen({
    id: 0xce,
    icon: icon`
      |▗▄▖|
      |▜∩▛|
      | ╳ |`,
    tilesets: {desert: {},
               // TODO - probably need to pull this out since flags differ
               // TODO - we could also make this workable in river if we want
               sea: {requires: [ScreenFix.SeaCaveEntrance]}},
    edges: 'oooo',
    exits: [cave(0xa7)],
  });
  readonly oasisCave = this.metascreen({
    id: 0xcf,
    icon: icon`
      | vv|
      |▄∩v|
      |█▌ |`,
    tilesets: {desert: {}},
    edges: '3^>o',
    exits: [upStair(0x37)],
  });
  readonly channelEndW_cave = this.metascreen({
    id: 0xd0,
    icon: icon`
      |██∩|
      |══ |
      |███|`,
    tilesets: {dolphinCave: {}},
    exits: [upStair(0x57)],
  });
  readonly boatChannel = this.metascreen({
    id: 0xd1,
    icon: icon`
      |███|
      |▀▀▀|
      |▄▄▄|`,
    tilesets: {sea: {}},
    edges: ' b b',
    exits: [{...rightEdge({top: 8, height: 3}), entrance: 0x9ce8},
            leftEdge({top: 8, height: 3})],
  });
  readonly channelWE = this.metascreen({
    id: 0xd2,
    icon: icon`
      |███|
      |═══|
      |███|`,
    tilesets: {dolphinCave: {}},
  });
  readonly riverCaveNWSE = this.metascreen({
    id: 0xd3,
    icon: icon`
      |┘║└|
      |═╬═|
      |┬┇┬|`,
      // |▘║▝|
      // |═╬═|
      // |▖┆▗|`,
    // TODO - consider using solids for the corners instead?
    tilesets: {cave: {}, fortress: {}},
    feature: ['bridge'],
    edges: 'rrrr',
    connect: '15:3d:79-af',
    wall: 0xb6,
    poi: [[4, 0x00, 0x98]],
  });
  readonly riverCaveNS = this.metascreen({
    id: 0xd4,
    icon: icon`
      |│║│|
      |│║│|
      |│║│|`,
      // |▌║▐|
      // |▌║▐|
      // |▌║▐|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'r r ',
    connect: '19:3a',
  });
  readonly riverCaveWE = this.metascreen({
    id: 0xd5,
    icon: icon`
      |───|
      |═══|
      |───|`,
    tilesets: {cave: {}, fortress: {}},
    edges: ' r r',
    connect: '5d:7f',
  });
  readonly riverCaveNS_bridge = this.metascreen({
    id: 0xd6,
    icon: icon`
      |│║│|
      |├┇┤|
      |│║│|`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['bridge'],
    edges: 'r r ',
    connect: '19-3a',
    wall: 0x87,
  });
  readonly riverCaveWE_bridge = this.metascreen({
    id: 0xd7,
    icon: icon`
      |─┬─|
      |═┅═|
      |─┴─|`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['bridge'],
    edges: ' r r',
    connect: '5d-7f',
    wall: 0x86,
  });
  readonly riverCaveSE = this.metascreen({
    id: 0xd8,
    icon: icon`
      |┌──|
      |│╔═|
      |│║┌|`,
    tilesets: {cave: {}, fortress: {}},
    edges: '  rr',
    connect: '9d:af',
  });
  readonly riverCaveWS = this.metascreen({
    id: 0xd9,
    icon: icon`
      |──┐|
      |═╗│|
      |┐║│|`,
    tilesets: {cave: {}, fortress: {}},
    edges: ' rr ',
    connect: '5a:79',
  });
  readonly riverCaveNE = this.metascreen({
    id: 0xda,
    icon: icon`
      |│║└|
      |│╚═|
      |└──|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'r  r',
    connect: '1f:3d',
  });
  readonly riverCaveNW = this.metascreen({
    id: 0xdb,
    icon: icon`
      |┘║│|
      |═╝│|
      |──┘|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'rr  ',
    connect: '15:37',
  });
  readonly riverCaveWE_passageN = this.metascreen({
    id: 0xdc,
    icon: icon`╧
      |─┴─|
      |═══|
      |───|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'cr r',
    connect: '25d:7f',
  });
  readonly riverCaveWE_passageS = this.metascreen({
    id: 0xdd,
    icon: icon`╤
      |───|
      |═══|
      |─┬─|`,
    tilesets: {cave: {}, fortress: {}},
    edges: ' rcr',
    connect: '5d:7af',
  });
  readonly riverCaveNS_passageW = this.metascreen({
    id: 0xde,
    icon: icon`╢
      |│║│|
      |┤║│|
      |│║│|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'rcr ',
    connect: '169:3b',
  });
  readonly riverCaveNS_passageE = this.metascreen({
    id: 0xdf,
    icon: icon`╟
      |│║│|
      |│║├|
      |│║│|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'r rc',
    connect: '19:3be',
  });
  readonly wideHallNE = this.metascreen({
    id: 0xe0,
    icon: icon`
      | ┃ |
      | ┗━|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'w  w',
    connect: '2e',
  });
  readonly goaWideHallNE = this.metascreen({
    id: 0xe0,
    icon: icon`
      |│┃└|
      |│┗━|
      |└──|`,
    tilesets: {labyrinth: {}},
    edges: 'w  w',
    connect: '1f|2e|3d',
  });
  readonly goaWideHallNE_blockedLeft = this.metascreen({
    id: 0xe0,
    icon: icon`
      |│┃└|
      | ┗━|
      |└──|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNE, 1, 0, 0x61)]],
    edges: 'w  w',
    connect: '1|f|2e|3d',
  });
  readonly goaWideHallNE_blockedRight = this.metascreen({
    id: 0xe0,
    icon: icon`
      |│┃ |
      |│┗━|
      |└──|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNE, 1, 1, 0x0d)]],
    edges: 'w  w',
    connect: '1f|2e|3|d',
  });
  readonly wideHallNW = this.metascreen({
    id: 0xe1,
    icon: icon`
      | ┃ |
      |━┛ |
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'ww  ',
    connect: '26',
  });
  readonly goaWideHallNW = this.metascreen({
    id: 0xe1,
    icon: icon`
      |┘┃│|
      |━┛│|
      |──┘|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNW_blockedRight,
                               -1, 0, 0x6d)]],
    flag: 'always',
    edges: 'ww  ',
    connect: '15|26|37',
  });
  readonly goaWideHallNW_blockedRight = this.metascreen({
    id: 0xe1,
    icon: icon`
      |┘┃│|
      |━┛ |
      |──┘|`,
    tilesets: {labyrinth: {}},
    edges: 'ww  ',
    connect: '15|26|3|7',
  });
  readonly goaWideHallNW_blockedLeft = this.metascreen({
    id: 0xe1,
    icon: icon`
      | ┃│|
      |━┛│|
      |──┘|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNW_blockedRight,
                               2, 1, 0x01, 0x6d)]],
    edges: 'ww  ',
    connect: '1|5|26|37',
  });
  readonly wideHallSE = this.metascreen({
    id: 0xe2,
    icon: icon`
      |   |
      | ┏━|
      | ┃ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: '  ww',
    connect: 'ae',
  });
  readonly goaWideHallSE = this.metascreen({
    id: 0xe2,
    icon: icon`
      |┌──|
      |│┏━|
      |│┃┌|`,
    tilesets: {labyrinth: {}},
    edges: '  ww',
    connect: '9d|ae|bf',
  });
  readonly goaWideHallSE_blockedLeft = this.metascreen({
    id: 0xe2,
    icon: icon`
      |┌──|
      | ┏━|
      |│┃┌|`,
    tilesets: {labyrinth: {}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallSE, 3, 0, 0x61)]],
    edges: '  ww',
    connect: '9|d|ae|bf',
  });
  readonly goaWideHallSE_blockedRight = this.metascreen({
    id: 0xe2,
    icon: icon`
      |┌──|
      |│┏━|
      |│┃ |`,
    tilesets: {labyrinth: {}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallSE, 3, 1, 0xdd)]],
    edges: '  ww',
    connect: '9d|ae|b|f',
  });
  readonly wideHallWS = this.metascreen({
    id: 0xe3,
    icon: icon`
      |   |
      |━┓ |
      | ┃ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' ww ',
    connect: '6a',
  });
  readonly goaWideHallWS = this.metascreen({
    id: 0xe3,
    icon: icon`
      |──┐|
      |━┓│|
      |┐┃│|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallWS_blockedRight,
                               -1, 0, 0x9d)]],
    flag: 'always',
    edges: ' ww ',
    connect: '5b|6a|79',
  });
  readonly goaWideHallWS_blockedRight = this.metascreen({
    id: 0xe3,
    icon: icon`
      |──┐|
      |━┓ |
      |┐┃│|`,
    tilesets: {labyrinth: {}},
    edges: ' ww ',
    connect: '5|b|6a|79',
  });
  readonly goaWideHallWS_blockedLeft = this.metascreen({
    id: 0xe3,
    icon: icon`
      |──┐|
      |━┓│|
      | ┃│|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallWS_blockedRight,
                               4, 0, 0xd1, 0x9d)]],
    edges: ' ww ',
    connect: '5b|6a|7|9',
  });
  readonly goaWideHallNS_stairs = this.metascreen({
    id: 0xe4,
    icon: icon`
      |├┨│|
      |│┃│|
      |│┠┤|`,
    tilesets: {labyrinth: {}},
    edges: 'w w ',
    connect: '1239ab',
  });
  readonly goaWideHallNS_stairsBlocked13 = this.metascreen({
    id: 0xe4,
    icon: icon`
      |└┨│|
      |╷┃╵|
      |│┠┐|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNS_stairs,
                               5, 0, [0x41, 0x8d])]],
    edges: 'w w ',
    connect: '12ab|3|9',
  });
  readonly goaWideHallNS_stairsBlocked24 = this.metascreen({
    id: 0xe4,
    icon: icon`
      |┌┨│|
      |│┃│|
      |│┠┘|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNS_stairs,
                               5, 1, [0x01, 0xcd])]],
    edges: 'w w ',
    connect: '1|239a|b',
  });
  // TODO - custom inverted version of e4 with the top stair on the right
  readonly wideHallNS_deadEnds = this.metascreen({
    id: 0xe5,
    icon: icon`
      | ╹ |
      |   |
      | ╻ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'w w ',
    connect: '2|a',
  });
  // TODO - add one-way views of this?!?
  readonly goaWideHallNS_deadEnd = this.metascreen({
    id: 0xe5,
    icon: icon`
      |│╹│|
      |├─┤|
      |│╻│|`,
    tilesets: {labyrinth: {}},
    edges: 'w w ',
    connect: '139b|2|a',
  });
  readonly goaWideHallNS_deadEndBlocked24 = this.metascreen({
    id: 0xe5,
    icon: icon`
      |╵╹│|
      |┌─┘|
      |│╻╷|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNS_deadEnd,
                               6, 0, [0x61, 0xad])]],
    edges: 'w w ',
    connect: '1|2|39|a|b',
  });
  readonly goaWideHallNS_deadEndBlocked13 = this.metascreen({
    id: 0xe5,
    icon: icon`
      |│╹╵|
      |└─┐|
      |╷╻│|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNS_deadEnd,
                               6, 1, [0x6d, 0xa1])]],
    edges: 'w w ',
    connect: '1b|2|3|9|a',
  });
  readonly wideHallNWSE = this.metascreen({
    id: 0xe6,
    icon: icon`
      | ┃ |
      |━╋━|
      | ┃ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'wwww',
    connect: '26ae',
  });
  readonly goaWideHallNWSE = this.metascreen({
    id: 0xe6,
    icon: icon`
      |┘┃└|
      |━╋━|
      |┐┃┌|`,
    tilesets: {labyrinth: {}},
    edges: 'wwww',
    connect: '26ae|15|3d|79|bf',
  });
  readonly goaWideHallNWSE_blocked13 = this.metascreen({
    id: 0xe6,
    icon: icon`
      |┘┃ |
      |━╋━|
      | ┃┌|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNWSE, 7, 0, [0x0d, 0xd1])]],
    edges: 'wwww',
    connect: '26ae|15|3|d|7|9|bf',
  });
  readonly goaWideHallNWSE_blocked24 = this.metascreen({
    id: 0xe6,
    icon: icon`
      | ┃└|
      |━╋━|
      |┐┃ |`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNWSE, 7, 1, [0x01, 0xdd])]],
    edges: 'wwww',
    connect: '26ae|1|5|3d|79|b|f',
  });
  readonly wideHallNWE = this.metascreen({
    id: 0xe7,
    icon: icon`
      | ┃ |
      |━┻━|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'ww w',
    connect: '26e',
  });
  readonly goaWideHallNWE = this.metascreen({
    id: 0xe7,
    icon: icon`
      |┘┃└|
      |━┻━|
      |───|`,
    tilesets: {labyrinth: {}},
    edges: 'ww w',
    connect: '26e|15|3d|7f',
  });
  readonly goaWideHallNWE_blockedTop = this.metascreen({
    id: 0xe7,
    icon: icon`
      | ┃ |
      |━┻━|
      |───|`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallNWE, -1, 0, [0x01, 0x0d])]],
    edges: 'ww w',
    connect: '26e|1|5|3|d|7f',
  });
  readonly wideHallWSE = this.metascreen({
    id: 0xe8,
    icon: icon`
      |   |
      |━┳━|
      | ┃ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' www',
    connect: '6ae',
  });
  readonly goaWideHallWSE = this.metascreen({
    id: 0xe8,
    icon: icon`
      |───|
      |━┳━|
      |┐┃┌|`,
    tilesets: {labyrinth: {}},
    edges: ' www',
    connect: '6ae|5d|79|bf',
  });
  readonly goaWideHallWSE_blockedBottom = this.metascreen({
    id: 0xe8,
    icon: icon`
      |───|
      |━┳━|
      | ┃ |`,
    tilesets: {labyrinth: {requires: [ScreenFix.LabyrinthParapets]}},
    update: [[ScreenFix.LabyrinthParapets,
              labyrinthVariant(s => s.goaWideHallWSE, -1, 0, [0xd1, 0xdd])]],
    edges: ' www',
    connect: '6ae|5d|7|9|b|f',
  });
  readonly wideHallNS_wallTop = this.metascreen({
    id: 0xe9,    // NOTE: the passage narrows at the top
    icon: icon`
      | ┆ |
      | ┃ |
      | ┃ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: 'c w',
    connect: '2a',
    exits: [topEdge({left: 6, width: 4})],
  });
  readonly goaWideHallNS_wallTop = this.metascreen({
    id: 0xe9,    // NOTE: the passage narrows at the top
    icon: icon`
      | ┆ |
      |╷┃╷|
      |│┃│|`,
    tilesets: {labyrinth: {}},
    edges: 'c w ',
    connect: '2a|9|b',
    exits: [topEdge({left: 6, width: 4})],
  });
  readonly wideHallWE = this.metascreen({
    id: 0xea,
    icon: icon`
      |   |
      |━━━|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    edges: ' w w',
    connect: '6e',
  });
  readonly goaWideHallWE = this.metascreen({
    id: 0xea,
    icon: icon`
      |───|
      |━━━|
      |───|`,
    tilesets: {labyrinth: {}},
    edges: ' w w',
    connect: '5d|6e|7f',
  });
  readonly pitWE = this.metascreen({
    id: 0xeb,
    icon: icon`
      |   |
      |─╳─|
      |   |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    // TODO - annotate the pit
    feature: ['pit'],
    edges: ' c c',
    connect: '6e',
    platform: {type: 'horizontal', coord: 0x70_38},
  });
  readonly pitNS = this.metascreen({
    id: 0xec,
    icon: icon`
      | │ |
      | ╳ |
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    // TODO - annotate the pit
    feature: ['pit'],
    edges: 'c c ',
    connect: '2a',
    platform: {type: 'vertical', coord: 0x40_78},
  });
  readonly spikesNS_hallS = this.metascreen({
    id: 0xed,
    icon: icon`
      | ░ |
      | ░ |
      | │ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    // TODO - annotate the spikes?
    feature: ['spikes'],
    edges: 's c ', // s = spikes
    connect: '2a',
  });
  readonly spikesNS_hallN = this.metascreen({
    id: 0xee,
    icon: icon`
      | │ |
      | ░ |
      | ░ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    // TODO - annotate the spikes?
    feature: ['spikes'],
    edges: 'c s ',
    connect: '2a',
  });
  readonly spikesNS_hallWE = this.metascreen({
    id: 0xef,
    icon: icon`
      | ░ |
      |─░─|
      | ░ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    // TODO - annotate the spikes?
    feature: ['spikes'],
    edges: 'scsc',
    connect: '26ae',
  });
  readonly spikesNS_hallW = this.metascreen({
    id: ~0xe0,
    icon: icon`
      | ░ |
      |─░ |
      | ░ |`,
    tilesets: withRequire(ScreenFix.ExtraSpikes,
                          {cave: {}, fortress: {}, pyramid: {}, iceCave: {}}),
    // TODO - annotate the spikes?
    feature: ['spikes'],
    edges: 'scs ',
    connect: '26a',
  });
  readonly spikesNS_hallE = this.metascreen({
    id: ~0xe1,
    icon: icon`
      | ░ |
      | ░─|
      | ░ |`,
    tilesets: withRequire(ScreenFix.ExtraSpikes,
                          {cave: {}, fortress: {}, pyramid: {}, iceCave: {}}),
    // TODO - annotate the spikes?
    feature: ['spikes'],
    edges: 's sc',
    connect: '2ae',
  });
  readonly riverCave_deadEndsNS = this.metascreen({
    id: 0xf0,
    icon: icon`
      | ╨ |
      |   |
      | ╥ |`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['empty'],
    edges: 'r r ',
    connect: '1:3|9:b',
    poi: [[1, -0x30, 0x48], [1, -0x30, 0x98],
          [1, 0x110, 0x48], [1, 0x110, 0x98]],
  });
  readonly riverCave_deadEndsN = this.metascreen({
    id: 0xf0,
    icon: icon`
      | ╨ |
      |   |
      |   |`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['empty'],
    edges: 'r   ',
    connect: '1:3',
    poi: [[1, -0x30, 0x48], [1, -0x30, 0x98]],
    match: (reachable) => !reachable(-0x30, 0x48) && !reachable(-0x30, 0x98),
  });
  readonly riverCave_deadEndsS = this.metascreen({
    id: 0xf0,
    icon: icon`
      |   |
      |   |
      | ╥ |`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['empty'],
    edges: '  r ',
    connect: '9:b',
    poi: [[1, 0x110, 0x48], [1, 0x110, 0x98]],
    match: (reachable) => !reachable(-0x30, 0x48) && !reachable(-0x30, 0x98),
  });
  readonly riverCave_deadEndsWE = this.metascreen({
    id: 0xf1,
    icon: icon`
      |   |
      |╡ ╞|
      |   |`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['empty'],
    edges: ' r r',
    connect: '5:7|d:f',
    poi: [[1, 0x60, 0x108], [1, 0xa0, 0x108],
          [1, 0x60, -0x28], [1, 0xa0, -0x28]],
  });
  readonly riverCave_deadEndsW = this.metascreen({
    id: 0xf1,
    icon: icon`
      |   |
      |╡  |
      |   |`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['empty'],
    edges: ' r  ',
    connect: '5:7',
    poi: [[1, 0x60, -0x28], [1, 0xa0, -0x28]],
    match: (reachable) => !reachable(0x60, 0x108) && !reachable(0xa0, 0x108),
  });
  readonly riverCave_deadEndsE = this.metascreen({
    id: 0xf1,
    icon: icon`
      |   |
      |  ╞|
      |   |`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['empty'],
    edges: '   r',
    connect: 'd:f',
    poi: [[1, 0x60, 0x108], [1, 0xa0, 0x108]],
    match: (reachable) => !reachable(0x60, -0x28) && !reachable(0xa0, -0x28),
  });
  readonly riverCaveN_bridge = this.metascreen({
    id: 0xf2,
    icon: icon`
      | ┇ |
      | ╨ |
      |   |`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['bridge'],
    edges: 'r   ',
    connect: '1-3',
    wall: 0x17,
    // TODO - consider a poi(2) here?
  });
  readonly riverCaveS_bridge = this.metascreen({
    id: 0xf2,
    icon: icon`
      |   |
      | ╥ |
      | ┇ |`,
    tilesets: {cave: {}, fortress: {}},
    feature: ['bridge'],
    edges: '  r ',
    connect: '9-b',
    wall: 0xc6,
    // TODO - consider a poi(2) here?
  });
  readonly riverCaveWSE = this.metascreen({
    id: 0xf3,
    icon: icon`
      |───|
      |═╦═|
      |┐║┌|`,
    tilesets: {cave: {}, fortress: {}},
    edges: ' rrr',
    connect: '5d:79:bf',
  });
  readonly riverCaveNWE = this.metascreen({
    id: 0xf4,
    icon: icon`
      |┘║└|
      |═╩═|
      |───|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'rr r',
    connect: '15:3d:7f',
  });
  readonly riverCaveNS_blockedRight = this.metascreen({
    id: 0xf5,
    icon: icon`
      |│║│|
      |│║ |
      |│║│|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'r r ',
    connect: '19:3:b',
    poi: [[1, 0xc0, 0x98], [1, 0x40, 0x98]],
  });
  readonly riverCaveNS_blockedLeft = this.metascreen({
    id: 0xf6,
    icon: icon`
      |│║│|
      | ║│|
      |│║│|`,
    tilesets: {cave: {}, fortress: {}},
    edges: 'r r ',
    connect: '1:3b:9',
    poi: [[1, 0xb0, 0x48], [1, 0x30, 0x48]],
  });
  readonly spikesNS = this.metascreen({
    id: 0xf7,
    icon: icon`
      | ░ |
      | ░ |
      | ░ |`,
    tilesets: {cave: {}, fortress: {}, pyramid: {}, iceCave: {}},
    feature: ['spikes'],
    edges: 's s ',
    connect: '2a',
  });
  readonly cryptArena_statues = this.metascreen({
    id: 0xf8,
    icon: icon`<
      |&<&|
      |│ │|
      |└┬┘|`,
    tilesets: {pyramid: {}},
    feature: ['arena'],
    edges: ' *c*',
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    connect: 'a',
    exits: [upStair(0x57)],
    flag: 'custom:false',
  });
  readonly pyramidArena_draygon = this.metascreen({
    id: 0xf9,
    icon: icon`
      |┌─┐|
      |│╳│|
      |└┬┘|`,
    tilesets: {pyramid: {}},
    feature: ['arena', 'pit'],
    edges: ' *w*',
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    connect: 'a',
  });
  readonly cryptArena_draygon2 = this.metascreen({
    id: 0xfa,
    icon: icon`
      |┏┷┓|
      |┃&┃|
      |┗┳┛|`,
    tilesets: {pyramid: {}},
    feature: ['arena'],
    edges: 'c*w*',
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    connect: '2a',
    exits: [topEdge({left: 6, width: 4})],
    flag: 'custom:false',
  });
  readonly cryptArena_entrance = this.metascreen({
    id: 0xfb,
    icon: icon`
      | ┃ |
      | ┃ |
      | ╿ |`,
    tilesets: {pyramid: {}},
    edges: 'w n ',
    connect: '2a',
    exits: [bottomEdge()],
  });
  readonly cryptTeleporter = this.metascreen({
    id: 0xfc,
    tilesets: {pyramid: {}, tower: {}},
    exits: [bottomEdge({left: 6, width: 4}), cave(0x57, 'teleporter')],
  });
  readonly fortressArena_through = this.metascreen({
    id: 0xfd,
    icon: icon`╽
      |┌┴┐|
      |│ │|
      |┕┳┙|`,
    tilesets: {fortress: {}, pyramid: {}},
    // NOTE: we could use this for a pit that requires flight to cross?
    feature: ['arena'],
    edges: 'n*w*',
    allowed: s => s.hasFeature('empty') ? [1, 3] : [],
    connect: '2a',
    exits: [topEdge()],
  });
  // readonly fortressArena_pit = this.metascreen({
  //   id: 0xfd,
  //   icon: icon`╽
  //     |┌┴┐|
  //     |│ │|
  //     |┕┳┙|`,
  //   tilesets: {pyramid: {}},
  //   feature: ['arena', 'pit'],
  //   edges: 'n w ',
  //   connect: '2a', // TODO - no way yet to notice flagged and have
  //   exits: [topEdge()],   // logic require flight...
  //   flagged: true,
  // });
  readonly fortressTrap = this.metascreen({
    id: 0xfe,
    icon: icon`
      |└─┘|
      | ╳ |
      |╶┬╴|`,
    tilesets: {fortress: {}, pyramid: {}},
    feature: ['pit'],
    edges: '  n ',
    connect: 'a',
    exits: [bottomEdge()],
  });
  readonly shrine = this.metascreen({
    id: 0xff,
    tilesets: {shrine: {}},
    exits: [bottomEdge({left: 6, width: 5})],
  });
  readonly inn = this.metascreen({
    id: 0x100,
    tilesets: {house: {}},
    exits: [{...door(0x86), entrance: 0x94_68}],
  });
  readonly toolShop = this.metascreen({
    id: 0x101,
    tilesets: {house: {}},
    exits: [{...door(0x86), entrance: 0x94_68}],
  });
  readonly armorShop = this.metascreen({
    id: 0x102,
    tilesets: {house: {}},
    exits: [{...door(0x86), entrance: 0x94_68}],
  });
  readonly exit = this.metascreen({
    id: ~0x7fff, // will never be instantiated
    tilesets: {}, // not directly included in any
    // Check for edge exits in potential neighbors
    allowed: (s) => (s.data.exits || [])
        .map(e => (edgeTypeMap[e.type]! ^ 2) as (0 | 1 | 2 | 3))
        .filter(d => d != null),
  });

  checkExitTypes() {
    // Does a quick check to make sure there's no conflicting exit types
    // on any metascreens.
    for (const s in this) {
      const ms = this[s] as any;
      const seen = new Set<string>();
      for (const e of ms?.data?.exits || []) {
        if (seen.has(e.type)) console.log(`duplicate: ${s} ${e.type}`);
        seen.add(e.type);
      }
    }
  }
}

const edgeTypeMap: {[C in ConnectionType]?: number} = {
  'edge:top': 0,
  'edge:left': 1,
  'edge:bottom': 2,
  'edge:right': 3,
};


//   ╔╦╗         ╢  ╥
//   ╠╬╣ ╞═╤╧╪╡  ║  ╫
//   ╚╩╝         ╨  ╟
//  ┌┬┐  ╷
//  ├┼┤  │ ╶─╴ 
//  └┴┘  ╵
// ▗▄▖   ▟▙
// ▐█▌   ▜▛ 
// ▝▀▘
// U+250x ─ ━ │ ┃ ┄ ┅ ┆ ┇ ┈ ┉ ┊ ┋ ┌ ┍ ┎ ┏
// U+251x ┐ ┑ ┒ ┓ └ ┕ ┖ ┗ ┘ ┙ ┚ ┛ ├ ┝ ┞ ┟
// U+252x ┠ ┡ ┢ ┣ ┤ ┥ ┦ ┧ ┨ ┩ ┪ ┫ ┬ ┭ ┮ ┯
// U+253x ┰ ┱ ┲ ┳ ┴ ┵ ┶ ┷ ┸ ┹ ┺ ┻ ┼ ┽ ┾ ┿
// U+254x ╀ ╁ ╂ ╃ ╄ ╅ ╆ ╇ ╈ ╉ ╊ ╋ ╌ ╍ ╎ ╏
// U+255x ═ ║ ╒ ╓ ╔ ╕ ╖ ╗ ╘ ╙ ╚ ╛ ╜ ╝ ╞	╟
// U+256x ╠ ╡ ╢ ╣ ╤ ╥ ╦ ╧ ╨ ╩ ╪ ╫ ╬ ╭ ╮ ╯
// U+257x ╰ ╱ ╲ ╳ ╴ ╵ ╶ ╷ ╸ ╹ ╺ ╻ ╼ ╽ ╾ ╿
// U+258x ▀ ▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ▉ ▊ ▋ ▌ ▍ ▎ ▏
// U+259x ▐ ░ ▒ ▓ ▔ ▕ ▖ ▗ ▘ ▙ ▚ ▛ ▜ ▝ ▞ ▟
//
// ∩ \cap

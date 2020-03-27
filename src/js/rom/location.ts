import {Assembler} from '../asm/assembler.js';
import {Expr} from '../asm/expr.js';
import {Module} from '../asm/module.js';
import {Area, Areas} from './area.js';
import {Entity} from './entity.js';
import {Metalocation} from './metalocation.js';
import {Screen} from './screen.js';
import {Segment,
        concatIterables, free, group, hex, initializer,
        readLittleEndian, seq, tuple, varSlice,
        upperCamelToSpaces} from './util.js';
import {Rom} from '../rom.js';
import {UnionFind} from '../unionfind.js';
import {assertNever, iters, DefaultMap} from '../util.js';
import {Monster} from './monster.js';
import {Random} from '../random.js';

import {Entrance, Exit, Flag, Pit, Spawn} from './locationtables.js';
export {Entrance, Exit, Flag, Pit, Spawn}; // TODO - remove the re-export

const {$0a, $0b, $0c, $0d} = Segment;

// Number indicates to copy whatever's at the given exit
type Key = string | symbol | number;
// Local for defining names on Locations objects.
interface LocationInit {
  area?: Area;
  subArea?: string;
  music?: Key | ((area: Area) => Key);
  palette?: Key | ((area: Area) => Key);
  bossScreen?: number;
  fixed?: readonly number[];
}
interface LocationData {
  area: Area;
  name: string;
  music: Key;
  palette: Key;
  subArea?: string;
  bossScreen?: number;
  fixed?: readonly number[]; // fixed spawn slots?
}

const CAVE = {
  subArea: 'cave',
  music: (area: Area) => `${area.name}-Cave`,
  palette: (area: Area) => `${area.name}-Cave`,
} as const;
const HOUSE = {
  subArea: 'house',
  palette: () => Symbol(),
} as const;
const FORTUNE_TELLER = {
  subArea: 'house',
  palette: () => Symbol(),
  music: (area: Area) => `${area.name}-FortuneTeller`,
} as const;
const MESIA = {
  name: 'mesia',
  music: (area: Area) => `${area.name}-Mesia`,
  // Mesia in tower keeps same palette
  palette: (area: Area) => area.name === 'Tower' ?
      area.name : `${area.name}-Mesia`,
} as const;
const DYNA = {
  name: 'dyna',
  music: (area: Area) => `${area.name}-Dyna`,
  palette: (area: Area) => `${area.name}-Dyna`,
} as const;
const KELBESQUE = {
  name: 'goa 1',
  music: 'goa 1',
  palette: 'goa 1',
} as const;
const SABERA = {
  name: 'goa 2',
  music: 'goa 2',
  palette: 'goa 2',
} as const;
const MADO_LOWER = {
  name: 'goa 3',
  music: 'goa 3',
  palette: 'goa 3',
} as const;
const MADO_UPPER = {...MADO_LOWER, palette: 'goa 3 upper'} as const;
const KARMINE_UPPER = {
  name: 'goa 4',
  music: 'goa 4',
  palette: 'goa 4',
} as const;
const KARMINE_LOWER = {...KARMINE_UPPER, palette: 'goa 4 lower'} as const;

type InitParams = readonly [number, LocationInit?];
type Init = {(...args: InitParams): Location,
             commit(locations: Locations): void};
const $: Init = (() => {
  const $ = initializer<[number, LocationInit], Location>();
  let area!: Area;
  function $$(id: number, data: LocationInit = {}): Location {
    data = {...data};
    area = data.area = data.area || area;
    return $(id, data);
  };
  ($$ as Init).commit = (locations: Locations) => {
    $.commit(locations, (prop: string, id: number, init: LocationInit) => {
      const name = upperCamelToSpaces(prop);
      const area = init.area!;
      const music = typeof init.music === 'function' ?
          init.music(area) : init.music != null ?
          init.music : area.name;
      const palette = typeof init.palette === 'function' ?
          init.palette(area) : init.palette || area.name;
      const data: LocationData = {area, name, music, palette};
      if (init.subArea != null) data.subArea = init.subArea;
      if (init.bossScreen != null) data.bossScreen = init.bossScreen;
      const location = new Location(locations.rom, id, data);
      // negative id indicates it's not registered.
      if (id >= 0) locations[id] = location;
      return location;
    });
  };
  return $$ as Init;
})();

export class Locations extends Array<Location> {

  readonly MezameShrine             = $(0x00, {area: Areas.Mezame});
  readonly Leaf_OutsideStart        = $(0x01, {music: 1});
  readonly Leaf                     = $(0x02, {area: Areas.Leaf});
  readonly ValleyOfWind             = $(0x03, {area: Areas.ValleyOfWind});
  readonly SealedCave1              = $(0x04, {area: Areas.SealedCave});
  readonly SealedCave2              = $(0x05);
  readonly SealedCave6              = $(0x06);
  readonly SealedCave4              = $(0x07);
  readonly SealedCave5              = $(0x08);
  readonly SealedCave3              = $(0x09);
  readonly SealedCave7              = $(0x0a, {bossScreen: 0x91});
  // INVALID: 0x0b
  readonly SealedCave8              = $(0x0c);
  // INVALID: 0x0d
  readonly WindmillCave             = $(0x0e, {area: Areas.WindmillCave});
  readonly Windmill                 = $(0x0f, {area: Areas.Windmill, music: 0});
  readonly ZebuCave                 = $(0x10, {area: Areas.ZebuCave});
  readonly MtSabreWest_Cave1        = $(0x11, {area: Areas.MtSabreWest, ...CAVE});
  // INVALID: 0x12
  // INVALID: 0x13
  readonly CordelPlainWest          = $(0x14, {area: Areas.CordelPlain});
  readonly CordelPlainEast          = $(0x15);
  // INVALID: 0x16 -- unused copy of 18
  // INVALID: 0x17
  readonly Brynmaer                 = $(0x18, {area: Areas.Brynmaer});
  readonly OutsideStomHouse         = $(0x19, {area: Areas.StomHouse,
                                               music: 0});
  readonly Swamp                    = $(0x1a, {area: Areas.Swamp,
                                               bossScreen: 0x7c});
  readonly Amazones                 = $(0x1b, {area: Areas.Amazones,
                                               fixed: [0x0d, 0x0e]});
  readonly Oak                      = $(0x1c, {area: Areas.Oak});
  // INVALID: 0x1d
  readonly StomHouse                = $(0x1e, {area: Areas.StomHouse});
  // INVALID: 0x1f
  readonly MtSabreWest_Lower        = $(0x20, {area: Areas.MtSabreWest});
  readonly MtSabreWest_Upper        = $(0x21);
  readonly MtSabreWest_Cave2        = $(0x22, CAVE);
  readonly MtSabreWest_Cave3        = $(0x23, CAVE);
  readonly MtSabreWest_Cave4        = $(0x24, CAVE);
  readonly MtSabreWest_Cave5        = $(0x25, CAVE);
  readonly MtSabreWest_Cave6        = $(0x26, CAVE);
  readonly MtSabreWest_Cave7        = $(0x27, CAVE);
  readonly MtSabreNorth_Main        = $(0x28, {area: Areas.MtSabreNorth,
                                               bossScreen: 0xb5});
  readonly MtSabreNorth_Middle      = $(0x29);
  readonly MtSabreNorth_Cave2       = $(0x2a, CAVE);
  readonly MtSabreNorth_Cave3       = $(0x2b, CAVE);
  readonly MtSabreNorth_Cave4       = $(0x2c, CAVE);
  readonly MtSabreNorth_Cave5       = $(0x2d, CAVE);
  readonly MtSabreNorth_Cave6       = $(0x2e, CAVE);
  readonly MtSabreNorth_PrisonHall  = $(0x2f, CAVE);
  readonly MtSabreNorth_LeftCell    = $(0x30, CAVE);
  readonly MtSabreNorth_LeftCell2   = $(0x31, CAVE);
  readonly MtSabreNorth_RightCell   = $(0x32, CAVE);
  readonly MtSabreNorth_Cave8       = $(0x33, CAVE);
  readonly MtSabreNorth_Cave9       = $(0x34, CAVE);
  readonly MtSabreNorth_SummitCave  = $(0x35, CAVE);
  // INVALID: 0x36
  // INVALID: 0x37
  readonly MtSabreNorth_Cave1       = $(0x38, CAVE);
  readonly MtSabreNorth_Cave7       = $(0x39, CAVE);
  // INVALID: 0x3a
  // INVALID: 0x3b
  readonly Nadare_Inn               = $(0x3c, {area: Areas.Nadare, ...HOUSE});
  readonly Nadare_ToolShop          = $(0x3d, HOUSE);
  readonly Nadare_BackRoom          = $(0x3e, HOUSE);
  // INVALID: 0x3f
  readonly WaterfallValleyNorth     = $(0x40, {area: Areas.WaterfallValley});
  readonly WaterfallValleySouth     = $(0x41);
  readonly LimeTreeValley           = $(0x42, {area: Areas.LimeTreeValley,
                                               music: 0});
  readonly LimeTreeLake             = $(0x43, {area: Areas.LimeTreeLake,
                                               music: 0});
  readonly KirisaPlantCave1         = $(0x44, {area: Areas.KirisaPlantCave});
  readonly KirisaPlantCave2         = $(0x45);
  readonly KirisaPlantCave3         = $(0x46);
  readonly KirisaMeadow             = $(0x47, {area: Areas.KirisaMeadow});
  readonly FogLampCave1             = $(0x48, {area: Areas.FogLampCave});
  readonly FogLampCave2             = $(0x49);
  readonly FogLampCave3             = $(0x4a);
  readonly FogLampCaveDeadEnd       = $(0x4b);
  readonly FogLampCave4             = $(0x4c);
  readonly FogLampCave5             = $(0x4d);
  readonly FogLampCave6             = $(0x4e);
  readonly FogLampCave7             = $(0x4f);
  readonly Portoa                   = $(0x50, {area: Areas.Portoa});
  readonly Portoa_FishermanIsland   = $(0x51, {area: Areas.FishermanHouse,
                                               music: 0});
  readonly MesiaShrine              = $(0x52, {area: Areas.LimeTreeLake,
                                               ...MESIA});
  // INVALID: 0x53
  readonly WaterfallCave1           = $(0x54, {area: Areas.WaterfallCave});
  readonly WaterfallCave2           = $(0x55);
  readonly WaterfallCave3           = $(0x56);
  readonly WaterfallCave4           = $(0x57);
  readonly TowerEntrance            = $(0x58, {area: Areas.Tower});
  readonly Tower1                   = $(0x59);
  readonly Tower2                   = $(0x5a);
  readonly Tower3                   = $(0x5b);
  readonly TowerOutsideMesia        = $(0x5c);
  readonly TowerOutsideDyna         = $(0x5d);
  readonly TowerMesia               = $(0x5e, MESIA);
  readonly TowerDyna                = $(0x5f, DYNA);
  readonly AngrySea                 = $(0x60, {area: Areas.AngrySea});
  readonly BoatHouse                = $(0x61);
  readonly JoelLighthouse           = $(0x62, {area: Areas.Lighthouse,
                                               music: 0});
  // INVALID: 0x63
  readonly UndergroundChannel       = $(0x64, {area: Areas.UndergroundChannel});
  readonly ZombieTown               = $(0x65, {area: Areas.ZombieTown});
  // INVALID: 0x66
  // INVALID: 0x67
  readonly EvilSpiritIsland1        = $(0x68, {area: Areas.EvilSpiritIslandEntrance,
                                               music: 1});
  readonly EvilSpiritIsland2        = $(0x69, {area: Areas.EvilSpiritIsland});
  readonly EvilSpiritIsland3        = $(0x6a);
  readonly EvilSpiritIsland4        = $(0x6b);
  readonly SaberaPalace1            = $(0x6c, {area: Areas.SaberaFortress,
                                               bossScreen: 0xfd});
  readonly SaberaPalace2            = $(0x6d);
  readonly SaberaPalace3            = $(0x6e, {bossScreen: 0xfd});
  // INVALID: 0x6f -- Sabera Palace 3 unused copy
  readonly JoelSecretPassage        = $(0x70, {area: Areas.JoelPassage});
  readonly Joel                     = $(0x71, {area: Areas.Joel});
  readonly Swan                     = $(0x72, {area: Areas.Swan, music: 1});
  readonly SwanGate                 = $(0x73, {area: Areas.SwanGate,
                                               music: 1});
  // INVALID: 0x74
  // INVALID: 0x75
  // INVALID: 0x76
  // INVALID: 0x77
  readonly GoaValley                = $(0x78, {area: Areas.GoaValley});
  // INVALID: 0x79
  // INVALID: 0x7a
  // INVALID: 0x7b
  readonly MtHydra                  = $(0x7c, {area: Areas.MtHydra});
  readonly MtHydra_Cave1            = $(0x7d, CAVE);
  readonly MtHydra_OutsideShyron    = $(0x7e, {fixed: [0x0d, 0x0e]}); // guards
  readonly MtHydra_Cave2            = $(0x7f, CAVE);
  readonly MtHydra_Cave3            = $(0x80, CAVE);
  readonly MtHydra_Cave4            = $(0x81, CAVE);
  readonly MtHydra_Cave5            = $(0x82, CAVE);
  readonly MtHydra_Cave6            = $(0x83, CAVE);
  readonly MtHydra_Cave7            = $(0x84, CAVE);
  readonly MtHydra_Cave8            = $(0x85, CAVE);
  readonly MtHydra_Cave9            = $(0x86, CAVE);
  readonly MtHydra_Cave10           = $(0x87, CAVE);
  readonly Styx1                    = $(0x88, {area: Areas.Styx});
  readonly Styx2                    = $(0x89);
  readonly Styx3                    = $(0x8a);
  // INVALID: 0x8b
  readonly Shyron                   = $(0x8c, {area: Areas.Shyron});
  // INVALID: 0x8d
  readonly Goa                      = $(0x8e, {area: Areas.Goa});
  readonly GoaFortressBasement      = $(0x8f, {area: Areas.FortressBasement,
                                               music: 0});
  readonly Desert1                  = $(0x90, {area: Areas.Desert1});
  readonly OasisCaveMain            = $(0x91, {area: Areas.OasisCave});
  readonly DesertCave1              = $(0x92, {area: Areas.DesertCave1,
                                               music: 0});
  readonly Sahara                   = $(0x93, {area: Areas.Sahara});
  readonly SaharaOutsideCave        = $(0x94, {music: 0}); // TODO - sahara?? generic??
  readonly DesertCave2              = $(0x95, {area: Areas.DesertCave2, music: 1});
  readonly SaharaMeadow             = $(0x96, {area: Areas.SaharaMeadow, music: 0});
  // INVALID: 0x97
  readonly Desert2                  = $(0x98, {area: Areas.Desert2});
  // INVALID: 0x99
  // INVALID: 0x9a
  // INVALID: 0x9b
  readonly Pyramid_Entrance         = $(0x9c, {area: Areas.Pyramid});
  readonly Pyramid_Branch           = $(0x9d);
  readonly Pyramid_Main             = $(0x9e);
  readonly Pyramid_Draygon          = $(0x9f);
  readonly Crypt_Entrance           = $(0xa0, {area: Areas.Crypt});
  readonly Crypt_Hall1              = $(0xa1);
  readonly Crypt_Branch             = $(0xa2);
  readonly Crypt_DeadEndLeft        = $(0xa3);
  readonly Crypt_DeadEndRight       = $(0xa4);
  readonly Crypt_Hall2              = $(0xa5);
  readonly Crypt_Draygon2           = $(0xa6);
  readonly Crypt_Teleporter         = $(0xa7, {music: 'Crypt-Teleporter'});
  readonly GoaFortress_Entrance     = $(0xa8, {area: Areas.GoaFortress,
                                               music: 1}); // same as next area
  readonly GoaFortress_Kelbesque    = $(0xa9, {bossScreen: 0x73,
                                               ...KELBESQUE});
  readonly GoaFortress_Zebu         = $(0xaa, {...KELBESQUE, palette: 1});
  readonly GoaFortress_Sabera       = $(0xab, SABERA);
  readonly GoaFortress_Tornel       = $(0xac, {bossScreen: 0x91,
                                               ...SABERA,
                                               palette: 1});
  readonly GoaFortress_Mado1        = $(0xad, MADO_LOWER);
  readonly GoaFortress_Mado2        = $(0xae, MADO_UPPER);
  readonly GoaFortress_Mado3        = $(0xaf, MADO_UPPER);
  readonly GoaFortress_Karmine1     = $(0xb0, KARMINE_UPPER);
  readonly GoaFortress_Karmine2     = $(0xb1, KARMINE_UPPER);
  readonly GoaFortress_Karmine3     = $(0xb2, KARMINE_UPPER);
  readonly GoaFortress_Karmine4     = $(0xb3, KARMINE_UPPER);
  readonly GoaFortress_Karmine5     = $(0xb4, KARMINE_UPPER);
  readonly GoaFortress_Karmine6     = $(0xb5, KARMINE_LOWER);
  readonly GoaFortress_Karmine7     = $(0xb6, {bossScreen: 0xfd,
                                               ...KARMINE_LOWER});
  readonly GoaFortress_Exit         = $(0xb7, {music: 0}); // same as top goa
  readonly OasisCave_Entrance       = $(0xb8, {area: Areas.OasisEntrance,
                                               music: 2});
  readonly GoaFortress_Asina        = $(0xb9, {area: Areas.GoaFortress,
                                               ...MADO_UPPER,
                                               bossScreen: 0x91});
  readonly GoaFortress_Kensu        = $(0xba, KARMINE_UPPER);
  readonly Goa_House                = $(0xbb, {area: Areas.Goa, ...HOUSE});
  readonly Goa_Inn                  = $(0xbc, HOUSE);
  // INVALID: 0xbd
  readonly Goa_ToolShop             = $(0xbe, HOUSE);
  readonly Goa_Tavern               = $(0xbf, HOUSE);
  readonly Leaf_ElderHouse          = $(0xc0, {area: Areas.Leaf, ...HOUSE});
  readonly Leaf_RabbitHut           = $(0xc1, HOUSE);
  readonly Leaf_Inn                 = $(0xc2, HOUSE);
  readonly Leaf_ToolShop            = $(0xc3, HOUSE);
  readonly Leaf_ArmorShop           = $(0xc4, HOUSE);
  readonly Leaf_StudentHouse        = $(0xc5, HOUSE);
  readonly Brynmaer_Tavern          = $(0xc6, {area: Areas.Brynmaer, ...HOUSE});
  readonly Brynmaer_PawnShop        = $(0xc7, HOUSE);
  readonly Brynmaer_Inn             = $(0xc8, HOUSE);
  readonly Brynmaer_ArmorShop       = $(0xc9, HOUSE);
  // INVALID: 0xca
  readonly Brynmaer_ItemShop        = $(0xcb, HOUSE);
  // INVALID: 0xcc
  readonly Oak_ElderHouse           = $(0xcd, {area: Areas.Oak, ...HOUSE});
  readonly Oak_MotherHouse          = $(0xce, HOUSE);
  readonly Oak_ToolShop             = $(0xcf, HOUSE);
  readonly Oak_Inn                  = $(0xd0, HOUSE);
  readonly Amazones_Inn             = $(0xd1, {area: Areas.Amazones, ...HOUSE});
  readonly Amazones_ItemShop        = $(0xd2, HOUSE);
  readonly Amazones_ArmorShop       = $(0xd3, HOUSE);
  readonly Amazones_Elder           = $(0xd4, HOUSE);
  readonly Nadare                   = $(0xd5, {area: Areas.Nadare}); // edge-door?
  readonly Portoa_FishermanHouse    = $(0xd6, {area: Areas.FishermanHouse,
                                               ...HOUSE, music: 0});
  readonly Portoa_PalaceEntrance    = $(0xd7, {area: Areas.PortoaPalace});
  readonly Portoa_FortuneTeller     = $(0xd8, {area: Areas.Portoa,
                                               fixed: [0x0d, 0x0e], // guard/empty
                                               ...FORTUNE_TELLER});
  readonly Portoa_PawnShop          = $(0xd9, HOUSE);
  readonly Portoa_ArmorShop         = $(0xda, HOUSE);
  // INVALID: 0xdb
  readonly Portoa_Inn               = $(0xdc, HOUSE);
  readonly Portoa_ToolShop          = $(0xdd, HOUSE);
  readonly PortoaPalace_Left        = $(0xde, {area: Areas.PortoaPalace,
                                               ...HOUSE});
  readonly PortoaPalace_ThroneRoom  = $(0xdf, HOUSE);
  readonly PortoaPalace_Right       = $(0xe0, HOUSE);
  readonly Portoa_AsinaRoom         = $(0xe1, {area: Areas.UndergroundChannel,
                                               ...HOUSE, music: 'asina'});
  readonly Amazones_ElderDownstairs = $(0xe2, {area: Areas.Amazones,
                                               ...HOUSE});
  readonly Joel_ElderHouse          = $(0xe3, {area: Areas.Joel, ...HOUSE});
  readonly Joel_Shed                = $(0xe4, HOUSE);
  readonly Joel_ToolShop            = $(0xe5, HOUSE);
  // INVALID: 0xe6
  readonly Joel_Inn                 = $(0xe7, HOUSE);
  readonly ZombieTown_House         = $(0xe8, {area: Areas.ZombieTown,
                                               ...HOUSE});
  readonly ZombieTown_HouseBasement = $(0xe9, HOUSE);
  // INVALID: 0xea
  readonly Swan_ToolShop            = $(0xeb, {area: Areas.Swan, ...HOUSE});
  readonly Swan_StomHut             = $(0xec, HOUSE);
  readonly Swan_Inn                 = $(0xed, HOUSE);
  readonly Swan_ArmorShop           = $(0xee, HOUSE);
  readonly Swan_Tavern              = $(0xef, HOUSE);
  readonly Swan_PawnShop            = $(0xf0, HOUSE);
  readonly Swan_DanceHall           = $(0xf1, HOUSE);
  readonly Shyron_Temple            = $(0xf2, {area: Areas.ShyronTemple,
                                               bossScreen: 0x70});
  readonly Shyron_TrainingHall      = $(0xf3, {area: Areas.Shyron, ...HOUSE});
  readonly Shyron_Hospital          = $(0xf4, HOUSE);
  readonly Shyron_ArmorShop         = $(0xf5, HOUSE);
  readonly Shyron_ToolShop          = $(0xf6, HOUSE);
  readonly Shyron_Inn               = $(0xf7, HOUSE);
  readonly Sahara_Inn               = $(0xf8, {area: Areas.Sahara, ...HOUSE});
  readonly Sahara_ToolShop          = $(0xf9, HOUSE);
  readonly Sahara_ElderHouse        = $(0xfa, HOUSE);
  readonly Sahara_PawnShop          = $(0xfb, HOUSE);

  // New locations, no ID procured yet.
  readonly EastCave1      = $(-1, {area: Areas.EastCave});
  readonly EastCave2      = $(-1);
  readonly EastCave3      = $(-1);
  readonly FishermanBeach = $(-1, {area: Areas.FishermanHouse, ...HOUSE});

  private readonly locsByScreen = new DefaultMap<number, Location[]>(() => []);

  constructor(readonly rom: Rom) {
    super(0x100);
    $.commit(this);
    // Fill in any missing ones
    for (let id = 0; id < 0x100; id++) {
      if (this[id]) {
        this.indexScreens(this[id]);
        continue;
      }
      this[id] = new Location(rom, id, {
        area: Areas.Unused,
        name: '',
        music: '',
        palette: '',
      });
    }
    // TODO - method to add an unregistered location to an empty index.
  }

  indexScreens(loc: Location) {
    for (const row of loc.screens) {
      for (const s of row) {
        this.locsByScreen.get(s).push(loc);
      }
    }
  }

  renumberScreen(oldId: number, newId: number) {
    const locs = this.locsByScreen.get(oldId);
    this.locsByScreen.set(newId, locs);
    this.locsByScreen.delete(oldId);
    for (const loc of locs) {
      for (const row of loc.screens) {
        for (let i = 0; i < row.length; i++) {
          if (row[i] === oldId) row[i] = newId;
        }
      }
    }
  }

  allocate(location: Location): Location {
    // pick an unused location
    for (const l of this) {
      if (l.used) continue;
      (location as any).id = l.id;
      location.used = true;
      this.indexScreens(location);
      return this[l.id] = location;
    }
    throw new Error('No unused location');
  }

  write(): Module[] {
    const a = this.rom.assembler();
    free(a, $0a, 0x84f8, 0xa000);
    free(a, $0b, 0xa000, 0xbe00);
    free(a, $0c, 0x93f9, 0xa000);
    free(a, $0d, 0xa000, 0xac00);
    free(a, $0d, 0xae00, 0xc000); // bf00 ???
    for (const location of this) {
      location.assemble(a);
    }
    return [a.module()];
  }

  copyFromMeta() {
    // First sync up Cordel's exits.
    this.CordelPlainEast.meta.reconcileExits(this.CordelPlainWest.meta);
    // Now do the actual copy.
    for (const loc of this) {
      if (!loc.used) continue;
      loc.exits = [];
      loc.entrances = [];
    }
    for (const loc of this) {
      if (!loc.used) continue;
      loc.meta.write();
    }
  }
}

// Location entities
export class Location extends Entity {

  used: boolean;

  bgm: number;
  originalBgm: number;
  layoutWidth: number;
  layoutHeight: number;
  animation: number;
  // Screen indices are (extended << 8 | screen)
  // extended: number;
  screens: number[][];

  tilePatterns: [number, number];
  tilePalettes: [number, number, number];
  originalTilePalettes: [number, number, number];
  tileset: number;
  tileEffects: number;

  entrances: Entrance[];
  exits: Exit[];
  flags: Flag[];
  pits: Pit[];

  spritePalettes: [number, number];
  spritePatterns: [number, number];
  spawns: Spawn[];

  private _isShop: boolean|undefined = undefined;
  private _meta?: Metalocation = undefined;

  constructor(rom: Rom, id: number, readonly data: LocationData) {
    // will include both MapData *and* NpcData, since they share a key.
    super(rom, id);

    const mapDataBase =
        id >= 0 ? readLittleEndian(rom.prg, this.mapDataPointer) + 0xc000 : 0;
    // TODO - pass this in and move LOCATIONS to locations.ts
    this.used = mapDataBase > 0xc000 && !!this.name;

    if (!this.used) {
      this.bgm = this.originalBgm = 0;
      this.layoutWidth = 0;
      this.layoutHeight = 0;
      this.animation = 0;
      // this.extended = 0;
      this.screens = [[0]];
      this.tilePalettes = [0x24, 0x01, 0x26];
      this.originalTilePalettes = [0x24, 0x01, 0x26];
      this.tileset = 0x80;
      this.tileEffects = 0xb3;
      this.tilePatterns = [2, 4];
      this.exits = [];
      this.entrances = [];
      this.flags = [];
      this.pits = [];
      this.spawns = [];
      this.spritePalettes = [0, 0];
      this.spritePatterns = [0, 0];
      return;
    }

    const layoutBase = readLittleEndian(rom.prg, mapDataBase) + 0xc000;
    const graphicsBase = readLittleEndian(rom.prg, mapDataBase + 2) + 0xc000;
    const entrancesBase = readLittleEndian(rom.prg, mapDataBase + 4) + 0xc000;
    const exitsBase = readLittleEndian(rom.prg, mapDataBase + 6) + 0xc000;
    const flagsBase = readLittleEndian(rom.prg, mapDataBase + 8) + 0xc000;

    // Read the exits first so that we can determine if there's entrance/pits
    // metadata encoded at the end.
    let hasPits = this.used && layoutBase !== mapDataBase + 10;
    let entranceLen = exitsBase - entrancesBase;
    this.exits = (() => {
      const exits = [];
      let i = exitsBase;
      while (!(rom.prg[i] & 0x80)) {
        // NOTE: set dest to FF to disable an exit (it's an invalid location anyway)
        if (rom.prg[i + 2] != 0xff) {
          exits.push(Exit.from(rom.prg, i));
        }
        i += 4;
      }
      if (rom.prg[i] !== 0xff) {
        hasPits = !!(rom.prg[i] & 0x40);
        entranceLen = (rom.prg[i] & 0x1f) << 2;
      }
      return exits;
    })();

    // TODO - these heuristics will not work to re-read the locations.
    //      - we can look at the order: if the data is BEFORE the pointers
    //        then we're in a rewritten state; in that case, we need to simply
    //        find all refs and max...?
    //      - can we read these parts lazily?
    const pitsBase =
        !hasPits ? 0 : readLittleEndian(rom.prg, mapDataBase + 10) + 0xc000;

    this.bgm = this.originalBgm = rom.prg[layoutBase];
    this.layoutWidth = rom.prg[layoutBase + 1];
    this.layoutHeight = rom.prg[layoutBase + 2];
    this.animation = rom.prg[layoutBase + 3];
    // this.extended = rom.prg[layoutBase + 4];
    const extended = rom.prg[layoutBase + 4] ? 0x100 : 0;
    this.screens = seq(
        this.height,
        y => tuple(rom.prg, layoutBase + 5 + y * this.width, this.width)
                 .map(s => extended | s));
    this.tilePalettes = tuple<number>(rom.prg, graphicsBase, 3);
    this.originalTilePalettes = tuple(this.tilePalettes, 0, 3);
    this.tileset = rom.prg[graphicsBase + 3];
    this.tileEffects = rom.prg[graphicsBase + 4];
    this.tilePatterns = tuple(rom.prg, graphicsBase + 5, 2);

    this.entrances =
      group(4, rom.prg.slice(entrancesBase, entrancesBase + entranceLen),
            x => Entrance.from(x));
    this.flags = varSlice(rom.prg, flagsBase, 2, 0xff, Infinity,
                          x => Flag.from(x));
    this.pits = pitsBase ? varSlice(rom.prg, pitsBase, 4, 0xff, Infinity,
                                    x => Pit.from(x)) : [];

    const npcDataBase = readLittleEndian(rom.prg, this.npcDataPointer) + 0x10000;
    const hasSpawns = npcDataBase !== 0x10000;
    this.spritePalettes =
        hasSpawns ? tuple(rom.prg, npcDataBase + 1, 2) : [0, 0];
    this.spritePatterns =
        hasSpawns ? tuple(rom.prg, npcDataBase + 3, 2) : [0, 0];
    this.spawns =
        hasSpawns ? varSlice(rom.prg, npcDataBase + 5, 4, 0xff, Infinity,
                             x => Spawn.from(x)) : [];
  }

  set meta(meta: Metalocation) {
    this._meta = meta;
  }

  get meta(): Metalocation {
    if (!this._meta) this._meta = Metalocation.of(this);
    return this._meta;
  }

  get name(): string {
    return this.data.name;
  }

  get mapDataPointer(): number {
    if (this.id < 0) throw new Error(`no mapdata pointer for ${this.name}`);
    return 0x14300 + (this.id << 1);
  }

  get npcDataPointer(): number {
    if (this.id < 0) throw new Error(`no npcdata pointer for ${this.name}`);
    return 0x19201 + (this.id << 1);
  }

  get hasSpawns(): boolean {
    return this.spawns.length > 0;
  }

  // // Offset to OR with screen IDs.
  // get screenPage(): number {
  //   if (!this.rom.compressedMapData) return this.extended ? 0x100 : 0;
  //   return this.extended << 8;
  // }

  mapPlane(): number {
    const set = new Set<number>();
    for (const row of this.screens) {
      for (const s of row) {
        set.add(s >>> 8);
      }
    }
    if (set.size !== 1) {
      throw new Error(`Non-unique screen page: ${[...set].join(', ')}`);
    }
    return set[Symbol.iterator]().next().value;
  }

  isShop(): boolean {
    //return this.rom.shops.findIndex(s => s.location === this.id) >= 0;
    if (this._isShop == null) {
      this._isShop = this.rom.shops.findIndex(s => s.location === this.id) >= 0;
    }
    return this._isShop;
  }

  //setIsShop(isShop: boolean) { this._isShop = isShop; }

  spawn(id: number): Spawn {
    const spawn = this.spawns[id - 0xd];
    if (!spawn) throw new Error(`Expected spawn $${hex(id)}`);
    return spawn;
  }

  get width(): number { return this.layoutWidth + 1; }
  set width(width: number) { this.layoutWidth = width - 1; }

  get height(): number { return this.layoutHeight + 1; }
  set height(height: number) { this.layoutHeight = height - 1; }

  findOrAddEntrance(screen: number, coord: number): number {
    for (let i = 0; i < this.entrances.length; i++) {
      const entrance = this.entrances[i];
      if (entrance.screen === screen && entrance.coord === coord) return i;
    }
    this.entrances.push(Entrance.of({screen, coord}));
    return this.entrances.length - 1;
  }

  // monsters() {
  //   if (!this.spawns) return [];
  //   return this.spawns.flatMap(
  //     ([,, type, id], slot) =>
  //       type & 7 || !this.rom.spawns[id + 0x50] ? [] : [
  //         [this.id,
  //          slot + 0x0d,
  //          type & 0x80 ? 1 : 0,
  //          id + 0x50,
  //          this.spritePatterns[type & 0x80 ? 1 : 0],
  //          this.rom.spawns[id + 0x50].palettes()[0],
  //          this.spritePalettes[this.rom.spawns[id + 0x50].palettes()[0] - 2],
  //         ]]);
  // }

  assemble(a: Assembler) {
    if (!this.used) return;
    const id = this.id.toString(16).padStart(2, '0');
    // const $layout = `Layout_${id}`;
    // const $graphics = `Graphics_${id}`;
    // const $entrances = `Entrances_${id}`;
    // const $exits = `Exits_${id}`;
    // const $flags = `Flags_${id}`;
    // const $pits = `Pits_${id}`;
    // const $mapdata = `MapData_${id}`;
    // const $npcdata = `NpcData_${id}`;

    const spritePal = this.spawns.length ? this.spritePalettes : [0xff, 0xff];
    const spritePat = this.spawns.length ? this.spritePatterns : [0xff, 0xff];
    const mapData: Expr[] = [];
    // write NPC data first, if present...
    const npcData = [0, ...spritePal, ...spritePat,
                     ...concatIterables(this.spawns), 0xff];
    a.segment('0c', '0d');
    a.reloc(`NpcData_${id}`);
    const $npcData = a.pc();
    a.byte(...npcData);
    a.org(0x9201 + (this.id << 1), `NpcData_${id}_Ptr`);
    a.word($npcData);

    // wite mapdata
    a.segment('0a', '0b');
    //const ext = new Set(this.screens.map(s => s >> 8));
    const screens = [];
    for (const s of concatIterables(this.screens)) {
      screens.push(s & 0xff);
    }
    const layout = this.rom.compressedMapData ? [
      this.bgm,
      // Compressed version: yx in one byte, ext+anim in one byte
      this.layoutHeight << 4 | this.layoutWidth,
      this.mapPlane() << 2 | this.animation, ...screens,
    ] : [
      this.bgm, this.layoutWidth, this.layoutHeight,
      this.animation, this.mapPlane() ? 0x80 : 0, ...screens,
    ];
    a.reloc(`MapData_${id}_Layout`);
    const $layout = a.pc();
    a.byte(...layout);
    mapData.push($layout);

    a.reloc(`MapData_${id}_Graphics`);
    const $graphics = a.pc();
    a.byte(...this.tilePalettes,
           this.tileset, this.tileEffects,
           ...this.tilePatterns);
    mapData.push($graphics);

    // Quick sanity check: if an entrance/exit is below the HUD on a
    // non-vertically scrolling map, then we need to move it up
    // NOTE: this is idempotent..
    if (this.height === 1) {
      for (const entrance of this.entrances) {
        if (!entrance.used) continue;
        if (entrance.y > 0xbf) entrance.y = 0xbf;
      }
      for (const exit of this.exits) {
        if (exit.yt > 0x0c) exit.yt = 0x0c;
      }
    }
    a.reloc(`MapData_${id}_Entrances`);
    const $entrances = a.pc();
    a.byte(...concatIterables(this.entrances));
    mapData.push($entrances);

    a.reloc(`MapData_${id}_Exits`);
    const $exits = a.pc();
    a.byte(...concatIterables(this.exits),
           0x80 | (this.pits.length ? 0x40 : 0) | this.entrances.length);
    mapData.push($exits);

    a.reloc(`MapData_${id}_Flags`);
    const $flags = a.pc();
    a.byte(...concatIterables(this.flags), 0xff);
    mapData.push($flags);

    const pits = concatIterables(this.pits);
    if (pits.length) {
      a.reloc(`MapData_${id}_Pits`);
      const $pits = a.pc();
      a.byte(...pits);
      mapData.push($pits);
    }

    a.reloc(`MapData_${id}`);
    const $mapData = a.pc();
    a.word(...mapData);

    a.org(0x8300 + (this.id << 1), `MapData_${id}_Ptr`);
    a.word($mapData);

    // If this is a boss room, write the restoration.
    const bossId = this.bossId();
    if (bossId != null && this.id !== 0x5f) { // don't restore dyna
      // This table should restore pat0 but not pat1
      let pats = [spritePat[0], undefined];
      if (this.id === 0xa6) pats = [0x53, 0x50]; // draygon 2
      const bossBase = this.rom.bossKills[bossId].base;
      // Set the "restore music" byte for the boss, but if it's Draygon 2, set
      // it to zero since no music is actually playing, and if the music in the
      // teleporter room happens to be the same as the music in the crypt, then
      // resetting to that means it will just remain silent, and not restart.
      const restoreBgm = this.id === 0xa6 ? 0 : this.bgm;
      const bossRestore = [
        ,,, restoreBgm,,
        ...this.tilePalettes,,,, this.spritePalettes[0],,
        ,,,, /*pats[0]*/, /*pats[1]*/,
        this.animation,
      ];
      const [] = [pats]; // avoid error

      // if (readLittleEndian(writer.rom, bossBase) === 0xba98) {
      //   // escape animation: don't clobber patterns yet?
      // }
      a.segment('0f');
      for (let j = 0; j < bossRestore.length; j++) {
        const restored = bossRestore[j];
        if (restored == null) continue;
        a.org(bossBase + j, `Boss_${bossId}_${j}`);
        a.byte(restored);
      }
      // later spot for pal3 and pat1 *after* explosion
      const bossBase2 = 0xb7c1 + 5 * bossId; // 1f7c1
      a.org(bossBase2, `Boss_${bossId}_Post`);
      a.byte(spritePal[1]);
      // NOTE: This ruins the treasure chest.
      // TODO - add some asm after a chest is cleared to reload patterns?
      // Another option would be to add a location-specific contraint to be
      // whatever the boss 
      //writer.rom[bossBase2 + 1] = this.spritePatterns[1];
    }
  }

  allScreens(): Set<Screen> {
    const screens = new Set<Screen>();
    for (const row of this.screens) {
      for (const screen of row) {
        screens.add(this.rom.screens[screen]);
      }
    }
    return screens;
  }

  bossId(): number | undefined {
    for (let i = 0; i < 0x0e; i++) {
      if (this.rom.prg[0x1f95d + i] === this.id) return i;
    }
    return undefined;
  }

  // neighbors(joinNexuses: boolean = false): Set<Location> {
  //   const out = new Set<Location>();
  //   const addNeighbors = (l: Location) => {
  //     for (const exit of l.exits) {
  //       const id = exit.dest;
  //       const neighbor = this.rom.locations[id];
  //       if (neighbor && neighbor.used &&
  //           neighbor !== this && !out.has(neighbor)) {
  //         out.add(neighbor);
  //         if (joinNexuses && NEXUSES[neighbor.key]) {
  //           addNeighbors(neighbor);
  //         }
  //       }
  //     }
  //   }
  //   addNeighbors(this);
  //   return out;
  // }

  hasDolphin(): boolean {
    return this.id === 0x60 || this.id === 0x64 || this.id === 0x68;
  }

  /**
   * @return Map of tiles ($YXyx) reachable from any entrance to
   * unflagged tileeffects.
   */
  reachableTiles(fly = false): Map<number, number> {
    // TODO - args for (1) use non-2ef flags, (2) only from given entrance/tile
    // Dolphin makes NO_WALK okay for some levels.
    if (this.hasDolphin()) fly = true;
    // Take into account the tileset and flags but not any overlay.
    const exits = new Set(this.exits.map(exit => exit.screen << 8 | exit.tile));
    const uf = new UnionFind<number>();
    const tileset = this.rom.tilesets[this.tileset];
    const tileEffects = this.rom.tileEffects[this.tileEffects - 0xb3];
    const passable = new Set<number>();
    
    for (let y = 0; y < this.height; y++) {
      const row = this.screens[y];
      for (let x = 0; x < this.width; x++) {
        const screen = this.rom.screens[row[x]];
        const pos = y << 4 | x;
        const flag = this.flags.find(f => f.screen === pos);
        for (let t = 0; t < 0xf0; t++) {
          const tileId = pos << 8 | t;
          if (exits.has(tileId)) continue; // don't go past exits
          let tile = screen.tiles[t];
          // flag 2ef is "always on", don't even bother making it conditional.
          let effects = tileEffects.effects[tile];
          let blocked = fly ? effects & 0x04 : effects & 0x06;
          if (flag && blocked && tile < 0x20 && tileset.alternates[tile] != tile) {
            tile = tileset.alternates[tile];
            effects = tileEffects.effects[tile];
            blocked = fly ? effects & 0x04 : effects & 0x06;
          }
          if (!blocked) passable.add(tileId);
        }
      }
    }

    for (let t of passable) {
      const right = (t & 0x0f) === 0x0f ? t + 0xf1 : t + 1;
      if (passable.has(right)) uf.union([t, right]);
      const below = (t & 0xf0) === 0xe0 ? t + 0xf20 : t + 16;
      if (passable.has(below)) uf.union([t, below]);
    }

    const map = uf.map();
    const sets = new Set<Set<number>>();
    for (const entrance of this.entrances) {
      if (!entrance.used) continue;
      const id = entrance.screen << 8 | entrance.tile;
      // NOTE: map should always have id, but bogus entrances
      // (e.g. Goa Valley entrance 2) can cause problems.
      sets.add(map.get(id) || new Set());
    }

    const out = new Map<number, number>();
    for (const set of sets) {
      for (const t of set) {
        const scr = this.screens[t >>> 12][(t >>> 8) & 0x0f];
        const screen = this.rom.screens[scr];
        out.set(t, tileEffects.effects[screen.tiles[t & 0xff]]);
      }
    }
    return out;
  }

  /** Safer version of the below? */
  screenMover(): (orig: number, repl: number) => void {
    const map = new DefaultMap<number, Array<{screen: number}>>(() => []);
    const objs =
        iters.concat<{screen: number}>(this.spawns, this.exits, this.entrances);
    for (const obj of objs) {
      map.get(obj.screen).push(obj);
    }
    return (orig: number, repl: number) => {
      for (const obj of map.get(orig)) {
        obj.screen = repl;
      }
    };
  }

  /**
   * Moves all spawns, entrances, and exits.
   * @param orig YX of the original screen.
   * @param repl YX of the equivalent replacement screen.
   */
  moveScreen(orig: number, repl: number): void {
    const objs =
        iters.concat<{screen: number}>(this.spawns, this.exits, this.entrances);
    for (const obj of objs) {
      if (obj.screen === orig) obj.screen = repl;
    }
  }

  // TODO - factor this out into a separate class?
  //   - holds metadata about map tiles in general?
  //   - need to figure out what to do with pits...
  monsterPlacer(random: Random): (m: Monster) => number | undefined {
    // If there's a boss screen, exclude it from getting enemies.
    const boss = this.data.bossScreen;
    // Start with list of reachable tiles.
    const reachable = this.reachableTiles(false);
    // Do a breadth-first search of all tiles to find "distance" (1-norm).
    const far = new Map<number, number>([...reachable.keys()].map(x => [x, 0]));
    const normal: number[] = []; // reachable, not slope or water
    const moths: number[] = [];  // distance ∈ 3..7
    const birds: number[] = [];  // distance > 12
    const plants: number[] = []; // distance ∈ 2..4
    const placed: Array<[Monster, number, number, number]> = [];
    const normalTerrainMask = this.hasDolphin() ? 0x25 : 0x27;
    for (const [t, distance] of far) {
      const scr = this.screens[t >>> 12][(t >>> 8) & 0xf];
      if (scr === boss) continue;
      for (const n of neighbors(t, this.width, this.height)) {
        if (far.has(n)) continue;
        far.set(n, distance + 1);
      }
      if (!distance && !(reachable.get(t)! & normalTerrainMask)) normal.push(t);
      if (this.id === 0x1a) {
        // Special-case the swamp for plant placement
        if (this.rom.screens[scr].tiles[t & 0xff] === 0xf0) plants.push(t);
      } else {
        if (distance >= 2 && distance <= 4) plants.push(t);
      }
      if (distance >= 3 && distance <= 7) moths.push(t);
      if (distance >= 12) birds.push(t);
      // TODO - special-case swamp for plant locations?
    }
    // We now know all the possible places to place things.
    //  - NOTE: still need to move chests to dead ends, etc?
    return (m: Monster) => {
      // check for placement.
      const placement = m.placement();
      const pool = [...(placement === 'normal' ? normal :
                        placement === 'moth' ? moths :
                        placement === 'bird' ? birds :
                        placement === 'plant' ? plants :
                        assertNever(placement))]
      POOL:
      while (pool.length) {
        const i = random.nextInt(pool.length);
        const [pos] = pool.splice(i, 1);

        const x = (pos & 0xf00) >>> 4 | (pos & 0xf);
        const y = (pos & 0xf000) >>> 8 | (pos & 0xf0) >>> 4;
        const r = m.clearance();

        // test distance from other enemies.
        for (const [, x1, y1, r1] of placed) {
          const z2 = ((y - y1) ** 2 + (x - x1) ** 2);
          if (z2 < (r + r1) ** 2) continue POOL;
        }
        // test distance from entrances.
        for (const {x: x1, y: y1, used} of this.entrances) {
          if (!used) continue;
          const z2 = ((y - (y1 >> 4)) ** 2 + (x - (x1 >> 4)) ** 2);
          if (z2 < (r + 1) ** 2) continue POOL;
        }

        // Valid spot (still, how toa approximately *maximize* distances?)
        placed.push([m, x, y, r]);
        const scr = (y & 0xf0) | (x & 0xf0) >>> 4;
        const tile = (y & 0x0f) << 4 | (x & 0x0f);
        return scr << 8 | tile;
      }
      return undefined;
    }
  }
  // TODO - allow less randomness for certain cases, e.g. top of north sabre or
  // appropriate side of cordel.

  /** @return {!Set<number>} */
  // allTiles() {
  //   const tiles = new Set();
  //   for (const screen of this.screens) {
  //     for (const tile of screen.allTiles()) {
  //       tiles.add(tile);
  //     }
  //   }
  //   return tiles;
  // }


  // TODO - use metascreen for this later
  resizeScreens(top: number, left: number, bottom: number, right: number,
                fill = 0) {
    const newWidth = this.width + left + right;
    const newHeight = this.height + top + bottom;
    const newScreens = Array.from({length: newHeight}, (_, y) => {
      y -= top;
      return Array.from({length: newWidth}, (_, x) => {
        x -= left;
        if (y < 0 || x < 0 || y >= this.height || x >= this.width) return fill;
        return this.screens[y][x];
      });
    });
    this.width = newWidth;
    this.height = newHeight;
    this.screens = newScreens;
    // TODO - if any of these go negative, we're in trouble...
    // Probably the best bet would be to put a check in the setter?
    for (const f of this.flags) {
      f.xs += left;
      f.ys += top;
    }
    for (const p of this.pits) {
      p.fromXs += left;
      p.fromYs += top;
    }
    for (const s of [...this.spawns, ...this.exits]) {
      s.xt += 16 * left;
      s.yt += 16 * top;
    }
    for (const e of this.entrances) {
      if (!e.used) continue;
      e.x += 256 * left;
      e.y += 256 * top;
    }
  }

  /** NOTE: if a screen is negative, sets the AlwaysTrue flag. */
  writeScreens2d(start: number,
                 data: ReadonlyArray<ReadonlyArray<number | null>>) {
    const x0 = start & 0xf;
    const y0 = start >>> 4;
    for (let y = 0; y < data.length; y++) {
      const row = data[y];
      for (let x = 0; x < row.length; x++) {
        let tile = row[x];
        if (tile == null) continue;
        if (tile < 0) {
          tile = ~tile;
          this.flags.push(Flag.of({screen: (y0 + y) << 4 | (x0 + x),
                                   flag: this.rom.flags.AlwaysTrue.id}));
        }
        this.screens[y0 + y][x0 + x] = tile;
      }
    }
  }

  // Connect two screens via entrances.
  // Assumes exits and entrances are completely absent.
  // Screen IDs must be in screenExits.
  // SUPER HACKY - if pos is negative, use complement and alternate stairs.
  connect(pos: number, that: Location, thatPos: number) {
    const thisAlt = pos < 0 ? 0x100 : 0;
    const thatAlt = thatPos < 0 ? 0x100 : 0;
    pos = pos < 0 ? ~pos : pos;
    thatPos = thatPos < 0 ? ~thatPos : thatPos;
    const thisY = pos >>> 4;
    const thisX = pos & 0xf;
    const thatY = thatPos >>> 4;
    const thatX = thatPos & 0xf;
    const thisTile = this.screens[thisY][thisX];
    const thatTile = that.screens[thatY][thatX];
    const [thisEntrance, thisExits] = screenExits[thisAlt | thisTile];
    const [thatEntrance, thatExits] = screenExits[thatAlt | thatTile];
    const thisEntranceIndex = this.entrances.length;
    const thatEntranceIndex = that.entrances.length;
    this.entrances.push(Entrance.of({y: thisY << 8 | thisEntrance >>> 8,
                                     x: thisX << 8 | thisEntrance & 0xff}));
    that.entrances.push(Entrance.of({y: thatY << 8 | thatEntrance >>> 8,
                                     x: thatX << 8 | thatEntrance & 0xff}));
    for (const exit of thisExits) {
      this.exits.push(Exit.of({screen: pos, tile: exit,
                               dest: that.id, entrance: thatEntranceIndex}));
    }
    for (const exit of thatExits) {
      that.exits.push(Exit.of({screen: thatPos, tile: exit,
                               dest: this.id, entrance: thisEntranceIndex}));
    }
  }

  neighborForEntrance(entranceId: number): Location {
    const entrance = this.entrances[entranceId];
    if (!entrance) throw new Error(`no entrance ${hex(this.id)}:${entranceId}`);
    for (const exit of this.exits) {
      if (exit.screen !== entrance.screen) continue;
      const dx = Math.abs(exit.x - entrance.x);
      const dy = Math.abs(exit.y - entrance.y);
      if (dx < 24 && dy < 24) return this.rom.locations[exit.dest];
    }
    throw new Error(`no exit found near ${hex(this.id)}:${entranceId}`);
  }

  toString() {
    return `${super.toString()} ${this.name}`;
  }
}

// TODO - move to a better-organized dedicated "geometry" module?
function neighbors(tile: number, width: number, height: number): number[] {
  const out = [];
  const y = tile & 0xf0f0;
  const x = tile & 0x0f0f;
  if (y < ((height - 1) << 12 | 0xe0)) {
    out.push((tile & 0xf0) === 0xe0 ? tile + 0x0f20 : tile + 16);
  }
  if (y) {
    out.push((tile & 0xf0) === 0x00 ? tile - 0x0f20 : tile - 16);
  }
  if (x < ((width - 1) << 8 | 0x0f)) {
    out.push((tile & 0x0f) === 0x0f ? tile + 0x00f1 : tile + 1);
  }
  if (x) {
    out.push((tile & 0x0f) === 0x00 ? tile - 0x00f1 : tile - 1);
  }
  return out;
}

// very simple version of what we're doing with metascreens
const screenExits: {[id: number]: readonly [number, readonly [number, number]]} = {
  0x15: [0x90_a0, [0x89, 0x8a]], // cave on left boundary
  0x19: [0x60_90, [0x58, 0x59]], // cave on right boundary (not on grass)
  0x96: [0x40_30, [0x32, 0x33]], // up stair from left
  0x97: [0xaf_30, [0xb2, 0xb3]], // down stair from left
  0x98: [0x40_d0, [0x3c, 0x3d]], // up stair from right
  0x99: [0xaf_d0, [0xbc, 0xbd]], // down stair from right
  0x9a: [0x1f_80, [0x27, 0x28]], // down stair (double - just use down!)
  0x9e: [0xdf_80, [0xe7, 0xe8]], // bottom edge
  0xc1: [0x50_a0, [0x49, 0x4a]], // cave on top boundary
  0xc2: [0x60_b0, [0x5a, 0x5b]], // cave on bottom-right boundary
  0x19a: [0xd0_80, [0xc7, 0xc8]], // up stair on double
};

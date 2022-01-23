import {Rom} from '../rom.js';
import {Location} from '../rom/location.js';

export function compressMapData(rom: Rom) {
  if (rom.compressedMapData) return;
  rom.compressedMapData = true;
  // for (const location of rom.locations) {
  //   if (location.extended) location.extended = 7;
  // }
  // Rearrange the screens - rom.screens is now a sparse array.
  // rom.screens[0xa00] = rom.screens[0x100];
  // rom.screens[0xa01] = rom.screens[0x101];
  // rom.screens[0xa02] = rom.screens[0x102];
  // delete rom.screens[0x100];
  // delete rom.screens[0x101];
  // delete rom.screens[0x102];

  for (let i = 0; i < 3; i++) {
    //this.screens[0xa00 | i] = this.screens[0x100 | i];
    rom.metascreens.renumber(0x100 | i, 0x140 | i);
    delete rom.screens[0x100 | i];
  }

  // TODO - find all refs to ".extended" in the source code and
  //        update with a more accurate approach
  // TODO - find all refs to ".screens" in the source code and
  //        make sure they can handle sparse arrays
  // TODO - update location.write
  // TODO - update screens.write

}

export function moveScreensIntoExpandedRom(rom: Rom) {
  if (!rom.compressedMapData) throw new Error(`Must compress first`);
  const {
    grass, // 80
    town, // 84
    cave, dolphinCave, // 88
    pyramid, // 8c
    river, // 90
    sea, lime, mountain, // 94
    shrine, // 98
    desert, mountainRiver, // 9c
    swamp, house, // a0
    fortress, labyrinth, // a4
    iceCave, // a8
    tower, // ac
  } = rom.metatilesets;

  // TODO - split up the shared town screens

  rom.moveScreens([swamp], 4);
  rom.moveScreens([house], 4);
  rom.moveScreens([town], 4);
  rom.moveScreens([lime], 4);
  rom.moveScreens([shrine], 4);
  rom.moveScreens([tower], 4);
  rom.moveScreens([mountain, mountainRiver], 4);
  rom.moveScreens([cave, pyramid, fortress, labyrinth, iceCave], 5);
  const [] = [sea, dolphinCave, grass, river, desert];

  // TODO - different condition for this pass?
  splitDeadEnds(rom);
}

function splitDeadEnds(rom: Rom) {
  const {
    caveEmpty,
    deadEndE,
    deadEndN,
    deadEndN_stairs,
    deadEndS,
    deadEndS_stairs,
    deadEndW,
    riverCave_deadEndE,
    riverCave_deadEndN,
    riverCave_deadEndS,
    riverCave_deadEndW,
    riverCaveN_bridge,
    riverCaveS_bridge,
    wideHall_deadEndN,
    wideHall_deadEndS,
  } = rom.metascreens;
  const empty = caveEmpty.screen.tiles[0];
  deadEndN_stairs.split().screen.tiles.fill(empty, 0x80);
  deadEndS_stairs.split().screen.tiles.fill(empty, 0, 0x80);
  deadEndN.split().screen.tiles.fill(empty, 0x80);
  deadEndS.split().screen.tiles.fill(empty, 0, 0x80);
  deadEndE.split().screen.set2d(0x00, repeat(15, repeat(6, empty)));
  deadEndW.split().screen.set2d(0x0a, repeat(15, repeat(6, empty)));
  wideHall_deadEndN.split().screen.tiles.fill(empty, 0xa0);
  wideHall_deadEndS.split().screen.tiles.fill(empty, 0, 0x70);
  riverCave_deadEndN.split().screen.tiles.fill(empty, 0x80);
  riverCave_deadEndS.split().screen.tiles.fill(empty, 0, 0x80);
  riverCave_deadEndE.split().screen.set2d(0x00, repeat(15, repeat(6, empty)));
  riverCave_deadEndW.split().screen.set2d(0x0a, repeat(15, repeat(6, empty)));
  riverCaveN_bridge.split().screen.tiles.fill(empty, 0x60);
  riverCaveS_bridge.split().screen.tiles.fill(empty, 0, 0x60);
}

function repeat<T>(length: number, x: T): T[] {
  return Array.from({length}, () => x);
}
  
const [] = [Location];

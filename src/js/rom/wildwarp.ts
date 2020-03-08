import {Module} from '../asm/module.js';
import {Rom} from '../rom.js';
import {Address, Segment, tuple} from './util.js';

// List of wild warp locations.
export class WildWarp {

  locations: number[];

  constructor(readonly rom: Rom) {
    this.locations = tuple(rom.prg, ADDRESS.offset, COUNT);
  }

  write(): Module[] {
    const a = this.rom.assembler();
    ADDRESS.loc(a);
    a.label('WildWarpLocations');
    a.byte(...this.locations);
    a.org(0xcbd9);
    a.instruction('lda', 'WildWarpLocations,y');
    return [a.module()];
  }
}

const ADDRESS = Address.of(Segment.$fe, 0xcbec);
const COUNT = 16;

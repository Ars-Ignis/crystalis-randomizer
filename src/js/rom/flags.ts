import {Rom} from '../rom.js';
import {Location} from './location.js';
import {Npc} from './npc.js';
import {Trigger} from './trigger.js';
import { hex, hex3, upperCamelToSpaces, Writable} from './util.js';

const FLAG = Symbol();

interface FlagData {
  fixed?: boolean;
  obsolete?: (ctx: FlagContext) => number;
}
interface FlagContext {
  trigger?: Trigger;
  location?: Location;
  npc?: Npc;
  spawn?: number;
  index?: number;
  dialog?: boolean;
  set?: boolean;
  //dialog?: LocalDialog|GlobalDialog;
  //index?: number;
  //condition?: boolean;
}

export class Flag {

  fixed: boolean;
  obsolete?: (ctx: FlagContext) => number;

  constructor(readonly flags: Flags,
              readonly name: string,
              readonly id: number,
              data: FlagData) {
    this.fixed = data.fixed || false;
    this.obsolete = data.obsolete;
  }
}

function obsolete(obsolete: number | ((ctx: FlagContext) => number)): Flag {
  if (typeof obsolete === 'number') obsolete = (o => () => o)(obsolete);
  return {obsolete, [FLAG]: true} as any;
}
function fixed(id: number): Flag {
  return {id, fixed: true, [FLAG]: true} as any;
}
function movable(id: number): Flag {
  return {id, [FLAG]: true} as any;
}
function dialogProgression(name: string): Flag {
  return {name, [FLAG]: true} as any;
}
function dialogToggle(name: string): Flag {
  return {name, [FLAG]: true} as any;
}

// obsolete flags - delete the sets (should never be a clear)
//                - replace the checks with the replacement

// --- maybe obsolete flags can have different replacements in
//     different contexts?
// --- in particular, itemgets shouldn't carry 1xx flags?


/** Tracks used and unused flags. */
export class Flags {

  [id: number]: Flag;

  // 00x
  0x000 = fixed(0x000);
  0x001 = fixed(0x001);
  0x002 = fixed(0x002);
  0x003 = fixed(0x003);
  0x004 = fixed(0x004);
  0x005 = fixed(0x005);
  0x006 = fixed(0x006);
  0x007 = fixed(0x007);
  0x008 = fixed(0x008);
  0x009 = fixed(0x009);
  UsedWindmillKey = fixed(0x00a);
  0x00b = obsolete(0x100); // check: sword of wind / talked to leaf elder
  0x00c = dialogToggle('Leaf villager');
  LeafVillagersRescued = movable(0x00d);
  0x00e = obsolete((s) => {
    if (s.trigger?.id === 0x85) return 0x143; // check: telepathy / stom
    return 0x243; // item: telepathy
  });
  WokeWindmillGuard = movable(0x00f);

  // 01x
  TurnedInKirisaPlant = movable(0x010);
  0x011 = dialogProgression('Welcomed to Amazones');
  0x012 = dialogProgression('Treasure hunter dead');
  0x013 = obsolete(0x138); // check: broken statue / sabera 1
  // unused 014, 015
  0x016 = dialogProgression('Portoa queen Rage hint');
  0x017 = obsolete(0x102); // chest: sword of water
  EnteredUndergroundChannel = movable(0x018);
  0x019 = dialogToggle('Portoa queen tired of talking');
  0x01a = dialogProgression('Initial talk with Portoa queen');
  MesiaRecording = movable(0x01b);
  // unused 01c
  0x01d = dialogProgression('Fortune teller initial');
  QueenRevealed = movable(0x01e);
  0x01f = obsolete(0x209); // item: ball of water

  // 02x
  0x020 = dialogToggle('Queen not in throne room');
  ReturnedFogLamp = movable(0x021);
  0x022 = dialogProgression('Sahara elder');
  0x023 = dialogProgression('Sahara elder daughter');
  0x024 = obsolete(0x13d); // check: ivory statue / karmine
  HealedDolphin = movable(0x025);
  0x026 = obsolete(0x2fd); // warp: shyron
  ShyronMassacre = fixed(0x027); // hardcoded in preshuffle to fix dead sprites
  ChangeWoman = fixed(0x028);
  ChangeAkahana = fixed(0x029);
  ChangeSoldier = fixed(0x02a);
  ChangeStom = fixed(0x02b);
  // unused 02c
  0x02d = dialogProgression('Shyron sages');
  0x02e = obsolete(0x12d); // check: deo's pendant
  // unused 02f

  // 03x
  // unused 030
  0x031 = dialogProgression('Zombie town');
  0x032 = obsolete(0x137); // check: eye glasses
  // unused 033
  0x034 = dialogProgression('Akahana in waterfall cave'); // ???
  CuredAkahana = movable(0x035);
  0x036 = dialogProgression('Akahana Shyron');
  0x037 = obsolete(0x142); // check: paralysis
  LeafAbduction = movable(0x038); // one-way latch
  0x039 = obsolete(0x141); // check: refresh
  TalkedToZebuInCave = movable(0x03a);
  TalkedToZebuInShyron = movable(0x03b);
  0x03c = obsolete(0x13b); // chest: love pendant
  0x03d = dialogProgression('Asina in Shyron temple');
  FoundKensuInDanceHall = movable(0x03e);
  0x03f = obsolete((s) => {
    if (s.trigger?.id === 0xba) return 0x244 // item: teleport
    return 0x144; // check: teleport
  });

  // 04x
  0x040 = dialogProgression('Tornel in Shyron temple');
  0x041 = obsolete(0x107); // check: ball of fire / insect
  // unused 042
  0x043 = dialogProgression('Oak');
  0x044 = obsolete(0x107); // check: ball of fire / insect
  RescuedChild = fixed(0x045); // hardcoded $3e7d5
  // unused 046
  RescuedLeafElder = movable(0x047);
  0x048 = dialogProgression('Treasure hunter embarked');
  0x049 = obsolete(0x101); // check: sword of fire
  0x04a = dialogProgression('Boat owner');
  0x04b = dialogToggle('Shyron sick men');
  0x04c = dialogToggle('Shyron training men 1');
  0x04d = dialogToggle('Shyron training men 2');
  0x04e = obsolete(0x106); // chest: tornado bracelet
  0x04f = obsolete(0x12b); // check: warrior ring

  // 05x
  GivenStatueToAkahana = movable(0x050); // give it back if unsuccessful?
  0x051 = obsolete(0x146); // check: barrier / angry sea
  TalkedToDwarfMother = movable(0x052);
  LeadingChild = fixed(0x053); // hardcoded $3e7c4 and following
  // unused 054
  0x055 = dialogProgression('Zebu rescued');
  0x056 = dialogProgression('Tornel rescued');
  0x057 = dialogProgression('Asina rescued');
  // unused 058 .. 05a
  MtSabreGuardsDespawned = movable(0x05b);
  // unused 05c, 05d
  0x05e = obsolete(0x28d); // draygon 2
  0x05f = obsolete(0x203); // item: sword of thunder
  // TODO - fix up the NPC spawn and trigger conditions in Shyron.
  // Maybe just remove the cutscene entirely?

  // 06x
  // unused 060
  TalkedToStomInSwan = movable(0x061);
  // unused 062  // obsolete(0x151); // chest: sacred shield
  0x063 = obsolete(0x147); // check: change
  // unused 064
  SwanGateOpened = movable(~0x064);
  CuredKensu = movable(0x065);
  // unused 066
  0x067 = obsolete(0x10b); // check: ball of thunder / mado 1
  ForgedCrystalis = movable(0x068);
  // unused 069
  StonedPeopleCured = movable(0x06a);
  // unused 06b
  0x06c = obsolete(0x11c); // check: psycho armor / draygon 1
  // unused 06d .. 06f
  CurrentlyRidingDolphin = fixed(~0x06e); // NOTE: added by rando

  // 07x
  ParalyzedKensuInTavern = fixed(0x070); // hardcoded in rando preshuffle.s
  ParalyzedKensuInDanceHall = fixed(0x071); // hardcoded in rando preshuffle.s
  FoundKensuInTavern = movable(0x072);
  0x073 = dialogProgression('Startled man in Leaf');
  // unused 074
  0x075 = obsolete(0x139); // check: glowing lamp
  0x076 = dialogProgression('Kensu in Goa');
  0x077 = obsolete(0x108); // check: flame bracelet / kelbesque 1
  0x078 = obsolete(0x10c); // chest: storm bracelet
  0x079 = obsolete(0x140); // check: bow of truth
  0x07a = obsolete(0x10a); // chest: blizzard bracelet
  // unused 07b, 07c
  0x07d = obsolete(0x13f); // chest: bow of sun
  0x07e = dialogProgression('Mt Sabre guards 1');
  0x07f = dialogProgression('Mt Sabre guards 2');

  AlarmFluteUsedOnce = fixed(0x76); // hardcoded: preshuffle.s PatchTradeInItem
  FluteOfLimeUsedOnce = fixed(0x77); // hardcoded: preshuffle.s PatchTradeInItem

  // 08x
  // unused 080, 081
  0x082 = obsolete(0x140); // check: bow of truth / azteca
  0x083 = dialogProgression('Rescued Leaf elder');
  0x084 = dialogToggle('Leaf villagers currently abducted');
  0x085 = dialogToggle('Leaf elder currently abducted');
  UsedBowOfTruth = movable(0x086);
  0x087 = obsolete(0x105); // chest: ball of wind
  0x088 = obsolete(0x132); // check: windmill key
  0x089 = dialogProgression('Dead Stom\'s girlfriend');
  0x08a = dialogProgression('Dead Stom');
  0x08b = obsolete(0x236); // item: shell flute
  0x08c = dialogProgression('Swan guards despawned');
  0x08d = obsolete(0x137); // check: eye glasses
  // unused 08e
  0x08f = obsolete(0x283); // event: calmed sea

  // 09x
  0x090 = dialogProgression('Stoned people gone');
  // unused 091
  0x092 = obsolete(0x128); // check: flute of lime
  // unused 093 .. 095
  0x096 = dialogToggle('Leaf elder daughter');
  0x097 = dialogToggle('Leaf villager');
  0x098 = dialogProgression('Nadare villager');
  // unused 099, 09a
  AbleToRideDolphin = movable(0x09b);
  0x09c = dialogToggle('Portoa queen going away');
  // unused 09d .. 09f

  // 0ax
  0x0a0 = obsolete(0x127); // check: insect flute
  // unused 0a1, 0a2
  0x0a3 = dialogToggle('Portoa queen/fortune teller');
  WokeKensuInLighthouse = movable(0x0a4);
  0x0a5 = obsolete(0x131); // check: alarm flute / zebu student
  0x0a6 = dialogProgression('Oak elder 1');
  0x0a7 = dialogToggle('Swan dancer');
  0x0a8 = dialogProgression('Oak elder 2');
  TalkedToLeafRabbit = movable(0x0a9);
  0x0aa = obsolete(0x11d); // chest: medical herb
  0x0ab = obsolete(0x150); // chest: medical herb
  // unused 0ac
  0x0ad = obsolete(0x152); // chest: medical herb
  0x0ae = obsolete(0x153); // chest: medical herb
  0x0af = obsolete(0x154); // chest: magic ring

  // 0bx
  0x0b0 = obsolete(0x155); // chest: medical herb
  0x0b1 = obsolete(0x156); // chest: medical herb
  0x0b2 = obsolete(0x157); // chest: medical herb
  0x0b3 = obsolete(0x158); // chest: magic ring
  0x0b4 = obsolete(0x159); // chest: medical herb
  0x0b5 = obsolete(0x15a); // chest: fruit of power
  0x0b6 = obsolete(0x11f); // chest: lysis plant
  0x0b7 = obsolete(0x15c); // chest: lysis plant
  0x0b8 = obsolete(0x15d); // chest: lysis plant
  0x0b9 = obsolete(0x11e); // chest: antidote
  0x0ba = obsolete(0x15e); // chest: antidote
  0x0bb = obsolete(0x15f); // chest: antidote
  0x0bc = obsolete(0x160); // chest: antidote
  0x0bd = obsolete(0x120); // chest: fruit of lime
  0x0be = obsolete(0x121); // chest: fruit of power
  0x0bf = obsolete(0x162); // chest: fruit of power

  // 0cx
  0x0c0 = obsolete(0x163); // chest: opel statue
  0x0c1 = obsolete(0x164); // chest: fruit of power
  0x0c2 = obsolete(0x122); // chest: magic ring
  0x0c3 = obsolete(0x165); // chest: magic ring
  0x0c4 = obsolete(0x166); // chest: fruit of repun
  0x0c5 = obsolete(0x16b); // chest: magic ring
  0x0c6 = obsolete(0x16c); // chest: magic ring
  0x0c7 = obsolete(0x123); // chest: fruit of repun
  0x0c8 = obsolete(0x124); // chest: warp boots
  0x0c9 = obsolete(0x16a); // chest: warp boots
  0x0ca = obsolete(0x13d); // check: ivory statue / karmine
  0x0cb = obsolete(0x12a); // chest: power ring
  0x0cc = obsolete(0x11c); // check: psycho armor / draygon 1
  0x0cd = obsolete(0x114); // chest: psycho shield
  0x0ce = obsolete(0x125); // chest: statue of onyx
  0x0cf = obsolete(0x133); // chest: key to prison
  
  // 0dx
  0x0d0 = obsolete(0x128); // check: flute of lime / queen
  0x0d1 = obsolete(0x135); // chest: fog lamp
  0x0d2 = obsolete(0x169); // chest: magic ring
  0x0d3 = obsolete(0x126); // chest: opel statue
  0x0d4 = obsolete(0x15b); // chest: flute of lime
  0x0d5 = dialogToggle('Portoa queen 1');
  0x0d6 = dialogToggle('Portoa queen 2');
  0x0d7 = dialogToggle('Portoa queen 3');
  0x0d8 = dialogProgression('Kensu rescued');
  0x0d9 = dialogToggle('Stoned pair');
  0x0da = dialogProgression('Kensu gone from tavern');
  0x0db = dialogToggle('In Sabera\'s trap');
  0x0dc = obsolete(0x16f); // chest: magic ring
  // unused 0dd
  0x0de = obsolete(0x12c); // chest: iron necklace
  0x0df = obsolete(0x11b); // chest: battle armor

  // 0ex
  0x0e0 = dialogProgression('Dead Akahana');
  // unused 0e1 .. 0e3
  0x0e4 = obsolete(0x13c); // chest: kirisa plant
  0x0e5 = obsolete(0x16e); // chest: warp boots
  0x0e6 = obsolete(0x16d); // chest: opel statue
  0x0e7 = obsolete(0x12f); // chest: leather boots
  0x0e8 = dialogProgression('Dead Shyron villager');
  0x0e9 = dialogProgression('Dead Shyron guard');
  0x0ea = dialogProgression('Tower message 1');
  0x0eb = dialogProgression('Tower message 2');
  0x0ec = dialogProgression('Tower message 3');
  0x0ed = dialogProgression('Mesia');
  // unused 0ee .. 0ff

  // 100
  0x100 = obsolete(0x12e); // check: rabbit boots / vampire
  0x101 = obsolete(0x107); // check: ball of fire / insect
  0x102 = obsolete(0x108); // check: flame bracelet / kelbesque 1
  0x103 = obsolete(0x109); // check: ball of water / rage
  // unused 104
  0x105 = obsolete(0x126); // check: opel statue / kelbesque 2
  0x106 = obsolete(0x123); // check: fruit of repun / sabera 2
  0x107 = obsolete(0x112); // check: sacred shield / mado 2
  0x108 = obsolete(0x13d); // check: ivory statue / karmine
  UsedBowOfMoon = movable(0x109);
  UsedBowOfSun = movable(0x10a);
  0x10b = obsolete(0x11c); // check: psycho armor / draygon 1
  0x10c = obsolete(0x161); // check: fruit of power / vampire 2

  // 100 .. 17f => fixed flags for checks.
  LeafElder = fixed(~0x100);
  OakElder = fixed(~0x101);
  WaterfallCaveSwordOfWaterChest = fixed(~0x102);
  StxyLeftUpperSwordOfThunderChest = fixed(~0x103);
  MesiaInTower = fixed(~0x104);
  SealedCaveBallOfWindChest = fixed(~0x105);
  MtSabreWestTornadoBraceletChest = fixed(~0x106);
  GiantInsect = fixed(~0x107);
  Kelbesque1 = fixed(~0x108);
  Rage = fixed(~0x109);
  AryllisBasementChest = fixed(~0x10a);
  Mado1 = fixed(~0x10b);
  StormBraceletChest = fixed(~0x10c);
  WaterfallCaveRiverLeftChest = fixed(0x110); // rando changed index!
  Mado2 = fixed(0x112);
  StxyRightMiddleChest = fixed(0x114);
  BattleArmorChest = fixed(0x11b);
  Draygon1 = fixed(0x11c);
  SealedCaveSmallRoomBackChest = fixed(0x11d); // medical herb
  SealedCaveBigRoomNortheastChest = fixed(0x11e); // antidote
  FogLampCaveFrontChest = fixed(0x11f); // lysis plant
  MtHydraRightChest = fixed(0x120); // fruit of lime
  SaberaUpstairsLeftChest = fixed(0x121); // fruit of power
  EvilSpiritIslandLowerChest = fixed(0x122); // magic ring
  Sabera2 = fixed(0x123); // fruit of repun
  SealedCaveSmallRoomFrontChest = fixed(0x124); // warp boots
  CordelGrass = fixed(0x125);
  Kelbesque2 = fixed(0x126); // opel statue
  OakMother = fixed(0x127);
  PortoaQueen = fixed(0x128);
  AkahanaStatueTradein = fixed(0x129);
  OasisCaveFortressBasementChest = fixed(0x12a);
  Brokahana = fixed(0x12b);
  EvilSpiritIslandRiverLeftChest = fixed(0x12c);
  Deo = fixed(0x12d);
  Vampire1 = fixed(0x12e);
  OasisCaveNorthwestChest = fixed(0x12f);
  AkahanaStoneTradein = fixed(0x130);
  ZebuStudent = fixed(0x131); // TODO - may opt for 2 in cave instead?
  WindmillGuard = fixed(0x132);
  MtSabreNorthBackOfPrisonChest = fixed(0x133);
  ZebuInShyron = fixed(0x134);
  FogLampCaveBackChest = fixed(0x135);
  InjuredDolphin = fixed(0x136);
  Clark = fixed(0x137);
  Sabera1 = fixed(0x138);
  KensuInLighthouse = fixed(0x139);
  RepairedStatue = fixed(0x13a);
  UndergroundChannelUnderwaterChest = fixed(0x13b);
  KirisaMeadow = fixed(0x13c);
  Karmine = fixed(0x13d);
  Aryllis = fixed(0x13e);
  MtHydraSummitChest = fixed(0x13f);
  AztecaInPyramid = fixed(0x140);
  ZebuAtWindmill = fixed(0x141);
  MtSabreNorthSummit = fixed(0x142);
  StomFightReward = fixed(0x143);
  MtSabreWestTornel = fixed(0x144);
  AsinaInBackRoom = fixed(0x145);
  BehindWhirlpool = fixed(0x146);
  KensuInSwan = fixed(0x147);
  SlimedKensu = fixed(0x148);
  SealedCaveBigRoomSouthwestChest = fixed(0x150); // medical herb
  // unused 151 sacred shield chest
  MtSabreWestRightChest = fixed(0x152); // medical herb
  MtSabreNorthMiddleChest = fixed(0x153); // medical herb
  FortressMadoHellwayChest = fixed(0x154); // magic ring
  SaberaUpstairsRightChest = fixed(0x155); // medical herb across spikes
  MtHydraFarLeftChest = fixed(0x156); // medical herb
  StxyLeftLowerChest = fixed(0x157); // medical herb
  KarmineBasementLowerMiddleChest = fixed(0x158); // magic ring
  EastCaveNortheastChest = fixed(0x159); // medical herb (unused)
  OasisCaveEntranceAcrossRiverChest = fixed(0x15a); // fruit of power
  // unused 15b 2nd flute of lime - changed in rando
  // WaterfallCaveRiverLeftChest = fixed(0x15b); // 2nd flute of lime
  EvilSpiritIslandExitChest = fixed(0x15c); // lysis plant
  FortressSaberaMiddleChest = fixed(0x15d); // lysis plant
  NoSabreNorthUnderBridgeChest = fixed(0x15e); // antidote
  KirisaPlantCaveChest = fixed(0x15f); // antidote
  FortressMadoUpperNorthChest = fixed(0x160); // antidote
  Vampire2 = fixed(0x161); // fruit of power
  FortressSaberaNorthwestChest = fixed(0x162); // fruit of power
  FortressMadoLowerCenterNorthChest = fixed(0x163); // opel statue
  OasisCaveNearEntranceChest = fixed(0x164); // fruit of power
  MtHydraLeftRightChest = fixed(0x165); // magic ring
  FortressSaberaSoutheastChest = fixed(0x166); // fruit of repun
  KensuInCabin = fixed(0x167); // added by randomizer if fog lamp not needed
  // unused 168 magic ring chest
  MtSabreWestNearKensuChest = fixed(0x169); // magic ring
  MtSabreWestLeftChest = fixed(0x16a); // warp boots
  FortressMadoUpperBehindWallChest = fixed(0x16b); // magic ring
  PyramidChest = fixed(0x16c); // magic ring
  CryptRightChest = fixed(0x16d); // opel statue
  KarmineBasementLowerLeftChest = fixed(0x16e); // warp boots
  FortressMadoLowerSoutheastChest = fixed(0x16f); // magic ring
  // = fixed(0x170); // mimic / medical herb
  // TODO - add all the mimics, give them stable numbers?


  // 180 .. 1ff => fixed flags for overflow buffer.

  // 200 .. 27f => fixed flags for items.
  SwordOfWind = fixed(0x200);
  SwordOfFire = fixed(0x201);
  SwordOfWater = fixed(0x202);
  SwordOfThunder = fixed(0x203);
  Crystalis = fixed(0x204);
  BallOfWind = fixed(0x205);
  TornadoBracelet = fixed(0x206);
  BallOfFire = fixed(0x207);
  FlameBracelet = fixed(0x208);
  BallOfWater = fixed(0x209);
  BlizzardBracelet = fixed(0x20a);
  BallOfThunder = fixed(0x20b);
  StormBracelet = fixed(0x20c);
  CarapaceShield = fixed(0x20d);
  BronzeShield = fixed(0x20e);
  PlatinumShield = fixed(0x20f);
  MirroredShield = fixed(0x210);
  CeramicShield = fixed(0x211);
  SacredShield = fixed(0x212);
  BattleShield = fixed(0x213);
  PsychoShield = fixed(0x214);
  TannedHide = fixed(0x215);
  LeatherArmor = fixed(0x216);
  BronzeArmor = fixed(0x217);
  PlatinumArmor = fixed(0x218);
  SoldierSuit = fixed(0x219);
  CeramicSuit = fixed(0x21a);
  BattleArmor = fixed(0x21b);
  PsychoArmor = fixed(0x21c);
  MedicalHerb = fixed(0x21d);
  Antidote = fixed(0x21e);
  LysisPlant = fixed(0x21f);
  FruitOfLime = fixed(0x220);
  FruitOfPower = fixed(0x221);
  MagicRing = fixed(0x222);
  FruitOfRepun = fixed(0x223);
  WarpBoots = fixed(0x224);
  StatueOfOnyx = fixed(0x225);
  OpelStatue = fixed(0x226);
  InsectFlute = fixed(0x227);
  FluteOfLime = fixed(0x228);
  GasMask = fixed(0x229);
  PowerRing = fixed(0x22a);
  WarriorRing = fixed(0x22b);
  IronNecklace = fixed(0x22c);
  DeosPendant = fixed(0x22d);
  RabbitBoots = fixed(0x22e);
  LeatherBoots = fixed(0x22f);
  ShieldRing = fixed(0x230);
  AlarmFlute = fixed(0x231);
  WindmillKey = fixed(0x232);
  KeyToPrison = fixed(0x233);
  KeyToStyx = fixed(0x234);
  FogLamp = fixed(0x235);
  ShellFlute = fixed(0x236);
  EyeGlasses = fixed(0x237);
  BrokenStatue = fixed(0x238);
  GlowingLamp = fixed(0x239);
  StatueOfGold = fixed(0x23a);
  LovePendant = fixed(0x23b);
  KirisaPlant = fixed(0x23c);
  IvoryStatue = fixed(0x23d);
  BowOfMoon = fixed(0x23e);
  BowOfSun = fixed(0x23f);
  BowOfTruth = fixed(0x240);
  Refresh = fixed(0x241);
  Paralysis = fixed(0x242);
  Telepathy = fixed(0x243);
  Teleport = fixed(0x244);
  Recover = fixed(0x245);
  Barrier = fixed(0x246);
  Change = fixed(0x247);
  Flight = fixed(0x248);

  // 280 .. 2ff => fixed flags for walls.
  CalmedAngrySea = fixed(0x283);
  Draygon2 = fixed(0x28d);
  // TODO - prison and stxy opened?

  WarpLeaf = fixed(0x2f5);
  WarpBrynmaer = fixed(0x2f6);
  WarpOak = fixed(0x2f7);
  WarpNadare = fixed(0x2f8);
  WarpPortoa = fixed(0x2f9);
  WarpAmazones = fixed(0x2fa);
  WarpJoel = fixed(0x2fb);
  WarpZombie = fixed(~0x2fb);
  WarpSwan = fixed(0x2fc);
  WarpShyron = fixed(0x2fd);
  WarpGoa = fixed(0x2fe);
  WarpSahara = fixed(0x2ff);

  // Nothing ever sets this, so just use it right out.
  AlwaysTrue = fixed(0x2f0);

  // Map of flags that are "waiting" for a previously-used ID.
  // Signified with a negative (one's complement) ID in the Flag object.
  private readonly unallocated = new Map<number, Flag>();

  // // Map of available IDs.
  // private readonly available = [
  //   new Set<number>(), // 000 .. 0ff
  //   new Set<number>(), // 100 .. 1ff
  //   new Set<number>(), // 200 .. 2ff
  // ];

  constructor(readonly rom: Rom) {
    // Build up all the flags as actual instances of Flag.
    for (const key in this) {
      if (!this.hasOwnProperty(key)) continue;
      const spec = this[key];
      if (!(spec as any)[FLAG]) continue;
      // Replace it with an actual flag.  We may need a name, etc...
      const keyNumber = Number(key);
      const id = typeof spec.id === 'number' ? spec.id : keyNumber;
      if (isNaN(id)) throw new Error(`Bad flag: ${key}`);
      const name =
          spec.name ||
          (isNaN(keyNumber) ? upperCamelToSpaces(key) : flagName(id));
      const flag = new Flag(this, name, id, spec);
      this[key] = flag;
      // If ID is negative, then store it as unallocated.
      if (flag.id < 0) {
        this.unallocated.set(~flag.id, flag);
      } else if (!this[flag.id]) {
        this[flag.id] = flag;
      }
    }

    // Now add the missing flags.
    for (let i = 0x100; i < 0x180; i++) {
      const name = `Check ${hex(i & 0xff)}`;
      if (this[i]) {
        if (!this[i].fixed && !this.unallocated.has(i)) {
          this.unallocated.set(
              i, new Flag(this, name, ~i, {fixed: true}));
        }
      } else {
        this[i] = new Flag(this, name, i, {fixed: true});
      }
    }
    for (let i = 0x180; i < 0x280; i++) {
      if (!this[i]) {
        // Item buffer here
        const type = i < 0x200 ? 'Buffer ' : 'Item ';
        this[i] = new Flag(this, type + hex(i), i, {fixed: true});
      }
    }
    // For the remainder, find walls in maps.
    //  - do we need to pull them form locations?? or this doing anything??
    for (const loc of rom.locations) {
      for (const f of loc.flags) {
        if (this[f.flag]) continue;
        this[f.flag] = wallFlag(this, f.flag);
      }
    }
  }


  // Saves > 470 bytes!
  defrag() {
    // make a map of new IDs for everything.
    const remapping = new Map<number, (f: FlagContext) => number>();

    // first handle all the obsolete flags - once the remapping is pulled off
    // we can simply unref them.
    for (let i = 0; i < 0x300; i++) {
      const f = this[i];
      const o = f?.obsolete;
      if (o) {
        remapping.set(i, (c: FlagContext) => c.set ? -1 : o.call(f, c));
        delete this[i];
      }
    }

    // now move all the movable flags.
    let i = 0;
    let j = 0x2ff;
    while (i < j) {
      if (this[i] || this.unallocated.has(i)) { i++; continue; }
      const f = this[j];
      if (!f || f.fixed) { j--; continue; }
      // f is a movable flag.  Move it to i.
      remapping.set(j, () => i);
      (f as Writable<Flag>).id = i;
      this[i] = f;
      delete this[j];
      i++;
      j--;
    }

    // go through all the possible places we could find flags and remap!
    this.remapFlags(remapping);

    // Unallocated flags don't need any remapping.
    for (const [want, flag] of this.unallocated) {
      if (this[want]) continue;
      this.unallocated.delete(want);
      (this[want] = flag as Writable<Flag>).id = want;
    }

    //if (this.unallocated.size) throw new Error(`Could not fully allocate`);

    // Report how the defrag went?
    const free = [];
    for (let i = 0; i < 0x300; i++) {
      if (!this[i]) free.push(hex3(i));
    }
    console.log(`Free flags: ${free.join(' ')}`);
  }

  insertZombieWarpFlag() {
    // Make space for the new flag between Joel and Swan
    const remapping = new Map<number, (f: FlagContext) => number>();
    if (this[0x2f4]) throw new Error(`No space to insert warp flag`);
    const newId = ~this.WarpZombie.id;
    if (newId < 0) throw new Error(`Bad WarpZombie id`);
    for (let i = 0x2f4; i < newId; i++) {
      this[i] = this[i + 1];
      (this[i] as Writable<Flag>).id = i;
      remapping.set(i + 1, () => i);
    }
    (this.WarpZombie as Writable<Flag>).id = newId;
    this[newId] = this.WarpZombie;
    this.remapFlags(remapping);
  }

  remap(src: number, dest: number) {
    this.remapFlags(new Map([[src, () => dest]]));
  }

  remapFlags(remapping: Map<number, (ctx: FlagContext) => number>) {
    function processList(list: number[], ctx: FlagContext) {
      for (let i = list.length - 1; i >= 0; i--) {
        let f = list[i];
        if (f < 0) f = ~f;
        const remap = remapping.get(list[i]);
        if (remap == null) continue;
        let mapped = remap({...ctx, index: i});
        if (mapped >= 0) {
          list[i] = list[i] < 0 ? ~mapped : mapped;
        } else {
          list.splice(i, 1);
        }
      }
    }
    function process(flag: number, ctx: FlagContext) {
      let unsigned = flag < 0 ? ~flag : flag;
      const remap = remapping.get(unsigned);
      if (remap == null) return flag;
      let mapped = remap(ctx);
      if (mapped < 0) throw new Error(`Bad flag delete`);
      return flag < 0 ? ~mapped : mapped;
    }

    // Location flags
    for (const location of this.rom.locations) {
      for (const flag of location.flags) {
        flag.flag = process(flag.flag, {location});
      }
    }

    // NPC flags
    for (const npc of this.rom.npcs) {
      for (const [loc, conds] of npc.spawnConditions) {
        processList(conds, {npc, spawn: loc});
      }
      for (const d of npc.globalDialogs) {
        d.condition = process(d.condition, {npc, dialog: true});
      }
      for (const [, ds] of npc.localDialogs) {
        for (const d of ds) {
          d.condition = process(d.condition, {npc, dialog: true});
          processList(d.flags, {npc, dialog: true, set: true});
        }
      }
    }

    // Trigger flags
    for (const trigger of this.rom.triggers) {
      processList(trigger.conditions, {trigger});
      processList(trigger.flags, {trigger, set: true});
    }

    // TODO - consider updating telepathy?!?

    // ItemGet flags
    for (const itemGet of this.rom.itemGets) {
      processList(itemGet.flags, {set: true});
    }
    for (const item of this.rom.items) {
      for (const itemUse of item.itemUseData) {
        if (itemUse.kind === 'flag') {
          itemUse.want = process(itemUse.want, {});
        }
        processList(itemUse.flags, {set: true});
      }
    }

    // TODO - anything else?
  }

  // TODO - manipulate this stuff

  // private readonly available = new Set<number>([
  //   // TODO - there's a ton of lower flags as well.
  //   // TODO - we can repurpose all the old item flags.
  //   0x270, 0x271, 0x272, 0x273, 0x274, 0x275, 0x276, 0x277,
  //   0x278, 0x279, 0x27a, 0x27b, 0x27c, 0x27d, 0x27e, 0x27f,
  //   0x280, 0x281, 0x288, 0x289, 0x28a, 0x28b, 0x28c,
  //   0x2a7, 0x2ab, 0x2b4,
  // ]);

  alloc(segment: number = 0): number {
    if (segment !== 0x200) throw new Error(`Cannot allocate outside 2xx`);
    for (let flag = 0x280; flag < 0x300; flag++) {
      if (!this[flag]) {
        this[flag] = wallFlag(this, flag);
      }
      return flag;
    }
    throw new Error(`No free flags.`);
  }

  free(flag: number) {
    // TODO - is there more to this?  check for something else?
    delete this[flag];
  }
}

function flagName(id: number): string {
  return 'Flag ' + hex3(id);
}

function wallFlag(flags: Flags, id: number): Flag {
  return new Flag(flags, 'Wall ' + hex(id & 0xff), id, {fixed: true});
}
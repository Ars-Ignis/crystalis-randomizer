import * as patch from './patch';
import {FlagSet} from './flagset';

export function archipelagoPreFill(originalRom: Uint8Array, seed: number, flagset: FlagSet): readonly [string[], FlagSet] {
    const [, f, world] = patch.onlyPreShuffle(originalRom, seed, flagset);
    //const preShuffleFilename = filenameBase + "_PRESHUFFLE.nes";
    const logSlots = [];
    const logItems = [];
    
    const locationList = world.getLocationList();
    for (const [check, req] of locationList.requirements) {
        const isSlot = locationList.slots.has(check);
        var logLineSlot = isSlot ? "*" : "";
        logLineSlot += locationList.checkName(check);
        const translateName = (check: number) => {
            if ((check & ~0xff) == 0x200 && world.rom.items[check & 0xff])
            {
                return world.rom.items[check & 0xff].messageName; 
            } else {
                return locationList.checkName(check);
            }
        }
        for (const route of req) {
          logLineSlot += " | " + [...route].map(translateName).join(' & ');
        }
        if (isSlot)
        {
            const slotInfo = locationList.slots.get(check);
            logLineSlot += " : (unique: " +  slotInfo?.unique + " lossy: " + slotInfo?.lossy + " preventLoss: " + slotInfo?.preventLoss + " broken: " + slotInfo?.broken + ")";
        }
        logLineSlot += "\n";
        logSlots.push(logLineSlot);
        
        if (isSlot)
        {
            const itemget = world.rom.itemGets[world.rom.slots[check & 0xff]];
            const item = world.rom.items[itemget.itemId];
            const unique = item?.unique;
            const losable = itemget.isLosable();
            // TODO - refactor to just "can't be bought"?
            const preventLoss = unique || item === world.rom.items.OpelStatue;
            var logLineItem = item.messageName + ": (unique: " +  unique + " losable: " + losable + " preventLoss: " + preventLoss + ")\n";
            logItems.push(logLineItem);
        }
    }
    logSlots.sort((a: any, b: any) => a < b ? -1 : a > b ? 1 : 0);
    logSlots.push('--------------------------------------------------\n');
    /*for (const [item, itemInfo] of locationList.items) {
        var logLine = '';
        if ((item & ~0xff) == 0x200 && world.rom.items[item & 0xff])
        {
            logLine += world.rom.items[item & 0xff].messageName; 
        }
        else
        {
            var itemName = locationList.checkName(item);
            if (itemName.startsWith("Item 2")) {
                logLine += translateConsumableName(world, item);
            } else {
                logLine += itemName;                    
            } 
        }
        logLine += " " + item.toString(16) +": (unique: " +  itemInfo.unique + " losable: " + itemInfo.losable + " preventLoss: " + itemInfo.preventLoss + ")\n";
        logItems.push(logLine);
    }*/
    logItems.sort((a: any, b: any) => a < b ? -1 : a > b ? 1 : 0);
    const log = logSlots.concat(logItems);
    return [log, f];
    //not sure if this works, let's find out'
    //preShuffled.writeData();
    /*await new Promise(
        (resolve, reject) => fs.writeFile(
            preShuffleFilename, originalRom, (err) => err ? reject(err) : resolve('')));
    console.log(`Wrote ${preShuffleFilename}`);*/
}
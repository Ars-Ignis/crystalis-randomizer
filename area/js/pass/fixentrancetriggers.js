import { Spawn } from '../rom/location.js';
export function fixEntranceTriggers(rom) {
    const { locations: { Portoa, PortoaPalace_ThroneRoom, Portoa_PalaceEntrance, UndergroundChannel, WaterfallCave2, WaterfallCave3, }, } = rom;
    fixTrigger(Portoa_PalaceEntrance, 'edge:bottom', 0xb7, Portoa);
    fixTrigger(PortoaPalace_ThroneRoom, 'door', 0x92, UndergroundChannel);
    fixTrigger(WaterfallCave2, 'stair:up', 0xbf, WaterfallCave3);
}
function fixTrigger(exitLocation, exitType, trigger, originalEntrance) {
    const [exit, ...rest] = [...exitLocation.meta.exits()].filter(([, type]) => type === exitType);
    if (!exit)
        throw new Error(`Could not find ${exitType} in ${exitLocation}`);
    if (rest.length)
        throw new Error(`Ambiguous ${exitType} in ${exitLocation}`);
    const [entranceLocPos, entranceType] = exit[2];
    const entranceLoc = entranceLocPos >>> 8;
    if (entranceLoc === originalEntrance.id)
        return;
    const entrancePos = entranceLocPos & 0xff;
    const entranceLocation = exitLocation.rom.locations[entranceLoc];
    const scr = entranceLocation.meta.get(entrancePos);
    const entrance = scr.data.exits.find(e => e.type === entranceType);
    if (!entrance)
        throw new Error(`Bad entrance in ${entranceLocation}`);
    const triggerCoord = ((entrance.entrance & 0xf000) >>> 8 | (entrance.entrance & 0xf0) >>> 4) +
        triggerDirectionAdjustments[entrance.dir];
    if (entranceLocation.spawns.length > 17)
        entranceLocation.spawns.pop();
    const triggerSpawnIndex = originalEntrance.spawns.findIndex(s => s.isTrigger() && s.id === trigger);
    const triggerSpawn = triggerSpawnIndex >= 0 ?
        originalEntrance.spawns.splice(triggerSpawnIndex, 1)[0] :
        Spawn.of({ type: 2, id: trigger });
    triggerSpawn.xt = (entrancePos & 0xf) << 4 | (triggerCoord & 0xf);
    triggerSpawn.yt = (entrancePos & 0xf0) | triggerCoord >>> 4;
    entranceLocation.spawns.push(triggerSpawn);
}
const triggerDirectionAdjustments = [0x10, 0, 0, 0];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4ZW50cmFuY2V0cmlnZ2Vycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9qcy9wYXNzL2ZpeGVudHJhbmNldHJpZ2dlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFZLEtBQUssRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBVXJELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFRO0lBQzFDLE1BQU0sRUFDSixTQUFTLEVBQUUsRUFDVCxNQUFNLEVBQ04sdUJBQXVCLEVBQ3ZCLHFCQUFxQixFQUNyQixrQkFBa0IsRUFDbEIsY0FBYyxFQUNkLGNBQWMsR0FDZixHQUNGLEdBQUcsR0FBRyxDQUFDO0lBRVIsVUFBVSxDQUFDLHFCQUFxQixFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0QsVUFBVSxDQUFDLHVCQUF1QixFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUN0RSxVQUFVLENBQUMsY0FBYyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFDL0QsQ0FBQztBQVFELFNBQVMsVUFBVSxDQUFDLFlBQXNCLEVBQUUsUUFBd0IsRUFDaEQsT0FBZSxFQUFFLGdCQUEwQjtJQUM3RCxNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQ2pCLENBQUMsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUM7SUFDM0UsSUFBSSxDQUFDLElBQUk7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixRQUFRLE9BQU8sWUFBWSxFQUFFLENBQUMsQ0FBQztJQUM1RSxJQUFJLElBQUksQ0FBQyxNQUFNO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFhLFFBQVEsT0FBTyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0lBQzdFLE1BQU0sQ0FBQyxjQUFjLEVBQUUsWUFBWSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQy9DLE1BQU0sV0FBVyxHQUFHLGNBQWMsS0FBSyxDQUFDLENBQUM7SUFDekMsSUFBSSxXQUFXLEtBQUssZ0JBQWdCLENBQUMsRUFBRTtRQUFFLE9BQU87SUFDaEQsTUFBTSxXQUFXLEdBQUcsY0FBYyxHQUFHLElBQUksQ0FBQztJQUMxQyxNQUFNLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sR0FBRyxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbkQsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsQ0FBQztJQUNwRSxJQUFJLENBQUMsUUFBUTtRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLGdCQUFnQixFQUFFLENBQUMsQ0FBQztJQUN0RSxNQUFNLFlBQVksR0FDZCxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2RSwyQkFBMkIsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUMsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLEVBQUU7UUFBRSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDdkUsTUFBTSxpQkFBaUIsR0FDbkIsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxLQUFLLE9BQU8sQ0FBQyxDQUFDO0lBQzlFLE1BQU0sWUFBWSxHQUNkLGlCQUFpQixJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3hCLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6RCxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFDLENBQUMsQ0FBQztJQUNyQyxZQUFZLENBQUMsRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUMsQ0FBQztJQUNsRSxZQUFZLENBQUMsRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLFlBQVksS0FBSyxDQUFDLENBQUM7SUFDNUQsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBRUQsTUFBTSwyQkFBMkIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUm9tIH0gZnJvbSAnLi4vcm9tLmpzJztcbmltcG9ydCB7IENvbm5lY3Rpb25UeXBlIH0gZnJvbSAnLi4vcm9tL21ldGFzY3JlZW5kYXRhLmpzJztcbmltcG9ydCB7IExvY2F0aW9uLCBTcGF3biB9IGZyb20gJy4uL3JvbS9sb2NhdGlvbi5qcyc7XG5cbi8qKlxuICogTW92ZXMgZW50cmFuY2UtYmFzZWQgdHJpZ2dlcnMgdGhhdCBzaG91bGQgYmUgYXR0YWNoZWQgdG9cbiAqIHRoZSBvcHBvc2l0ZSBzaWRlIG9mIHNwZWNpZmljIGV4aXRzLiAgVGhpcyBzaG91bGQgaWRlYWxseVxuICogcnVuIGFmdGVyIHNodWZmbGluZyBhbnkgbG9jYXRpb24tdG8tbG9jYXRpb24gY29ubmVjdGlvbnNcbiAqIChpLmUuIHNodWZmbGUgaG91c2VzKSBidXQgX2JlZm9yZV8gcmFuZG9taXppbmcgdGhlIG1hcHMsXG4gKiBpbiBjYXNlIHdlIG5lZWQgdG8gZGlzYW1iaWd1YXRlIG11bHRpcGxlIHNhbWUtdHlwZSBleGl0c1xuICogYXQgc29tZSBwb2ludC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpeEVudHJhbmNlVHJpZ2dlcnMocm9tOiBSb20pIHtcbiAgY29uc3Qge1xuICAgIGxvY2F0aW9uczoge1xuICAgICAgUG9ydG9hLFxuICAgICAgUG9ydG9hUGFsYWNlX1Rocm9uZVJvb20sXG4gICAgICBQb3J0b2FfUGFsYWNlRW50cmFuY2UsXG4gICAgICBVbmRlcmdyb3VuZENoYW5uZWwsXG4gICAgICBXYXRlcmZhbGxDYXZlMixcbiAgICAgIFdhdGVyZmFsbENhdmUzLFxuICAgIH0sXG4gIH0gPSByb207XG5cbiAgZml4VHJpZ2dlcihQb3J0b2FfUGFsYWNlRW50cmFuY2UsICdlZGdlOmJvdHRvbScsIDB4YjcsIFBvcnRvYSk7XG4gIGZpeFRyaWdnZXIoUG9ydG9hUGFsYWNlX1Rocm9uZVJvb20sICdkb29yJywgMHg5MiwgVW5kZXJncm91bmRDaGFubmVsKTtcbiAgZml4VHJpZ2dlcihXYXRlcmZhbGxDYXZlMiwgJ3N0YWlyOnVwJywgMHhiZiwgV2F0ZXJmYWxsQ2F2ZTMpO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBnaXZlbiBgdHlwZWAgb2YgZXhpdCBmcm9tIGBleGl0TG9jYXRpb25gIGNvbm5lY3RzIHRvXG4gKiB0aGUgYG9yaWdpbmFsRW50cmFuY2VgIGxvY2F0aW9uLiAgSWYgbm90LCByZW1vdmUgYHRyaWdnZXJgIGZyb21cbiAqIHRoZSBvcmlnaW5hbCBsb2NhdGlvbiBhbmQgYWRkIGl0IHRvIHRoZSBhY3R1YWwgb3RoZXIgc2lkZSBvZiB0aGVcbiAqIGdpdmVuIGV4aXQuXG4gKi9cbmZ1bmN0aW9uIGZpeFRyaWdnZXIoZXhpdExvY2F0aW9uOiBMb2NhdGlvbiwgZXhpdFR5cGU6IENvbm5lY3Rpb25UeXBlLFxuICAgICAgICAgICAgICAgICAgICB0cmlnZ2VyOiBudW1iZXIsIG9yaWdpbmFsRW50cmFuY2U6IExvY2F0aW9uKSB7XG4gIGNvbnN0IFtleGl0LCAuLi5yZXN0XSA9XG4gICAgICBbLi4uZXhpdExvY2F0aW9uLm1ldGEuZXhpdHMoKV0uZmlsdGVyKChbLCB0eXBlXSkgPT4gdHlwZSA9PT0gZXhpdFR5cGUpO1xuICBpZiAoIWV4aXQpIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtleGl0VHlwZX0gaW4gJHtleGl0TG9jYXRpb259YCk7XG4gIGlmIChyZXN0Lmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKGBBbWJpZ3VvdXMgJHtleGl0VHlwZX0gaW4gJHtleGl0TG9jYXRpb259YCk7XG4gIGNvbnN0IFtlbnRyYW5jZUxvY1BvcywgZW50cmFuY2VUeXBlXSA9IGV4aXRbMl07XG4gIGNvbnN0IGVudHJhbmNlTG9jID0gZW50cmFuY2VMb2NQb3MgPj4+IDg7XG4gIGlmIChlbnRyYW5jZUxvYyA9PT0gb3JpZ2luYWxFbnRyYW5jZS5pZCkgcmV0dXJuOyAvLyBub3RoaW5nIHRvIGRvXG4gIGNvbnN0IGVudHJhbmNlUG9zID0gZW50cmFuY2VMb2NQb3MgJiAweGZmO1xuICBjb25zdCBlbnRyYW5jZUxvY2F0aW9uID0gZXhpdExvY2F0aW9uLnJvbS5sb2NhdGlvbnNbZW50cmFuY2VMb2NdO1xuICBjb25zdCBzY3IgPSBlbnRyYW5jZUxvY2F0aW9uLm1ldGEuZ2V0KGVudHJhbmNlUG9zKTtcbiAgY29uc3QgZW50cmFuY2UgPSBzY3IuZGF0YS5leGl0cyEuZmluZChlID0+IGUudHlwZSA9PT0gZW50cmFuY2VUeXBlKTtcbiAgaWYgKCFlbnRyYW5jZSkgdGhyb3cgbmV3IEVycm9yKGBCYWQgZW50cmFuY2UgaW4gJHtlbnRyYW5jZUxvY2F0aW9ufWApO1xuICBjb25zdCB0cmlnZ2VyQ29vcmQgPVxuICAgICAgKChlbnRyYW5jZS5lbnRyYW5jZSAmIDB4ZjAwMCkgPj4+IDggfCAoZW50cmFuY2UuZW50cmFuY2UgJiAweGYwKSA+Pj4gNCkgK1xuICAgICAgdHJpZ2dlckRpcmVjdGlvbkFkanVzdG1lbnRzW2VudHJhbmNlLmRpcl07XG4gIGlmIChlbnRyYW5jZUxvY2F0aW9uLnNwYXducy5sZW5ndGggPiAxNykgZW50cmFuY2VMb2NhdGlvbi5zcGF3bnMucG9wKCk7XG4gIGNvbnN0IHRyaWdnZXJTcGF3bkluZGV4ID1cbiAgICAgIG9yaWdpbmFsRW50cmFuY2Uuc3Bhd25zLmZpbmRJbmRleChzID0+IHMuaXNUcmlnZ2VyKCkgJiYgcy5pZCA9PT0gdHJpZ2dlcik7XG4gIGNvbnN0IHRyaWdnZXJTcGF3biA9XG4gICAgICB0cmlnZ2VyU3Bhd25JbmRleCA+PSAwID9cbiAgICAgIG9yaWdpbmFsRW50cmFuY2Uuc3Bhd25zLnNwbGljZSh0cmlnZ2VyU3Bhd25JbmRleCwgMSlbMF0gOlxuICAgICAgU3Bhd24ub2Yoe3R5cGU6IDIsIGlkOiB0cmlnZ2VyfSk7XG4gIHRyaWdnZXJTcGF3bi54dCA9IChlbnRyYW5jZVBvcyAmIDB4ZikgPDwgNCB8ICh0cmlnZ2VyQ29vcmQgJiAweGYpO1xuICB0cmlnZ2VyU3Bhd24ueXQgPSAoZW50cmFuY2VQb3MgJiAweGYwKSB8IHRyaWdnZXJDb29yZCA+Pj4gNDtcbiAgZW50cmFuY2VMb2NhdGlvbi5zcGF3bnMucHVzaCh0cmlnZ2VyU3Bhd24pO1xufVxuXG5jb25zdCB0cmlnZ2VyRGlyZWN0aW9uQWRqdXN0bWVudHMgPSBbMHgxMCwgMCwgMCwgMF07XG4iXX0=
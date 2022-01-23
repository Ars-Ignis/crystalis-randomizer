export function writeLocationsFromMeta(rom) {
    const { locations } = rom;
    const { CordelPlainEast, CordelPlainWest, WaterfallValleyNorth, WaterfallValleySouth, MezameShrine, MtSabreWest_Cave1 } = locations;
    CordelPlainEast.meta.reconcileExits(CordelPlainWest.meta);
    for (const pos of WaterfallValleyNorth.meta.allPos()) {
        const north = WaterfallValleyNorth.meta.get(pos);
        const south = WaterfallValleySouth.meta.get(pos);
        if (north.isEmpty() && !south.isEmpty()) {
            WaterfallValleyNorth.meta.set(pos, south);
        }
        else if (south.isEmpty() && !north.isEmpty()) {
            WaterfallValleySouth.meta.set(pos, north);
        }
    }
    for (const loc of locations) {
        if (!loc.used)
            continue;
        loc.exits = [];
        loc.entrances = [];
        loc.meta.writeEntrance0();
    }
    if (!MezameShrine.meta.getExit(0, 'door')) {
        MezameShrine.meta.attach(0, MezameShrine.meta, 0, 'door', 'door');
    }
    for (const loc of locations) {
        if (!loc.used)
            continue;
        if (loc === MtSabreWest_Cave1)
            continue;
        loc.meta.write();
        if (loc === CordelPlainWest && MtSabreWest_Cave1.used) {
            MtSabreWest_Cave1.meta.write();
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3JpdGVsb2NhdGlvbnNmcm9tbWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9qcy9wYXNzL3dyaXRlbG9jYXRpb25zZnJvbW1ldGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsTUFBTSxVQUFVLHNCQUFzQixDQUFDLEdBQVE7SUFDN0MsTUFBTSxFQUFDLFNBQVMsRUFBQyxHQUFHLEdBQUcsQ0FBQztJQUN4QixNQUFNLEVBQUMsZUFBZSxFQUFFLGVBQWUsRUFDaEMsb0JBQW9CLEVBQUUsb0JBQW9CLEVBQzFDLFlBQVksRUFBRSxpQkFBaUIsRUFBQyxHQUFHLFNBQVMsQ0FBQztJQUdwRCxlQUFlLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7SUFNMUQsS0FBSyxNQUFNLEdBQUcsSUFBSSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDcEQsTUFBTSxLQUFLLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqRCxNQUFNLEtBQUssR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2pELElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQ3ZDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQzNDO2FBQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDOUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDM0M7S0FDRjtJQUlELEtBQUssTUFBTSxHQUFHLElBQUksU0FBUyxFQUFFO1FBQzNCLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSTtZQUFFLFNBQVM7UUFDeEIsR0FBRyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDZixHQUFHLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNuQixHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO0tBQzNCO0lBR0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsRUFBRTtRQUN6QyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0tBQ25FO0lBRUQsS0FBSyxNQUFNLEdBQUcsSUFBSSxTQUFTLEVBQUU7UUFDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJO1lBQUUsU0FBUztRQUt4QixJQUFJLEdBQUcsS0FBSyxpQkFBaUI7WUFBRSxTQUFTO1FBQ3hDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDakIsSUFBSSxHQUFHLEtBQUssZUFBZSxJQUFJLGlCQUFpQixDQUFDLElBQUksRUFBRTtZQUNyRCxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7U0FDaEM7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1JvbX0gZnJvbSAnLi4vcm9tLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlTG9jYXRpb25zRnJvbU1ldGEocm9tOiBSb20pIHtcbiAgY29uc3Qge2xvY2F0aW9uc30gPSByb207XG4gIGNvbnN0IHtDb3JkZWxQbGFpbkVhc3QsIENvcmRlbFBsYWluV2VzdCxcbiAgICAgICAgIFdhdGVyZmFsbFZhbGxleU5vcnRoLCBXYXRlcmZhbGxWYWxsZXlTb3V0aCxcbiAgICAgICAgIE1lemFtZVNocmluZSwgTXRTYWJyZVdlc3RfQ2F2ZTF9ID0gbG9jYXRpb25zO1xuXG4gIC8vIEZpcnN0IHN5bmMgdXAgQ29yZGVsJ3MgZXhpdHMuXG4gIENvcmRlbFBsYWluRWFzdC5tZXRhLnJlY29uY2lsZUV4aXRzKENvcmRlbFBsYWluV2VzdC5tZXRhKTtcblxuICAvLyBDb3B5IHRoZSBub24tZW1wdHkgc2NyZWVucyBiZXR3ZWVuIHRoZSBXYXRlcmZhbGwgVmFsbGV5IHBhaXIuICBXaXRob3V0XG4gIC8vIHRoaXMsIGV2ZXJ5dGhpbmcgb24gdGhlIG90aGVyIHNpZGUgb2YgdGhlIHNlYW0gaXMgZmlsbGVkIGluIGFzIG1vdW50YWlucyxcbiAgLy8gd2hpY2ggY2F1c2VzIHZlcnkgbWlub3IgZ3JhcGhpY2FsIGFydGlmYWN0cyB3aGVuIHdhbGtpbmcgc291dGggdGhyb3VnaFxuICAvLyB0aGUgcGFzcy5cbiAgZm9yIChjb25zdCBwb3Mgb2YgV2F0ZXJmYWxsVmFsbGV5Tm9ydGgubWV0YS5hbGxQb3MoKSkge1xuICAgIGNvbnN0IG5vcnRoID0gV2F0ZXJmYWxsVmFsbGV5Tm9ydGgubWV0YS5nZXQocG9zKTtcbiAgICBjb25zdCBzb3V0aCA9IFdhdGVyZmFsbFZhbGxleVNvdXRoLm1ldGEuZ2V0KHBvcyk7XG4gICAgaWYgKG5vcnRoLmlzRW1wdHkoKSAmJiAhc291dGguaXNFbXB0eSgpKSB7XG4gICAgICBXYXRlcmZhbGxWYWxsZXlOb3J0aC5tZXRhLnNldChwb3MsIHNvdXRoKTtcbiAgICB9IGVsc2UgaWYgKHNvdXRoLmlzRW1wdHkoKSAmJiAhbm9ydGguaXNFbXB0eSgpKSB7XG4gICAgICBXYXRlcmZhbGxWYWxsZXlTb3V0aC5tZXRhLnNldChwb3MsIG5vcnRoKTtcbiAgICB9XG4gIH1cblxuICAvLyBOb3cgZG8gdGhlIGFjdHVhbCBjb3B5LiAgU3RhcnQgYnkgd2lwaW5nIG91dCBhbGwgdGhlIGVudHJhbmNlcyBhbmQgZXhpdHMuXG4gIC8vIFRoaXMgbmVlZHMgdG8gYmUgZG9uZSBhcyBhIHNlcGFyYXRlIHBhc3NcbiAgZm9yIChjb25zdCBsb2Mgb2YgbG9jYXRpb25zKSB7XG4gICAgaWYgKCFsb2MudXNlZCkgY29udGludWU7XG4gICAgbG9jLmV4aXRzID0gW107XG4gICAgbG9jLmVudHJhbmNlcyA9IFtdO1xuICAgIGxvYy5tZXRhLndyaXRlRW50cmFuY2UwKCk7XG4gIH1cbiAgLy8gTmVlZCB0byBtYWtlIHN1cmUgTWV6YW1lIGVudHJhbmNlIDEgZXhpc3RzLCBzaW5jZSAodW5sZXNzIG5vLWJvdyBtb2RlIGlzXG4gIC8vIG9uKSBub3RoaW5nIGFjdHVhbGx5IGxlYWRzIHRvIGl0LlxuICBpZiAoIU1lemFtZVNocmluZS5tZXRhLmdldEV4aXQoMCwgJ2Rvb3InKSkge1xuICAgIE1lemFtZVNocmluZS5tZXRhLmF0dGFjaCgwLCBNZXphbWVTaHJpbmUubWV0YSwgMCwgJ2Rvb3InLCAnZG9vcicpO1xuICB9XG4gIC8vIFRoZW4gd3JpdGUgZWFjaCBvbmUuXG4gIGZvciAoY29uc3QgbG9jIG9mIGxvY2F0aW9ucykge1xuICAgIGlmICghbG9jLnVzZWQpIGNvbnRpbnVlO1xuICAgIC8vIE5PVEU6IHRoZSBlbnRyYW5jZSBvcmRlciBmb3IgTXQgU2FicmUgVyBMb3dlciBpcyBjaGFuZ2VkIGJlY2F1c2VcbiAgICAvLyB0aGUgYmFjayBvZiBaZWJ1IENhdmUgKFNhYnJlIFcgQ2F2ZSAxKSBpcyB3cml0dGVuIGJlZm9yZSBDb3JkZWwgVy5cbiAgICAvLyBUbyBoZWxwIGdldCB0aGUgZW50cmFuY2VzIGJhY2sgaW4gdGhlIHJpZ2h0IG9yZGVyLCB3ZSBkbyBhIHF1aWNrXG4gICAgLy8gc3BlY2lhbCBjYXNlIHRvIGRlZmVyIHdyaXRpbmcgdGhlIHplYnUgY2F2ZSByZWFkIHVudGlsIGFmdGVyIGNvcmRlbC5cbiAgICBpZiAobG9jID09PSBNdFNhYnJlV2VzdF9DYXZlMSkgY29udGludWU7XG4gICAgbG9jLm1ldGEud3JpdGUoKTtcbiAgICBpZiAobG9jID09PSBDb3JkZWxQbGFpbldlc3QgJiYgTXRTYWJyZVdlc3RfQ2F2ZTEudXNlZCkge1xuICAgICAgTXRTYWJyZVdlc3RfQ2F2ZTEubWV0YS53cml0ZSgpO1xuICAgIH1cbiAgfVxufVxuIl19
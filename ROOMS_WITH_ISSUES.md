# Rooms That Faced Issues - Analysis Report

## Summary

Based on server log analysis, here are the rooms that experienced issues:

---

## Rooms with Disconnections ⚠️

### Room: `kzsl56o`
- **Issue**: Participants disconnected
- **Participants Affected**:
  - `raween_guest_kzsl56o` (Guest)
  - `dr esraa_host_kzsl56o` (Host)
- **Status**: Room was deleted after disconnections
- **Server**: `http://178.128.78.195:7880` (LiveKit Server 1)
- **Evidence**: Found in logs: "Disconnected participant" entries

---

## Rooms with Excessive Recording Status Polling ⚠️

These rooms had high recording status polling activity (indicating active recordings or issues):

### 1. Room: `r0as74t`
- **Polling Count**: 156 instances in last 1000 log lines
- **Server**: `http://167.99.107.128:7880` (LiveKit Server 2)
- **Status**: Active recording session
- **Issue**: Excessive logging (performance impact)

### 2. Room: `dqpovbt`
- **Polling Count**: 115 instances in last 1000 log lines
- **Server**: `http://178.128.78.195:7880` (LiveKit Server 1)
- **Status**: Active recording session
- **Issue**: Excessive logging (performance impact)

### 3. Room: `kzsl56o`
- **Polling Count**: 71 instances in last 1000 log lines
- **Server**: `http://178.128.78.195:7880` (LiveKit Server 1)
- **Status**: Had disconnections + recording polling
- **Issue**: Both disconnection AND excessive logging

---

## Active Rooms (No Issues Detected)

### Room: `jqpc96w`
- **Status**: Active (multiple connection requests)
- **Server**: `http://178.128.78.195:7880` (LiveKit Server 1)
- **Issues**: None detected in logs

---

## Issue Breakdown by Room

| Room Name | Disconnections | High Polling | Server | Status |
|-----------|---------------|--------------|--------|--------|
| `kzsl56o` | ✅ Yes (2 participants) | ✅ Yes (71 polls) | Server 1 | Deleted |
| `r0as74t` | ❌ No | ✅ Yes (156 polls) | Server 2 | Active |
| `dqpovbt` | ❌ No | ✅ Yes (115 polls) | Server 1 | Active |
| `jqpc96w` | ❌ No | ❌ No | Server 1 | Active |

---

## Key Findings

1. **Room `kzsl56o`** had the most issues:
   - Both host and guest disconnected
   - High recording polling activity
   - Room was eventually deleted

2. **Recording Status Polling** is affecting multiple rooms:
   - `r0as74t`: 156 polls (most active)
   - `dqpovbt`: 115 polls
   - `kzsl56o`: 71 polls

3. **Server Distribution**:
   - Server 1 (`178.128.78.195:7880`): 3 rooms with issues
   - Server 2 (`167.99.107.128:7880`): 1 room with issues

---

## Recommendations

1. **Immediate**: Fix excessive recording status polling (Issue #2)
2. **Critical**: Add TrackPublicationFailed handler (Issue #1) - may have affected all rooms
3. **High**: Improve disconnection handling (Issue #5) - affected `kzsl56o`

---

## Note

- **Server Action Errors**: Not tied to specific rooms (appears to be client-side cache issue)
- **TrackPublicationFailed**: Not in logs (silent failure) - may have affected all rooms
- **Network Quality Issues**: Not in logs (client-side) - may have affected all rooms

The rooms listed above are the ones where we have **direct evidence** in server logs. However, client-side issues (like TrackPublicationFailed) may have affected other rooms without appearing in server logs.


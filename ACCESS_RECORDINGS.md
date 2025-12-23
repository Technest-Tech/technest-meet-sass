# How to Access Recordings

## Local Access (Recommended)

The recordings are stored in the `recordings/` folder in your project directory.

### Path
```
/Users/ahmedomar/Documents/technest/TarteelAcademy/Tarteel-meet-last/almajd-meet-livekit/recordings
```

### Quick Commands

**List all recordings:**
```bash
ls -lah recordings/
```

**Open in Finder (macOS):**
```bash
open recordings/
```

**View file sizes:**
```bash
du -sh recordings/*.mp4
```

**Copy a recording:**
```bash
cp recordings/2025-12-22T16-20-14-817Z-9h3t0u5.mp4 ~/Downloads/
```

## Docker Container Access

### Egress Server 1
```bash
# List files
docker exec livekit-egress-server1 ls -lah /recordings

# Copy file from container to host
docker cp livekit-egress-server1:/recordings/filename.mp4 ./recordings/
```

### Egress Server 2
```bash
# List files
docker exec livekit-egress-server2 ls -lah /recordings

# Copy file from container to host
docker cp livekit-egress-server2:/recordings/filename.mp4 ./recordings/
```

## File Naming Convention

Recordings are named with the format:
```
YYYY-MM-DDTHH-MM-SS-milliseconds-roomName.mp4
```

Example: `2025-12-22T16-20-14-817Z-9h3t0u5.mp4`
- Date: 2025-12-22
- Time: 16:20:14.817
- Room: 9h3t0u5

## Notes

- Recordings are automatically saved to `./recordings/` on your host machine
- The Docker containers mount this directory, so files are accessible both locally and in containers
- Files are typically 5-50 MB depending on recording length and quality
- JSON files contain metadata about each recording (egress ID, status, etc.)


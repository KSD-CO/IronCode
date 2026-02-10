# Resource Monitoring & Throttling

IronCode includes built-in memory and CPU monitoring with automatic throttling to prevent resource spikes.

**✨ NEW: Enabled by default with 300MB limit** - Because IDEs shouldn't eat RAM like crazy!

## Features

- **Real-time monitoring**: Tracks memory and CPU usage every 5 seconds
- **Automatic throttling**: Slows down processing when approaching limits
- **Garbage collection**: Forces GC when memory is critical
- **Configurable limits**: Set custom memory limits via CLI
- **Enabled by default**: 300MB limit out of the box

## Usage

### Default Behavior (Recommended)

```bash
# Just run normally - monitoring is ENABLED by default with 300MB limit
ironcode thread

# Monitoring is active automatically! No flags needed.
```

### Disable Monitoring (if needed)

```bash
# Turn it off if you want
ironcode thread --no-enable-resource-monitor
```

### Custom Memory Limit

```bash
# Use 500MB instead of default 300MB
ironcode thread --max-memory 500

# Lower limit for memory-constrained systems (200MB)
ironcode thread --max-memory 200

# Higher limit if you have RAM to spare (1GB)
ironcode thread --max-memory 1024
```

### With Logging

```bash
# See monitoring activity in real-time
ironcode thread --print-logs --log-level INFO
```

## Configuration Options

| Option                         | Description                      | Default   |
| ------------------------------ | -------------------------------- | --------- |
| `--enable-resource-monitor`    | Enable monitoring and throttling | `true` ✅ |
| `--no-enable-resource-monitor` | Disable monitoring               | -         |
| `--max-memory`                 | Max memory in MB                 | `300`     |

## How It Works

1. **Monitor**: Every 5 seconds, checks memory and CPU usage
2. **Warn**: Logs warning when memory exceeds 80% (240MB) or CPU exceeds 80%
3. **Throttle**: At 95% memory usage (285MB):
   - Adds delays between AI processing steps
   - Reduces batch sizes by 50%
   - Forces garbage collection
   - Doubles delay times in async operations
4. **Recover**: Automatically returns to normal when usage drops

## Thresholds (with 300MB default)

- **Normal**: < 240MB (80%), < 80% CPU
- **Warning**: 240-285MB (80-95%) or CPU > 80%
- **Critical**: > 285MB (95%) - throttling enabled

## Why 300MB Default?

IDEs should be **lightweight and efficient**, not memory hogs like:

- ❌ VS Code: 400-800MB per window
- ❌ IntelliJ IDEA: 1-2GB
- ❌ Eclipse: 500MB-1GB

✅ IronCode: **~250-300MB** with AI agent running - reasonable and efficient!

## Recommended Settings

### For Most Users (Default - Just Works™)

```bash
ironcode thread  # Uses 300MB limit automatically
```

### Windows (14GB RAM)

```bash
ironcode thread --max-memory 300  # Already the default!
```

### Mac (18GB RAM)

```bash
ironcode thread --max-memory 400  # Slightly higher if you want
```

### Memory-Constrained Systems

```bash
ironcode thread --max-memory 200  # Tighter limit
```

### Performance-First (Disable Monitoring)

```bash
ironcode thread --no-enable-resource-monitor  # No limits, YOLO mode
```

## Implementation Details

### Core Module: `src/util/resource.ts`

The `Resource` namespace provides:

```typescript
// Check if currently throttled
Resource.shouldThrottle() // boolean

// Get current status
Resource.status() // { memoryMB, memoryPercent, cpuPercent, isThrottled, level }

// Throttle-aware delay
await Resource.delay(1000) // 1s normally, 2s when throttled

// Conditional execution
Resource.ifNotThrottled(() => {
  // Only runs if not throttled
})

// Batch processing with auto-throttling
for await (const batch of Resource.batchProcess(items, 10)) {
  // Batch size reduced to 5 when throttled
}
```

### Integration Points

1. **Main entry** (`src/index.ts`):
   - CLI options
   - Start/stop monitoring
   - Enabled by default

2. **Message processing** (`src/session/prompt.ts`):
   - Adds delays when throttled
   - Slows down AI conversation loop

## Example Output

```
[INFO] Resource monitor enabled { maxMemoryMB: 300 }
[WARN] Resource usage elevated { memoryMB: 250, memoryPercent: 83, cpuPercent: 75 }
[ERROR] CRITICAL: Memory usage exceeded threshold, enabling throttling { memoryMB: 290, maxMemoryMB: 300, percent: 96 }
[INFO] Forcing garbage collection
[INFO] Resource usage normalized { memoryMB: 180, percent: 60 }
```

## Performance Impact

When **not** throttled (< 285MB):

- ✅ Zero overhead (monitoring runs in background)
- ✅ No delays added
- ✅ Full performance

When **throttled** (> 285MB):

- ⚠️ Processing slows by ~2x to reduce memory pressure
- ✅ Prevents crashes and system freezes
- ✅ Auto-recovers when usage normalizes

Monitoring overhead: **< 1% CPU**

## Alternative: Docker

For hard limits at OS level, use Docker:

```bash
docker run --memory="300m" --cpus="0.5" ironcode-image
```

## Testing

```bash
# Monitor in one terminal
tail -f ~/.local/state/ironcode/log/cli.log | grep -E "resource|throttl"

# Run IronCode in another
ironcode thread --print-logs
```

Then observe throttling when memory approaches 300MB.

## Disabling the Monitor

If you want the old behavior (no limits):

```bash
ironcode thread --no-enable-resource-monitor
```

Or set a very high limit:

```bash
ironcode thread --max-memory 10000  # 10GB, basically unlimited
```

---

**Philosophy**: IDEs should be lightweight tools that assist development, not resource-hungry behemoths. 300MB is reasonable for an AI-powered code editor with active conversation context.

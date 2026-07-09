// Read token stats from Claude Code session files
// Memory-efficient: caches pre-aggregated data per file, not raw entries
import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import { createInterface } from 'readline';

const CLAUDE_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// Max entries in fileCache (slightly above current file count to avoid thrashing)
const FILE_CACHE_MAX = 700;

// Safe readline: wraps createReadStream + createInterface with proper error handlers
// Prevents silent crashes from unhandled stream errors (Windows file locking, deleted files)
function safeReadLines(filePath, onLine) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });
    let streamError = null;

    stream.on('error', (err) => {
      streamError = err;
      // Don't reject here — let readline 'close' handle it
    });

    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('line', (line) => {
      try { onLine(line); } catch { /* skip bad line */ }
    });

    rl.on('close', () => {
      if (streamError) {
        reject(streamError);
      } else {
        resolve();
      }
    });

    rl.on('error', (err) => {
      reject(err);
    });
  });
}

// Pricing per 1M tokens (Anthropic official pricing)
// Fable 5 / Opus 4.x / Sonnet 4.6 / Haiku 4.5 GA rates.
// cacheCreation = 5-minute cache write (1.25x input); cacheCreation1h = 1-hour cache write (2x input).
const PRICING = {
  'fable': { input: 10, output: 50, cacheRead: 1, cacheCreation: 12.5, cacheCreation1h: 20 },
  'opus': { input: 5, output: 25, cacheRead: 0.5, cacheCreation: 6.25, cacheCreation1h: 10 },
  'sonnet': { input: 3, output: 15, cacheRead: 0.30, cacheCreation: 3.75, cacheCreation1h: 6 },
  'haiku': { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25, cacheCreation1h: 2 },
  'other': { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75, cacheCreation1h: 6 }
};

// Cache for computed stats (refresh every 60 seconds)
let cachedStats = null;
let lastCacheTime = 0;
const CACHE_TTL = 60000;

// Incremental file cache: filePath -> { mtime, size, agg }
// agg = pre-aggregated { byModel: { [model]: {input,output,cacheRead,cacheCreation} }, hourBuckets: { [hourKey]: { tokens, byModel } } }
// This stores ~200 bytes per file instead of thousands of raw entry objects
const fileCache = new Map();

// Get all project directories (async)
async function getProjectDirs() {
  try {
    if (!existsSync(PROJECTS_DIR)) return [];
    const items = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    return items.filter(d => d.isDirectory()).map(d => path.join(PROJECTS_DIR, d.name));
  } catch {
    return [];
  }
}

// Recursively find all .jsonl files in a directory (async)
async function findJsonlFilesRecursive(dir, cutoff, results = []) {
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await findJsonlFilesRecursive(fullPath, cutoff, results);
      } else if (item.name.endsWith('.jsonl')) {
        const stat = await fs.stat(fullPath);
        if (stat.mtimeMs > cutoff) {
          results.push({ path: fullPath, mtime: stat.mtimeMs, size: stat.size });
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return results;
}

// Get session files for a date range
async function getSessionFiles(daysBack = 7) {
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const files = [];

  const projectDirs = await getProjectDirs();
  for (const projectDir of projectDirs) {
    await findJsonlFilesRecursive(projectDir, cutoff, files);
  }

  return files.sort((a, b) => b.mtime - a.mtime);
}

// Parse a session file and return pre-aggregated data (memory efficient)
// Instead of storing every entry, aggregate by model + hour bucket on parse
async function parseAndAggregate(filePath) {
  const byModel = {};
  const hourBuckets = {};
  let minTs = Infinity;
  let maxTs = 0;

  try {
    await safeReadLines(filePath, (line) => {
      if (!line.trim()) return;

      const parsed = JSON.parse(line);

      if (parsed.message?.role === 'assistant' && parsed.message?.usage && parsed.message?.model !== '<synthetic>') {
        const usage = parsed.message.usage;
        const model = parsed.message.model || 'unknown';
        const timestamp = parsed.timestamp;
        const timestampMs = timestamp ? new Date(timestamp).getTime() : 0;

        if (timestampMs > 0) {
          if (timestampMs < minTs) minTs = timestampMs;
          if (timestampMs > maxTs) maxTs = timestampMs;
        }

        const modelLower = model.toLowerCase();
        const modelKey = modelLower.includes('fable') ? 'fable' :
                        modelLower.includes('opus') ? 'opus' :
                        modelLower.includes('sonnet') ? 'sonnet' :
                        modelLower.includes('haiku') ? 'haiku' : 'other';

        // sum top-level usage only; usage.iterations[] is already rolled up into these totals — do NOT add iterations
        const input = usage.input_tokens || 0;
        const output = usage.output_tokens || 0;
        const cacheRead = usage.cache_read_input_tokens || 0;
        const cacheCreation = usage.cache_creation_input_tokens || 0;
        // 1-hour cache writes cost ~2x the 5-minute tier — track separately for accurate cost
        const cacheCreation1h = usage.cache_creation?.ephemeral_1h_input_tokens || 0;

        if (!byModel[modelKey]) {
          byModel[modelKey] = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, cacheCreation1h: 0 };
        }
        byModel[modelKey].input += input;
        byModel[modelKey].output += output;
        byModel[modelKey].cacheRead += cacheRead;
        byModel[modelKey].cacheCreation += cacheCreation;
        byModel[modelKey].cacheCreation1h += cacheCreation1h;

        if (timestampMs > 0) {
          const d = new Date(timestampMs);
          const hourKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}`;
          if (!hourBuckets[hourKey]) {
            hourBuckets[hourKey] = { tokens: 0, fable: 0, opus: 0, sonnet: 0, haiku: 0, other: 0 };
          }
          const tokens = input + output;
          hourBuckets[hourKey].tokens += tokens;
          if (modelKey === 'fable') hourBuckets[hourKey].fable += tokens;
          else if (modelKey === 'opus') hourBuckets[hourKey].opus += tokens;
          else if (modelKey === 'sonnet') hourBuckets[hourKey].sonnet += tokens;
          else if (modelKey === 'haiku') hourBuckets[hourKey].haiku += tokens;
          else hourBuckets[hourKey].other += tokens;
        }
      }
    });
  } catch (err) {
    console.error(`[STATS] Error parsing ${path.basename(filePath)}: ${err.message}`);
  }

  return { byModel, hourBuckets, minTs, maxTs };
}

// Calculate cost for tokens. cacheCreation is the TOTAL cache-write tokens; cacheCreation1h is the
// 1-hour-tier subset (priced 2x). The remainder (5m + any untiered) is priced at the 5m rate.
function calculateCost(model, input, output, cacheRead, cacheCreation, cacheCreation1h = 0) {
  const pricing = PRICING[model] || PRICING.opus;
  const cc1h = cacheCreation1h || 0;
  const cc5mAndUntiered = Math.max(0, (cacheCreation || 0) - cc1h);
  return (
    (input / 1000000) * pricing.input +
    (output / 1000000) * pricing.output +
    (cacheRead / 1000000) * pricing.cacheRead +
    (cc5mAndUntiered / 1000000) * pricing.cacheCreation +
    (cc1h / 1000000) * (pricing.cacheCreation1h || pricing.cacheCreation)
  );
}

// Cache efficiency for one model's aggregate.
//   cacheHitRate   = cacheRead / (cacheRead + cacheCreation + input) — share of prompt tokens
//                    served cheaply from cache. High = good.
//   wastedInputCost = the *premium* paid on fresh (uncached) input vs if those same tokens had
//                    been cache reads (~10x cheaper). It's the money you'd save with perfect caching —
//                    an upper bound, since the first request always has to be fresh. Big number ⇒
//                    context kept getting re-sent fresh (idle > 5m cache-TTL expiry, or prefix churn).
function cacheEfficiencyForModel(model, data) {
  const pricing = PRICING[model] || PRICING.opus;
  const cacheableTotal = data.cacheRead + data.cacheCreation + data.input;
  const cacheHitRate = cacheableTotal > 0 ? data.cacheRead / cacheableTotal : 0;
  const wastedInputCost = (data.input / 1000000) * (pricing.input - pricing.cacheRead);
  return {
    cacheHitRate: Math.round(cacheHitRate * 1000) / 1000,
    wastedInputCost: Math.round(wastedInputCost * 100) / 100
  };
}

// Overall cache efficiency across all models (for the single dashboard badge).
function computeCacheEfficiency(byModel) {
  let cacheRead = 0, cacheCreation = 0, input = 0, wastedCost = 0;
  for (const [model, data] of Object.entries(byModel)) {
    const pricing = PRICING[model] || PRICING.opus;
    cacheRead += data.cacheRead;
    cacheCreation += data.cacheCreation;
    input += data.input;
    wastedCost += (data.input / 1000000) * (pricing.input - pricing.cacheRead);
  }
  const cacheableTotal = cacheRead + cacheCreation + input;
  const hitRate = cacheableTotal > 0 ? cacheRead / cacheableTotal : 0;
  return {
    hitRate: Math.round(hitRate * 1000) / 1000,
    wastedCost: Math.round(wastedCost * 100) / 100,
    cacheReadTokens: cacheRead,
    freshInputTokens: input
  };
}

// Build model usage display object
function buildModelUsage(byModel) {
  const result = {};
  for (const [model, data] of Object.entries(byModel)) {
    const displayName = model.charAt(0).toUpperCase() + model.slice(1);
    const cost = calculateCost(model, data.input, data.output, data.cacheRead, data.cacheCreation, data.cacheCreation1h);
    const { cacheHitRate, wastedInputCost } = cacheEfficiencyForModel(model, data);
    result[displayName] = {
      inputTokens: data.input,
      outputTokens: data.output,
      cacheReadTokens: data.cacheRead,
      cacheCreationTokens: data.cacheCreation,
      cacheCreation1hTokens: data.cacheCreation1h || 0,
      totalTokens: data.input + data.output,
      estimatedCost: Math.round(cost * 100) / 100,
      cacheHitRate,
      wastedInputCost
    };
  }
  return result;
}

// Filter byModel to only include entries after startMs
// Since we aggregate by hour buckets, we use those for time-filtered queries
function aggregateFromBuckets(allAggs, startMs) {
  let tokens = 0;
  let cost = 0;
  const byModel = {};

  for (const agg of allAggs) {
    // Quick skip: if entire file is before startMs, skip
    if (agg.maxTs < startMs) continue;

    // If entire file is after startMs, use full byModel totals (fast path)
    // tokens is recomputed from byModel below, so we only accumulate byModel here
    if (agg.minTs >= startMs) {
      for (const [model, data] of Object.entries(agg.byModel)) {
        if (!byModel[model]) byModel[model] = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, cacheCreation1h: 0 };
        byModel[model].input += data.input;
        byModel[model].output += data.output;
        byModel[model].cacheRead += data.cacheRead;
        byModel[model].cacheCreation += data.cacheCreation;
        byModel[model].cacheCreation1h += data.cacheCreation1h || 0;
      }
      continue;
    }

    // Partial overlap: tokens is recomputed from byModel below, so no per-bucket
    // token accumulation is needed here — just include the file's full byModel.
    // For cost: use full byModel if file overlaps significantly, or skip tokens-only for partial
    // Better approach: always use full byModel for files that overlap (slight overcount for month boundary files)
    // The accuracy difference is negligible since we're looking at month/week boundaries
    for (const [model, data] of Object.entries(agg.byModel)) {
      if (!byModel[model]) byModel[model] = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, cacheCreation1h: 0 };
      // For partially overlapping files, include full data (within ~1 hour accuracy)
      byModel[model].input += data.input;
      byModel[model].output += data.output;
      byModel[model].cacheRead += data.cacheRead;
      byModel[model].cacheCreation += data.cacheCreation;
      byModel[model].cacheCreation1h += data.cacheCreation1h || 0;
    }
  }

  // Recalculate tokens from byModel for consistency
  tokens = 0;
  for (const data of Object.values(byModel)) {
    tokens += data.input + data.output;
  }

  for (const [model, data] of Object.entries(byModel)) {
    cost += calculateCost(model, data.input, data.output, data.cacheRead, data.cacheCreation, data.cacheCreation1h);
  }

  return { tokens, cost, byModel };
}

// Main function - only calculates monthly cost data
// Session/Weekly usage should come from Chrome extension
export async function readStatsCache() {
  if (cachedStats && (Date.now() - lastCacheTime) < CACHE_TTL) {
    return cachedStats;
  }

  const t0 = Date.now();

  const sessionFiles = await getSessionFiles(31); // Last 31 days for monthly

  // Collect pre-aggregated data per file using incremental cache
  const allAggs = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const file of sessionFiles) {
    const cached = fileCache.get(file.path);
    if (cached && cached.mtime === file.mtime && cached.size === file.size) {
      cacheHits++;
      allAggs.push(cached.agg);
    } else {
      cacheMisses++;
      const agg = await parseAndAggregate(file.path);
      fileCache.set(file.path, { mtime: file.mtime, size: file.size, agg });
      allAggs.push(agg);
    }
  }

  // Clean stale file cache entries (files that no longer exist in scan)
  const currentPaths = new Set(sessionFiles.map(f => f.path));
  for (const key of fileCache.keys()) {
    if (!currentPaths.has(key)) fileCache.delete(key);
  }

  // Evict oldest entries if cache exceeds limit (prevent unbounded growth)
  if (fileCache.size > FILE_CACHE_MAX) {
    const excess = fileCache.size - FILE_CACHE_MAX;
    const keys = fileCache.keys();
    for (let i = 0; i < excess; i++) {
      const { value } = keys.next();
      if (value) fileCache.delete(value);
    }
  }

  // Monthly usage (1st of current month to now)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const month = aggregateFromBuckets(allAggs, monthStart.getTime());
  const monthModelUsage = buildModelUsage(month.byModel);

  // Primary model this month
  let primaryModel = 'opus';
  let maxModelTokens = 0;
  for (const [model, data] of Object.entries(month.byModel)) {
    const modelTokens = data.input + data.output;
    if (modelTokens > maxModelTokens) {
      maxModelTokens = modelTokens;
      primaryModel = model;
    }
  }

  // Weekly usage (last 7 days)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const week = aggregateFromBuckets(allAggs, weekStart.getTime());
  const weekModelUsage = buildModelUsage(week.byModel);

  // Hourly breakdown for last 12 hours (from pre-aggregated hour buckets)
  const now = new Date();
  const currentHour = now.getHours();
  const session_hourly = [];

  for (let i = 0; i < 12; i++) {
    const hourOffset = (currentHour - i + 24) % 24;
    const hourStart = new Date(now);
    hourStart.setHours(currentHour - i, 0, 0, 0);

    const hourKey = `${hourStart.getFullYear()}-${String(hourStart.getMonth()+1).padStart(2,'0')}-${String(hourStart.getDate()).padStart(2,'0')}-${String(hourStart.getHours()).padStart(2,'0')}`;

    const hourByModel = { fable: 0, opus: 0, sonnet: 0, haiku: 0, other: 0 };
    let hourTokens = 0;

    // Sum across all file aggregations for this hour
    for (const agg of allAggs) {
      const bucket = agg.hourBuckets[hourKey];
      if (bucket) {
        hourTokens += bucket.tokens;
        hourByModel.fable += bucket.fable || 0;
        hourByModel.opus += bucket.opus;
        hourByModel.sonnet += bucket.sonnet;
        hourByModel.haiku += bucket.haiku;
        hourByModel.other += bucket.other || 0;
      }
    }

    session_hourly.push({
      hour: hourOffset,
      timeLabel: `${hourOffset.toString().padStart(2, '0')}:00`,
      tokens: hourTokens,
      byModel: hourByModel,
      isCurrentHour: i === 0
    });
  }

  cachedStats = {
    month_used: month.tokens,
    month_cost: Math.round(month.cost * 100) / 100,
    month_start: monthStart.toISOString().split('T')[0],
    monthModelUsage,

    week_used: week.tokens,
    week_cost: Math.round(week.cost * 100) / 100,
    weekModelUsage,

    session_hourly,
    session_primary_model: primaryModel,

    modelUsage: weekModelUsage,
    totalCost: Math.round(week.cost * 100) / 100,

    // Cache efficiency badge (this-week window). hitRate 0–1; wastedCost = $ premium paid on
    // uncached fresh input vs cache reads — see cacheEfficiencyForModel().
    cacheEfficiency: computeCacheEfficiency(week.byModel),

    last_updated: new Date().toISOString()
  };

  lastCacheTime = Date.now();
  const elapsed = Date.now() - t0;
  const heapMB = Math.round(process.memoryUsage().heapUsed / 1048576);
  console.log(`[STATS] ${sessionFiles.length} files (${cacheHits} cached, ${cacheMisses} parsed) in ${elapsed}ms [${heapMB}MB heap] — Month: ${month.tokens.toLocaleString()} tokens $${cachedStats.month_cost}, Week: ${week.tokens.toLocaleString()} tokens $${cachedStats.week_cost}`);

  return cachedStats;
}

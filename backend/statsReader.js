// Read token stats from Claude Code session files
// Simplified: Only calculates monthly costs from session files
// Session/Weekly usage comes from Chrome extension (claudeUsage)
import fs from 'fs/promises';
import { existsSync, createReadStream, statSync } from 'fs';
import path from 'path';
import { createInterface } from 'readline';

const CLAUDE_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// Pricing per 1M tokens (Anthropic official pricing)
const PRICING = {
  'opus': { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
  'sonnet': { input: 3, output: 15, cacheRead: 0.30, cacheCreation: 3.75 },
  'haiku': { input: 0.25, output: 1.25, cacheRead: 0.03, cacheCreation: 0.30 }
};

// Cache for computed stats (refresh every 15 seconds)
let cachedStats = null;
let lastCacheTime = 0;
const CACHE_TTL = 15000;

// Incremental file cache: filePath -> { mtime, size, entries }
// Avoids re-parsing unchanged files on every refresh
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

// Parse a session file using STREAMING (memory efficient for large files)
async function parseSessionFile(filePath) {
  const entries = [];

  try {
    const rl = createInterface({
      input: createReadStream(filePath, { highWaterMark: 64 * 1024 }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);

        if (parsed.message?.role === 'assistant' && parsed.message?.usage) {
          const usage = parsed.message.usage;
          const model = parsed.message.model || 'unknown';
          const timestamp = parsed.timestamp;
          const timestampMs = timestamp ? new Date(timestamp).getTime() : 0;

          const modelLower = model.toLowerCase();
          const modelKey = modelLower.includes('opus') ? 'opus' :
                          modelLower.includes('sonnet') ? 'sonnet' :
                          modelLower.includes('haiku') ? 'haiku' : 'other';

          entries.push({
            timestamp: timestampMs,
            modelKey,
            input: usage.input_tokens || 0,
            output: usage.output_tokens || 0,
            cacheRead: usage.cache_read_input_tokens || 0,
            cacheCreation: usage.cache_creation_input_tokens || 0
          });
        }
      } catch {
        // Skip invalid lines
      }
    }
  } catch (err) {
    console.error('Error parsing session file:', err.message);
  }

  return entries;
}

// Get entries for a file, using cache if file hasn't changed
async function getFileEntries(file) {
  const cached = fileCache.get(file.path);
  if (cached && cached.mtime === file.mtime && cached.size === file.size) {
    return cached.entries;
  }

  // File changed or new — re-parse
  const entries = await parseSessionFile(file.path);
  fileCache.set(file.path, { mtime: file.mtime, size: file.size, entries });
  return entries;
}

// Calculate cost for tokens
function calculateCost(model, input, output, cacheRead, cacheCreation) {
  const pricing = PRICING[model] || PRICING.opus;
  return (
    (input / 1000000) * pricing.input +
    (output / 1000000) * pricing.output +
    (cacheRead / 1000000) * pricing.cacheRead +
    (cacheCreation / 1000000) * pricing.cacheCreation
  );
}

// Aggregate entries by model for a time range
function aggregateEntries(allEntries, startMs) {
  let tokens = 0;
  let cost = 0;
  const byModel = {};

  for (const entry of allEntries) {
    if (entry.timestamp < startMs) continue;
    tokens += entry.input + entry.output;

    if (!byModel[entry.modelKey]) {
      byModel[entry.modelKey] = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
    }
    byModel[entry.modelKey].input += entry.input;
    byModel[entry.modelKey].output += entry.output;
    byModel[entry.modelKey].cacheRead += entry.cacheRead;
    byModel[entry.modelKey].cacheCreation += entry.cacheCreation;
  }

  for (const [model, data] of Object.entries(byModel)) {
    cost += calculateCost(model, data.input, data.output, data.cacheRead, data.cacheCreation);
  }

  return { tokens, cost, byModel };
}

// Build model usage display object
function buildModelUsage(byModel) {
  const result = {};
  for (const [model, data] of Object.entries(byModel)) {
    const displayName = model.charAt(0).toUpperCase() + model.slice(1);
    const cost = calculateCost(model, data.input, data.output, data.cacheRead, data.cacheCreation);
    result[displayName] = {
      inputTokens: data.input,
      outputTokens: data.output,
      cacheReadTokens: data.cacheRead,
      cacheCreationTokens: data.cacheCreation,
      totalTokens: data.input + data.output,
      estimatedCost: Math.round(cost * 100) / 100
    };
  }
  return result;
}

// Main function - only calculates monthly cost data
// Session/Weekly usage should come from Chrome extension
export async function readStatsCache() {
  if (cachedStats && (Date.now() - lastCacheTime) < CACHE_TTL) {
    return cachedStats;
  }

  const t0 = Date.now();

  const sessionFiles = await getSessionFiles(31); // Last 31 days for monthly

  // Collect all entries using incremental file cache
  // Only re-parses files whose mtime/size changed since last scan
  const allEntries = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const file of sessionFiles) {
    const cached = fileCache.get(file.path);
    if (cached && cached.mtime === file.mtime && cached.size === file.size) {
      cacheHits++;
      allEntries.push(...cached.entries);
    } else {
      cacheMisses++;
      const entries = await parseSessionFile(file.path);
      fileCache.set(file.path, { mtime: file.mtime, size: file.size, entries });
      allEntries.push(...entries);
    }
  }

  // Clean stale file cache entries (files that no longer exist in scan)
  const currentPaths = new Set(sessionFiles.map(f => f.path));
  for (const key of fileCache.keys()) {
    if (!currentPaths.has(key)) fileCache.delete(key);
  }

  // Monthly usage (1st of current month to now)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const month = aggregateEntries(allEntries, monthStart.getTime());
  const monthModelUsage = buildModelUsage(month.byModel);

  // Primary model this month
  let primaryModel = 'sonnet';
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
  const week = aggregateEntries(allEntries, weekStart.getTime());
  const weekModelUsage = buildModelUsage(week.byModel);

  // Hourly breakdown for last 12 hours
  const now = new Date();
  const currentHour = now.getHours();
  const session_hourly = [];

  for (let i = 0; i < 12; i++) {
    const hourOffset = (currentHour - i + 24) % 24;
    const hourStart = new Date(now);
    hourStart.setHours(currentHour - i, 0, 0, 0);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourStart.getHours() + 1);

    const hourStartMs = hourStart.getTime();
    const hourEndMs = hourEnd.getTime();

    const hourByModel = { opus: 0, sonnet: 0, haiku: 0 };
    let hourTokens = 0;

    for (const entry of allEntries) {
      if (entry.timestamp >= hourStartMs && entry.timestamp < hourEndMs) {
        const tokens = entry.input + entry.output;
        hourTokens += tokens;
        if (entry.modelKey === 'opus') hourByModel.opus += tokens;
        else if (entry.modelKey === 'sonnet') hourByModel.sonnet += tokens;
        else if (entry.modelKey === 'haiku') hourByModel.haiku += tokens;
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

    last_updated: new Date().toISOString()
  };

  lastCacheTime = Date.now();
  const elapsed = Date.now() - t0;
  console.log(`[STATS] ${sessionFiles.length} files (${cacheHits} cached, ${cacheMisses} parsed) in ${elapsed}ms — Month: ${month.tokens.toLocaleString()} tokens $${cachedStats.month_cost}, Week: ${week.tokens.toLocaleString()} tokens $${cachedStats.week_cost}`);

  return cachedStats;
}

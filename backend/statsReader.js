// Read token stats from Claude Code session files
// Simplified: Only calculates monthly costs from session files
// Session/Weekly usage comes from Chrome extension (claudeUsage)
import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
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

// Cache for session data (refresh every 15 seconds)
let cachedStats = null;
let lastCacheTime = 0;
const CACHE_TTL = 15000;

// Get all project directories (async)
async function getProjectDirs() {
  try {
    if (!existsSync(PROJECTS_DIR)) return [];
    const items = await fs.readdir(PROJECTS_DIR);
    const dirs = [];
    for (const f of items) {
      const fullPath = path.join(PROJECTS_DIR, f);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        dirs.push(fullPath);
      }
    }
    return dirs;
  } catch (err) {
    return [];
  }
}

// Recursively find all .jsonl files in a directory (async)
async function findJsonlFilesRecursive(dir, cutoff, results = []) {
  try {
    const items = await fs.readdir(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        await findJsonlFilesRecursive(fullPath, cutoff, results);
      } else if (item.endsWith('.jsonl') && stat.mtimeMs > cutoff) {
        results.push({ path: fullPath, mtime: stat.mtimeMs, size: stat.size });
      }
    }
  } catch (err) {
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
  const results = {
    entries: [],
    byModel: {},
    totalInput: 0,
    totalOutput: 0,
    totalCacheRead: 0,
    totalCacheCreation: 0
  };

  try {
    // Use readline streaming instead of loading entire file
    const rl = createInterface({
      input: createReadStream(filePath, { highWaterMark: 64 * 1024 }), // 64KB chunks
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

          const inputTokens = usage.input_tokens || 0;
          const outputTokens = usage.output_tokens || 0;
          const cacheReadTokens = usage.cache_read_input_tokens || 0;
          const cacheCreationTokens = usage.cache_creation_input_tokens || 0;

          results.entries.push({
            timestamp: timestampMs,
            modelKey,
            input: inputTokens,
            output: outputTokens,
            cacheRead: cacheReadTokens,
            cacheCreation: cacheCreationTokens
          });

          if (!results.byModel[modelKey]) {
            results.byModel[modelKey] = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
          }
          results.byModel[modelKey].input += inputTokens;
          results.byModel[modelKey].output += outputTokens;
          results.byModel[modelKey].cacheRead += cacheReadTokens;
          results.byModel[modelKey].cacheCreation += cacheCreationTokens;

          results.totalInput += inputTokens;
          results.totalOutput += outputTokens;
          results.totalCacheRead += cacheReadTokens;
          results.totalCacheCreation += cacheCreationTokens;
        }
      } catch (e) {
        // Skip invalid lines
      }
    }
  } catch (err) {
    console.error('Error parsing session file:', err.message);
  }

  return results;
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

// Main function - only calculates monthly cost data
// Session/Weekly usage should come from Chrome extension
export async function readStatsCache() {
  if (cachedStats && (Date.now() - lastCacheTime) < CACHE_TTL) {
    return cachedStats;
  }

  console.log('[STATS] Refreshing token stats from session files...');

  const sessionFiles = await getSessionFiles(31); // Last 31 days for monthly
  console.log(`   Found ${sessionFiles.length} session files`);

  const allEntries = [];
  const aggregatedByModel = {};

  for (const file of sessionFiles) {
    const stats = await parseSessionFile(file.path);
    allEntries.push(...stats.entries);

    for (const [model, data] of Object.entries(stats.byModel)) {
      if (!aggregatedByModel[model]) {
        aggregatedByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
      }
      aggregatedByModel[model].input += data.input;
      aggregatedByModel[model].output += data.output;
      aggregatedByModel[model].cacheRead += data.cacheRead;
      aggregatedByModel[model].cacheCreation += data.cacheCreation;
    }
  }

  // Calculate Monthly usage (1st of current month to now)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  let monthTokens = 0;
  let monthCost = 0;
  const monthByModel = {};

  for (const entry of allEntries) {
    if (entry.timestamp >= monthStartMs) {
      monthTokens += entry.input + entry.output;

      if (!monthByModel[entry.modelKey]) {
        monthByModel[entry.modelKey] = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
      }
      monthByModel[entry.modelKey].input += entry.input;
      monthByModel[entry.modelKey].output += entry.output;
      monthByModel[entry.modelKey].cacheRead += entry.cacheRead;
      monthByModel[entry.modelKey].cacheCreation += entry.cacheCreation;
    }
  }

  // Calculate month cost by model
  for (const [model, data] of Object.entries(monthByModel)) {
    monthCost += calculateCost(model, data.input, data.output, data.cacheRead, data.cacheCreation);
  }

  // Build monthly model usage
  const monthModelUsage = {};
  for (const [model, data] of Object.entries(monthByModel)) {
    const displayName = model.charAt(0).toUpperCase() + model.slice(1);
    const cost = calculateCost(model, data.input, data.output, data.cacheRead, data.cacheCreation);
    monthModelUsage[displayName] = {
      inputTokens: data.input,
      outputTokens: data.output,
      cacheReadTokens: data.cacheRead,
      cacheCreationTokens: data.cacheCreation,
      totalTokens: data.input + data.output,
      estimatedCost: Math.round(cost * 100) / 100
    };
  }

  // Determine primary model (most used this month)
  let primaryModel = 'sonnet';
  let maxModelTokens = 0;
  for (const [model, data] of Object.entries(monthByModel)) {
    const modelTokens = data.input + data.output;
    if (modelTokens > maxModelTokens) {
      maxModelTokens = modelTokens;
      primaryModel = model;
    }
  }

  // Calculate Weekly usage (last 7 days)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartMs = weekStart.getTime();

  let weekTokens = 0;
  let weekCost = 0;
  const weekByModel = {};

  for (const entry of allEntries) {
    if (entry.timestamp >= weekStartMs) {
      weekTokens += entry.input + entry.output;

      if (!weekByModel[entry.modelKey]) {
        weekByModel[entry.modelKey] = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
      }
      weekByModel[entry.modelKey].input += entry.input;
      weekByModel[entry.modelKey].output += entry.output;
      weekByModel[entry.modelKey].cacheRead += entry.cacheRead;
      weekByModel[entry.modelKey].cacheCreation += entry.cacheCreation;
    }
  }

  // Calculate week cost by model
  for (const [model, data] of Object.entries(weekByModel)) {
    weekCost += calculateCost(model, data.input, data.output, data.cacheRead, data.cacheCreation);
  }

  // Build weekly model usage
  const weekModelUsage = {};
  for (const [model, data] of Object.entries(weekByModel)) {
    const displayName = model.charAt(0).toUpperCase() + model.slice(1);
    const cost = calculateCost(model, data.input, data.output, data.cacheRead, data.cacheCreation);
    weekModelUsage[displayName] = {
      inputTokens: data.input,
      outputTokens: data.output,
      cacheReadTokens: data.cacheRead,
      cacheCreationTokens: data.cacheCreation,
      totalTokens: data.input + data.output,
      estimatedCost: Math.round(cost * 100) / 100
    };
  }

  // Generate hourly breakdown for last 12 hours (most recent first)
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

    // Find entries in this hour
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
    // Monthly totals (calculated from session files)
    month_used: monthTokens,
    month_cost: Math.round(monthCost * 100) / 100,
    month_start: monthStart.toISOString().split('T')[0],
    monthModelUsage,

    // Weekly totals (last 7 days)
    week_used: weekTokens,
    week_cost: Math.round(weekCost * 100) / 100,
    weekModelUsage,

    // Hourly breakdown for last 12 hours
    session_hourly,

    // Primary model this month
    session_primary_model: primaryModel,

    // Model usage for display (use WEEKLY data)
    modelUsage: weekModelUsage,
    totalCost: Math.round(weekCost * 100) / 100,

    last_updated: new Date().toISOString()
  };

  lastCacheTime = Date.now();
  console.log(`   Month: ${monthTokens.toLocaleString()} tokens, $${cachedStats.month_cost}`);
  console.log(`   Week: ${weekTokens.toLocaleString()} tokens, $${cachedStats.week_cost}`);

  return cachedStats;
}

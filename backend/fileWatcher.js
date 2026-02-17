// File Watcher for Claude Code real data
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLAUDE_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const STATS_FILE = path.join(CLAUDE_DIR, 'stats-cache.json');
const TODOS_DIR = path.join(CLAUDE_DIR, 'todos');

// Current state
let state = {
  sessions: [],
  agents: [],
  tasks: [],
  tokens: {
    today_used: 0,
    daily_limit: 1000000, // Opus daily limit ~1M tokens
    week_used: 0,
    weekly_limit: 5000000,
    last_updated: new Date().toISOString()
  }
};

// Parse session ID from filename
function getSessionId(filename) {
  return path.basename(filename, '.jsonl');
}

// Read stats cache for token usage
export function readStatsCache() {
  try {
    if (!fs.existsSync(STATS_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));

    const today = new Date().toISOString().split('T')[0];
    const todayStats = data.dailyModelTokens?.find(d => d.date === today);

    // Calculate today's tokens
    let todayTokens = 0;
    if (todayStats?.tokensByModel) {
      todayTokens = Object.values(todayStats.tokensByModel).reduce((sum, t) => sum + t, 0);
    }

    // Calculate week's tokens (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekTokens = data.dailyModelTokens
      ?.filter(d => new Date(d.date) >= weekAgo)
      ?.reduce((sum, d) => {
        const tokens = Object.values(d.tokensByModel || {}).reduce((s, t) => s + t, 0);
        return sum + tokens;
      }, 0) || 0;

    // Get total model usage
    const modelUsage = data.modelUsage || {};

    return {
      today_used: todayTokens,
      week_used: weekTokens,
      totalSessions: data.totalSessions || 0,
      totalMessages: data.totalMessages || 0,
      modelUsage,
      dailyActivity: data.dailyActivity || []
    };
  } catch (err) {
    console.error('Error reading stats cache:', err.message);
    return null;
  }
}

// Find all project directories
function getProjectDirs() {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) return [];
    return fs.readdirSync(PROJECTS_DIR)
      .filter(f => fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory())
      .map(f => path.join(PROJECTS_DIR, f));
  } catch (err) {
    return [];
  }
}

// Get recent session files (modified in last 24 hours)
function getRecentSessionFiles() {
  const sessions = [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

  for (const projectDir of getProjectDirs()) {
    try {
      const files = fs.readdirSync(projectDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          path: path.join(projectDir, f),
          stats: fs.statSync(path.join(projectDir, f))
        }))
        .filter(f => f.stats.mtimeMs > cutoff)
        .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

      sessions.push(...files.slice(0, 5)); // Top 5 per project
    } catch (err) {
      // Skip inaccessible directories
    }
  }

  return sessions.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs).slice(0, 10);
}

// Parse session file to get metadata
function parseSessionFile(filePath) {
  try {
    const sessionId = getSessionId(filePath);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    let firstMessage = null;
    let lastMessage = null;
    let messageCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let sessionName = 'Unknown Session';
    let isActive = false;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        // Get first user message for session name
        if (parsed.message?.role === 'user' && !firstMessage) {
          firstMessage = parsed;
          const content = parsed.message?.content;
          if (typeof content === 'string') {
            sessionName = content.slice(0, 50) + (content.length > 50 ? '...' : '');
          } else if (Array.isArray(content)) {
            const text = content.find(c => c.type === 'text')?.text || '';
            sessionName = text.slice(0, 50) + (text.length > 50 ? '...' : '');
          }
        }

        // Track last message
        if (parsed.message) {
          lastMessage = parsed;
          messageCount++;
        }

        // Extract token usage
        if (parsed.message?.usage) {
          inputTokens += parsed.message.usage.input_tokens || 0;
          outputTokens += parsed.message.usage.output_tokens || 0;
          inputTokens += parsed.message.usage.cache_creation_input_tokens || 0;
          inputTokens += parsed.message.usage.cache_read_input_tokens || 0;
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Determine if session is active (modified in last 5 minutes)
    isActive = Date.now() - stats.mtimeMs < 5 * 60 * 1000;

    // Get project name from path
    const projectName = path.basename(path.dirname(filePath));

    return {
      session_id: sessionId,
      name: sessionName,
      project: projectName,
      status: isActive ? 'RUNNING' : 'DONE',
      started_at: stats.birthtime.toISOString(),
      ended_at: isActive ? null : stats.mtime.toISOString(),
      tokens_used: inputTokens + outputTokens,
      message_count: messageCount,
      file_path: filePath
    };
  } catch (err) {
    console.error('Error parsing session:', err.message);
    return null;
  }
}

// Read agent todos
function readAgentTodos() {
  const agents = [];

  try {
    if (!fs.existsSync(TODOS_DIR)) return agents;

    const files = fs.readdirSync(TODOS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        path: path.join(TODOS_DIR, f),
        stats: fs.statSync(path.join(TODOS_DIR, f))
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs)
      .slice(0, 10);

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
        const filename = path.basename(file.path, '.json');
        const parts = filename.split('-agent-');
        const sessionId = parts[0];
        const agentId = parts[1] || sessionId;

        // Determine agent role from filename or content
        let role = 'Agent';
        if (filename.includes('explore')) role = 'Explorer';
        else if (filename.includes('plan')) role = 'Planner';
        else if (filename.includes('code')) role = 'Coder';
        else if (filename.includes('review')) role = 'Reviewer';
        else if (filename.includes('test')) role = 'Tester';

        // Get current task from todos
        const todos = data.todos || [];
        const inProgress = todos.find(t => t.status === 'in_progress');
        const pending = todos.filter(t => t.status === 'pending').length;
        const completed = todos.filter(t => t.status === 'completed').length;

        // Determine status
        let status = 'IDLE';
        if (inProgress) status = 'RUNNING';
        else if (pending === 0 && completed > 0) status = 'DONE';

        agents.push({
          agent_id: `agt_${agentId.slice(0, 8)}`,
          session_id: sessionId,
          role: role,
          status: status,
          current_task: inProgress?.content || inProgress?.activeForm || 'Waiting...',
          tokens_used: 0, // Not available in todo files
          todos: {
            total: todos.length,
            completed,
            pending,
            in_progress: inProgress ? 1 : 0
          },
          last_updated: file.stats.mtime.toISOString()
        });
      } catch {
        // Skip invalid files
      }
    }
  } catch (err) {
    console.error('Error reading todos:', err.message);
  }

  return agents;
}

// Get tasks from current session
function getSessionTasks(sessionPath) {
  const tasks = [];

  try {
    if (!sessionPath || !fs.existsSync(sessionPath)) return tasks;

    const content = fs.readFileSync(sessionPath, 'utf-8');
    const lines = content.trim().split('\n').slice(-100); // Last 100 lines

    let taskId = 0;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        // Extract tool calls as tasks
        if (parsed.message?.content) {
          const content = parsed.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use') {
                taskId++;
                tasks.push({
                  task_id: taskId,
                  session_id: parsed.sessionId,
                  agent_role: 'Claude',
                  tool: block.name,
                  description: getToolDescription(block.name, block.input),
                  status: 'DONE',
                  completed_at: parsed.timestamp
                });
              }
            }
          }
        }

        // Extract thinking as planning tasks
        if (parsed.message?.content) {
          const content = parsed.message.content;
          if (Array.isArray(content)) {
            const thinking = content.find(c => c.type === 'thinking');
            if (thinking && thinking.thinking?.length > 100) {
              taskId++;
              tasks.push({
                task_id: taskId,
                session_id: parsed.sessionId,
                agent_role: 'Thinking',
                tool: 'analysis',
                description: thinking.thinking.slice(0, 80) + '...',
                status: 'DONE',
                completed_at: parsed.timestamp
              });
            }
          }
        }
      } catch {
        // Skip invalid lines
      }
    }
  } catch (err) {
    console.error('Error reading session tasks:', err.message);
  }

  return tasks.slice(-20); // Last 20 tasks
}

// Get human-readable tool description
function getToolDescription(toolName, input) {
  switch (toolName) {
    case 'Read':
      return `Reading ${path.basename(input?.file_path || 'file')}`;
    case 'Write':
      return `Writing ${path.basename(input?.file_path || 'file')}`;
    case 'Edit':
      return `Editing ${path.basename(input?.file_path || 'file')}`;
    case 'Bash':
      return input?.description || `Running command`;
    case 'Glob':
      return `Searching: ${input?.pattern || 'files'}`;
    case 'Grep':
      return `Grep: ${input?.pattern?.slice(0, 30) || 'pattern'}`;
    case 'Task':
      return `Agent: ${input?.description || 'task'}`;
    case 'TodoWrite':
      return 'Updating todo list';
    case 'WebSearch':
      return `Searching: ${input?.query?.slice(0, 30) || 'web'}`;
    case 'WebFetch':
      return `Fetching: ${input?.url?.slice(0, 30) || 'url'}`;
    default:
      return `${toolName}`;
  }
}

// Update state with real data
export function updateState() {
  // Read stats
  const stats = readStatsCache();
  if (stats) {
    state.tokens = {
      today_used: stats.today_used,
      daily_limit: 1000000,
      week_used: stats.week_used,
      weekly_limit: 5000000,
      last_updated: new Date().toISOString(),
      modelUsage: stats.modelUsage
    };
  }

  // Read sessions
  const sessionFiles = getRecentSessionFiles();
  state.sessions = sessionFiles
    .map(f => parseSessionFile(f.path))
    .filter(Boolean);

  // Read agents
  state.agents = readAgentTodos();

  // Read tasks from most recent active session
  const activeSession = state.sessions.find(s => s.status === 'RUNNING');
  if (activeSession) {
    state.tasks = getSessionTasks(activeSession.file_path);
  } else if (state.sessions.length > 0) {
    state.tasks = getSessionTasks(state.sessions[0].file_path);
  }

  return state;
}

// Get current state
export function getState() {
  return state;
}

// Initialize file watching
export function startWatching(interval = 3000) {
  // Initial load
  updateState();

  // Watch for changes
  setInterval(() => {
    updateState();
  }, interval);

  console.log(`📁 File watcher started (${interval}ms interval)`);
  console.log(`   Claude dir: ${CLAUDE_DIR}`);
  console.log(`   Projects: ${getProjectDirs().length} found`);
}

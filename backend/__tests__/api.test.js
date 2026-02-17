import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';

// Create a minimal test app with the same routes
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Event validation schema (same as server.js)
const eventSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  timestamp: z.string().optional(),
  sessionId: z.string().optional().nullable(),
  toolName: z.string().optional().nullable(),
  toolInput: z.any().optional().nullable(),
  toolOutput: z.any().optional().nullable(),
  agentId: z.string().optional().nullable(),
  agentType: z.string().optional().nullable(),
  parentAgentId: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  cwd: z.string().optional().nullable(),
  stopReason: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  inputTokens: z.number().optional().nullable(),
  outputTokens: z.number().optional().nullable(),
  error: z.any().optional().nullable(),
  raw: z.any().optional(),
});

// Mock events storage
let mockEvents = [];

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/stats', (req, res) => {
  res.json({
    eventCounts: {},
    tokens: { month_used: 0, month_cost: 0 }
  });
});

app.get('/agents', (req, res) => {
  res.json([]);
});

app.get('/sessions', (req, res) => {
  res.json([]);
});

app.post('/events', (req, res) => {
  try {
    const result = eventSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid event data',
        details: result.error.issues
      });
    }
    mockEvents.push(result.data);
    res.json({ success: true, eventId: result.data.id || 'generated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

describe('API Endpoints', () => {
  beforeAll(() => {
    mockEvents = [];
  });

  describe('GET /health', () => {
    it('returns ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /stats', () => {
    it('returns stats object', async () => {
      const res = await request(app).get('/stats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('eventCounts');
      expect(res.body).toHaveProperty('tokens');
    });
  });

  describe('GET /agents', () => {
    it('returns agents array', async () => {
      const res = await request(app).get('/agents');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /sessions', () => {
    it('returns sessions array', async () => {
      const res = await request(app).get('/sessions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /events', () => {
    it('accepts valid event', async () => {
      const event = {
        type: 'TestEvent',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session'
      };
      const res = await request(app)
        .post('/events')
        .send(event);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects event without type', async () => {
      const invalidEvent = {
        timestamp: new Date().toISOString()
      };
      const res = await request(app)
        .post('/events')
        .send(invalidEvent);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid event data');
    });

    it('rejects event with empty type', async () => {
      const invalidEvent = {
        type: '',
        timestamp: new Date().toISOString()
      };
      const res = await request(app)
        .post('/events')
        .send(invalidEvent);
      expect(res.status).toBe(400);
    });

    it('accepts event with optional fields', async () => {
      const event = {
        type: 'ToolUse',
        toolName: 'Read',
        toolInput: { file: 'test.js' },
        inputTokens: 100,
        outputTokens: 50
      };
      const res = await request(app)
        .post('/events')
        .send(event);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Event Validation', () => {
  it('validates type is required and non-empty', () => {
    const result1 = eventSchema.safeParse({});
    expect(result1.success).toBe(false);

    const result2 = eventSchema.safeParse({ type: '' });
    expect(result2.success).toBe(false);

    const result3 = eventSchema.safeParse({ type: 'ValidType' });
    expect(result3.success).toBe(true);
  });

  it('allows nullable optional fields', () => {
    const result = eventSchema.safeParse({
      type: 'Test',
      sessionId: null,
      toolName: null,
      agentId: null
    });
    expect(result.success).toBe(true);
  });

  it('allows raw field with any content', () => {
    const result = eventSchema.safeParse({
      type: 'Test',
      raw: {
        nested: { data: 'value' },
        array: [1, 2, 3]
      }
    });
    expect(result.success).toBe(true);
  });
});

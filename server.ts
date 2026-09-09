import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AI Milestones breakdown endpoint
  app.post('/api/milestones', async (req, res) => {
    try {
      const { title, category, description, remainingMinutes } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Return default structured milestones if key is not configured yet
        return res.json({
          milestones: [
            { text: `Set up workspace & clarify goals for "${title}"`, estimatedMins: 5 },
            { text: `Execute core phase of "${title}" with focused attention`, estimatedMins: Math.max(15, Math.floor((remainingMinutes || 25) * 0.6)) },
            { text: `Review progress, clean up details & wrap up`, estimatedMins: 5 },
          ],
          source: 'default',
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `You are a focus coach. Break down the task into 3 to 4 bite-sized, actionable, concrete checklist milestones for a deep-work session.
Task: "${title}"
Category: ${category || 'General'}
Description: ${description || 'None provided'}
Session Duration: ${remainingMinutes ? remainingMinutes + ' minutes' : '25-45 minutes'}

Provide concise, encouraging, and clear milestone steps that can be checked off during this focus session.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: 'List of actionable milestones for the focus session',
            items: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: 'Action-oriented milestone step name (max 10 words)',
                },
                estimatedMins: {
                  type: Type.NUMBER,
                  description: 'Estimated minutes for this milestone',
                },
              },
              required: ['text'],
            },
          },
        },
      });

      const text = response.text ? response.text.trim() : '[]';
      let milestones = [];
      try {
        milestones = JSON.parse(text);
      } catch (e) {
        milestones = [
          { text: `Prepare environment for ${title}`, estimatedMins: 5 },
          { text: `Deep work execution on ${title}`, estimatedMins: 20 },
          { text: `Wrap-up and verify deliverables`, estimatedMins: 5 },
        ];
      }

      res.json({ milestones, source: 'gemini' });
    } catch (err: any) {
      console.error('Error generating milestones with Gemini:', err?.message || err);
      // Fallback gracefully so UI never fails
      const fallbackTitle = req.body?.title || 'task';
      res.json({
        milestones: [
          { text: `Prepare materials & start ${fallbackTitle}`, estimatedMins: 5 },
          { text: `Main focus sprint on ${fallbackTitle}`, estimatedMins: 20 },
          { text: `Final review & wrap up`, estimatedMins: 5 },
        ],
        source: 'fallback',
        error: err?.message,
      });
    }
  });

  // AI Scheduling Agent endpoint
  app.post('/api/auto-schedule', async (req, res) => {
    try {
      const { prompt: userGoal, todayDate } = req.body;
      if (!userGoal || typeof userGoal !== 'string') {
        return res.status(400).json({ error: 'Goal prompt is required' });
      }

      const currentDateStr = todayDate || new Date().toISOString();
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.json({
          events: generateFallbackSchedule(userGoal, currentDateStr),
          source: 'default',
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemPrompt = `You are an expert AI Scheduling Agent and executive productivity assistant.
The current date and time is: ${currentDateStr}.
When given a user's goal (e.g. studying for an upcoming exam, daily workout schedule, project launch sprint, or routine), analyze the timeline and break it down into an array of concrete, sequential countdown sessions leading up to or around the target date.

Guidelines:
1. Every targetDate MUST be formatted as a valid ISO 8601 string: 'YYYY-MM-DDTHH:mm:00' (e.g. '2026-10-15T18:00:00').
2. Ensure dates are realistic and in the future relative to ${currentDateStr}.
3. durationMinutes should represent the planned focus duration (e.g., 30, 45, 60, 90, 120).
4. category must be one of: 'study', 'health', 'work', 'project', 'finance', 'personal', 'other'.
5. Provide clear, descriptive, professional titles (e.g., 'MT132 - Core Concepts', 'Leg Day & Cardio Prep', 'Sprint 1 - API Architecture').
6. Provide a concise 1-sentence description for the session.
7. Return an array of 3 to 7 structured session objects adhering strictly to the JSON schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Goal to schedule: "${userGoal}"`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: 'Array of scheduled countdown sessions',
            items: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Clear, actionable title for the countdown session',
                },
                targetDate: {
                  type: Type.STRING,
                  description: "ISO 8601 target date-time string, e.g. '2026-10-15T18:00:00'",
                },
                durationMinutes: {
                  type: Type.NUMBER,
                  description: 'Duration of session in minutes',
                },
                category: {
                  type: Type.STRING,
                  description: 'Category: study, health, work, project, finance, personal, or other',
                },
                description: {
                  type: Type.STRING,
                  description: '1-sentence focus summary of what to achieve in this session',
                },
                priority: {
                  type: Type.STRING,
                  description: 'Priority level: low, medium, high, or urgent',
                },
              },
              required: ['title', 'targetDate', 'durationMinutes', 'category'],
            },
          },
        },
      });

      const text = response.text ? response.text.trim() : '[]';
      let events = [];
      try {
        events = JSON.parse(text);
      } catch (e) {
        events = generateFallbackSchedule(userGoal, currentDateStr);
      }

      if (!Array.isArray(events) || events.length === 0) {
        events = generateFallbackSchedule(userGoal, currentDateStr);
      }

      res.json({ events, source: 'gemini' });
    } catch (err: any) {
      console.error('Error in /api/auto-schedule:', err?.message || err);
      const fallbackEvents = generateFallbackSchedule(
        req.body?.prompt || 'Schedule',
        req.body?.todayDate || new Date().toISOString()
      );
      res.json({
        events: fallbackEvents,
        source: 'fallback',
        error: err?.message,
      });
    }
  });

  // Helper for generating fallback schedules if offline or without key
  function generateFallbackSchedule(userGoal: string, baseDateStr: string) {
    const base = new Date(baseDateStr);
    const goalLower = userGoal.toLowerCase();

    let category = 'study';
    let defaultPrefix = 'Session';
    let duration = 60;

    if (
      goalLower.includes('workout') ||
      goalLower.includes('fitness') ||
      goalLower.includes('gym') ||
      goalLower.includes('exercise')
    ) {
      category = 'health';
      defaultPrefix = 'Workout';
      duration = 45;
    } else if (
      goalLower.includes('project') ||
      goalLower.includes('launch') ||
      goalLower.includes('code') ||
      goalLower.includes('sprint')
    ) {
      category = 'project';
      defaultPrefix = 'Milestone';
      duration = 90;
    } else if (
      goalLower.includes('work') ||
      goalLower.includes('client') ||
      goalLower.includes('presentation')
    ) {
      category = 'work';
      defaultPrefix = 'Work Sprint';
      duration = 60;
    } else if (
      goalLower.includes('finance') ||
      goalLower.includes('budget') ||
      goalLower.includes('tax')
    ) {
      category = 'finance';
      defaultPrefix = 'Finance Review';
      duration = 45;
    }

    const sessions = [
      {
        title: `${defaultPrefix} 1: Core Fundamentals & Review`,
        daysOffset: 1,
        hour: 18,
        durationMinutes: duration,
        category,
        description: `Kick-off focus block for ${userGoal.slice(0, 50)}`,
        priority: 'medium',
      },
      {
        title: `${defaultPrefix} 2: Deep Practice & Problem Sets`,
        daysOffset: 3,
        hour: 18,
        durationMinutes: duration,
        category,
        description: `Intensive execution session for ${userGoal.slice(0, 50)}`,
        priority: 'high',
      },
      {
        title: `${defaultPrefix} 3: Final Mock Sprint & Consolidation`,
        daysOffset: 5,
        hour: 17,
        durationMinutes: duration,
        category,
        description: `Final mastery verification before the target deadline`,
        priority: 'urgent',
      },
    ];

    return sessions.map((s) => {
      const d = new Date(base);
      d.setDate(d.getDate() + s.daysOffset);
      d.setHours(s.hour, 0, 0, 0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const targetDate = `${yyyy}-${mm}-${dd}T${hh}:00:00`;
      return {
        title: s.title,
        targetDate,
        durationMinutes: s.durationMinutes,
        category: s.category,
        description: s.description,
        priority: s.priority,
      };
    });
  }
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

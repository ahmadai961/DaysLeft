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
        model: 'gemini-3.7-flash',
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

  // Vite middleware for development
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

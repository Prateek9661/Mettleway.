import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: Extract & Generate Personalized Curriculum from URL or Syllabus
app.post('/api/extract-resource', async (req, res) => {
  try {
    const { url, rawTopic, dailyMinutes = 60 } = req.body;

    const prompt = `You are a world-class Computer Science and Software Engineering curriculum architect.
A student wants to learn the following subject or playlist resource without spending money on an expensive 10k course:
Resource URL or Description: "${url || rawTopic}"
Target daily study time: ${dailyMinutes} minutes.

Analyze this resource (or synthesize the definitive curriculum for this topic if a specific YouTube channel or topic is indicated, e.g., Striver A2Z DSA, Love Babbar C++, Chai aur Code MERN, freeCodeCamp Web Dev, CS50, NeetCode 150, or any general syllabus).

Generate a complete, structured learning path broken down into ordered modules and bite-sized video lessons (aim for 12 to 24 total lessons grouped into 3-5 logical modules).
For each lesson provide:
- Realistic title
- Estimated duration in minutes (between 15 and 65 mins)
- 2-4 key concepts taught
- A helpful YouTube search query or representative video URL
- Prerequisites or practice tags

Respond strictly in valid JSON matching this schema:
{
  "title": string (e.g. "Striver's A2Z DSA Master Path" or "Complete Full Stack Web Dev"),
  "description": string (one to two clear sentences),
  "category": "DSA" | "Web Development" | "System Design" | "Computer Science Core" | "AI & ML",
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "instructor": string (e.g. "Striver", "Hitesh Choudhary", "Kunal Kushwaha", "FreeCodeCamp", or "Curated Community"),
  "totalVideos": number,
  "estimatedTotalMinutes": number,
  "modules": [
    {
      "id": string (e.g. "mod-1"),
      "title": string,
      "description": string,
      "lessons": [
        {
          "id": string (e.g. "les-1"),
          "title": string,
          "durationMinutes": number,
          "videoUrl": string (embeddable youtube or representative link),
          "keyConcepts": string[],
          "practiceTask": string
        }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error extracting resource:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to analyze learning resource with AI',
    });
  }
});

// In-memory cache for ultra-fast repeated concept queries (1-hour TTL)
const tutorCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

// Endpoint: AI Daily Learning Summary & Practical Suggestions
app.post('/api/daily-recap', async (req, res) => {
  try {
    const { trackerTitle, recentLessons, streak, currentModule } = req.body;

    const prompt = `You are DevTrack's expert CS mentor.
The student is studying: "${trackerTitle}".
Current Module: "${currentModule || 'Core Fundamentals'}"
Current Streak: ${streak} days in a row!
Lessons recently completed by the student:
${JSON.stringify(recentLessons, null, 2)}

Provide:
1. "summary": A crystal clear, high-density recap of what they learned in previous days, explaining how these concepts connect and why they matter in real software engineering or tech interviews.
2. "practicalChallenges": An array of 2-3 specific, hands-on practical coding challenges, LeetCode problem recommendations, or mini-project implementations to test concept retention.
3. "pitfalls": 2 common mistakes or interview traps beginners fall into with these concepts.
4. "mentorAdvice": A personalized, high-conviction tip to make their next study session more effective and retain 10x better.

Format your response as valid JSON:
{
  "summary": string,
  "practicalChallenges": [
    {
      "title": string,
      "difficulty": "Easy" | "Medium" | "Hard",
      "description": string,
      "starterHint": string
    }
  ],
  "pitfalls": string[],
  "mentorAdvice": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        temperature: 0.3,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error generating daily recap:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate recap',
    });
  }
});

// Endpoint: Concept Tutor / Doubt Clearance (Low Latency & High Accuracy)
app.post('/api/concept-tutor', async (req, res) => {
  try {
    const { topic, currentLesson, question, codeSnippet } = req.body;

    // Check fast in-memory cache
    const cacheKey = `${topic}::${currentLesson}::${question.toLowerCase().trim()}`;
    const cached = tutorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({ success: true, data: cached.data, cached: true });
    }

    const prompt = `Course Topic: ${topic}
Current Lesson: ${currentLesson}
Student's Question: "${question}"
${codeSnippet ? `Student's Code Context:\n\`\`\`\n${codeSnippet}\n\`\`\`` : ''}

Provide a high-accuracy, rigorous explanation:
1. Direct Answer: 1-2 authoritative sentences answering the core doubt.
2. Detailed Explanation: Clear bulleted explanation focusing on the invariant, state breakdown, and exact Big-O complexities.
3. Code Example: Concise, clean, idiomatic code snippet under 15 lines.
4. Quick Check Question: A crisp multiple-choice question testing the core concept with 4 options and the correct 0-based index.

Format strictly as JSON:
{
  "directAnswer": string,
  "detailedExplanation": string,
  "codeExample": {
    "language": string,
    "code": string,
    "explanation": string
  },
  "quickCheckQuestion": {
    "question": string,
    "options": string[],
    "correctIndex": number,
    "explanation": string
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        systemInstruction: 'You are DevTrack’s high-precision, low-latency CS Concept Tutor. Provide immediate, accurate, and pedagogically crystal-clear answers. Never use fluff or filler. Focus on exact algorithmic invariants, asymptotic analysis, and idiomatic code.',
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    
    // Store in cache for sub-10ms subsequent lookups
    tutorCache.set(cacheKey, { data: parsed, timestamp: Date.now() });

    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error querying concept tutor:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to clear concept',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DevTrack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

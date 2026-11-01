import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { buildSmartConceptFallback } from './src/utils/aiMentorCache';
import { buildDynamicTrackerFromInput } from './src/utils/studyWorkspaceLogic';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.resolve(__dirname, 'public')));

const ai = new GoogleGenAI(
  process.env.GEMINI_API_KEY
    ? {
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          timeout: 10000,
        },
      }
    : {
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          timeout: 10000,
        },
      }
);

// Helper to enforce a strict server-side timeout so requests never hang
function withTimeout<T>(promise: Promise<T>, ms: number, fallbackMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(fallbackMessage));
    }, ms);
    promise
      .then(val => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Endpoint: Extract & Generate Personalized Curriculum from URL or Syllabus
app.post('/api/extract-resource', async (req, res) => {
  const { url = '', rawTopic = '', dailyMinutes = 60 } = req.body || {};
  let resolvedTitle = rawTopic && !/^https?:\/\//i.test(rawTopic.trim()) ? rawTopic.trim() : '';
  let resolvedInstructor = '';

  // Attempt fast YouTube oEmbed lookup if a YouTube URL is provided so raw links get their real video/playlist title
  if (/youtube\.com|youtu\.be/i.test(url)) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.trim())}&format=json`;
      const oembedRes = await withTimeout(fetch(oembedUrl), 2500, 'oEmbed timeout');
      if (oembedRes.ok) {
        const oembedJson = (await oembedRes.json()) as any;
        if (oembedJson?.title && !resolvedTitle) {
          resolvedTitle = String(oembedJson.title).trim();
        }
        if (oembedJson?.author_name) {
          resolvedInstructor = String(oembedJson.author_name).trim();
        }
      }
    } catch {
      // Proceed with topic/URL inference if oEmbed is unavailable
    }
  }

  try {
    const prompt = `You are a world-class Computer Science and Software Engineering curriculum architect.
A student wants to learn the following subject or playlist resource:
Resource URL: "${url}"
Topic / Course Title: "${resolvedTitle || rawTopic || url}"
${resolvedInstructor ? `Instructor / Channel: "${resolvedInstructor}"` : ''}
Target daily study time: ${dailyMinutes} minutes.

Generate a complete, structured learning path broken down into ordered modules and bite-sized video lessons (aim for 6 to 9 total lessons grouped into 3 logical modules) specifically tailored to "${resolvedTitle || rawTopic || url}".
Respond strictly in valid JSON matching this schema:
{
  "title": string,
  "description": string,
  "category": "DSA" | "Web Development" | "System Design" | "Computer Science Core" | "AI & ML",
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "instructor": string,
  "totalVideos": number,
  "estimatedTotalMinutes": number,
  "modules": [
    {
      "id": string,
      "title": string,
      "description": string,
      "lessons": [
        {
          "id": string,
          "title": string,
          "durationMinutes": number,
          "videoUrl": string,
          "keyConcepts": string[],
          "practiceTask": string
        }
      ]
    }
  ]
}`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      }),
      5000,
      'Curriculum extraction timed out'
    );

    const parsed = JSON.parse(response.text || '{}');
    if (resolvedTitle && (!parsed.title || /^https?:\/\//i.test(parsed.title))) {
      parsed.title = resolvedTitle;
    }
    if (resolvedInstructor && !parsed.instructor) {
      parsed.instructor = resolvedInstructor;
    }

    const dynamicTracker = buildDynamicTrackerFromInput({
      inputUrl: url || rawTopic,
      rawTopic: resolvedTitle || rawTopic,
      extractedData: parsed,
      dailyMinutes,
    });

    return res.json({ success: true, data: dynamicTracker });
  } catch (error: any) {
    console.warn('Using dynamic topic curriculum builder:', error?.message || error);
    const dynamicTracker = buildDynamicTrackerFromInput({
      inputUrl: url || rawTopic,
      rawTopic: resolvedTitle || rawTopic,
      extractedData: resolvedInstructor ? { title: resolvedTitle, instructor: resolvedInstructor } : undefined,
      dailyMinutes,
    });
    return res.json({
      success: true,
      data: dynamicTracker,
      fallback: true,
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

    const prompt = `You are DevTrack's friendly, crystal-clear CS mentor.
The student is studying: "${trackerTitle}".
Current Module: "${currentModule || 'Core Fundamentals'}"
Current Streak: ${streak} days in a row!
Lessons recently completed by the student:
${JSON.stringify(recentLessons, null, 2)}

Write in simple, everyday, easy-to-understand language:
1. "summary": A clear, plain-English recap of what they learned recently, using a simple mental model to show how these concepts connect and why they matter in real coding.
2. "practicalChallenges": An array of 2 specific, hands-on coding challenges or mini-exercises to lock in the concept.
3. "pitfalls": 2 common beginner mistakes explained simply so they never fall for them.
4. "mentorAdvice": 1 practical, encouraging study tip to understand concepts 10x faster.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              practicalChallenges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                    description: { type: Type.STRING },
                    starterHint: { type: Type.STRING },
                  },
                  required: ['title', 'difficulty', 'description', 'starterHint'],
                },
              },
              pitfalls: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              mentorAdvice: { type: Type.STRING },
            },
            required: ['summary', 'practicalChallenges', 'pitfalls', 'mentorAdvice'],
          },
        },
      }),
      6000,
      'Recap generation timed out'
    );

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error generating daily recap:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate recap',
    });
  }
});

// Endpoint: Concept Tutor / Doubt Clearance (Professor-to-Beginner + Real Interviewer Expectations + Line-by-Line Code)
app.post('/api/concept-tutor', async (req, res) => {
  const startTime = Date.now();
  try {
    const { topic, currentLesson, question, codeSnippet, explanationStyle = 'simple' } = req.body;

    // Check fast in-memory cache
    const cacheKey = `${topic}::${currentLesson}::${explanationStyle}::${(question || '').toLowerCase().trim()}::${(codeSnippet || '').trim()}`;
    const cached = tutorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({
        success: true,
        data: cached.data,
        cached: true,
        latencyMs: Date.now() - startTime,
      });
    }

    const isInterviewMode = explanationStyle === 'interview';

    const prompt = isInterviewMode
      ? `Topic: ${topic}
Current Lesson: ${currentLesson}
Candidate's Question: "${question}"
${codeSnippet ? `Candidate's Code:\n\`\`\`\n${codeSnippet}\n\`\`\`` : ''}

You are a Senior FAANG Technical Interviewer & CS Professor.
The learner has selected INTERVIEW MODE. Answer with the exact question an interviewer actually asks on this topic, the structured answer they expect from a top candidate, a real-world example, and clean optimal code with line-by-line explanations.
Return ONLY valid JSON matching this exact structure:
{
  "directAnswer": "2 clear sentences giving the high-conviction interview summary of this concept.",
  "realWorldAnalogy": "Real-World Example: 2 relatable sentences showing how this works in everyday life.",
  "interviewPerspective": {
    "actualInterviewQuestion": "The exact coding or conceptual question a real technical interviewer asks on this topic.",
    "whatInterviewerExpects": "The exact talking points, brute-force to optimal progression, and edge cases the interviewer expects in your answer.",
    "followUpTrap": "1 classic follow-up trap question interviewers ask next and how to answer it."
  },
  "stepByStepBreakdown": [
    "Step 1 of the optimal interview approach",
    "Step 2 of the optimal interview approach",
    "Step 3 of the optimal interview approach"
  ],
  "complexitySimple": {
    "time": "O(...) — exact interview justification",
    "space": "O(...) — exact memory trade-off justification"
  },
  "commonMistake": "1 sentence on the #1 mistake candidates make in interviews on this topic.",
  "detailedExplanation": "2 sentences summarizing why this optimal solution wins in an interview.",
  "codeExample": {
    "language": "C++ or JavaScript or Python",
    "code": "6 to 10 lines of clean, optimal interview-ready code",
    "explanation": "1 sentence summary of what the code does",
    "lineByLine": [
      { "line": "exact code line 1", "explanation": "clear explanation of why this line is needed" },
      { "line": "exact code line 2", "explanation": "clear explanation of why this line is needed" },
      { "line": "exact code line 3", "explanation": "clear explanation of why this line is needed" },
      { "line": "exact code line 4", "explanation": "clear explanation of why this line is needed" }
    ]
  },
  "quickCheckQuestion": {
    "question": "1 interview-style multiple-choice question",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "1 sentence explaining why that option is correct"
  }
}`
      : `Topic: ${topic}
Current Lesson: ${currentLesson}
Student's Question: "${question}"
${codeSnippet ? `Student's Code:\n\`\`\`\n${codeSnippet}\n\`\`\`` : ''}

You are a warm, patient, world-class University Computer Science Professor teaching a complete beginner student.
Explain the concept using a vivid Real-World Example, simple everyday words (zero heavy jargon), a whiteboard step-by-step walkthrough, and where code helps, explain each line of code simply. Do NOT include interview jargon—focus 100% on making the concept crystal clear for a beginner learner.
Return ONLY valid JSON matching this exact structure:
{
  "directAnswer": "2 warm, crystal-clear sentences where you (the Professor) directly answer the beginner student's question in plain English.",
  "realWorldAnalogy": "Real-World Example: 2-3 relatable sentences (e.g. numbered gym lockers, coffee shop line, dictionary pages, nesting dolls) showing how this works in everyday life.",
  "stepByStepBreakdown": [
    "Step 1 in plain beginner language",
    "Step 2 in plain beginner language",
    "Step 3 in plain beginner language"
  ],
  "complexitySimple": {
    "time": "O(...) — simple beginner-friendly explanation of speed",
    "space": "O(...) — simple beginner-friendly explanation of memory used"
  },
  "commonMistake": "1 friendly sentence warning about the #1 beginner mistake and how to avoid it.",
  "detailedExplanation": "2 sentences summarizing the core takeaway for the student.",
  "codeExample": {
    "language": "C++ or JavaScript or Python",
    "code": "6 to 10 lines of clean, beginner-friendly code",
    "explanation": "1 sentence summary of what the code does",
    "lineByLine": [
      { "line": "exact code line 1", "explanation": "plain-English explanation for a beginner student" },
      { "line": "exact code line 2", "explanation": "plain-English explanation for a beginner student" },
      { "line": "exact code line 3", "explanation": "plain-English explanation for a beginner student" },
      { "line": "exact code line 4", "explanation": "plain-English explanation for a beginner student" }
    ]
  },
  "quickCheckQuestion": {
    "question": "1 beginner-friendly multiple-choice question testing the concept",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "1 encouraging sentence explaining why that option is right"
  }
}`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      }),
      5000,
      'AI tutor timed out after 5s'
    );

    const parsed = JSON.parse(response.text || '{}');

    if (!isInterviewMode) {
      delete parsed.interviewPerspective;
    }

    if (Array.isArray(parsed.stepByStepBreakdown)) {
      parsed.stepByStepBreakdown = parsed.stepByStepBreakdown
        .slice(0, 4)
        .map((s: string) => String(s).replace(/^\d+[\.\)]\s*/, '').trim())
        .filter((s: string) => s.length > 8);
    }

    if (parsed.codeExample && Array.isArray(parsed.codeExample.lineByLine)) {
      parsed.codeExample.lineByLine = parsed.codeExample.lineByLine
        .slice(0, 6)
        .filter((item: any) => item && item.line && item.explanation);
    }

    // Store in cache for sub-5ms subsequent lookups
    tutorCache.set(cacheKey, { data: parsed, timestamp: Date.now() });

    return res.json({
      success: true,
      data: parsed,
      cached: false,
      latencyMs: Date.now() - startTime,
    });
  } catch (error: any) {
    console.warn('Upstream AI tutor fallback activated:', error?.message || error);
    const { topic, currentLesson, question, explanationStyle = 'simple' } = req.body || {};
    const isInterviewMode = explanationStyle === 'interview';
    const fallbackData = buildSmartConceptFallback(
      topic || 'Computer Science',
      undefined,
      question || currentLesson || 'Core Concept',
      'DSA'
    );
    if (!isInterviewMode) {
      delete fallbackData.interviewPerspective;
    }
    const cacheKey = `${topic}::${currentLesson}::${explanationStyle}::${(question || '').toLowerCase().trim()}::${(req.body?.codeSnippet || '').trim()}`;
    tutorCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });

    return res.json({
      success: true,
      data: fallbackData,
      cached: false,
      fallback: true,
      latencyMs: Date.now() - startTime,
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

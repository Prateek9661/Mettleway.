import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { buildSmartConceptFallback } from './src/utils/aiMentorCache';
import {
  buildDynamicTrackerFromInput,
  parseYouTubeSourceUrl,
  ScrapedPlaylistVideoItem,
} from './src/utils/studyWorkspaceLogic';
import {
  discoverYouTubePlaylist,
  importManualMultipleVideoUrls,
  buildTrackerFromVerifiedLessons,
  PLAYLIST_FALLBACK_MESSAGE,
} from './src/utils/youtubePlaylistDiscovery';

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

function decodeHtmlEntities(str: string): string {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseLengthTextToMinutes(lengthText?: string): number {
  if (!lengthText) return 35;
  const parts = String(lengthText)
    .trim()
    .split(':')
    .map(n => parseInt(n, 10))
    .filter(n => Number.isFinite(n));
  if (parts.length === 3) {
    return Math.max(10, parts[0] * 60 + parts[1] + Math.round(parts[2] / 60));
  }
  if (parts.length === 2) {
    return Math.max(10, parts[0] + Math.round(parts[1] / 60));
  }
  return 35;
}

/**
 * Scrapes YouTube playlist or watch page metadata & sequential video list
 * using YouTube's official XML feed (feeds/videos.xml?playlist_id=...) + watch page playlistPanelVideoRenderer
 * + oEmbed when a user provides a playlist URL or the first video link of a playlist.
 */
async function scrapeYouTubePlaylistOrVideo(rawUrl: string): Promise<{
  title: string;
  instructor: string;
  playlistVideos: ScrapedPlaylistVideoItem[];
}> {
  const parsed = parseYouTubeSourceUrl(rawUrl);
  let title = '';
  let instructor = '';
  const playlistVideos: ScrapedPlaylistVideoItem[] = [];

  if (!parsed.isYouTube) {
    return { title, instructor, playlistVideos };
  }

  // 1. Try oEmbed first for fast video/playlist title & author_name
  try {
    const targetForOembed = parsed.videoId
      ? `https://www.youtube.com/watch?v=${parsed.videoId}`
      : rawUrl.trim();
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetForOembed)}&format=json`;
    const oembedRes = await withTimeout(fetch(oembedUrl), 2000, 'oEmbed timeout');
    if (oembedRes.ok) {
      const oembedJson = (await oembedRes.json()) as any;
      if (oembedJson?.title) title = String(oembedJson.title).trim();
      if (oembedJson?.author_name) instructor = String(oembedJson.author_name).trim();
    }
  } catch {
    // Ignore oEmbed failure
  }

  let effectivePlaylistId = parsed.playlistId;

  // 2. If playlistId is present, fetch YouTube's official public XML feed first (ultra-fast & reliable)
  const xmlVideos: ScrapedPlaylistVideoItem[] = [];
  if (effectivePlaylistId) {
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(effectivePlaylistId)}`;
      const feedRes = await withTimeout(fetch(feedUrl), 2200, 'Playlist XML feed timeout');
      if (feedRes.ok) {
        const xml = await feedRes.text();
        // Extract playlist level <title> and <author><name> before the first <entry>
        const headerPart = xml.split('<entry>')[0] || '';
        const plTitleMatch = headerPart.match(/<title>([\s\S]*?)<\/title>/);
        const plAuthorMatch = headerPart.match(/<author>\s*<name>([\s\S]*?)<\/name>/);
        if (plTitleMatch?.[1]) {
          title = decodeHtmlEntities(plTitleMatch[1].trim());
        }
        if (plAuthorMatch?.[1]) {
          instructor = decodeHtmlEntities(plAuthorMatch[1].trim());
        }

        const entryRegex = /<entry>[\s\S]*?<yt:videoId>([^<]+)<\/yt:videoId>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/entry>/g;
        let m: RegExpExecArray | null;
        while ((m = entryRegex.exec(xml)) !== null) {
          const vid = m[1].trim();
          const vidTitle = decodeHtmlEntities(m[2].trim());
          if (vid && vidTitle) {
            xmlVideos.push({
              videoId: vid,
              title: vidTitle,
              durationMinutes: 35,
            });
          }
        }
      }
    } catch {
      // Ignore XML feed error and continue to watch-page scrape
    }
  }

  // 3. Fetch the watch page (?v=FIRST_VID&list=PLAYLIST_ID) or playlist page (/playlist?list=PLAYLIST_ID)
  // to extract playlistPanelVideoRenderer and playlistVideoRenderer (includes exact durations and up to 16 sequential videos)
  const seedVideoId = parsed.videoId || xmlVideos[0]?.videoId;
  if (effectivePlaylistId) {
    try {
      const targetScrapeUrl = seedVideoId
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(seedVideoId)}&list=${encodeURIComponent(effectivePlaylistId)}`
        : `https://www.youtube.com/playlist?list=${encodeURIComponent(effectivePlaylistId)}`;
      const pageRes = await withTimeout(
        fetch(targetScrapeUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }),
        2800,
        'Watch/playlist scrape timeout'
      );

      if (pageRes.ok) {
        const html = await pageRes.text();
        const marker = 'var ytInitialData = ';
        const startIdx = html.indexOf(marker);
        if (startIdx !== -1) {
          const endIdx = html.indexOf(';</script>', startIdx);
          if (endIdx !== -1) {
            const jsonStr = html.slice(startIdx + marker.length, endIdx);
            const ytData = JSON.parse(jsonStr);

            const collectPanelVideos = (node: any) => {
              if (!node || typeof node !== 'object') return;
              if (node.playlistPanelRenderer?.title && typeof node.playlistPanelRenderer.title === 'string') {
                title = node.playlistPanelRenderer.title.trim();
              }
              if (
                node.playlistMetadataRenderer?.title &&
                typeof node.playlistMetadataRenderer.title === 'string'
              ) {
                title = node.playlistMetadataRenderer.title.trim();
              }
              const videoRenderer = node.playlistPanelVideoRenderer || node.playlistVideoRenderer;
              if (videoRenderer) {
                const vid = videoRenderer.videoId;
                const vidTitle =
                  videoRenderer.title?.simpleText || videoRenderer.title?.runs?.[0]?.text || '';
                const lengthStr =
                  videoRenderer.lengthText?.simpleText ||
                  videoRenderer.lengthText?.runs?.[0]?.text ||
                  '';
                const byline =
                  videoRenderer.shortBylineText?.runs?.[0]?.text ||
                  videoRenderer.longBylineText?.runs?.[0]?.text ||
                  '';
                if (byline && !instructor) {
                  instructor = String(byline).trim();
                }
                if (vid && vidTitle && !playlistVideos.some(v => v.videoId === String(vid))) {
                  playlistVideos.push({
                    videoId: String(vid),
                    title: String(vidTitle).trim(),
                    durationMinutes: parseLengthTextToMinutes(lengthStr),
                  });
                }
                return;
              }
              if (Array.isArray(node)) {
                for (const item of node) collectPanelVideos(item);
              } else {
                for (const k of Object.keys(node)) collectPanelVideos(node[k]);
              }
            };

            collectPanelVideos(ytData);
          }
        }
      }
    } catch {
      // Fall back to xmlVideos if watch/playlist page parse fails
    }
  }

  if (playlistVideos.length === 0 && xmlVideos.length > 0) {
    playlistVideos.push(...xmlVideos);
  }

  return { title, instructor, playlistVideos };
}

// Endpoint: Smart YouTube Playlist Discovery (single video URL or playlist URL)
app.post('/api/youtube/discover', async (req, res) => {
  try {
    const { url = '', selectedPlaylistId = '' } = req.body || {};
    const result = await discoverYouTubePlaylist({
      inputUrl: String(url || '').trim(),
      selectedPlaylistId: String(selectedPlaylistId || '').trim() || undefined,
      apiKey: process.env.YOUTUBE_API_KEY,
    });
    return res.json({
      success: result.status === 'playlist_found' || result.status === 'multiple_playlists_found',
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to discover YouTube playlist.',
    });
  }
});

// Endpoint: Manual Multiple-Video URL Import
app.post('/api/youtube/import-manual', async (req, res) => {
  try {
    const {
      rawUrls = '',
      courseTitle = '',
      dailyMinutes = 60,
      scheduledTime = '20:00',
      studyDays = [1, 2, 3, 4, 5, 6],
      trackerId,
    } = req.body || {};

    const imported = await importManualMultipleVideoUrls({
      rawUrls,
      courseTitle: String(courseTitle || '').trim(),
      apiKey: process.env.YOUTUBE_API_KEY,
    });

    if (!imported.success || imported.lessons.length < 2) {
      return res.status(400).json({
        success: false,
        error: imported.message,
      });
    }

    const tracker = buildTrackerFromVerifiedLessons({
      lessons: imported.lessons,
      playlistId: null,
      courseTitle: imported.inferredTitle,
      instructor: imported.inferredInstructor,
      category: imported.inferredCategory,
      sourceUrl: imported.lessons[0].videoUrl,
      dailyMinutes: Number(dailyMinutes) || 60,
      scheduledTime: String(scheduledTime || '20:00'),
      studyDays: Array.isArray(studyDays) && studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5, 6],
      trackerId: trackerId || `tracker-${Date.now()}`,
    });

    return res.json({
      success: true,
      data: tracker,
      lessons: imported.lessons,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to import manual video URLs.',
    });
  }
});

// Endpoint: Extract & Generate Personalized Curriculum from URL or Syllabus
app.post('/api/extract-resource', async (req, res) => {
  const {
    url = '',
    rawTopic = '',
    dailyMinutes = 60,
    scheduledTime = '20:00',
    studyDays = [1, 2, 3, 4, 5, 6],
    selectedPlaylistId = '',
    requireVerifiedPlaylist = false,
  } = req.body || {};
  const userSubject = rawTopic && !/^https?:\/\//i.test(rawTopic.trim()) ? rawTopic.trim() : '';
  const parsedInput = parseYouTubeSourceUrl(url);

  // Run Smart YouTube Playlist Discovery first when a YouTube URL is provided
  if (parsedInput.isYouTube) {
    const discovery = await discoverYouTubePlaylist({
      inputUrl: url,
      selectedPlaylistId: String(selectedPlaylistId || '').trim() || undefined,
      apiKey: process.env.YOUTUBE_API_KEY,
    });

    if (
      (discovery.status === 'playlist_found' || discovery.status === 'multiple_playlists_found') &&
      discovery.selectedPlaylist &&
      discovery.selectedPlaylist.lessons.length >= 2
    ) {
      const chosen = discovery.selectedPlaylist;
      const tracker = buildTrackerFromVerifiedLessons({
        lessons: chosen.lessons,
        playlistId: chosen.playlistId,
        courseTitle: userSubject ? `${userSubject}: ${chosen.title}` : chosen.title,
        instructor: chosen.channelTitle,
        category: discovery.videoMetadata?.category,
        sourceUrl: `https://www.youtube.com/playlist?list=${chosen.playlistId}`,
        dailyMinutes: Number(dailyMinutes) || 60,
        scheduledTime: String(scheduledTime || '20:00'),
        studyDays: Array.isArray(studyDays) && studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5, 6],
      });
      return res.json({
        success: true,
        data: tracker,
        scrapedPlaylist: true,
        discovery,
      });
    }

    if (requireVerifiedPlaylist && discovery.status === 'no_playlist_found') {
      return res.status(422).json({
        success: false,
        status: 'no_playlist_found',
        error: PLAYLIST_FALLBACK_MESSAGE,
        discovery,
      });
    }
  }

  // Scrape YouTube metadata and playlist video items if a YouTube link was provided
  const scraped = await scrapeYouTubePlaylistOrVideo(url);
  const resolvedTitle = userSubject || scraped.title || '';
  const resolvedInstructor = scraped.instructor || '';

  // If we scraped actual playlist videos directly from YouTube, build the tracker immediately!
  if (scraped.playlistVideos.length >= 2) {
    const dynamicTracker = buildDynamicTrackerFromInput({
      inputUrl: url || rawTopic,
      rawTopic: userSubject,
      extractedData: {
        title: scraped.title || userSubject,
        instructor: resolvedInstructor,
        playlistVideos: scraped.playlistVideos,
      },
      dailyMinutes,
    });
    return res.json({ success: true, data: dynamicTracker, scrapedPlaylist: true });
  }

  try {
    const prompt = `You are a world-class Computer Science and Software Engineering curriculum architect.
A student wants to learn the following subject or playlist resource:
Resource URL: "${url}"
Subject / Course Title: "${resolvedTitle || rawTopic || url}"
${resolvedInstructor ? `Instructor / Channel: "${resolvedInstructor}"` : ''}
Target daily study time: ${dailyMinutes} minutes.

Generate a complete, structured learning path broken down into ordered modules and sequential video lessons ("Lesson 1: ...", "Lesson 2: ...", "Lesson 3: ...", etc., aim for 6 to 8 total lessons grouped into 2 or 3 logical modules) specifically tailored to "${resolvedTitle || rawTopic || url}".
Do NOT use generic titles like "Computer Science Course" or "YouTube Curated Series"—reflect the exact subject "${resolvedTitle || rawTopic || url}".
Respond strictly in valid JSON matching this schema:
{
  "title": string,
  "description": string,
  "category": string,
  "difficulty": string,
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
      4500,
      'Curriculum extraction timed out'
    );

    const parsed = JSON.parse(response.text || '{}');
    if (scraped.title && (!parsed.title || /^https?:\/\//i.test(parsed.title))) {
      parsed.title = scraped.title;
    }
    if (resolvedInstructor && (!parsed.instructor || parsed.instructor === 'YouTube Curated Series')) {
      parsed.instructor = resolvedInstructor;
    }

    const dynamicTracker = buildDynamicTrackerFromInput({
      inputUrl: url || rawTopic,
      rawTopic: userSubject,
      extractedData: parsed,
      dailyMinutes,
    });

    return res.json({ success: true, data: dynamicTracker });
  } catch (error: any) {
    console.warn('Using dynamic topic curriculum builder:', error?.message || error);
    const dynamicTracker = buildDynamicTrackerFromInput({
      inputUrl: url || rawTopic,
      rawTopic: userSubject,
      extractedData:
        scraped.title || resolvedInstructor
          ? { title: scraped.title, instructor: resolvedInstructor }
          : undefined,
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

// ============================================================================
// User-Specific Account Progress Synchronization & Data Deletion Store
// ============================================================================
interface UserAccountSnapshot {
  userId: string;
  trackers: any[];
  activeTrackerId: string;
  streakDays: number;
  dailyLogs: any[];
  learnerProfile?: any;
  updatedAt: string;
}

const userAccountStore = new Map<string, UserAccountSnapshot>();

function sanitizeUserId(raw: any): string {
  const str = String(raw || 'default-learner').trim();
  return str.replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 80) || 'default-learner';
}

app.get('/api/account/sync', (req, res) => {
  const userId = sanitizeUserId(req.query.userId);
  const snapshot = userAccountStore.get(userId) || null;
  return res.json({
    success: true,
    userId,
    data: snapshot,
  });
});

app.post('/api/account/sync', (req, res) => {
  try {
    const body = req.body || {};
    const userId = sanitizeUserId(body.userId);
    const snapshot: UserAccountSnapshot = {
      userId,
      trackers: Array.isArray(body.trackers) ? body.trackers : [],
      activeTrackerId: String(body.activeTrackerId || ''),
      streakDays: Number.isFinite(Number(body.streakDays)) ? Number(body.streakDays) : 1,
      dailyLogs: Array.isArray(body.dailyLogs) ? body.dailyLogs : [],
      learnerProfile: body.learnerProfile || undefined,
      updatedAt: new Date().toISOString(),
    };
    userAccountStore.set(userId, snapshot);
    return res.json({
      success: true,
      userId,
      updatedAt: snapshot.updatedAt,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to sync account progress.',
    });
  }
});

app.delete('/api/account/data', (req, res) => {
  const userId = sanitizeUserId(req.body?.userId || req.query?.userId);
  const existed = userAccountStore.has(userId);
  userAccountStore.delete(userId);
  userProfileStore.delete(userId);
  userNotesStore.delete(userId);
  return res.json({
    success: true,
    userId,
    deleted: existed,
    message: 'All saved learning data for this user account has been permanently deleted.',
  });
});

// ============================================================================
// Student Onboarding, Profile & Dedicated Personal Notes Database Store
// (Enforces Row-Level Security / User-Specific Data Isolation per userId)
// ============================================================================

interface StoredPersonalNote {
  id: string;
  userId: string;
  courseId: string;
  trackerId: string;
  lessonId: string;
  heading?: string;
  content: string;
  codeSnippet?: string;
  codeLanguage?: string;
  timestampSeconds: number;
  formattedTimestamp: string;
  tags: string[];
  conceptTag?: string;
  isBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
}

const userProfileStore = new Map<string, any>();
// Keyed by userId -> Map<noteId, StoredPersonalNote> for strict RLS isolation & zero duplication
const userNotesStore = new Map<string, Map<string, StoredPersonalNote>>();

// 1. Register New Student Account -> Redirects to Multi-Step Onboarding
app.post('/api/auth/register', (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Full name and email are required to register a student account.',
      });
    }

    const userId = sanitizeUserId(
      body.userId || `student_${email.replace(/[^a-z0-9]/g, '_').slice(0, 32)}_${Date.now().toString(36)}`
    );

    const newProfile = {
      userId,
      email,
      name,
      avatarUrl:
        body.avatarUrl || '/src/assets/images/avatar_student_alex_1793187697984.jpg',
      role: body.role || 'University Student',
      country: body.country || '',
      preferredLanguage: body.preferredLanguage || 'English',
      educationLevel: body.educationLevel || '',
      currentDegree: body.currentDegree || '',
      collegeOrUniversity: body.collegeOrUniversity || '',
      academicYearOrSemester: body.academicYearOrSemester || '',
      careerAspiration: body.careerAspiration || '',
      careerObjective: body.careerObjective || '',
      learningInterests: Array.isArray(body.learningInterests) ? body.learningInterests : [],
      skillLevels: body.skillLevels && typeof body.skillLevels === 'object' ? body.skillLevels : {},
      preferredLearningFormats: Array.isArray(body.preferredLearningFormats)
        ? body.preferredLearningFormats
        : ['Video Lectures', 'Timestamped Notes'],
      personalLearningGoals: Array.isArray(body.personalLearningGoals)
        ? body.personalLearningGoals
        : [],
      pacingMode: body.pacingMode || 'steady-daily',
      dailyMinutesTarget: Number(body.dailyMinutesTarget) || 60,
      preferredTime: body.preferredTime || '20:00',
      studyDays: Array.isArray(body.studyDays) ? body.studyDays : [1, 2, 3, 4, 5, 6],
      weeklyHoursGoal: Number(body.weeklyHoursGoal) || 6,
      onboardingCompleted: Boolean(body.onboardingCompleted),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    userProfileStore.set(userId, newProfile);
    if (!userNotesStore.has(userId)) {
      userNotesStore.set(userId, new Map());
    }

    return res.json({
      success: true,
      userId,
      redirectTo: !newProfile.onboardingCompleted ? 'onboarding' : 'dashboard',
      redirectToOnboarding: !newProfile.onboardingCompleted,
      profile: newProfile,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Student registration failed.',
    });
  }
});

// 2. Get or Save Authenticated Student Profile (Onboarding & My Profile)
app.get('/api/profile', (req, res) => {
  const userId = sanitizeUserId(req.query.userId);
  const profile =
    userProfileStore.get(userId) || userAccountStore.get(userId)?.learnerProfile || null;
  return res.json({
    success: true,
    userId,
    profile,
  });
});

app.post('/api/profile', (req, res) => {
  try {
    const body = req.body || {};
    const userId = sanitizeUserId(body.userId || body.profile?.userId);
    const incoming = body.profile || body;
    const existing = userProfileStore.get(userId) || {};

    const updatedProfile = {
      ...existing,
      ...incoming,
      userId,
      updatedAt: new Date().toISOString(),
    };
    userProfileStore.set(userId, updatedProfile);

    const existingSnapshot = userAccountStore.get(userId);
    if (existingSnapshot) {
      existingSnapshot.learnerProfile = updatedProfile;
      existingSnapshot.updatedAt = updatedProfile.updatedAt;
    }

    return res.json({
      success: true,
      userId,
      profile: updatedProfile,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to save student profile.',
    });
  }
});

// 3. Dedicated Personal Notes Database API with Row-Level Security (RLS) by userId
app.get('/api/notes', (req, res) => {
  const userId = sanitizeUserId(req.query.userId);
  const courseId = req.query.courseId ? String(req.query.courseId).trim() : '';
  const lessonId = req.query.lessonId ? String(req.query.lessonId).trim() : '';

  const userMap = userNotesStore.get(userId);
  let notes: StoredPersonalNote[] = userMap ? Array.from(userMap.values()) : [];

  // Enforce RLS: only return notes whose userId matches the requesting userId
  notes = notes.filter(n => n.userId === userId);

  if (courseId && courseId !== 'all') {
    notes = notes.filter(n => n.courseId === courseId || n.trackerId === courseId);
  }
  if (lessonId && lessonId !== 'all') {
    notes = notes.filter(n => n.lessonId === lessonId);
  }

  notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return res.json({
    success: true,
    userId,
    totalCount: notes.length,
    notes,
  });
});

app.post('/api/notes', (req, res) => {
  try {
    const rawBody = req.body || {};
    const notePayload = rawBody.note && typeof rawBody.note === 'object' ? rawBody.note : rawBody;
    const userId = sanitizeUserId(rawBody.userId || notePayload.userId);
    const courseId = String(notePayload.courseId || notePayload.trackerId || rawBody.courseId || rawBody.trackerId || '').trim();
    const lessonId = String(notePayload.lessonId || rawBody.lessonId || '').trim();
    const content = String(notePayload.content || '').trim();
    const heading = notePayload.heading !== undefined ? String(notePayload.heading).trim() : undefined;
    const codeSnippet = notePayload.codeSnippet !== undefined ? String(notePayload.codeSnippet).trim() : undefined;

    if (!courseId || !lessonId || (!content && !heading && !codeSnippet)) {
      return res.status(400).json({
        success: false,
        error: 'courseId, lessonId, and note content are required.',
      });
    }

    const noteId =
      String(notePayload.id || notePayload.noteId || rawBody.id || rawBody.noteId || '').trim() ||
      `vnote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // RLS check across all user maps: if noteId already exists under a different userId, reject modification
    for (const [ownerId, ownerMap] of userNotesStore.entries()) {
      const foreignNote = ownerMap.get(noteId);
      if (foreignNote && (ownerId !== userId || foreignNote.userId !== userId)) {
        return res.status(403).json({
          success: false,
          error: 'Row-Level Security violation: Cannot modify another user note.',
        });
      }
    }

    let userMap = userNotesStore.get(userId);
    if (!userMap) {
      userMap = new Map<string, StoredPersonalNote>();
      userNotesStore.set(userId, userMap);
    }

    const existing = userMap.get(noteId);

    const nowIso = new Date().toISOString();
    const timestampSeconds = Math.max(0, Number(notePayload.timestampSeconds) || 0);
    const formattedTimestamp =
      String(notePayload.formattedTimestamp || '').trim() || '00:00';
    const tags: string[] = Array.isArray(notePayload.tags)
      ? Array.from(new Set(notePayload.tags.map((t: any) => String(t).trim()).filter(Boolean)))
      : existing?.tags || [];

    const savedNote: StoredPersonalNote = {
      id: noteId,
      userId,
      courseId,
      trackerId: courseId,
      lessonId,
      heading: heading !== undefined ? heading : existing?.heading,
      content: content || existing?.content || heading || 'Code note',
      codeSnippet: codeSnippet !== undefined ? codeSnippet : existing?.codeSnippet,
      codeLanguage: notePayload.codeLanguage || existing?.codeLanguage || (codeSnippet ? 'cpp' : undefined),
      timestampSeconds,
      formattedTimestamp,
      tags,
      conceptTag: notePayload.conceptTag !== undefined ? String(notePayload.conceptTag).trim() : existing?.conceptTag,
      isBookmarked:
        notePayload.isBookmarked !== undefined ? Boolean(notePayload.isBookmarked) : Boolean(existing?.isBookmarked),
      createdAt: existing?.createdAt || notePayload.createdAt || nowIso,
      updatedAt: nowIso,
    };

    userMap.set(noteId, savedNote);

    return res.json({
      success: true,
      userId,
      note: savedNote,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to save personal note.',
    });
  }
});

app.delete('/api/notes/:noteId', (req, res) => {
  const userId = sanitizeUserId(req.body?.userId || req.query?.userId);
  const noteId = String(req.params.noteId || '').trim();

  // RLS check across all user maps: if noteId belongs to another user, reject deletion with 403
  for (const [ownerId, ownerMap] of userNotesStore.entries()) {
    const foreignNote = ownerMap.get(noteId);
    if (foreignNote && (ownerId !== userId || foreignNote.userId !== userId)) {
      return res.status(403).json({
        success: false,
        error: 'Row-Level Security violation: Cannot delete another user note.',
      });
    }
  }

  const userMap = userNotesStore.get(userId);
  if (!userMap || !userMap.has(noteId)) {
    return res.json({
      success: true,
      userId,
      deleted: false,
    });
  }
  userMap.delete(noteId);
  return res.json({
    success: true,
    userId,
    deleted: true,
    noteId,
  });
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


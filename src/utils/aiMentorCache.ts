import { ConceptTutorAnswer, AIRecapData } from '../types';

const TUTOR_CACHE_STORAGE_KEY = 'devtrack_ai_tutor_cache_v1';
const RECAP_CACHE_STORAGE_KEY = 'devtrack_ai_recap_cache_v1';
const MAX_CACHE_ENTRIES = 80;

interface CachedTutorEntry {
  key: string;
  question: string;
  answer: ConceptTutorAnswer;
  timestamp: number;
}

interface CachedRecapEntry {
  key: string;
  recap: AIRecapData;
  timestamp: number;
}

function normalizeKey(trackerTitle: string, lessonTitle: string, query: string): string {
  const normTracker = (trackerTitle || '').toLowerCase().trim();
  const normLesson = (lessonTitle || '').toLowerCase().trim();
  const normQuery = (query || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${normTracker}::${normLesson}::${normQuery}`;
}

export const aiMentorStorage = {
  /**
   * Retrieve cached Concept Tutor answer from localStorage
   */
  getConceptAnswer(trackerTitle: string, lessonTitle: string, question: string): { answer: ConceptTutorAnswer; timestamp: number } | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(TUTOR_CACHE_STORAGE_KEY);
      if (!raw) return null;
      const cache: Record<string, CachedTutorEntry> = JSON.parse(raw);
      const key = normalizeKey(trackerTitle, lessonTitle, question);
      const entry = cache[key];
      if (entry && entry.answer) {
        return { answer: entry.answer, timestamp: entry.timestamp };
      }
    } catch (e) {
      console.warn('Failed to read AI tutor response from localStorage:', e);
    }
    return null;
  },

  /**
   * Save Concept Tutor answer to localStorage
   */
  setConceptAnswer(trackerTitle: string, lessonTitle: string, question: string, answer: ConceptTutorAnswer) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(TUTOR_CACHE_STORAGE_KEY);
      const cache: Record<string, CachedTutorEntry> = raw ? JSON.parse(raw) : {};

      const key = normalizeKey(trackerTitle, lessonTitle, question);
      cache[key] = {
        key,
        question: question.trim(),
        answer,
        timestamp: Date.now(),
      };

      // Limit size to MAX_CACHE_ENTRIES
      const entries = Object.values(cache);
      if (entries.length > MAX_CACHE_ENTRIES) {
        entries.sort((a, b) => b.timestamp - a.timestamp);
        const trimmed: Record<string, CachedTutorEntry> = {};
        entries.slice(0, MAX_CACHE_ENTRIES).forEach(e => {
          trimmed[e.key] = e;
        });
        localStorage.setItem(TUTOR_CACHE_STORAGE_KEY, JSON.stringify(trimmed));
      } else {
        localStorage.setItem(TUTOR_CACHE_STORAGE_KEY, JSON.stringify(cache));
      }
    } catch (e) {
      console.warn('Failed to write AI tutor response to localStorage:', e);
    }
  },

  /**
   * Retrieve all previously asked questions for the active lesson from localStorage
   */
  getPreviousQuestionsForLesson(trackerTitle: string, lessonTitle: string): CachedTutorEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(TUTOR_CACHE_STORAGE_KEY);
      if (!raw) return [];
      const cache: Record<string, CachedTutorEntry> = JSON.parse(raw);
      const prefix = `${(trackerTitle || '').toLowerCase().trim()}::${(lessonTitle || '').toLowerCase().trim()}::`;
      return Object.values(cache)
        .filter(entry => entry.key.startsWith(prefix))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  },

  /**
   * Retrieve cached Daily Recap from localStorage
   */
  getDailyRecap(trackerTitle: string, completedSignature: string): AIRecapData | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(RECAP_CACHE_STORAGE_KEY);
      if (!raw) return null;
      const cache: Record<string, CachedRecapEntry> = JSON.parse(raw);
      const key = `${trackerTitle.toLowerCase().trim()}::${completedSignature}`;
      const entry = cache[key];
      if (entry && entry.recap) {
        return entry.recap;
      }
    } catch {
      return null;
    }
    return null;
  },

  /**
   * Save Daily Recap to localStorage
   */
  setDailyRecap(trackerTitle: string, completedSignature: string, recap: AIRecapData) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(RECAP_CACHE_STORAGE_KEY);
      const cache: Record<string, CachedRecapEntry> = raw ? JSON.parse(raw) : {};
      const key = `${trackerTitle.toLowerCase().trim()}::${completedSignature}`;
      cache[key] = {
        key,
        recap,
        timestamp: Date.now(),
      };
      localStorage.setItem(RECAP_CACHE_STORAGE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('Failed to save recap to localStorage:', e);
    }
  },

  /**
   * Clear localStorage cache
   */
  clearAllMentorCache() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(TUTOR_CACHE_STORAGE_KEY);
      localStorage.removeItem(RECAP_CACHE_STORAGE_KEY);
    } catch {}
  },
};

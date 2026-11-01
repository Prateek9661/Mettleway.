import { ConceptTutorAnswer, AIRecapData, Lesson } from '../types';

const TUTOR_CACHE_STORAGE_KEY = 'devtrack_ai_tutor_cache_v3';
const RECAP_CACHE_STORAGE_KEY = 'devtrack_ai_recap_cache_v3';
const MAX_CACHE_ENTRIES = 100;

interface CachedTutorEntry {
  key: string;
  question: string;
  style: 'simple' | 'interview';
  answer: ConceptTutorAnswer;
  timestamp: number;
}

interface CachedRecapEntry {
  key: string;
  recap: AIRecapData;
  timestamp: number;
}

function normalizeKey(
  trackerTitle: string,
  lessonTitle: string,
  query: string,
  style: 'simple' | 'interview' = 'simple'
): string {
  const normTracker = (trackerTitle || '').toLowerCase().trim();
  const normLesson = (lessonTitle || '').toLowerCase().trim();
  const normQuery = (query || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${normTracker}::${normLesson}::${style}::${normQuery}`;
}

/**
 * Generates an accurate, Professor-to-Beginner explanation with a concrete Real-World Example,
 * actual Interviewer Question & Expected Answer, and Line-by-Line Code Walkthrough.
 */
export function buildSmartConceptFallback(
  topic: string,
  lesson: Lesson | undefined,
  question: string,
  category: string
): ConceptTutorAnswer {
  const qLower = `${question} ${lesson?.title || ''}`.toLowerCase();
  const lessonTitle = lesson?.title || topic;
  const concepts = lesson?.keyConcepts?.length ? lesson.keyConcepts : ['Core Logic', 'Optimization'];

  // Pattern 1: Hashing / Frequency Map / Two Sum / Unordered Map
  if (
    qLower.includes('hash') ||
    qLower.includes('map') ||
    qLower.includes('frequency') ||
    qLower.includes('collision') ||
    qLower.includes('two sum')
  ) {
    return {
      directAnswer:
        'Welcome to class! A Hash Map is simply a smart notebook that stores information as "Label → Value" pairs so you can find any item in 1 single step instead of checking a whole list one by one.',
      realWorldAnalogy:
        'Real-World Example: Imagine a gym with 500 lockers. If locks had no numbers (like a plain Array), you would have to open Locker 1, Locker 2, Locker 3... until you found your bag. A Hash Map gives you a numbered key (#42) so you walk straight to Locker #42 and open it in 1 second!',
      stepByStepBreakdown: [
        'First, we create an empty Hash Map (our numbered locker room) before looking at the array.',
        'Next, we walk through the array once: for each number x, we either add 1 to its count in the map, or check if the partner number we need (target - x) is already waiting in a locker.',
        'Because checking a locker takes 1 instant step, we finish the whole job in a single walk through the list!',
      ],
      complexitySimple: {
        time: 'O(N) — We walk through the N items only once, and each locker check takes O(1) instant time.',
        space: 'O(N) — In the worst case, we use N lockers in memory to store N unique items.',
      },
      commonMistake:
        'Beginners often use `std::map` instead of `std::unordered_map` in C++—`std::map` sorts keys alphabetically behind the scenes, which slows every lookup from O(1) to O(log N).',
      detailedExplanation:
        'By spending a small amount of memory to remember what we have already seen, a Hash Map eliminates slow nested loops (O(N²)) and solves lookup problems in fast O(N) time.',
      interviewPerspective: {
        actualInterviewQuestion:
          'Interviewer asks: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers that add up to `target` in better than O(N²) time."',
        whatInterviewerExpects:
          '1) Start by stating the brute-force nested loop takes O(N²) time and O(1) space. 2) Propose an `unordered_map` storing `value -> index` to check `target - nums[i]` in O(1) time. 3) Mention that you check the map BEFORE inserting the current element so you never reuse the same index twice.',
        followUpTrap:
          'Follow-Up Trap: "What happens in the worst case if all keys hash to the exact same bucket (Hash Collision)?" → Answer: Lookup degrades from O(1) average to O(N) worst-case, though good hash functions make this extremely rare.',
      },
      codeExample: {
        language: category === 'DSA' ? 'C++' : 'JavaScript',
        code:
          category === 'DSA'
            ? `unordered_map<int, int> seen;\nfor (int i = 0; i < nums.size(); i++) {\n  int need = target - nums[i];\n  if (seen.count(need)) {\n    return {seen[need], i};\n  }\n  seen[nums[i]] = i;\n}`
            : `const seen = new Map();\nfor (let i = 0; i < nums.length; i++) {\n  const need = target - nums[i];\n  if (seen.has(need)) {\n    return [seen.get(need), i];\n  }\n  seen.set(nums[i], i);\n}`,
        explanation: 'Finds two numbers that sum to target in a single O(N) pass using a Hash Map.',
        lineByLine: [
          {
            line: category === 'DSA' ? 'unordered_map<int, int> seen;' : 'const seen = new Map();',
            explanation: 'Creates an empty Hash Map where Key = number we saw, and Value = its index position.',
          },
          {
            line: category === 'DSA' ? 'for (int i = 0; i < nums.size(); i++)' : 'for (let i = 0; i < nums.length; i++)',
            explanation: 'Loops through each number in the array one time from left to right.',
          },
          {
            line: category === 'DSA' ? 'int need = target - nums[i];' : 'const need = target - nums[i];',
            explanation: 'Calculates the exact partner number needed to reach the target sum.',
          },
          {
            line: category === 'DSA' ? 'if (seen.count(need)) return {seen[need], i};' : 'if (seen.has(need)) return [seen.get(need), i];',
            explanation: 'Checks in O(1) time if that partner number is already in our map; if yes, returns both indices immediately!',
          },
          {
            line: category === 'DSA' ? 'seen[nums[i]] = i;' : 'seen.set(nums[i], i);',
            explanation: 'Otherwise, saves the current number and its index in the map for future numbers to find.',
          },
        ],
      },
      quickCheckQuestion: {
        question: 'In a Two-Sum interview question, why do we check `if (seen.count(need))` BEFORE inserting `seen[nums[i]] = i`?',
        options: [
          'So we do not accidentally match a number with itself (e.g., using a single 3 twice to make target 6)',
          'Because C++ crashes if you insert first',
          'To sort the map in ascending order',
          'To save memory',
        ],
        correctIndex: 0,
        explanation:
          'Exactly right! Checking before inserting guarantees the two indices are strictly different.',
      },
    };
  }

  // Pattern 2: Pointers / Dutch National Flag / Sliding Window / Kadane
  if (
    qLower.includes('pointer') ||
    qLower.includes('dutch') ||
    qLower.includes('kadane') ||
    qLower.includes('subarray') ||
    qLower.includes('window')
  ) {
    return {
      directAnswer:
        'Think of this like a Professor’s favorite shortcut: instead of starting over and re-counting subarrays from scratch, we use moving bookmarks (pointers) or a running score so we only walk through the list once.',
      realWorldAnalogy:
        'Real-World Example: Imagine tracking your happiness score during a road trip. Aslong as the trip overall is positive, you keep going. The moment a terrible traffic jam makes your total running mood drop below zero, you mentally "start a fresh trip" from the next town instead of carrying yesterday’s bad mood forward!',
      stepByStepBreakdown: [
        'Start with `currentSum = 0` and `maxSum = nums[0]` (the first element, in case all numbers are negative).',
        'Add the current number to `currentSum` and update `maxSum` if `currentSum` beat our best record.',
        'If `currentSum` drops below 0, reset `currentSum = 0` because a negative total would only drag down the next numbers.',
      ],
      complexitySimple: {
        time: 'O(N) — We look at each number in the array only once.',
        space: 'O(1) — We only use 2 simple integer variables (`currentSum` and `maxSum`).',
      },
      commonMistake:
        'Initializing `maxSum = 0` instead of `maxSum = nums[0]`—if the array is `[-5, -2, -8]`, initializing to 0 gives the wrong answer `0` instead of `-2`!',
      detailedExplanation:
        'Single-pass pointer and running-sum algorithms eliminate redundant work by maintaining a clean rule (invariant) at every step.',
      interviewPerspective: {
        actualInterviewQuestion:
          'Interviewer asks: "Find the contiguous subarray with the largest sum (Kadane’s Algorithm), or sort an array of 0s, 1s, and 2s in-place in a single pass."',
        whatInterviewerExpects:
          '1) Explain why checking all subarrays takes O(N²) time. 2) State the core insight: a negative prefix sum never helps a future subarray, so reset `curSum = 0` when `< 0`. 3) Explicitly handle the all-negative array edge case by setting `maxSum = nums[0]`.',
        followUpTrap:
          'Follow-Up Trap: "Can you also print the start and end indices of that maximum subarray?" → Answer: Yes! Track a `tempStart` index whenever you reset `curSum = 0`, and copy it to `bestStart` / `bestEnd` whenever `curSum > maxSum`.',
      },
      codeExample: {
        language: 'C++',
        code: `int curSum = 0;\nint maxSum = nums[0];\nfor (int x : nums) {\n  curSum += x;\n  maxSum = max(maxSum, curSum);\n  if (curSum < 0) curSum = 0;\n}\nreturn maxSum;`,
        explanation: 'Kadane’s Algorithm finds the maximum subarray sum in O(N) time and O(1) space.',
        lineByLine: [
          {
            line: 'int curSum = 0; int maxSum = nums[0];',
            explanation: 'Starts running sum at 0, and sets best record to the first element (crucial if all numbers are negative).',
          },
          {
            line: 'for (int x : nums) { curSum += x;',
            explanation: 'Steps through each number one by one and adds it to our current running streak.',
          },
          {
            line: 'maxSum = max(maxSum, curSum);',
            explanation: 'If our current running sum beats the highest sum ever seen, updates the record.',
          },
          {
            line: 'if (curSum < 0) curSum = 0;',
            explanation: 'If the running sum becomes negative, drops it and resets to 0 so it doesn’t shrink future numbers.',
          },
        ],
      },
      quickCheckQuestion: {
        question: 'What happens in an interview if you initialize `maxSum = 0` and the input array is `[-10, -3, -5]`?',
        options: [
          'Your code returns 0, which is wrong because the largest non-empty subarray is [-3] with sum -3',
          'Your code still returns -3',
          'The loop never runs',
          'It causes a compiler error',
        ],
        correctIndex: 0,
        explanation:
          'Initializing `maxSum = nums[0]` is a classic interviewer check to make sure your code works on all-negative arrays!',
      },
    };
  }

  // Pattern 3: Recursion / Backtracking / Stack / Trees
  if (qLower.includes('recurs') || qLower.includes('stack') || qLower.includes('base case') || qLower.includes('tree')) {
    return {
      directAnswer:
        'As your Professor, let me take the mystery out of Recursion: a recursive function is just a function that solves one tiny step itself and asks a clone of itself to solve the remaining smaller piece, stopping at a clear Base Case.',
      realWorldAnalogy:
        'Real-World Example: Imagine you are sitting in a dark movie theater and want to know what row number you are in. You tap the person in front of you and ask their row. They ask the person in front of them, until the person in Row 1 says "I am Row 1!" (the Base Case). Then each person simply adds +1 to the answer passed back!',
      stepByStepBreakdown: [
        'Write the Base Case first: check if the problem is so small (like `n == 0` or `node == nullptr`) that you already know the answer, and `return`.',
        'Call the function on a smaller input (like `n - 1`) and trust that it returns the answer for the rest.',
        'Combine your current step’s work with that returned answer and pass it back up.',
      ],
      complexitySimple: {
        time: 'O(N) — We make 1 function call for each step down to the Base Case.',
        space: 'O(N) — Each waiting function call sits on the computer’s Call Stack until the Base Case returns.',
      },
      commonMistake:
        'Writing the recursive call without making the input strictly smaller toward the Base Case, which creates an infinite chain and crashes with a Stack Overflow.',
      detailedExplanation:
        'Never try to trace 50 recursive calls in your head—just verify the Base Case works for the smallest input, and verify that step `N` correctly combines with step `N - 1`.',
      interviewPerspective: {
        actualInterviewQuestion:
          'Interviewer asks: "What is the space complexity of your recursive solution, and how would you prevent a Stack Overflow if N is 100,000?"',
        whatInterviewerExpects:
          '1) Explicitly state that recursion uses O(H) or O(N) auxiliary Call Stack memory even if you create no arrays. 2) Explain that for very deep inputs (N = 100,000), the call stack can overflow, so converting to an iterative loop (or explicit stack) reduces stack risk.',
        followUpTrap:
          'Follow-Up Trap: "If a recursive function calls itself TWICE per step (like `fib(n-1) + fib(n-2)`), what is the time and space complexity?" → Answer: Time explodes to O(2^N) without memoization, while space is still O(N) because the maximum depth of the call tree at any moment is N!',
      },
      codeExample: {
        language: category === 'DSA' ? 'C++' : 'JavaScript',
        code: `int sumUpTo(int n) {\n  if (n <= 0) {\n    return 0;\n  }\n  int smallerResult = sumUpTo(n - 1);\n  return n + smallerResult;\n}`,
        explanation: 'Computes 1 + 2 + ... + n recursively with an explicit base case and step.',
        lineByLine: [
          {
            line: 'int sumUpTo(int n) {',
            explanation: 'Defines our function that wants to find the sum from 1 up to n.',
          },
          {
            line: 'if (n <= 0) return 0;',
            explanation: 'THE BASE CASE: The stop sign! When n reaches 0, we stop calling ourselves and return 0.',
          },
          {
            line: 'int smallerResult = sumUpTo(n - 1);',
            explanation: 'THE RECURSIVE STEP: Pauses current function and asks for the sum of (n - 1).',
          },
          {
            line: 'return n + smallerResult;',
            explanation: 'Adds our current number n to the answer returned from (n - 1) and sends it back up.',
          },
        ],
      },
      quickCheckQuestion: {
        question: 'In a recursive function `fib(n) = fib(n-1) + fib(n-2)`, what is the Call Stack space complexity?',
        options: [
          'O(N) — because the computer finishes the left branch before starting the right branch, so the stack is never deeper than N',
          'O(2^N) space',
          'O(1) space',
          'O(N²) space',
        ],
        correctIndex: 0,
        explanation:
          'This is a classic interview question! Even though time is O(2^N), the Call Stack only holds one root-to-leaf path at a time, so space is O(N).',
      },
    };
  }

  // Default Professor-to-Beginner + Interviewer response for any lesson or topic
  return {
    directAnswer: `Let’s break "${question}" in ${lessonTitle} down like we are in a beginner lecture: the goal is to organize our data cleanly around ${concepts.join(' and ')} so the computer never repeats work it already did.`,
    realWorldAnalogy: `Real-World Example: Imagine ${lessonTitle} is like organizing a busy coffee shop counter. Instead of running to the back storage room every time a customer orders a cup, you keep the essentials right on the counter in labeled jars so every order is served in seconds.`,
    stepByStepBreakdown: [
      `Step 1 (Small Whiteboard Trace): Pick a tiny 3-item example and write down the starting input and the exact output you want.`,
      `Step 2 (Core Rule of ${concepts[0] || lessonTitle}): Process one item at a time, updating your state variables in a single clean pass.`,
      `Step 3 (Boundary Check): Test what happens when the input is empty, has 1 item, or has duplicate values.`,
    ],
    complexitySimple: {
      time: 'O(N) — We process each item a constant number of times without slow nested loops.',
      space: 'O(1) to O(N) — We store only the minimum variables or lookup table needed.',
    },
    commonMistake:
      'Jumping straight into typing code before dry-running a 3-element example by hand and checking empty/edge inputs.',
    detailedExplanation: `Mastering ${lessonTitle} comes down to understanding the real-world intuition first, then translating each step into clean, predictable code.`,
    interviewPerspective: {
      actualInterviewQuestion: `Interviewer asks: "How would you implement ${lessonTitle} (${concepts[0] || 'this pattern'}) optimally, and how does it scale when input size N grows to 1,000,000?"`,
      whatInterviewerExpects:
        '1) Clarify input constraints and edge cases (empty input, duplicates, negative values) first. 2) Contrast the naive brute-force approach with the optimal single-pass or indexed approach. 3) Clearly state both Time and Space complexity.',
      followUpTrap:
        'Follow-Up Trap: "Can we optimize the space complexity further if the input is already sorted or can be modified in-place?" → Answer: Yes, sorting or in-place pointer swaps often reduce auxiliary space from O(N) down to O(1).',
    },
    codeExample: {
      language: category === 'DSA' ? 'C++' : 'JavaScript',
      code:
        category === 'DSA'
          ? `int solvePattern(vector<int>& nums) {\n  if (nums.empty()) return 0;\n  int result = 0;\n  for (int i = 0; i < nums.size(); i++) {\n    result += nums[i];\n  }\n  return result;\n}`
          : `function solvePattern(items) {\n  if (!items || items.length === 0) return [];\n  const result = [];\n  for (let i = 0; i < items.length; i++) {\n    result.push(items[i]);\n  }\n  return result;\n}`,
      explanation: `Clean, interview-ready template for ${lessonTitle} with edge-case guard and single-pass loop.`,
      lineByLine: [
        {
          line: category === 'DSA' ? 'if (nums.empty()) return 0;' : 'if (!items || items.length === 0) return [];',
          explanation: 'Guards against empty input right at the top so the code never crashes on edge cases.',
        },
        {
          line: category === 'DSA' ? 'int result = 0;' : 'const result = [];',
          explanation: 'Initializes our accumulator variable before starting the main loop.',
        },
        {
          line: category === 'DSA' ? 'for (int i = 0; i < nums.size(); i++)' : 'for (let i = 0; i < items.length; i++)',
          explanation: 'Walks through each element exactly once from start to finish in O(N) time.',
        },
        {
          line: category === 'DSA' ? 'return result;' : 'return result;',
          explanation: 'Returns the final computed answer after all elements have been processed.',
        },
      ],
    },
    quickCheckQuestion: {
      question: `In a technical interview on ${lessonTitle}, what should you always do BEFORE writing your main loop?`,
      options: [
        'Clarify constraints and guard edge cases like empty or single-element inputs',
        'Write a triple nested loop without asking questions',
        'Skip time complexity analysis',
        'Assume the input is always size 10',
      ],
      correctIndex: 0,
      explanation:
        'Interviewers love candidates who clarify constraints and handle edge cases at the very beginning!',
    },
  };
}

export const aiMentorStorage = {
  /**
   * Retrieve cached Concept Tutor answer from localStorage
   */
  getConceptAnswer(
    trackerTitle: string,
    lessonTitle: string,
    question: string,
    style: 'simple' | 'interview' = 'simple'
  ): { answer: ConceptTutorAnswer; timestamp: number } | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(TUTOR_CACHE_STORAGE_KEY);
      if (!raw) return null;
      const cache: Record<string, CachedTutorEntry> = JSON.parse(raw);
      const key = normalizeKey(trackerTitle, lessonTitle, question, style);
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
  setConceptAnswer(
    trackerTitle: string,
    lessonTitle: string,
    question: string,
    answer: ConceptTutorAnswer,
    style: 'simple' | 'interview' = 'simple'
  ) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(TUTOR_CACHE_STORAGE_KEY);
      const cache: Record<string, CachedTutorEntry> = raw ? JSON.parse(raw) : {};

      const key = normalizeKey(trackerTitle, lessonTitle, question, style);
      cache[key] = {
        key,
        question: question.trim(),
        style,
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

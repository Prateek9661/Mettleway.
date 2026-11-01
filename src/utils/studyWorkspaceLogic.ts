import { Tracker, Module, Lesson, StudyTask } from '../types';

export type NavTab = 'today' | 'curriculum' | 'mentor' | 'squads' | 'schedule';

export interface CourseThemeTokens {
  accentText: string;
  accentBgSoft: string;
  accentBorder: string;
  progressBg: string;
  buttonBg: string;
}

/**
 * Returns distinct visual theme tokens based on the active course category
 * so switching courses visibly updates the dashboard theme.
 */
export function getCourseThemeTokens(category?: Tracker['category']): CourseThemeTokens {
  switch (category) {
    case 'AI & ML':
      return {
        accentText: 'text-emerald-700',
        accentBgSoft: 'bg-emerald-50',
        accentBorder: 'border-emerald-200',
        progressBg: 'bg-emerald-600',
        buttonBg: 'bg-emerald-600 hover:bg-emerald-700',
      };
    case 'Web Development':
      return {
        accentText: 'text-sky-700',
        accentBgSoft: 'bg-sky-50',
        accentBorder: 'border-sky-200',
        progressBg: 'bg-sky-600',
        buttonBg: 'bg-sky-600 hover:bg-sky-700',
      };
    case 'System Design':
      return {
        accentText: 'text-amber-700',
        accentBgSoft: 'bg-amber-50',
        accentBorder: 'border-amber-200',
        progressBg: 'bg-amber-600',
        buttonBg: 'bg-amber-600 hover:bg-amber-700',
      };
    case 'Computer Science Core':
      return {
        accentText: 'text-violet-700',
        accentBgSoft: 'bg-violet-50',
        accentBorder: 'border-violet-200',
        progressBg: 'bg-violet-600',
        buttonBg: 'bg-violet-600 hover:bg-violet-700',
      };
    case 'DSA':
    default:
      return {
        accentText: 'text-indigo-600',
        accentBgSoft: 'bg-indigo-50',
        accentBorder: 'border-indigo-200',
        progressBg: 'bg-indigo-600',
        buttonBg: 'bg-indigo-600 hover:bg-indigo-700',
      };
  }
}

/**
 * Resolves the state transition when toggling Deep Work mode.
 * When enabling Deep Work from a non-essential view (squads, curriculum, schedule),
 * automatically redirects the learner to the 'today' active study session view.
 */
export function resolveDeepWorkToggle(
  currentDeepWork: boolean,
  currentTab: NavTab
): { isDeepWork: boolean; nextTab: NavTab } {
  const nextDeepWork = !currentDeepWork;
  if (nextDeepWork && currentTab !== 'today' && currentTab !== 'mentor') {
    return { isDeepWork: true, nextTab: 'today' };
  }
  return { isDeepWork: nextDeepWork, nextTab: currentTab };
}

/**
 * Computes overall course mastery statistics (completed, total, percent).
 */
export function calculateCourseProgress(
  tracker: Tracker | null
): { completed: number; total: number; percent: number } {
  if (!tracker) return { completed: 0, total: 0, percent: 0 };
  let total = 0;
  let completed = 0;
  tracker.modules.forEach(mod => {
    mod.lessons.forEach(les => {
      total += 1;
      if (les.completed) completed += 1;
    });
  });
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

/**
 * Returns the first uncompleted lesson in the active tracker, or null if all are completed.
 */
export function getCurrentUncompletedLesson(tracker: Tracker | null): Lesson | null {
  if (!tracker) return null;
  for (const mod of tracker.modules) {
    for (const les of mod.lessons) {
      if (!les.completed) return les;
    }
  }
  return null;
}

/**
 * Generates the combined Daily Study Checklist by pairing curriculum-linked tasks
 * (watching the lecture, completing the hands-on exercise, writing revision notes)
 * with the learner's custom study tasks.
 */
export function generateDailyStudyChecklist(
  currentLesson: Lesson | null,
  builtInChecks: Record<string, boolean>,
  customTasks: StudyTask[],
  sessionNotes: string
): StudyTask[] {
  const coreTasks: StudyTask[] = [];
  if (currentLesson) {
    coreTasks.push({
      id: `lesson-watch-${currentLesson.id}`,
      title: `Watch & complete lesson: "${currentLesson.title}"`,
      category: 'video',
      estimatedMinutes: currentLesson.durationMinutes,
      completed: Boolean(currentLesson.completed),
      linkedLessonId: currentLesson.id,
    });

    if (currentLesson.practiceTask) {
      const key = `practice-${currentLesson.id}`;
      coreTasks.push({
        id: key,
        title: `Hands-on practice: ${currentLesson.practiceTask}`,
        category: 'practice',
        estimatedMinutes: 20,
        completed: Boolean(builtInChecks[key]),
      });
    }

    const notesKey = `notes-${currentLesson.id}`;
    coreTasks.push({
      id: notesKey,
      title: `Write key takeaways or test 1 concept with Professor Mentor`,
      category: 'notes',
      estimatedMinutes: 10,
      completed: Boolean(builtInChecks[notesKey] || sessionNotes.trim().length > 15),
    });
  }
  return [...coreTasks, ...customTasks];
}

/**
 * Filters study tasks by status ('all' | 'todo' | 'done').
 */
export function filterStudyTasks(
  tasks: StudyTask[],
  filter: 'all' | 'todo' | 'done'
): StudyTask[] {
  if (filter === 'todo') return tasks.filter(t => !t.completed);
  if (filter === 'done') return tasks.filter(t => t.completed);
  return tasks;
}

/**
 * Pure state updater that marks a specific lesson completed in a Tracker
 * and attaches the completion timestamp and optional study notes.
 */
export function completeLessonInTracker(
  tracker: Tracker,
  lessonId: string,
  notes?: string,
  completedAtIso: string = new Date().toISOString()
): Tracker {
  return {
    ...tracker,
    modules: tracker.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(les => {
        if (les.id === lessonId) {
          return {
            ...les,
            completed: true,
            completedAt: completedAtIso,
            notes: notes !== undefined && notes.trim() !== '' ? notes : les.notes,
          };
        }
        return les;
      }),
    })),
  };
}

/**
 * Dynamically binds a lesson's videoUrl to the active course's stored sourceUrl / YouTube playlist
 * rather than falling back to hardcoded or fake AI placeholder URLs.
 */
export function resolveLessonVideoUrl(
  courseSourceUrl: string,
  _lessonVideoUrl?: string,
  lessonIndex: number = 0,
  courseTitle: string = '',
  lessonTitle: string = ''
): string {
  const trimmedSource = (courseSourceUrl || '').trim();
  const isHttpUrl = /^https?:\/\//i.test(trimmedSource);

  if (isHttpUrl) {
    // If it's a YouTube playlist URL, append &index=N so each lesson links to its place in the playlist
    if (trimmedSource.includes('list=')) {
      const cleanUrl = trimmedSource.replace(/([?&])index=\d+/g, '');
      const separator = cleanUrl.includes('?') ? '&' : '?';
      return `${cleanUrl}${separator}index=${lessonIndex + 1}`;
    }
    // Single YouTube video or external course URL: bind directly to the user's course URL
    return trimmedSource;
  }

  // If the user typed a topic name instead of a URL, generate a targeted YouTube search link for that lesson
  const query = `${courseTitle || trimmedSource} ${lessonTitle}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query || 'programming tutorial')}`;
}

// Known playlist IDs or keywords for popular YouTube courses
const KNOWN_YOUTUBE_PLAYLIST_HINTS: Record<string, { title: string; instructor: string; topic: string }> = {
  plu0w_9lii9agwh1xjrt242xiphpt2llg: {
    title: 'Python Programming Complete Bootcamp (100 Days of Code)',
    instructor: 'CodeWithHarry',
    topic: 'python',
  },
  _uqrj0tkzlc: {
    title: 'Python Tutorial for Beginners - Full Course',
    instructor: 'Programming with Mosh',
    topic: 'python',
  },
  rfscvs0vtbw: {
    title: 'Learn Python - Full Course for Beginners',
    instructor: 'freeCodeCamp.org',
    topic: 'python',
  },
  hdI2bqOjy3c: {
    title: 'JavaScript Crash Course & Modern ES6+',
    instructor: 'Traversy Media',
    topic: 'web',
  },
};

function inferCourseMetadata(inputUrl: string, rawTopic?: string, extractedData?: any) {
  const combined = `${inputUrl} ${rawTopic || ''} ${extractedData?.title || ''} ${extractedData?.description || ''}`.toLowerCase();

  // Check known YouTube playlist/video hints
  for (const [idKey, meta] of Object.entries(KNOWN_YOUTUBE_PLAYLIST_HINTS)) {
    if (combined.includes(idKey.toLowerCase())) {
      return {
        subjectKey: meta.topic as 'python' | 'web' | 'ai' | 'system' | 'cs' | 'dsa',
        defaultTitle: meta.title,
        defaultInstructor: meta.instructor,
        category: (meta.topic === 'python' ? 'AI & ML' : 'Web Development') as Tracker['category'],
      };
    }
  }

  if (
    combined.includes('python') ||
    combined.includes('django') ||
    combined.includes('flask') ||
    combined.includes('fastapi') ||
    combined.includes('pandas')
  ) {
    return {
      subjectKey: 'python' as const,
      defaultTitle: 'Python Programming & Automation Mastery',
      defaultInstructor: 'Python Core Curriculum',
      category: 'AI & ML' as Tracker['category'],
    };
  }

  if (
    combined.includes('machine learning') ||
    combined.includes('deep learning') ||
    combined.includes('neural') ||
    combined.includes('llm') ||
    combined.includes('ai ') ||
    combined.includes('data science')
  ) {
    return {
      subjectKey: 'ai' as const,
      defaultTitle: 'Applied Machine Learning & AI Engineering',
      defaultInstructor: 'AI Engineering Track',
      category: 'AI & ML' as Tracker['category'],
    };
  }

  if (
    combined.includes('react') ||
    combined.includes('javascript') ||
    combined.includes('typescript') ||
    combined.includes('next') ||
    combined.includes('node') ||
    combined.includes('mern') ||
    combined.includes('web') ||
    combined.includes('frontend') ||
    combined.includes('html') ||
    combined.includes('css')
  ) {
    return {
      subjectKey: 'web' as const,
      defaultTitle: 'Modern Full-Stack Web Development Track',
      defaultInstructor: 'Full-Stack Engineering',
      category: 'Web Development' as Tracker['category'],
    };
  }

  if (
    combined.includes('system design') ||
    combined.includes('microservice') ||
    combined.includes('distributed') ||
    combined.includes('docker') ||
    combined.includes('kubernetes') ||
    combined.includes('aws') ||
    combined.includes('devops')
  ) {
    return {
      subjectKey: 'system' as const,
      defaultTitle: 'Scalable System Design & Cloud Architecture',
      defaultInstructor: 'Architecture & Systems Track',
      category: 'System Design' as Tracker['category'],
    };
  }

  if (
    combined.includes('dsa') ||
    combined.includes('algorithm') ||
    combined.includes('striver') ||
    combined.includes('leetcode') ||
    combined.includes('data structure')
  ) {
    return {
      subjectKey: 'dsa' as const,
      defaultTitle: 'Data Structures & Algorithms Problem Solving',
      defaultInstructor: 'DSA Mastery Track',
      category: 'DSA' as Tracker['category'],
    };
  }

  return {
    subjectKey: 'cs' as const,
    defaultTitle: 'Computer Science & Software Engineering Track',
    defaultInstructor: 'YouTube Curated Series',
    category: 'Computer Science Core' as Tracker['category'],
  };
}

function buildCuratedModulesForSubject(
  subjectKey: 'python' | 'web' | 'ai' | 'system' | 'cs' | 'dsa',
  courseTitle: string
): Array<{
  title: string;
  description: string;
  lessons: Array<{
    title: string;
    durationMinutes: number;
    keyConcepts: string[];
    practiceTask: string;
  }>;
}> {
  if (subjectKey === 'python') {
    return [
      {
        title: 'Module 1: Python Core Syntax, Variables & Control Flow',
        description: 'Master Python execution model, dynamic typing, string slicing, and conditional loops.',
        lessons: [
          {
            title: 'Lesson 1: Python Environment Setup, Variables & Memory Model',
            durationMinutes: 35,
            keyConcepts: ['Dynamic Typing', 'Reference Counting', 'f-Strings', 'Type Casting'],
            practiceTask: 'Write a CLI expense calculator script using formatted f-strings and user input validation',
          },
          {
            title: 'Lesson 2: Control Flow, Loops & List Comprehensions in Python',
            durationMinutes: 40,
            keyConcepts: ['for/while Loops', 'enumerate & zip', 'List Comprehensions', 'Time Efficiency'],
            practiceTask: 'Transform nested loops into clean single-line Python list and dictionary comprehensions',
          },
          {
            title: 'Lesson 3: Python Data Structures — Lists, Tuples, Sets & Dictionaries',
            durationMinutes: 45,
            keyConcepts: ['Mutability vs Imutability', 'Hashable Keys', 'O(1) Dict Lookups', 'Set Operations'],
            practiceTask: 'Build a word-frequency analyzer and deduplicator using Python dicts and sets',
          },
        ],
      },
      {
        title: 'Module 2: Functions, Modular Python & Object-Oriented Programming',
        description: 'Write reusable, production-grade Python with *args/**kwargs, decorators, and classes.',
        lessons: [
          {
            title: 'Lesson 4: First-Class Functions, Closures, *args & **kwargs',
            durationMinutes: 40,
            keyConcepts: ['Positional vs Keyword Args', 'Lambda Functions', 'Decorators', 'Scope (LEGB Rule)'],
            practiceTask: 'Implement a `@measure_time` decorator that logs execution time of any Python function',
          },
          {
            title: 'Lesson 5: Object-Oriented Python — Classes, Dunder Methods & Inheritance',
            durationMinutes: 50,
            keyConcepts: ['__init__ & __repr__', 'Encapsulation', 'Composition vs Inheritance', 'Dataclasses'],
            practiceTask: 'Design a BankAccount & Transaction ledger class hierarchy with `@dataclass`',
          },
        ],
      },
      {
        title: 'Module 3: File I/O, Error Handling, APIs & Real-World Python Projects',
        description: 'Work with JSON files, context managers, HTTP requests, and automated testing.',
        lessons: [
          {
            title: 'Lesson 6: Context Managers (`with`), Exceptions & JSON Data Pipelines',
            durationMinutes: 40,
            keyConcepts: ['try/except/finally', 'Custom Exceptions', 'Context Managers', 'Pathlib & JSON'],
            practiceTask: 'Build a fault-tolerant JSON log parser that gracefully handles malformed entries',
          },
          {
            title: 'Lesson 7: Generators, Iterators & Async Python Fundamentals',
            durationMinutes: 45,
            keyConcepts: ['yield Keyword', 'Lazy Evaluation', 'Memory-Efficient Streams', 'asyncio Basics'],
            practiceTask: 'Write a Python generator pipeline that processes a 1GB CSV file in O(1) memory',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'web') {
    return [
      {
        title: 'Module 1: Modern JavaScript / TypeScript & Asynchronous Runtime',
        description: 'Event loop internals, closures, Promises, async/await, and strict TypeScript types.',
        lessons: [
          {
            title: 'Lesson 1: Call Stack, Microtask Queue & Async/Await Execution',
            durationMinutes: 40,
            keyConcepts: ['Event Loop', 'Promises & Microtasks', 'Closures', 'Lexical Scope'],
            practiceTask: 'Implement a custom `Promise.all` and debounced search handler from scratch',
          },
          {
            title: 'Lesson 2: Component Architecture, State Hooks & Rendering Lifecycle',
            durationMinutes: 45,
            keyConcepts: ['Declarative UI', 'useState & useEffect', 'Referential Equality', 'Custom Hooks'],
            practiceTask: 'Build a synchronized filterable dashboard with URL query state persistence',
          },
        ],
      },
      {
        title: 'Module 2: Backend APIs, Authentication & Database Persistence',
        description: 'RESTful API design, middleware pipelines, validation, and data modeling.',
        lessons: [
          {
            title: 'Lesson 3: REST API Design, Middleware & Input Validation',
            durationMinutes: 45,
            keyConcepts: ['HTTP Status Codes', 'Request Validation', 'Error Handling Middleware'],
            practiceTask: 'Build a complete CRUD API endpoint with schema validation and rate limiting',
          },
          {
            title: 'Lesson 4: Authentication Flows, JWT Security & Deployment',
            durationMinutes: 50,
            keyConcepts: ['Session vs JWT', 'HttpOnly Cookies', 'CORS', 'Production Build'],
            practiceTask: 'Secure protected API routes and write end-to-end integration tests',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'ai') {
    return [
      {
        title: 'Module 1: Foundations of Machine Learning & Vector Math',
        description: 'Supervised vs unsupervised learning, loss functions, and gradient descent.',
        lessons: [
          {
            title: 'Lesson 1: Features, Labels, Loss Functions & Gradient Descent Intuition',
            durationMinutes: 45,
            keyConcepts: ['MSE Loss', 'Learning Rate', 'Partial Derivatives', 'Vectorization'],
            practiceTask: 'Implement Linear Regression with Gradient Descent in pure NumPy',
          },
          {
            title: 'Lesson 2: Model Evaluation, Overfitting & Regularization',
            durationMinutes: 40,
            keyConcepts: ['Train/Val/Test Split', 'Precision & Recall', 'L1/L2 Regularization'],
            practiceTask: 'Evaluate a classification pipeline using confusion matrices and F1-score',
          },
        ],
      },
      {
        title: 'Module 2: Neural Networks, Embeddings & LLM Applications',
        description: 'Backpropagation, transformer attention, embeddings, and RAG systems.',
        lessons: [
          {
            title: 'Lesson 3: Neural Network Layers, Activations & Backpropagation',
            durationMinutes: 50,
            keyConcepts: ['ReLU & Softmax', 'Chain Rule', 'Batch Normalization'],
            practiceTask: 'Train a 2-layer neural network classifier and visualize the loss curve',
          },
          {
            title: 'Lesson 4: Embeddings, Semantic Search & Structured LLM Outputs',
            durationMinutes: 45,
            keyConcepts: ['Cosine Similarity', 'Vector Retrieval', 'Prompt Engineering'],
            practiceTask: 'Build a semantic document Q&A pipeline with structured JSON validation',
          },
        ],
      },
    ];
  }

  if (subjectKey === 'system') {
    return [
      {
        title: 'Module 1: Scalability, Load Balancing & Caching Layers',
        description: 'Horizontal scaling, consistent hashing, Redis caching strategies, and CDNs.',
        lessons: [
          {
            title: 'Lesson 1: Vertical vs Horizontal Scaling & Load Balancers',
            durationMinutes: 40,
            keyConcepts: ['L4 vs L7 Load Balancing', 'Consistent Hashing', 'Stateless Servers'],
            practiceTask: 'Design a consistent hashing ring that minimizes key redistribution on node failure',
          },
          {
            title: 'Lesson 2: Distributed Caching Patterns (Cache-Aside, Write-Through)',
            durationMinutes: 45,
            keyConcepts: ['Cache Eviction (LRU)', 'Thundering Herd', 'TTL Tuning'],
            practiceTask: 'Implement an in-memory LRU cache with TTL expiration',
          },
        ],
      },
      {
        title: 'Module 2: Databases, Sharding, Message Queues & High Availability',
        description: 'SQL vs NoSQL trade-offs, CAP theorem, replication, and async queues.',
        lessons: [
          {
            title: 'Lesson 3: Database Replication, Partitioning & CAP Theorem',
            durationMinutes: 45,
            keyConcepts: ['Leader-Follower Replication', 'Range vs Hash Sharding', 'ACID vs BASE'],
            practiceTask: 'Design the database schema and sharding key for a high-throughput URL shortener',
          },
        ],
      },
    ];
  }

  // Default Clean Custom Course / CS Curriculum (never pre-completed, never hardcoded to Striver URLs)
  const cleanSubjectName = courseTitle.replace(/^DevTrack:\s*/i, '').trim() || 'Core Computer Science';
  return [
    {
      title: `Module 1: ${cleanSubjectName} — Core Foundations & Mental Models`,
      description: `Essential building blocks, terminology, and foundational execution patterns for ${cleanSubjectName}.`,
      lessons: [
        {
          title: `Lesson 1: Introduction, Setup & Core Architecture of ${cleanSubjectName}`,
          durationMinutes: 35,
          keyConcepts: ['Core Mental Model', 'Environment Setup', 'Execution Lifecycle'],
          practiceTask: `Complete the starter setup and build a minimal working example for ${cleanSubjectName}`,
        },
        {
          title: `Lesson 2: Essential Data Patterns, State & Control Flow in ${cleanSubjectName}`,
          durationMinutes: 40,
          keyConcepts: ['Data Representation', 'State Transitions', 'Edge Case Handling'],
          practiceTask: `Implement the primary data flow pattern covered in the lecture without looking at notes`,
        },
        {
          title: `Lesson 3: Debugging, Complexity & Best Practices in ${cleanSubjectName}`,
          durationMinutes: 45,
          keyConcepts: ['Performance Bottlenecks', 'Debugging Workflow', 'Clean Code Patterns'],
          practiceTask: `Refactor your implementation and test against 3 boundary conditions`,
        },
      ],
    },
    {
      title: `Module 2: ${cleanSubjectName} — Applied Implementation & Real-World Workflows`,
      description: `Hands-on problem solving, modular design, and practical implementation.`,
      lessons: [
        {
          title: `Lesson 4: Building Modular Components & Reusable Logic in ${cleanSubjectName}`,
          durationMinutes: 45,
          keyConcepts: ['Modular Abstraction', 'Error Handling', 'Unit Testing'],
          practiceTask: `Write a modular solution with automated unit tests verifying expected outputs`,
        },
        {
          title: `Lesson 5: Capstone Project & End-to-End Integration in ${cleanSubjectName}`,
          durationMinutes: 50,
          keyConcepts: ['End-to-End Integration', 'Production Readiness', 'Optimization'],
          practiceTask: `Combine all modules into a complete working mini-project`,
        },
      ],
    },
  ];
}

export interface BuildDynamicTrackerOptions {
  inputUrl: string;
  rawTopic?: string;
  extractedData?: any;
  dailyMinutes?: number;
  scheduledTime?: string;
  studyDays?: number[];
  trackerId?: string;
}

/**
 * Dynamically constructs a fresh, 100% synchronized Tracker from a user's YouTube URL or topic.
 * - Ensures 0% initial completion on all lessons.
 * - Ensures every lesson's videoUrl dynamically binds to the user's inputUrl.
 * - Never falls back to hardcoded Striver DSA lessons or URLs.
 */
export function buildDynamicTrackerFromInput(options: BuildDynamicTrackerOptions): Tracker {
  const {
    inputUrl,
    rawTopic,
    extractedData,
    dailyMinutes = 60,
    scheduledTime = '20:00',
    studyDays = [1, 2, 3, 4, 5, 6],
    trackerId = `tracker-${Date.now()}`,
  } = options;

  const trimmedUrl = inputUrl.trim();
  const inferred = inferCourseMetadata(trimmedUrl, rawTopic, extractedData);

  // Determine clean course title (avoid raw https:// URL as the title if a human-readable title is available)
  let cleanTitle =
    extractedData?.title && !/^https?:\/\//i.test(extractedData.title.trim())
      ? extractedData.title.trim()
      : '';

  if (!cleanTitle && rawTopic && !/^https?:\/\//i.test(rawTopic.trim())) {
    cleanTitle = rawTopic.trim();
  }

  if (!cleanTitle) {
    // If inputUrl contains both a URL and text (e.g., "Python Course https://..."), extract the text
    const withoutUrls = trimmedUrl.replace(/https?:\/\/[^\s]+/gi, '').trim();
    cleanTitle = withoutUrls.length > 3 ? withoutUrls : inferred.defaultTitle;
  }

  const validCategories: Tracker['category'][] = [
    'DSA',
    'Web Development',
    'System Design',
    'Computer Science Core',
    'AI & ML',
  ];

  // If the subject was explicitly inferred as non-DSA (e.g. Python -> AI & ML), prefer that over a generic 'DSA' default
  const category: Tracker['category'] =
    inferred.subjectKey !== 'dsa' && inferred.subjectKey !== 'cs'
      ? inferred.category
      : validCategories.includes(extractedData?.category)
      ? extractedData.category
      : inferred.category;

  const difficulty: Tracker['difficulty'] =
    extractedData?.difficulty === 'Beginner' ||
    extractedData?.difficulty === 'Intermediate' ||
    extractedData?.difficulty === 'Advanced'
      ? extractedData.difficulty
      : 'Beginner';

  const instructor =
    extractedData?.instructor && extractedData.instructor !== 'take U forward (Striver)'
      ? extractedData.instructor
      : inferred.defaultInstructor;

  // Use extracted modules ONLY if they are valid and NOT the hardcoded Striver DSA preset modules
  const hasValidExtractedModules =
    Array.isArray(extractedData?.modules) &&
    extractedData.modules.length > 0 &&
    !extractedData.modules.some((m: any) =>
      (m.lessons || []).some((l: any) =>
        String(l.title || '').includes('Hashing & Frequency Counting Maps')
      )
    );

  const rawModules = hasValidExtractedModules
    ? extractedData.modules
    : buildCuratedModulesForSubject(inferred.subjectKey, cleanTitle);

  let runningLessonIdx = 0;
  let totalMinutes = 0;

  const modules: Module[] = rawModules.map((mod: any, mIdx: number) => {
    const rawLessons = Array.isArray(mod.lessons) && mod.lessons.length > 0 ? mod.lessons : [];
    const lessons: Lesson[] = rawLessons.map((les: any, lIdx: number) => {
      const currentIdx = runningLessonIdx++;
      const duration = Number(les.durationMinutes) || 40;
      totalMinutes += duration;
      const lessonTitle = les.title || `Lesson ${currentIdx + 1}`;

      return {
        id: `${trackerId}-les-${mIdx + 1}-${lIdx + 1}`,
        title: lessonTitle,
        durationMinutes: duration,
        videoUrl: resolveLessonVideoUrl(trimmedUrl, les.videoUrl, currentIdx, cleanTitle, lessonTitle),
        keyConcepts:
          Array.isArray(les.keyConcepts) && les.keyConcepts.length > 0
            ? les.keyConcepts
            : ['Core Principles', 'Hands-On Implementation'],
        practiceTask:
          les.practiceTask || `Complete the hands-on coding exercise for ${lessonTitle}`,
        completed: false,
      };
    });

    return {
      id: `${trackerId}-mod-${mIdx + 1}`,
      title: mod.title || `Module ${mIdx + 1}`,
      description: mod.description || `Structured learning module for ${cleanTitle}`,
      lessons,
    };
  });

  return {
    id: trackerId,
    title: cleanTitle,
    description:
      extractedData?.description ||
      `Personalized daily learning roadmap and task tracker for ${cleanTitle}.`,
    category,
    difficulty,
    instructor,
    sourceUrl: trimmedUrl,
    totalVideos: runningLessonIdx,
    estimatedTotalMinutes: totalMinutes || runningLessonIdx * 40,
    dailyMinutesTarget: dailyMinutes,
    scheduledTime,
    studyDays: studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5, 6],
    createdAt: new Date().toISOString(),
    modules,
  };
}

/**
 * Detects and automatically repairs any custom tracker in state/localStorage
 * that was previously polluted with stale Striver DSA modules ("Lec 3: Hashing & Frequency Counting Maps")
 * or unbound YouTube URLs.
 */
export function sanitizeAndSyncTracker(tracker: Tracker): Tracker {
  // Leave the built-in preset trackers untouched
  if (tracker.id === 'tracker-dsa-striver' || tracker.id === 'tracker-fullstack-mern') {
    return tracker;
  }

  const hasStaleStriverLessons = tracker.modules.some(m =>
    m.lessons.some(
      l =>
        l.id === 'les-3' ||
        l.title.includes('Hashing & Frequency Counting Maps') ||
        l.videoUrl.includes('KEs5UyBJ39g')
    )
  );

  const isRawUrlTitle = /^https?:\/\//i.test(tracker.title.trim());

  if (hasStaleStriverLessons || isRawUrlTitle) {
    return buildDynamicTrackerFromInput({
      inputUrl: tracker.sourceUrl || tracker.title,
      rawTopic: isRawUrlTitle ? undefined : tracker.title,
      dailyMinutes: tracker.dailyMinutesTarget,
      scheduledTime: tracker.scheduledTime,
      studyDays: tracker.studyDays,
      trackerId: tracker.id,
    });
  }

  // Also ensure every lesson in a custom tracker has its videoUrl bound to tracker.sourceUrl if tracker.sourceUrl is an HTTP URL
  if (tracker.sourceUrl && /^https?:\/\//i.test(tracker.sourceUrl.trim())) {
    let idx = 0;
    return {
      ...tracker,
      modules: tracker.modules.map(mod => ({
        ...mod,
        lessons: mod.lessons.map(les => {
          const lessonIdx = idx++;
          const needsRebind =
            !les.videoUrl ||
            les.videoUrl.includes('KEs5UyBJ39g') ||
            les.videoUrl.includes('FPu9Uld7W-E') ||
            les.videoUrl.includes('example');
          return {
            ...les,
            videoUrl: needsRebind
              ? resolveLessonVideoUrl(tracker.sourceUrl, les.videoUrl, lessonIdx, tracker.title, les.title)
              : les.videoUrl,
          };
        }),
      })),
    };
  }

  return tracker;
}

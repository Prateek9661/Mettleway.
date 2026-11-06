import { ConceptTutorAnswer, AIRecapData, Lesson, ConceptMentorStyle } from '../types';

const TUTOR_CACHE_STORAGE_KEY = 'devtrack_ai_tutor_cache_v4';
const RECAP_CACHE_STORAGE_KEY = 'devtrack_ai_recap_cache_v3';
const MAX_CACHE_ENTRIES = 100;

interface CachedTutorEntry {
  key: string;
  question: string;
  style: ConceptMentorStyle;
  answer: ConceptTutorAnswer;
  timestamp: number;
}

interface CachedRecapEntry {
  key: string;
  recap: AIRecapData;
  timestamp: number;
}

function normalizeStyle(style?: ConceptMentorStyle | string): 'simple' | 'technical' {
  if (style === 'technical' || style === 'interview') {
    return 'technical';
  }
  return 'simple';
}

function normalizeKey(
  trackerTitle: string,
  lessonTitle: string,
  query: string,
  style: ConceptMentorStyle | string = 'simple'
): string {
  const normTracker = (trackerTitle || '').toLowerCase().trim();
  const normLesson = (lessonTitle || '').toLowerCase().trim();
  const normQuery = (query || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const normStyle = normalizeStyle(style);
  return `${normTracker}::${normLesson}::${normStyle}::${normQuery}`;
}

/**
 * Generates an accurate explanation tailored to the active mode:
 * - Professor Mode ('simple'): Friendly, patient professor teaching an absolute beginner with simple everyday words,
 *   zero heavy jargon, relatable real-world analogies, and tiny step-by-step beginner examples.
 * - Technical Mode ('technical'): Strict computer science & software engineering deep dive with precise technical definitions,
 *   under-the-hood memory/execution behavior, syntax rules, Big-O time & space complexity, edge cases, and production-ready code.
 */
export function buildSmartConceptFallback(
  topic: string,
  lesson: Lesson | undefined,
  question: string,
  category: string,
  style: ConceptMentorStyle | string = 'simple'
): ConceptTutorAnswer {
  const qLower = `${question} ${lesson?.title || ''}`.toLowerCase();
  const lessonTitle = lesson?.title || topic;
  const concepts = lesson?.keyConcepts?.length ? lesson.keyConcepts : ['Core Logic', 'Optimization'];
  const isTechnicalMode = normalizeStyle(style) === 'technical';

  // Pattern 0: Strings / Immutability / Memory Interning
  if (qLower.includes('string') || qLower.includes('immutab') || qLower.includes('intern')) {
    return {
      directAnswer: isTechnicalMode
        ? 'In Python and most modern managed runtimes, a `str` object is an immutable, contiguous sequence of Unicode code points allocated on the heap (PEP 393 flexible string representation). Any apparent mutation allocates a new heap object and rebinds the variable reference rather than modifying bytes in-place.'
        : 'Welcome to class! In Python, a String is simply a sequence of characters locked inside a sealed glass display case (immutable). Once you create `"hello"`, you can read every letter inside, but if you want to change a letter, Python builds a brand-new display case instead of opening the old one!',
      realWorldAnalogy: isTechnicalMode
        ? 'Architectural Mental Model: CPython caches small and identifier-like strings in an internal interned hash table (`interned` dict) so identical string literals share a single heap address (`O(1)` pointer equality check via `is`).'
        : 'Real-World Analogy: Imagine a printed book page vs. a whiteboard. A list is like a whiteboard where you can erase one letter and write another. A string is like a printed page—to fix a typo, you print a fresh page with the updated word!',
      technicalDeepDive: isTechnicalMode
        ? {
            exactDefinition:
              'CPython represents strings via `PyASCIIObject` / `PyCompactUnicodeObject`, dynamically selecting 1-byte (Latin-1), 2-byte (UCS-2), or 4-byte (UCS-4) fixed-width code point buffers based on the highest code point present.',
            memoryAndExecutionBehavior:
              'Because strings are immutable, their hash value is computed lazily once and cached in the struct header (`ob_shash`), enabling O(1) dictionary key lookups and safe sharing across threads without defensive copying.',
            syntaxAndEdgeCases:
              'Repeated concatenation in a loop (`s += char`) degrades to O(N²) time due to repeated heap allocations; always accumulate substrings in a list and invoke `"".join(parts)` for O(N) linear allocation.',
          }
        : undefined,
      interviewPerspective: isTechnicalMode
        ? {
            actualInterviewQuestion:
              'How are immutable strings stored in memory, and why does repeated `+=` concatenation in a loop cause quadratic memory overhead?',
            whatInterviewerExpects:
              '1) Explain heap allocation and immutability invariants. 2) Detail how `"".join(list)` pre-calculates total byte length and performs a single contiguous buffer copy in O(N) time.',
            followUpTrap:
              'Edge Case: String interning (`sys.intern`) only automatically interns compile-time identifier strings, not arbitrary runtime-concatenated strings.',
          }
        : undefined,
      stepByStepBreakdown: isTechnicalMode
        ? [
            'Allocation: Runtime inspects the maximum Unicode code point in the literal and allocates a compact header + contiguous byte array on the heap.',
            'Hashing & Indexing: Indexing `s[i]` performs O(1) pointer arithmetic (`base_addr + i * char_width`), while `hash(s)` caches the SipHash digest.',
            'Transformation: Calling `.replace()` or slicing allocates a new string buffer while leaving the original memory block untouched for existing references.',
          ]
        : [
            'Step 1: We create `name = "cat"`. Python stores the letters `c`, `a`, `t` in boxes 0, 1, and 2.',
            'Step 2: We read `name[0]` and immediately get `"c"`—looking at any position is completely allowed!',
            'Step 3: To change `"cat"` into `"bat"`, we write `new_name = "b" + name[1:]`, which creates a fresh string `"bat"`.',
          ],
      complexitySimple: {
        time: isTechnicalMode
          ? 'O(1) index access & cached hash lookup; O(N) substring slice or `.join()` concatenation.'
          : 'O(1) instant time to read any character by index; O(N) time to copy or join a string of length N.',
        space: isTechnicalMode
          ? 'O(N) contiguous heap memory (49–56 byte CPython object header + 1/2/4 bytes per character).'
          : 'O(N) memory — uses 1 slot per character in the string.',
      },
      commonMistake: isTechnicalMode
        ? 'Mutating strings inside a loop with `+=` without buffer pre-allocation, or relying on `is` (reference identity) instead of `==` (value equality) when comparing non-interned runtime strings.'
        : 'Trying to change a character directly like `word[0] = "B"`—Python will raise a `TypeError` because strings cannot be changed in-place!',
      detailedExplanation: isTechnicalMode
        ? 'String immutability guarantees hash stability for hash-table keys, eliminates race conditions in concurrent reads, and allows runtime string interning.'
        : 'Understanding that strings are immutable helps you write bug-free code and use `.join()` or slicing whenever you want to build new text.',
      codeExample: {
        language: 'Python',
        code: isTechnicalMode
          ? `import sys\n\ndef build_payload(chunks: list[str]) -> str:\n    # O(N) single-pass contiguous buffer allocation\n    assembled = "".join(chunks)\n    return sys.intern(assembled)`
          : `word = "python"\n# Read first letter (index 0)\nfirst_letter = word[0]\n# Create a new capitalized string\ncapitalized = "P" + word[1:]\nprint(capitalized)  # Prints: Python`,
        explanation: isTechnicalMode
          ? 'Production-grade O(N) string assembly using `"".join()` and explicit string table interning.'
          : 'Simple beginner example showing how to read a character and create a new updated string.',
        lineByLine: [
          {
            line: isTechnicalMode ? 'assembled = "".join(chunks)' : 'word = "python"',
            explanation: isTechnicalMode
              ? 'Computes total byte length across all chunks first, then performs a single heap allocation and memcpy.'
              : 'Stores the text "python" in a variable so we can work with it.',
          },
          {
            line: isTechnicalMode ? 'return sys.intern(assembled)' : 'capitalized = "P" + word[1:]',
            explanation: isTechnicalMode
              ? 'Registers the string in the global interned pool so repeated lookups compare pointers in O(1).'
              : 'Combines "P" with the rest of the word ("ython") to build a brand-new string.',
          },
        ],
      },
      quickCheckQuestion: {
        question: isTechnicalMode
          ? 'Why can Python `str` objects be used as `dict` keys while `list` objects cannot?'
          : 'What happens if you try to run `name = "Sam"` followed by `name[0] = "P"` in Python?',
        options: isTechnicalMode
          ? [
              'Strings are immutable so their hash value remains invariant across their lifetime, preserving hash-table bucket invariants',
              'Lists are stored on the stack instead of the heap',
              'Strings are limited to 256 bytes',
              'Dictionaries sort keys alphabetically',
            ]
          : [
              'Python shows a TypeError because strings are immutable (cannot be changed in-place)',
              'It changes the string to "Pam" in-place',
              'It deletes the variable',
              'It prints an empty string',
            ],
        correctIndex: 0,
        explanation: isTechnicalMode
          ? 'Hash tables require key hashes to remain constant; mutating a key in-place would orphan its entry in the wrong hash bucket.'
          : 'Spot on! Because strings are immutable, you create a new string like `"P" + name[1:]` instead of changing `name[0]` directly.',
      },
    };
  }

  // Pattern 1: Hashing / Frequency Map / Two Sum / Unordered Map
  if (
    qLower.includes('hash') ||
    qLower.includes('map') ||
    qLower.includes('frequency') ||
    qLower.includes('collision') ||
    qLower.includes('two sum')
  ) {
    return {
      directAnswer: isTechnicalMode
        ? 'A Hash Table (`std::unordered_map` / `Map`) is an associative array backed by a contiguous bucket array where a deterministic hash function `h(k)` maps each key to a bucket index `h(k) % B`, achieving O(1) amortized lookup, insertion, and deletion.'
        : 'Welcome to class! A Hash Map is simply a smart notebook that stores information as "Label → Value" pairs so you can find any item in 1 single step instead of checking a whole list one by one.',
      realWorldAnalogy: isTechnicalMode
        ? 'Architectural Mental Model: Keys are digested via SipHash/MurmurHash into a 64-bit integer, masked to the bucket table capacity, and resolved via separate chaining or open addressing (linear/quadratic probing).'
        : 'Real-World Example: Imagine a gym with 500 lockers. If locks had no numbers (like a plain Array), you would have to open Locker 1, Locker 2, Locker 3... until you found your bag. A Hash Map gives you a numbered key (#42) so you walk straight to Locker #42 and open it in 1 second!',
      technicalDeepDive: isTechnicalMode
        ? {
            exactDefinition:
              'A hash table maintains `N` key-value entries across `B` buckets with load factor `α = N / B`. When `α` exceeds `max_load_factor` (typically 0.75 or 1.0), the table allocates a larger prime/power-of-two bucket array and rehashes all keys in O(N) time.',
            memoryAndExecutionBehavior:
              '`std::unordered_map` allocates linked nodes on the heap per bucket (pointer chasing across cache lines), whereas open-addressed flat hash tables store entries inline in a contiguous buffer for superior CPU L1/L2 cache locality.',
            syntaxAndEdgeCases:
              'In C++, `map[key]` default-constructs and inserts a zeroed entry if `key` is absent (mutating table state and potentially triggering a rehash). Use `.find(key)` or `.count(key)` for read-only membership checks.',
          }
        : undefined,
      interviewPerspective: isTechnicalMode
        ? {
            actualInterviewQuestion:
              'How does a hash table resolve bucket collisions, and when does lookup degrade from O(1) average to O(N) worst-case?',
            whatInterviewerExpects:
              '1) Contrast separate chaining vs open addressing (Robin Hood / linear probing). 2) Explain load factor thresholds, rehashing amortization, and adversarial hash collision behavior.',
            followUpTrap:
              'Edge Case: If all keys collide into the same bucket, lookup degrades from O(1) to O(N) linear chain traversal.',
          }
        : undefined,
      stepByStepBreakdown: isTechnicalMode
        ? [
            'Hash Computation & Masking: Compute `size_t idx = hash_fn(key) & (bucket_count - 1)` in O(1) time.',
            'Complement Lookup: Probe bucket `idx` for `target - nums[i]` using key equality comparator before mutating the table.',
            'Single-Pass Insertion: Insert `{nums[i], i}` into the bucket; if load factor exceeds threshold, trigger geometric table growth.',
          ]
        : [
            'First, we create an empty Hash Map (our numbered locker room) before looking at the array.',
            'Next, we walk through the array once: for each number x, we either add 1 to its count in the map, or check if the partner number we need (target - x) is already waiting in a locker.',
            'Because checking a locker takes 1 instant step, we finish the whole job in a single walk through the list!',
          ],
      complexitySimple: {
        time: isTechnicalMode
          ? 'O(N) amortized time (O(1) average per lookup/insert; O(N) worst-case under adversarial hash collisions).'
          : 'O(N) — We walk through the N items only once, and each locker check takes O(1) instant time.',
        space: isTechnicalMode
          ? 'O(N) auxiliary heap memory for bucket array + key-value nodes (`α = N / B`).'
          : 'O(N) — In the worst case, we use N lockers in memory to store N unique items.',
      },
      commonMistake: isTechnicalMode
        ? 'Using `std::map` (Red-Black Tree with O(log N) comparisons and high pointer overhead) instead of `std::unordered_map` (O(1) amortized hash table), or failing to call `.reserve(N)` to prevent mid-loop rehashing.'
        : 'Beginners often use `std::map` instead of `std::unordered_map` in C++—`std::map` sorts keys alphabetically behind the scenes, which slows every lookup from O(1) to O(log N).',
      detailedExplanation: isTechnicalMode
        ? 'Pre-allocating bucket capacity via `.reserve(n)` eliminates rehash overhead and guarantees deterministic O(1) amortized lookups across single-pass algorithms.'
        : 'By spending a small amount of memory to remember what we have already seen, a Hash Map eliminates slow nested loops (O(N²)) and solves lookup problems in fast O(N) time.',
      codeExample: {
        language: category === 'DSA' ? 'C++' : 'JavaScript',
        code:
          category === 'DSA'
            ? `unordered_map<int, int> seen;\nseen.reserve(nums.size()); // Pre-allocate buckets\nfor (int i = 0; i < (int)nums.size(); i++) {\n  int need = target - nums[i];\n  if (auto it = seen.find(need); it != seen.end()) {\n    return {it->second, i};\n  }\n  seen[nums[i]] = i;\n}`
            : `const seen = new Map();\nfor (let i = 0; i < nums.length; i++) {\n  const need = target - nums[i];\n  if (seen.has(need)) {\n    return [seen.get(need), i];\n  }\n  seen.set(nums[i], i);\n}`,
        explanation: isTechnicalMode
          ? 'Single-pass O(N) hash lookup with bucket pre-allocation and non-mutating `.find()` iterator resolution.'
          : 'Finds two numbers that sum to target in a single O(N) pass using a Hash Map.',
        lineByLine: [
          {
            line: category === 'DSA' ? 'unordered_map<int, int> seen;' : 'const seen = new Map();',
            explanation: isTechnicalMode
              ? 'Initializes an O(1) amortized hash table mapping element values to their array indices.'
              : 'Creates an empty Hash Map where Key = number we saw, and Value = its index position.',
          },
          {
            line: category === 'DSA' ? 'for (int i = 0; i < (int)nums.size(); i++)' : 'for (let i = 0; i < nums.length; i++)',
            explanation: isTechnicalMode
              ? 'Iterates sequentially over the contiguous buffer for optimal hardware prefetcher throughput.'
              : 'Loops through each number in the array one time from left to right.',
          },
          {
            line: category === 'DSA' ? 'int need = target - nums[i];' : 'const need = target - nums[i];',
            explanation: isTechnicalMode
              ? 'Computes the complement required to satisfy the linear invariant `nums[j] + nums[i] == target`.'
              : 'Calculates the exact partner number needed to reach the target sum.',
          },
          {
            line: category === 'DSA' ? 'if (auto it = seen.find(need); it != seen.end())' : 'if (seen.has(need)) return [seen.get(need), i];',
            explanation: isTechnicalMode
              ? 'Probes the hash bucket in O(1) without inserting a default key on cache miss.'
              : 'Checks in O(1) time if that partner number is already in our map; if yes, returns both indices immediately!',
          },
          {
            line: category === 'DSA' ? 'seen[nums[i]] = i;' : 'seen.set(nums[i], i);',
            explanation: isTechnicalMode
              ? 'Inserts the current value-index pair after the lookup check to prevent self-pairing on `target == 2 * nums[i]`.'
              : 'Otherwise, saves the current number and its index in the map for future numbers to find.',
          },
        ],
      },
      quickCheckQuestion: {
        question: 'Why do we check for the complement `need` BEFORE inserting `seen[nums[i]] = i`?',
        options: [
          'So we do not accidentally match an element with itself at the same index when `target == 2 * nums[i]`',
          'Because C++ crashes if you insert first',
          'To sort the map in ascending order',
          'To save memory',
        ],
        correctIndex: 0,
        explanation:
          'Exactly right! Checking before inserting guarantees the two indices `i` and `j` are strictly distinct (`j < i`).',
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
      directAnswer: isTechnicalMode
        ? 'Single-pass pointer and dynamic-programming subarray algorithms maintain an inductive loop invariant over contiguous memory, reducing O(N²) nested range scans to O(N) time and O(1) auxiliary register space.'
        : 'Think of this like a Professor’s favorite shortcut: instead of starting over and re-counting subarrays from scratch, we use moving bookmarks (pointers) or a running score so we only walk through the list once.',
      realWorldAnalogy: isTechnicalMode
        ? 'Architectural Mental Model: Sequential array traversal exploits CPU cache-line prefetching (64-byte cache lines) while keeping state variables (`curSum`, `maxSum`) inside CPU registers.'
        : 'Real-World Example: Imagine tracking your happiness score during a road trip. As long as the trip overall is positive, you keep going. The moment a terrible traffic jam makes your total running mood drop below zero, you mentally "start a fresh trip" from the next town instead of carrying yesterday’s bad mood forward!',
      technicalDeepDive: isTechnicalMode
        ? {
            exactDefinition:
              'Kadane’s recurrence defines `dp[i] = max(nums[i], dp[i-1] + nums[i])`, representing the maximum subarray sum ending at index `i`. Because `dp[i]` depends only on `dp[i-1]`, state space compresses from O(N) to O(1).',
            memoryAndExecutionBehavior:
              'All operations execute in-place with zero heap allocations. Sequential index reads maximize spatial locality across L1 data cache lines.',
            syntaxAndEdgeCases:
              'Initialize `maxSum = nums[0]` (or `INT_MIN`) prior to clamping negative prefixes to 0 so all-negative inputs (`[-8, -2, -5]`) return the maximum single element (`-2`) rather than `0`. Use `long long` if element sums can overflow 32-bit signed integers.',
          }
        : undefined,
      interviewPerspective: isTechnicalMode
        ? {
            actualInterviewQuestion:
              'Derive the loop invariant for Kadane’s Algorithm and prove why resetting a negative prefix sum preserves optimality.',
            whatInterviewerExpects:
              '1) Formulate `dp[i] = max(nums[i], dp[i-1] + nums[i])`. 2) Prove that any prefix with `sum < 0` strictly decreases the sum of any subsequent subarray `nums[i..j]`.',
            followUpTrap:
              'Edge Case: Handling all-negative arrays and 32-bit signed integer overflow (`INT_MAX`).',
          }
        : undefined,
      stepByStepBreakdown: isTechnicalMode
        ? [
            'Base Invariant Initialization: Bind `curSum = 0` and `maxSum = nums[0]` in scalar registers.',
            'Inductive Transition: Accumulate `curSum += nums[i]` and update the global extremum `maxSum = max(maxSum, curSum)`.',
            'Prefix Pruning: If `curSum < 0`, reset `curSum = 0` since a negative prefix cannot contribute positively to any future suffix.',
          ]
        : [
            'Start with `currentSum = 0` and `maxSum = nums[0]` (the first element, in case all numbers are negative).',
            'Add the current number to `currentSum` and update `maxSum` if `currentSum` beat our best record.',
            'If `currentSum` drops below 0, reset `currentSum = 0` because a negative total would only drag down the next numbers.',
          ],
      complexitySimple: {
        time: isTechnicalMode
          ? 'O(N) — Single linear pass performing constant-time arithmetic per element.'
          : 'O(N) — We look at each number in the array only once.',
        space: isTechnicalMode
          ? 'O(1) — Zero heap allocation; uses only two scalar accumulators.'
          : 'O(1) — We only use 2 simple integer variables (`currentSum` and `maxSum`).',
      },
      commonMistake: isTechnicalMode
        ? 'Initializing `maxSum = 0` instead of `nums[0]`, which violates the non-empty subarray constraint on strictly negative inputs.'
        : 'Initializing `maxSum = 0` instead of `maxSum = nums[0]`—if the array is `[-5, -2, -8]`, initializing to 0 gives the wrong answer `0` instead of `-2`!',
      detailedExplanation: isTechnicalMode
        ? 'Maintaining strict loop invariants across contiguous memory buffers yields optimal O(N) time and O(1) space complexity.'
        : 'Single-pass pointer and running-sum algorithms eliminate redundant work by maintaining a clean rule (invariant) at every step.',
      codeExample: {
        language: 'C++',
        code: `long long curSum = 0;\nlong long maxSum = nums[0];\nfor (int x : nums) {\n  curSum += x;\n  maxSum = max(maxSum, curSum);\n  if (curSum < 0) curSum = 0;\n}\nreturn maxSum;`,
        explanation: 'Kadane’s Algorithm finds the maximum contiguous subarray sum in O(N) time and O(1) space.',
        lineByLine: [
          {
            line: 'long long curSum = 0; long long maxSum = nums[0];',
            explanation: isTechnicalMode
              ? 'Uses 64-bit accumulators to prevent 32-bit signed integer overflow and seeds `maxSum` with `nums[0]`.'
              : 'Starts running sum at 0, and sets best record to the first element (crucial if all numbers are negative).',
          },
          {
            line: 'for (int x : nums) { curSum += x;',
            explanation: isTechnicalMode
              ? 'Extends the active subarray invariant to include element `x`.'
              : 'Steps through each number one by one and adds it to our current running streak.',
          },
          {
            line: 'maxSum = max(maxSum, curSum);',
            explanation: isTechnicalMode
              ? 'Updates the global maximum before prefix reset so all-negative inputs are handled accurately.'
              : 'If our current running sum beats the highest sum ever seen, updates the record.',
          },
          {
            line: 'if (curSum < 0) curSum = 0;',
            explanation: isTechnicalMode
              ? 'Prunes negative prefix sums to maintain the optimal substructure invariant.'
              : 'If the running sum becomes negative, drops it and resets to 0 so it doesn’t shrink future numbers.',
          },
        ],
      },
      quickCheckQuestion: {
        question: 'What happens if you initialize `maxSum = 0` and the input array is `[-10, -3, -5]`?',
        options: [
          'Your code returns 0, which is wrong because the largest non-empty subarray is [-3] with sum -3',
          'Your code still returns -3',
          'The loop never runs',
          'It causes a compiler error',
        ],
        correctIndex: 0,
        explanation:
          'Initializing `maxSum = nums[0]` ensures your algorithm works accurately on all-negative arrays!',
      },
    };
  }

  // Pattern 3: Recursion / Backtracking / Stack / Trees
  if (qLower.includes('recurs') || qLower.includes('stack') || qLower.includes('base case') || qLower.includes('tree')) {
    return {
      directAnswer: isTechnicalMode
        ? 'Recursion decomposes a problem into self-similar subproblems by pushing activation frames (return address, local variables, and parameters) onto the thread Call Stack until a terminating Base Case unwinds the stack.'
        : 'As your Professor, let me take the mystery out of Recursion: a recursive function is just a function that solves one tiny step itself and asks a clone of itself to solve the remaining smaller piece, stopping at a clear Base Case.',
      realWorldAnalogy: isTechnicalMode
        ? 'Architectural Mental Model: Each recursive invocation allocates a stack frame via stack-pointer (`RSP`) decrement; reaching the base case pops frames in LIFO order back to the caller.'
        : 'Real-World Example: Imagine you are sitting in a dark movie theater and want to know what row number you are in. You tap the person in front of you and ask their row. They ask the person in front of them, until the person in Row 1 says "I am Row 1!" (the Base Case). Then each person simply adds +1 to the answer passed back!',
      technicalDeepDive: isTechnicalMode
        ? {
            exactDefinition:
              'A recursive relation `T(n) = a T(n/b) + f(n)` builds an implicit Depth-First Search (DFS) activation tree whose maximum simultaneously active depth bounds auxiliary memory.',
            memoryAndExecutionBehavior:
              'Even when no heap allocations occur, each active call consumes stack frame bytes (return instruction pointer + saved registers + local variables). Unbounded depth (`N > 10^5`) overflows the fixed OS thread stack (typically 1–8 MB).',
            syntaxAndEdgeCases:
              'Always place the terminating base case guard before any recursive dispatch, and ensure state parameters strictly converge toward the base case on every branch.',
          }
        : undefined,
      interviewPerspective: isTechnicalMode
        ? {
            actualInterviewQuestion:
              'Why is the auxiliary space complexity of naive recursive `fib(n)` O(N) even though its time complexity is O(2^N)?',
            whatInterviewerExpects:
              '1) Explain that the Call Stack executes depth-first, reusing stack frames across sibling branches. 2) Maximum concurrent stack depth is `N`, so space is O(N).',
            followUpTrap:
              'Edge Case: Mitigating stack overflow on deep recursion via explicit heap-allocated stack or tail-call optimization.',
          }
        : undefined,
      stepByStepBreakdown: isTechnicalMode
        ? [
            'Base Case Guard: Evaluate the terminal boundary condition (`n <= 0` or `node == nullptr`) and return immediately without allocating further stack frames.',
            'Recursive Descent: Push a new activation frame with strictly reduced state (`n - 1`) onto the call stack.',
            'Stack Unwinding: Combine the child frame’s return value with the current frame’s local state and pop the frame.',
          ]
        : [
            'Write the Base Case first: check if the problem is so small (like `n == 0` or `node == nullptr`) that you already know the answer, and `return`.',
            'Call the function on a smaller input (like `n - 1`) and trust that it returns the answer for the rest.',
            'Combine your current step’s work with that returned answer and pass it back up.',
          ],
      complexitySimple: {
        time: isTechnicalMode
          ? 'O(N) for linear recursion; O(b^d) for branching recursion of factor `b` and depth `d` without memoization.'
          : 'O(N) — We make 1 function call for each step down to the Base Case.',
        space: isTechnicalMode
          ? 'O(d) auxiliary Call Stack memory proportional to maximum recursion tree depth `d`.'
          : 'O(N) — Each waiting function call sits on the computer’s Call Stack until the Base Case returns.',
      },
      commonMistake: isTechnicalMode
        ? 'Omitting base-case convergence or passing large structs by value instead of `const&` across recursive frames, multiplying stack frame footprint.'
        : 'Writing the recursive call without making the input strictly smaller toward the Base Case, which creates an infinite chain and crashes with a Stack Overflow.',
      detailedExplanation: isTechnicalMode
        ? 'Analyzing recursion via its activation tree clarifies both asymptotic branching time and peak LIFO call-stack memory.'
        : 'Never try to trace 50 recursive calls in your head—just verify the Base Case works for the smallest input, and verify that step `N` correctly combines with step `N - 1`.',
      codeExample: {
        language: category === 'DSA' ? 'C++' : 'JavaScript',
        code: `int sumUpTo(int n) {\n  if (n <= 0) {\n    return 0;\n  }\n  int smallerResult = sumUpTo(n - 1);\n  return n + smallerResult;\n}`,
        explanation: 'Computes 1 + 2 + ... + n recursively with an explicit base case and stack unwinding step.',
        lineByLine: [
          {
            line: 'int sumUpTo(int n) {',
            explanation: isTechnicalMode
              ? 'Entry point allocating a stack frame for parameter `n`.'
              : 'Defines our function that wants to find the sum from 1 up to n.',
          },
          {
            line: 'if (n <= 0) return 0;',
            explanation: isTechnicalMode
              ? 'Terminating base case that halts recursive frame allocation and begins stack unwinding.'
              : 'THE BASE CASE: The stop sign! When n reaches 0, we stop calling ourselves and return 0.',
          },
          {
            line: 'int smallerResult = sumUpTo(n - 1);',
            explanation: isTechnicalMode
              ? 'Pushes a child activation frame with strictly smaller state `n - 1`.'
              : 'THE RECURSIVE STEP: Pauses current function and asks for the sum of (n - 1).',
          },
          {
            line: 'return n + smallerResult;',
            explanation: isTechnicalMode
              ? 'Accumulates `n` with the unwound child result and pops the current stack frame.'
              : 'Adds our current number n to the answer returned from (n - 1) and sends it back up.',
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
          'Even though time is O(2^N), the Call Stack only holds one root-to-leaf path at a time, so space is O(N).',
      },
    };
  }

  // Default Professor Mode vs Technical Mode response for any lesson or topic
  return {
    directAnswer: isTechnicalMode
      ? `From a software engineering perspective, "${lessonTitle}" centers on structuring state and data flow around ${concepts.join(' and ')} to enforce deterministic invariants, predictable memory layout, and optimal asymptotic execution.`
      : `Let’s break "${question}" in ${lessonTitle} down like we are in a beginner lecture: the goal is to organize our data cleanly around ${concepts.join(' and ')} so the computer never repeats work it already did.`,
    realWorldAnalogy: isTechnicalMode
      ? `Architectural Mental Model: ${lessonTitle} operates like an indexed pipeline where state transitions are bounded to O(1) or O(log N) amortized operations without redundant full-buffer scans.`
      : `Real-World Example: Imagine ${lessonTitle} is like organizing a busy coffee shop counter. Instead of running to the back storage room every time a customer orders a cup, you keep the essentials right on the counter in labeled jars so every order is served in seconds.`,
    technicalDeepDive: isTechnicalMode
      ? {
          exactDefinition: `${lessonTitle} formalizes the invariant relationship between ${concepts.join(', ')} so state transitions execute deterministically without redundant recomputation.`,
          memoryAndExecutionBehavior:
            'Prioritizes contiguous buffer access and bounded auxiliary state to minimize heap fragmentation, pointer chasing, and CPU cache misses.',
          syntaxAndEdgeCases:
            'Always validate boundary inputs (empty collections, single-element inputs, duplicate keys, and numeric overflow limits) before executing the core loop.',
        }
      : undefined,
    interviewPerspective: isTechnicalMode
      ? {
          actualInterviewQuestion: `How does ${lessonTitle} (${concepts[0] || 'this pattern'}) behave under scale when input size N grows to 1,000,000, and what are its memory trade-offs?`,
          whatInterviewerExpects:
            '1) Define exact invariants and boundary constraints. 2) Contrast naive O(N²) execution with the optimal single-pass or indexed architecture. 3) Specify both Time and Auxiliary Space complexity.',
          followUpTrap:
            'Edge Case: Can auxiliary space be reduced from O(N) to O(1) if the input buffer can be mutated in-place?',
        }
      : undefined,
    stepByStepBreakdown: isTechnicalMode
      ? [
          `Step 1 (Invariant & Boundary Specification): Guard empty/null inputs and establish initial state variables for ${concepts[0] || lessonTitle}.`,
          `Step 2 (Core Execution Loop): Process elements in a deterministic pass while maintaining the ${concepts[0] || lessonTitle} invariant.`,
          `Step 3 (Complexity & Edge-Case Verification): Verify behavior on degenerate inputs (size 0, size 1, duplicates, and boundary values).`,
        ]
      : [
          `Step 1 (Small Whiteboard Trace): Pick a tiny 3-item example and write down the starting input and the exact output you want.`,
          `Step 2 (Core Rule of ${concepts[0] || lessonTitle}): Process one item at a time, updating your state variables in a single clean pass.`,
          `Step 3 (Boundary Check): Test what happens when the input is empty, has 1 item, or has duplicate values.`,
        ],
    complexitySimple: {
      time: isTechnicalMode
        ? 'O(N) — Linear single-pass execution with O(1) amortized work per element.'
        : 'O(N) — We process each item a constant number of times without slow nested loops.',
      space: isTechnicalMode
        ? 'O(1) to O(N) — Bounded auxiliary memory proportional to active state requirements.'
        : 'O(1) to O(N) — We store only the minimum variables or lookup table needed.',
    },
    commonMistake: isTechnicalMode
      ? 'Failing to guard degenerate boundary conditions (empty input, null references, or integer overflow) prior to executing the main loop.'
      : 'Jumping straight into typing code before dry-running a 3-element example by hand and checking empty/edge inputs.',
    detailedExplanation: isTechnicalMode
      ? `Mastering ${lessonTitle} requires pairing formal algorithmic invariants with cache-friendly data structures and explicit boundary guards.`
      : `Mastering ${lessonTitle} comes down to understanding the real-world intuition first, then translating each step into clean, predictable code.`,
    codeExample: {
      language: category === 'DSA' ? 'C++' : 'JavaScript',
      code:
        category === 'DSA'
          ? `int solvePattern(const vector<int>& nums) {\n  if (nums.empty()) return 0; // Boundary guard\n  int accumulator = 0;\n  for (size_t i = 0; i < nums.size(); ++i) {\n    accumulator += nums[i];\n  }\n  return accumulator;\n}`
          : `function solvePattern(items) {\n  if (!Array.isArray(items) || items.length === 0) return [];\n  const result = [];\n  for (let i = 0; i < items.length; i++) {\n    result.push(items[i]);\n  }\n  return result;\n}`,
      explanation: isTechnicalMode
        ? `Production-ready implementation for ${lessonTitle} with const-reference parameter passing, boundary guard, and O(N) traversal.`
        : `Clean, beginner-friendly template for ${lessonTitle} with an empty-input check and a simple loop.`,
      lineByLine: [
        {
          line:
            category === 'DSA'
              ? 'if (nums.empty()) return 0; // Boundary guard'
              : 'if (!Array.isArray(items) || items.length === 0) return [];',
          explanation: isTechnicalMode
            ? 'Enforces precondition safety on empty containers in O(1) time before dereferencing.'
            : 'Guards against empty input right at the top so the code never crashes on edge cases.',
        },
        {
          line: category === 'DSA' ? 'int accumulator = 0;' : 'const result = [];',
          explanation: isTechnicalMode
            ? 'Allocates the state accumulator prior to entering the iteration scope.'
            : 'Initializes our accumulator variable before starting the main loop.',
        },
        {
          line:
            category === 'DSA'
              ? 'for (size_t i = 0; i < nums.size(); ++i)'
              : 'for (let i = 0; i < items.length; i++)',
          explanation: isTechnicalMode
            ? 'Traverses the contiguous buffer sequentially in O(N) time with optimal cache locality.'
            : 'Walks through each element exactly once from start to finish in O(N) time.',
        },
        {
          line: category === 'DSA' ? 'return accumulator;' : 'return result;',
          explanation: isTechnicalMode
            ? 'Returns the computed invariant result to the caller.'
            : 'Returns the final computed answer after all elements have been processed.',
        },
      ],
    },
    quickCheckQuestion: {
      question: `When implementing ${lessonTitle}, what should you always verify BEFORE running your main loop?`,
      options: [
        'Boundary constraints and edge cases such as empty or single-element inputs',
        'Write a triple nested loop without checking input size',
        'Skip time and space complexity analysis',
        'Assume the input always has exactly 10 elements',
      ],
      correctIndex: 0,
      explanation:
        'Validating input preconditions and boundary cases first prevents runtime bugs and guarantees predictable behavior!',
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
    style: ConceptMentorStyle | string = 'simple'
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
    style: ConceptMentorStyle | string = 'simple'
  ) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(TUTOR_CACHE_STORAGE_KEY);
      const cache: Record<string, CachedTutorEntry> = raw ? JSON.parse(raw) : {};

      const normStyle = normalizeStyle(style);
      const key = normalizeKey(trackerTitle, lessonTitle, question, normStyle);
      cache[key] = {
        key,
        question: question.trim(),
        style: normStyle,
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

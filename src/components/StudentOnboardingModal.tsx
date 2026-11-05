import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserPlus,
  Globe,
  GraduationCap,
  Target,
  Clock,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Upload,
} from 'lucide-react';
import { LearnerProfile, SkillProficiency } from '../types';
import {
  DEFAULT_AVATAR_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  LEARNING_INTEREST_OPTIONS,
  LEARNING_FORMAT_OPTIONS,
  LEARNER_ROLE_OPTIONS,
  registerNewStudentProfile,
  calculateProfileCompletionReport,
  isLearnerProfileCreated,
  generateInitialsAvatarDataUrl,
  sanitizeProfileAvatarUrl,
} from '../utils/studyWorkspaceLogic';

interface StudentOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: LearnerProfile;
  initialMode?: 'register' | 'onboarding';
  onCompleteOnboarding: (
    updatedProfile: LearnerProfile,
    isNewAccountRegistration: boolean
  ) => void;
}

export const StudentOnboardingModal: React.FC<StudentOnboardingModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  initialMode = 'onboarding',
  onCompleteOnboarding,
}) => {
  const onboardingFileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'register' | 'onboarding'>(initialMode);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isNewRegistration, setIsNewRegistration] = useState<boolean>(
    initialMode === 'register'
  );

  // Registration step state (when signing up as a brand-new student)
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regRole, setRegRole] = useState<string>('University Student');
  const [regError, setRegError] = useState<string | null>(null);

  // Multi-step onboarding state
  const [userId, setUserId] = useState<string>(currentProfile.userId || 'default-learner');
  const [email, setEmail] = useState<string>(
    currentProfile.email || 'alex.rivera@devtrack.edu'
  );
  const [name, setName] = useState<string>(currentProfile.name || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(
    currentProfile.avatarUrl || DEFAULT_AVATAR_OPTIONS[0].url
  );
  const [customAvatarLink, setCustomAvatarLink] = useState<string>(() => {
    const initial = currentProfile.avatarUrl || '';
    return initial.startsWith('http://') || initial.startsWith('https://') ? initial : '';
  });
  const [country, setCountry] = useState<string>(currentProfile.country || 'India');
  const [preferredLanguage, setPreferredLanguage] = useState<string>(
    currentProfile.preferredLanguage || 'English'
  );
  const [role, setRole] = useState<string>(currentProfile.role || 'University Student');

  // Step 2: Education
  const [educationLevel, setEducationLevel] = useState<string>(
    currentProfile.educationLevel || 'Undergraduate Degree'
  );
  const [currentDegree, setCurrentDegree] = useState<string>(
    currentProfile.currentDegree || 'B.Tech in Computer Science'
  );
  const [collegeOrUniversity, setCollegeOrUniversity] = useState<string>(
    currentProfile.collegeOrUniversity || ''
  );
  const [academicYearOrSemester, setAcademicYearOrSemester] = useState<string>(
    currentProfile.academicYearOrSemester || ''
  );

  // Step 3: Career Aspiration, Learning Interests & Skill Levels
  const [careerAspiration, setCareerAspiration] = useState<string>(
    currentProfile.careerAspiration || currentProfile.careerObjective || ''
  );
  const [learningInterests, setLearningInterests] = useState<string[]>(
    currentProfile.learningInterests && currentProfile.learningInterests.length > 0
      ? currentProfile.learningInterests
      : ['DSA', 'Web Development']
  );
  const [skillLevels, setSkillLevels] = useState<Record<string, SkillProficiency>>(
    currentProfile.skillLevels || {
      DSA: 'Beginner',
      'Web Development': 'Beginner',
    }
  );

  // Step 4: Learning Formats, Study Availability & Personal Goals
  const [preferredLearningFormats, setPreferredLearningFormats] = useState<string[]>(
    currentProfile.preferredLearningFormats &&
      currentProfile.preferredLearningFormats.length > 0
      ? currentProfile.preferredLearningFormats
      : ['Video Lectures', 'Timestamped Notes', 'Hands-On Coding']
  );
  const [dailyMinutesTarget, setDailyMinutesTarget] = useState<number>(
    currentProfile.dailyMinutesTarget || 60
  );
  const [preferredTime, setPreferredTime] = useState<string>(
    currentProfile.preferredTime || '20:00'
  );
  const [studyDays, setStudyDays] = useState<number[]>(
    currentProfile.studyDays && currentProfile.studyDays.length > 0
      ? currentProfile.studyDays
      : [1, 2, 3, 4, 5, 6]
  );
  const [personalGoalInput, setPersonalGoalInput] = useState<string>('');
  const [personalLearningGoals, setPersonalLearningGoals] = useState<string[]>(
    Array.isArray(currentProfile.personalLearningGoals) &&
      currentProfile.personalLearningGoals.length > 0
      ? currentProfile.personalLearningGoals
      : typeof currentProfile.personalLearningGoals === 'string' &&
        currentProfile.personalLearningGoals.trim()
      ? [currentProfile.personalLearningGoals.trim()]
      : ['Complete 1 structured lecture every study day']
  );

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setIsNewRegistration(initialMode === 'register');
      setStep(1);
      setRegError(null);
      if (initialMode === 'onboarding') {
        setUserId(currentProfile.userId || 'default-learner');
        setEmail(currentProfile.email || 'alex.rivera@devtrack.edu');
        setName(currentProfile.name || '');
        setAvatarUrl(currentProfile.avatarUrl || DEFAULT_AVATAR_OPTIONS[0].url);
        setCountry(currentProfile.country || 'India');
        setPreferredLanguage(currentProfile.preferredLanguage || 'English');
        setRole(currentProfile.role || 'University Student');
        setEducationLevel(currentProfile.educationLevel || 'Undergraduate Degree');
        setCurrentDegree(currentProfile.currentDegree || '');
        setCollegeOrUniversity(currentProfile.collegeOrUniversity || '');
        setAcademicYearOrSemester(currentProfile.academicYearOrSemester || '');
        setCareerAspiration(
          currentProfile.careerAspiration || currentProfile.careerObjective || ''
        );
        setLearningInterests(
          currentProfile.learningInterests?.length
            ? currentProfile.learningInterests
            : ['DSA', 'Web Development']
        );
        setSkillLevels(
          currentProfile.skillLevels || {
            DSA: 'Beginner',
            'Web Development': 'Beginner',
          }
        );
        setPreferredLearningFormats(
          currentProfile.preferredLearningFormats?.length
            ? currentProfile.preferredLearningFormats
            : ['Video Lectures', 'Timestamped Notes']
        );
        setDailyMinutesTarget(currentProfile.dailyMinutesTarget || 60);
        setPreferredTime(currentProfile.preferredTime || '20:00');
        setStudyDays(currentProfile.studyDays || [1, 2, 3, 4, 5, 6]);
        setPersonalLearningGoals(
          Array.isArray(currentProfile.personalLearningGoals) &&
            currentProfile.personalLearningGoals.length > 0
            ? currentProfile.personalLearningGoals
            : typeof currentProfile.personalLearningGoals === 'string' &&
              currentProfile.personalLearningGoals.trim()
            ? [currentProfile.personalLearningGoals.trim()]
            : ['Complete 1 structured lecture every study day']
        );
      }
    }
  }, [isOpen, initialMode, currentProfile]);

  if (!isOpen) return null;

  const handleStartNewRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = regName.trim();
    const trimmedEmail = regEmail.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setRegError('Please enter your full name and email address to sign up.');
      return;
    }

    const freshProfile = registerNewStudentProfile({
      name: trimmedName,
      email: trimmedEmail,
      role: regRole,
    });

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          role: regRole,
          userId: freshProfile.userId,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.userId) {
          freshProfile.userId = json.userId;
        }
      }
    } catch {
      // Fallback to client registration if offline
    }

    setUserId(freshProfile.userId || `student_${Date.now()}`);
    setEmail(freshProfile.email || trimmedEmail);
    setName(freshProfile.name);
    setRole(freshProfile.role);
    setCountry('');
    setPreferredLanguage('English');
    setEducationLevel('Undergraduate Degree');
    setCurrentDegree('');
    setCollegeOrUniversity('');
    setAcademicYearOrSemester('');
    setCareerAspiration('');
    setLearningInterests(['DSA', 'Web Development']);
    setSkillLevels({ DSA: 'Beginner', 'Web Development': 'Beginner' });
    setPreferredLearningFormats(['Video Lectures', 'Timestamped Notes']);
    setPersonalLearningGoals([]);
    setIsNewRegistration(true);
    setMode('onboarding');
    setStep(1);
  };

  const toggleInterest = (interest: string) => {
    setLearningInterests(prev => {
      const exists = prev.includes(interest);
      const next = exists ? prev.filter(i => i !== interest) : [...prev, interest];
      setSkillLevels(currSkills => {
        const copy = { ...currSkills };
        if (!exists && !copy[interest]) {
          copy[interest] = 'Beginner';
        }
        return copy;
      });
      return next;
    });
  };

  const setSkillForInterest = (interest: string, level: SkillProficiency) => {
    setSkillLevels(prev => ({
      ...prev,
      [interest]: level,
    }));
  };

  const toggleFormat = (fmt: string) => {
    setPreferredLearningFormats(prev =>
      prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
    );
  };

  const toggleStudyDay = (dayIdx: number) => {
    setStudyDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const handleAddGoal = () => {
    const trimmed = personalGoalInput.trim();
    if (!trimmed) return;
    if (!personalLearningGoals.includes(trimmed)) {
      setPersonalLearningGoals(prev => [...prev, trimmed]);
    }
    setPersonalGoalInput('');
  };

  const handleRemoveGoal = (goal: string) => {
    setPersonalLearningGoals(prev => prev.filter(g => g !== goal));
  };

  const handleOnboardingPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;
      setAvatarUrl(rawDataUrl);
      setCustomAvatarLink('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const buildDraftProfile = (markCompleted: boolean): LearnerProfile => {
    const weeklyHoursGoal = Math.max(
      1,
      Math.round(((dailyMinutesTarget * Math.max(1, studyDays.length)) / 60) * 10) / 10
    );
    const effectiveAspiration =
      careerAspiration.trim() ||
      currentProfile.careerObjective ||
      'Full-Stack & Software Engineering Mastery';

    const resolvedAvatar = sanitizeProfileAvatarUrl(
      avatarUrl,
      customAvatarLink,
      name || currentProfile.name || 'Student'
    );

    return {
      ...currentProfile,
      userId: userId || 'default-learner',
      email: email || 'student@devtrack.edu',
      name: name.trim() || 'Student Learner',
      avatarUrl: resolvedAvatar,
      country: country.trim(),
      preferredLanguage: preferredLanguage.trim() || 'English',
      educationLevel: educationLevel.trim(),
      currentDegree: currentDegree.trim(),
      collegeOrUniversity: collegeOrUniversity.trim(),
      academicYearOrSemester: academicYearOrSemester.trim(),
      role: role || 'University Student',
      careerAspiration: effectiveAspiration,
      careerObjective: effectiveAspiration,
      learningInterests,
      skillLevels,
      preferredLearningFormats,
      personalLearningGoals,
      dailyMinutesTarget: Math.max(15, Number(dailyMinutesTarget) || 60),
      preferredTime: preferredTime || '20:00',
      studyDays: studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5],
      weeklyHoursGoal,
      onboardingCompleted: markCompleted,
      onboardingCompletedAt: new Date().toISOString(),
    };
  };

  const handleFinishOrSkip = (markCompleted: boolean = true) => {
    const finalProfile = buildDraftProfile(markCompleted);
    onCompleteOnboarding(finalProfile, isNewRegistration);
  };

  const draftCompletion = calculateProfileCompletionReport(buildDraftProfile(false));
  const profileAlreadyCreated = isLearnerProfileCreated(currentProfile);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-onboarding-modal-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full p-6 space-y-6 relative max-h-[92vh] overflow-y-auto">
        <input
          ref={onboardingFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleOnboardingPhotoUpload}
          className="hidden"
        />

        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {mode === 'register'
                  ? 'New Student Account Sign Up'
                  : `Personalized Student Onboarding · Step ${step} of 4`}
              </span>
              {mode === 'onboarding' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-emerald-700">
                    Profile {draftCompletion.percent}% Complete
                  </span>
                </>
              )}
            </div>
            <h2
              id="student-onboarding-modal-title"
              className="text-xl font-bold text-slate-900"
            >
              {mode === 'register'
                ? 'Create Your Student Learning Account'
                : 'Personalize Your Learning Experience'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'register'
                ? 'Sign up to get personalized course recommendations, study roadmaps, and a private course-linked notes library.'
                : 'Tell us about your academic background, career goals, and study preferences. You can skip optional questions anytime.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'onboarding' && !profileAlreadyCreated && (
              <button
                type="button"
                onClick={() => setMode('register')}
                className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                + Register New Student
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              aria-label="Close onboarding modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Registration Form Mode */}
        {mode === 'register' ? (
          <form onSubmit={handleStartNewRegistration} noValidate className="space-y-4">
            {regError && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700"
              >
                {regError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="e.g. Aarav Verma"
                  aria-label="Student full name"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Student Email Address *
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="e.g. aarav@university.edu"
                  aria-label="Student email address"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Primary Learner Category
              </label>
              <select
                value={regRole}
                onChange={e => setRegRole(e.target.value)}
                aria-label="Primary learner category"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
              >
                {LEARNER_ROLE_OPTIONS.map(opt => (
                  <option key={opt.role} value={opt.role}>
                    {opt.role} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMode('onboarding')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Continue with Current Account ({currentProfile.name})
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account &amp; Start Onboarding</span>
              </button>
            </div>
          </form>
        ) : (
          /* 4-Step Learner Onboarding Wizard */
          <div className="space-y-6">
            {/* Step Progress Indicator */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { num: 1, label: '1. Identity & Region' },
                { num: 2, label: '2. Education' },
                { num: 3, label: '3. Career & Skills' },
                { num: 4, label: '4. Goals & Pace' },
              ].map(s => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num as 1 | 2 | 3 | 4)}
                  className={`py-2 px-3 rounded-xl text-left border transition-colors cursor-pointer ${
                    step === s.num
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                      : step > s.num
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <div className="text-xs truncate">{s.label}</div>
                </button>
              ))}
            </div>

            {/* STEP 1: Full Name, Profile Picture, Country & Preferred Language */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>Step 1: Personal Identity, Country &amp; Preferred Language</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your full name"
                      aria-label="Onboarding full name"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Learner Role
                    </label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      aria-label="Onboarding learner role"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    >
                      {LEARNER_ROLE_OPTIONS.map(r => (
                        <option key={r.role} value={r.role}>
                          {r.role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Country
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      placeholder="e.g. India, United States, Germany, UK"
                      aria-label="Onboarding country"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Preferred Language
                    </label>
                    <input
                      type="text"
                      value={preferredLanguage}
                      onChange={e => setPreferredLanguage(e.target.value)}
                      placeholder="e.g. English, Hindi / Hinglish, Spanish"
                      aria-label="Onboarding preferred language"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                  </div>
                </div>

                {/* Profile Picture Selection */}
                <div className="space-y-2.5 p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Profile Picture (Upload Own Photo or Choose Avatar)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onboardingFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Own Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrl(generateInitialsAvatarDataUrl(name || 'Learner'));
                          setCustomAvatarLink('');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl cursor-pointer"
                      >
                        Use My Initials
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {avatarUrl.startsWith('data:image/') && (
                      <div className="flex items-center gap-2 p-2 rounded-xl border border-emerald-500 bg-emerald-50 text-xs font-semibold text-emerald-800">
                        <img
                          src={avatarUrl}
                          alt="Custom Avatar"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <span>Custom Photo</span>
                      </div>
                    )}
                    {DEFAULT_AVATAR_OPTIONS.map(av => (
                      <button
                        key={av.url}
                        type="button"
                        onClick={() => {
                          setAvatarUrl(av.url);
                          setCustomAvatarLink('');
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                          avatarUrl === av.url
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={av.url}
                          alt={av.label}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <span>{av.label}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customAvatarLink}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomAvatarLink(val);
                      if (val.trim()) setAvatarUrl(val.trim());
                    }}
                    placeholder="Optional: Paste external image link (https://...)"
                    aria-label="Custom profile picture URL"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Education Level, Degree, Optional College & Semester */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>Step 2: Education Background &amp; Academic Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Education Level
                    </label>
                    <select
                      value={educationLevel}
                      onChange={e => setEducationLevel(e.target.value)}
                      aria-label="Onboarding education level"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    >
                      <option value="">Select education level...</option>
                      {EDUCATION_LEVEL_OPTIONS.map(lvl => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Current Degree or Specialization
                    </label>
                    <input
                      type="text"
                      value={currentDegree}
                      onChange={e => setCurrentDegree(e.target.value)}
                      placeholder="e.g. B.Tech Computer Science, BCA, MCA, Self-Taught"
                      aria-label="Onboarding current degree"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      College or University <span className="text-slate-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={collegeOrUniversity}
                      onChange={e => setCollegeOrUniversity(e.target.value)}
                      placeholder="Optional — e.g. IIT Delhi, NIT, State University"
                      aria-label="Onboarding college or university"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Current Academic Year or Semester{' '}
                      <span className="text-slate-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={academicYearOrSemester}
                      onChange={e => setAcademicYearOrSemester(e.target.value)}
                      placeholder="Optional — e.g. 2nd Year / Semester 4, Final Year"
                      aria-label="Onboarding academic year or semester"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Career Aspiration, Learning Interests & Current Skill Levels */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span>Step 3: Career Aspiration, Learning Interests &amp; Current Skill Levels</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Career Aspiration
                  </label>
                  <input
                    type="text"
                    value={careerAspiration}
                    onChange={e => setCareerAspiration(e.target.value)}
                    placeholder="e.g. Full-Stack Software Engineer, Backend & Cloud Architect, AI Engineer"
                    aria-label="Onboarding career aspiration"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Learning Interests (Select topics you want to master)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEARNING_INTEREST_OPTIONS.map(interest => {
                      const selected = learningInterests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            selected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {learningInterests.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Current Skill Levels (Personalizes difficulty &amp; course recommendations)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {learningInterests.map(interest => {
                        const currentLvl = skillLevels[interest] || 'Beginner';
                        return (
                          <div
                            key={interest}
                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {interest}
                            </span>
                            <div className="flex items-center gap-1">
                              {(['Beginner', 'Intermediate', 'Advanced'] as SkillProficiency[]).map(
                                lvl => (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setSkillForInterest(interest, lvl)}
                                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg cursor-pointer ${
                                      currentLvl === lvl
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {lvl}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Preferred Learning Formats, Daily Study Availability & Personal Goals */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Step 4: Learning Formats, Study Availability &amp; Personal Goals</span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Preferred Learning Formats
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEARNING_FORMAT_OPTIONS.map(fmt => {
                      const selected = preferredLearningFormats.includes(fmt);
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => toggleFormat(fmt)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            selected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {fmt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Daily Study Availability (Minutes / Day)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={360}
                      step={15}
                      value={dailyMinutesTarget}
                      onChange={e => setDailyMinutesTarget(Number(e.target.value))}
                      aria-label="Onboarding daily study minutes"
                      className="w-full px-3.5 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Preferred Daily Study Time
                    </label>
                    <input
                      type="time"
                      value={preferredTime}
                      onChange={e => setPreferredTime(e.target.value)}
                      aria-label="Onboarding preferred study time"
                      className="w-full px-3.5 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Active Study Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {dayNames.map((label, idx) => {
                      const active = studyDays.includes(idx);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleStudyDay(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                            active
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Personal Learning Goals */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Personal Learning Goals
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={personalGoalInput}
                      onChange={e => setPersonalGoalInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGoal();
                        }
                      }}
                      placeholder="Add a personal learning goal (e.g. Finish 50 DSA problems this month)..."
                      aria-label="Personal learning goal input"
                      className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleAddGoal}
                      className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      + Add Goal
                    </button>
                  </div>

                  {personalLearningGoals.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {personalLearningGoals.map(goal => (
                        <li
                          key={goal}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-800"
                        >
                          <span>• {goal}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGoal(goal)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer ml-2"
                            aria-label={`Remove goal ${goal}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Footer Controls: Back, Skip Optional, Next / Finish */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(prev => (prev - 1) as 1 | 2 | 3 | 4)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleFinishOrSkip(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Skip Optional &amp; Complete Profile Later
                </button>
              </div>

              <div className="flex items-center gap-2">
                {step < 4 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep(prev => (prev + 1) as 1 | 2 | 3 | 4)}
                      className="px-3.5 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Skip Step
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(prev => (prev + 1) as 1 | 2 | 3 | 4)}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleFinishOrSkip(true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Profile &amp; Go to Personalized Dashboard</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

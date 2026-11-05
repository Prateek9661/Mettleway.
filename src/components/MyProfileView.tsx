import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  User,
  Globe,
  GraduationCap,
  Briefcase,
  Target,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Save,
  UserPlus,
  Play,
  BookOpen,
  Award,
  Plus,
  X,
  Camera,
  Upload,
  RotateCcw,
} from 'lucide-react';
import {
  LearnerProfile,
  LearnerRole,
  PacingMode,
  Tracker,
  SkillProficiencyLevel,
} from '../types';
import {
  LEARNER_ROLES,
  EDUCATION_LEVEL_OPTIONS,
  LEARNING_INTEREST_OPTIONS,
  LEARNING_FORMAT_OPTIONS,
  DEFAULT_AVATAR_OPTIONS,
  calculateProfileCompletionReport,
  computePersonalizedCourseRecommendations,
  computeProfileCourseAnalytics,
  isLearnerProfileCreated,
  generateInitialsAvatarDataUrl,
  sanitizeProfileAvatarUrl,
} from '../utils/studyWorkspaceLogic';

interface MyProfileViewProps {
  profile: LearnerProfile;
  trackers: Tracker[];
  activeTrackerId: string;
  onSaveProfile: (updatedProfile: LearnerProfile, syncToActiveCourse: boolean) => void;
  onOpenOnboardingWizard: (mode: 'register' | 'onboarding') => void;
  onResumeOrSelectCourse: (trackerId: string, lessonId?: string) => void;
  onOpenCreateCourseModal: () => void;
  onMarkCourseCompleted: (trackerId: string) => void;
  onResetCourseToPending: (trackerId: string) => void;
}

const DAY_LABELS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' },
];

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  profile,
  trackers,
  activeTrackerId,
  onSaveProfile,
  onOpenOnboardingWizard,
  onResumeOrSelectCourse,
  onOpenCreateCourseModal,
  onMarkCourseCompleted,
  onResetCourseToPending,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Editable personal & academic fields
  const [name, setName] = useState<string>(profile.name || '');
  const [email, setEmail] = useState<string>(profile.email || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(
    profile.avatarUrl || DEFAULT_AVATAR_OPTIONS[0].url
  );
  // Separate state for optional external image URL so internal /src/assets/... or data:image/... never triggers URL input validation
  const [customAvatarLink, setCustomAvatarLink] = useState<string>(() => {
    const initial = profile.avatarUrl || '';
    return initial.startsWith('http://') || initial.startsWith('https://') ? initial : '';
  });
  const [avatarUploadNotice, setAvatarUploadNotice] = useState<string | null>(null);

  const [country, setCountry] = useState<string>(profile.country || '');
  const [preferredLanguage, setPreferredLanguage] = useState<string>(
    profile.preferredLanguage || 'English'
  );
  const [role, setRole] = useState<LearnerRole>(profile.role || 'College / University Student');
  const [educationLevel, setEducationLevel] = useState<string>(
    profile.educationLevel || "Bachelor's Degree (Undergraduate)"
  );
  const [currentDegree, setCurrentDegree] = useState<string>(profile.currentDegree || '');
  const [collegeOrUniversity, setCollegeOrUniversity] = useState<string>(
    profile.collegeOrUniversity || ''
  );
  const [academicYearOrSemester, setAcademicYearOrSemester] = useState<string>(
    profile.academicYearOrSemester || ''
  );

  // Career & skills
  const [careerAspiration, setCareerAspiration] = useState<string>(
    profile.careerAspiration || profile.careerObjective || ''
  );
  const [learningInterests, setLearningInterests] = useState<string[]>(
    profile.learningInterests || []
  );
  const [customInterestInput, setCustomInterestInput] = useState<string>('');
  const [skillLevels, setSkillLevels] = useState<Record<string, SkillProficiencyLevel>>(
    profile.skillLevels || {}
  );

  // Preferences, availability & goals
  const [preferredLearningFormats, setPreferredLearningFormats] = useState<string[]>(
    profile.preferredLearningFormats || []
  );
  const [pacingMode, setPacingMode] = useState<PacingMode>(profile.pacingMode || 'steady-daily');
  const [dailyMinutesTarget, setDailyMinutesTarget] = useState<number>(
    profile.dailyMinutesTarget || 60
  );
  const [weeklyHoursGoal, setWeeklyHoursGoal] = useState<number>(profile.weeklyHoursGoal || 7);
  const [preferredTime, setPreferredTime] = useState<string>(profile.preferredTime || '20:00');
  const [studyDays, setStudyDays] = useState<number[]>(
    profile.studyDays || [1, 2, 3, 4, 5]
  );
  const [personalLearningGoals, setPersonalLearningGoals] = useState<string>(
    Array.isArray(profile.personalLearningGoals)
      ? profile.personalLearningGoals.join('\n')
      : profile.personalLearningGoals || ''
  );
  const [syncToActiveCourse, setSyncToActiveCourse] = useState<boolean>(true);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [courseAnalyticsTab, setCourseAnalyticsTab] = useState<
    'in_progress' | 'completed' | 'pending'
  >('in_progress');

  // Keep form synced if profile prop changes from onboarding wizard
  useEffect(() => {
    setName(profile.name || '');
    setEmail(profile.email || '');
    const nextAvatar = profile.avatarUrl || DEFAULT_AVATAR_OPTIONS[0].url;
    setAvatarUrl(nextAvatar);
    setCustomAvatarLink(
      nextAvatar.startsWith('http://') || nextAvatar.startsWith('https://') ? nextAvatar : ''
    );
    setCountry(profile.country || '');
    setPreferredLanguage(profile.preferredLanguage || 'English');
    setRole(profile.role || 'College / University Student');
    setEducationLevel(profile.educationLevel || "Bachelor's Degree (Undergraduate)");
    setCurrentDegree(profile.currentDegree || '');
    setCollegeOrUniversity(profile.collegeOrUniversity || '');
    setAcademicYearOrSemester(profile.academicYearOrSemester || '');
    setCareerAspiration(profile.careerAspiration || profile.careerObjective || '');
    setLearningInterests(profile.learningInterests || []);
    setSkillLevels(profile.skillLevels || {});
    setPreferredLearningFormats(profile.preferredLearningFormats || []);
    setPacingMode(profile.pacingMode || 'steady-daily');
    setDailyMinutesTarget(profile.dailyMinutesTarget || 60);
    setWeeklyHoursGoal(profile.weeklyHoursGoal || 7);
    setPreferredTime(profile.preferredTime || '20:00');
    setStudyDays(profile.studyDays || [1, 2, 3, 4, 5]);
    setPersonalLearningGoals(
      Array.isArray(profile.personalLearningGoals)
        ? profile.personalLearningGoals.join('\n')
        : profile.personalLearningGoals || ''
    );
  }, [profile]);

  const resolvedAvatarUrl = useMemo(
    () => sanitizeProfileAvatarUrl(avatarUrl, customAvatarLink, name || profile.name),
    [avatarUrl, customAvatarLink, name, profile.name]
  );

  // Live draft profile for real-time completion % and recommendations preview
  const liveProfileDraft: LearnerProfile = useMemo(
    () => ({
      ...profile,
      name: name.trim() || profile.name,
      email: email.trim() || profile.email,
      avatarUrl: resolvedAvatarUrl,
      country: country.trim(),
      preferredLanguage: preferredLanguage.trim(),
      role,
      educationLevel: educationLevel.trim(),
      currentDegree: currentDegree.trim(),
      collegeOrUniversity: collegeOrUniversity.trim(),
      academicYearOrSemester: academicYearOrSemester.trim(),
      careerAspiration: careerAspiration.trim(),
      careerObjective: careerAspiration.trim() || profile.careerObjective,
      learningInterests,
      skillLevels,
      preferredLearningFormats,
      pacingMode,
      dailyMinutesTarget,
      weeklyHoursGoal,
      preferredTime,
      studyDays,
      personalLearningGoals: personalLearningGoals
        .split('\n')
        .map(g => g.trim())
        .filter(Boolean),
    }),
    [
      profile,
      name,
      email,
      resolvedAvatarUrl,
      country,
      preferredLanguage,
      role,
      educationLevel,
      currentDegree,
      collegeOrUniversity,
      academicYearOrSemester,
      careerAspiration,
      learningInterests,
      skillLevels,
      preferredLearningFormats,
      pacingMode,
      dailyMinutesTarget,
      weeklyHoursGoal,
      preferredTime,
      studyDays,
      personalLearningGoals,
    ]
  );

  const completionReport = useMemo(
    () => calculateProfileCompletionReport(liveProfileDraft),
    [liveProfileDraft]
  );

  const recommendations = useMemo(
    () => computePersonalizedCourseRecommendations(liveProfileDraft, trackers),
    [liveProfileDraft, trackers]
  );

  const courseAnalytics = useMemo(
    () => computeProfileCourseAnalytics(trackers),
    [trackers]
  );

  const profileAlreadyCreated = useMemo(
    () => isLearnerProfileCreated(profile),
    [profile]
  );

  // Handle uploading custom profile photo from user's computer or mobile device
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarUploadNotice('Please select a valid image file (PNG, JPG, WebP, or GIF).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;

      // Resize onto a 256x256 square canvas for fast, lightweight localStorage persistence
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
            setAvatarUrl(optimizedDataUrl);
            setCustomAvatarLink('');
            setAvatarUploadNotice('Your custom profile picture is set! Click "Save Profile" to keep changes.');
          } else {
            setAvatarUrl(rawDataUrl);
            setCustomAvatarLink('');
            setAvatarUploadNotice('Your custom profile picture is set!');
          }
        } catch {
          setAvatarUrl(rawDataUrl);
          setCustomAvatarLink('');
          setAvatarUploadNotice('Your custom profile picture is set!');
        }
      };
      img.onerror = () => {
        setAvatarUrl(rawDataUrl);
        setCustomAvatarLink('');
        setAvatarUploadNotice('Your custom profile picture is set!');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUseInitialsAvatar = () => {
    const generated = generateInitialsAvatarDataUrl(name || profile.name || 'Learner');
    setAvatarUrl(generated);
    setCustomAvatarLink('');
    setAvatarUploadNotice('Generated custom initials avatar for your profile.');
  };

  const handleToggleInterest = (interest: string) => {
    setLearningInterests(prev => {
      const exists = prev.includes(interest);
      if (exists) {
        const next = prev.filter(i => i !== interest);
        setSkillLevels(curr => {
          const copy = { ...curr };
          delete copy[interest];
          return copy;
        });
        return next;
      }
      setSkillLevels(curr => ({
        ...curr,
        [interest]: curr[interest] || 'Beginner',
      }));
      return [...prev, interest];
    });
  };

  const handleAddCustomInterest = () => {
    const trimmed = customInterestInput.trim();
    if (!trimmed) return;
    if (!learningInterests.includes(trimmed)) {
      setLearningInterests(prev => [...prev, trimmed]);
      setSkillLevels(prev => ({ ...prev, [trimmed]: 'Beginner' }));
    }
    setCustomInterestInput('');
  };

  const handleSkillLevelChange = (skill: string, level: SkillProficiencyLevel) => {
    setSkillLevels(prev => ({ ...prev, [skill]: level }));
  };

  const handleToggleFormat = (fmt: string) => {
    setPreferredLearningFormats(prev =>
      prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
    );
  };

  const handleToggleStudyDay = (dayId: number) => {
    setStudyDays(prev => {
      if (prev.includes(dayId)) {
        return prev.length > 1 ? prev.filter(d => d !== dayId) : prev;
      }
      return [...prev, dayId].sort();
    });
  };

  const persistProfileChanges = () => {
    const updated: LearnerProfile = {
      ...liveProfileDraft,
      avatarUrl: resolvedAvatarUrl,
      onboardingCompleted: true,
      onboardingCompletedAt: profile.onboardingCompletedAt || new Date().toISOString(),
    };
    onSaveProfile(updated, syncToActiveCourse);

    // Persist to backend /api/profile as well
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: updated.userId,
        profile: updated,
      }),
    }).catch(() => {});

    setAvatarUploadNotice(null);
    setJustSaved(true);
    setSaveBanner(
      'Your personalized learner profile, profile picture, skill levels, and study preferences have been saved.'
    );
    setTimeout(() => {
      setJustSaved(false);
    }, 2500);
    setTimeout(() => setSaveBanner(null), 4500);
  };

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    persistProfileChanges();
  };

  const displayedAnalyticsList =
    courseAnalyticsTab === 'completed'
      ? courseAnalytics.completedCourses
      : courseAnalyticsTab === 'in_progress'
      ? courseAnalytics.inProgressCourses
      : courseAnalytics.pendingCourses;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hidden Device File Input for Custom Profile Photo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarFileUpload}
        data-testid="profile-avatar-file-input"
        aria-label="Upload custom profile picture from device"
        className="hidden"
      />

      {/* Top Personalized Profile Hero & Completion Percentage Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Interactive Avatar with Direct "Upload Photo" Camera Button */}
            <div className="relative group shrink-0 self-start sm:self-center">
              <img
                src={resolvedAvatarUrl}
                alt={name || 'Learner Avatar'}
                data-testid="profile-hero-avatar-img"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-100 shadow-xs bg-slate-100"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="profile-hero-upload-photo-btn"
                title="Upload your own profile photo from device"
                className="absolute -bottom-2 -right-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm border border-white transition-colors cursor-pointer"
              >
                <Camera className="w-3 h-3" />
                <span>Photo</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-indigo-600">{role}</span>
                {country && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{country}</span>
                  </>
                )}
                {preferredLanguage && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{preferredLanguage}</span>
                  </>
                )}
                {currentDegree && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{currentDegree}</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                My Profile: {name || 'Learner'}
              </h1>
              <p className="text-xs text-slate-600 max-w-2xl">
                {careerAspiration
                  ? `Career Aspiration: ${careerAspiration}`
                  : 'Complete your learner profile below to personalize course recommendations and learning roadmaps.'}
              </p>
            </div>
          </div>

          {/* Profile Completion Bar + Action Triggers */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            <div className="w-full sm:w-72 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Profile Completion</span>
                <span className="font-mono tabular-nums font-bold text-indigo-600">
                  {completionReport.completedCount}/{completionReport.totalCount} fields (
                  {completionReport.percentage}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    completionReport.percentage === 100 ? 'bg-emerald-600' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${completionReport.percentage}%` }}
                />
              </div>
              {completionReport.missingFields.length > 0 && (
                <p className="text-[11px] text-amber-700">
                  Missing: {completionReport.missingFields.slice(0, 3).join(', ')}
                  {completionReport.missingFields.length > 3
                    ? ` +${completionReport.missingFields.length - 3} more`
                    : ''}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={persistProfileChanges}
                data-testid="profile-top-save-btn"
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98] ${
                  justSaved
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {justSaved ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Profile</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenOnboardingWizard('onboarding')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>4-Step Setup Wizard</span>
              </button>
              {/* Only show "Create / Register Profile" if the learner has NOT created their profile yet */}
              {!profileAlreadyCreated && (
                <button
                  type="button"
                  data-testid="profile-register-new-student-btn"
                  onClick={() => onOpenOnboardingWizard('register')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Student Profile</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {saveBanner && (
        <div
          role="status"
          data-testid="profile-save-success-banner"
          className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            aria-label="Dismiss save notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main 2-Column Layout: Left (Editable Profile Form) | Right (Personalized Recommendations & Course History) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Editable Student Profile Sections (noValidate prevents HTML5 URL popup blocking) */}
        <form onSubmit={handleSubmitProfile} noValidate className="lg:col-span-7 space-y-6">
          {/* Section 1: Personal Information */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">1. Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-full-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="profile-full-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Account Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-country"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Country
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="profile-country"
                    type="text"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    placeholder="e.g. India, United States, Germany"
                    className="w-full pl-8 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-language"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Preferred Language
                </label>
                <input
                  id="profile-language"
                  type="text"
                  value={preferredLanguage}
                  onChange={e => setPreferredLanguage(e.target.value)}
                  placeholder="e.g. English, Hindi / Hinglish, Spanish"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>
            </div>

            {/* Profile Picture Studio: Upload Own Photo, Generate Initials Avatar, Pick Preset, or Paste Optional Link */}
            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3 pt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    Profile Picture (Upload Own Photo or Choose Avatar)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Upload any photo from your device, generate an initials avatar, or choose a preset below.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="profile-upload-own-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Own Photo</span>
                  </button>
                  <button
                    type="button"
                    data-testid="profile-use-initials-avatar-btn"
                    onClick={handleUseInitialsAvatar}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Use My Initials</span>
                  </button>
                  {avatarUrl.startsWith('data:image/') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl(DEFAULT_AVATAR_OPTIONS[0].url);
                        setCustomAvatarLink('');
                        setAvatarUploadNotice(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl cursor-pointer"
                      title="Reset to default avatar"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {avatarUploadNotice && (
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{avatarUploadNotice}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {/* Current Custom / Initials Preview if active */}
                {avatarUrl.startsWith('data:image/') && (
                  <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
                    <img
                      src={avatarUrl}
                      alt="Your custom uploaded avatar"
                      className="w-11 h-11 rounded-xl object-cover border-2 border-emerald-600 shadow-2xs"
                    />
                    <span className="text-[11px] font-semibold text-emerald-700">
                      Custom Photo Active
                    </span>
                  </div>
                )}

                {/* Preset Avatars */}
                {DEFAULT_AVATAR_OPTIONS.map((opt, idx) => (
                  <button
                    key={opt.url}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(opt.url);
                      setCustomAvatarLink('');
                      setAvatarUploadNotice(null);
                    }}
                    className={`p-0.5 rounded-xl border-2 transition-all cursor-pointer ${
                      resolvedAvatarUrl === opt.url
                        ? 'border-indigo-600 scale-105'
                        : 'border-transparent hover:border-slate-300'
                    }`}
                    title={`Select avatar ${opt.label}`}
                  >
                    <img
                      src={opt.url}
                      alt={`Avatar option ${idx + 1}: ${opt.label}`}
                      className="w-11 h-11 rounded-lg object-cover"
                    />
                  </button>
                ))}

                {/* Optional External Image Link (type="text" so it NEVER triggers browser URL popup) */}
                <input
                  type="text"
                  value={customAvatarLink}
                  onChange={e => {
                    const val = e.target.value;
                    setCustomAvatarLink(val);
                    if (val.trim()) {
                      setAvatarUrl(val.trim());
                    }
                  }}
                  placeholder="Optional: Paste external image link (https://...)"
                  aria-label="Custom profile picture URL"
                  className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Education Background */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">2. Education Background</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-role"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Learner / Professional Category
                </label>
                <select
                  id="profile-role"
                  value={role}
                  onChange={e => setRole(e.target.value as LearnerRole)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 cursor-pointer"
                >
                  {LEARNER_ROLES.map(r => (
                    <option key={r.role} value={r.role}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="profile-education-level"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Education Level
                </label>
                <select
                  id="profile-education-level"
                  value={educationLevel}
                  onChange={e => setEducationLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 cursor-pointer"
                >
                  {EDUCATION_LEVEL_OPTIONS.map(level => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="profile-degree"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Current Degree / Major
                </label>
                <input
                  id="profile-degree"
                  type="text"
                  value={currentDegree}
                  onChange={e => setCurrentDegree(e.target.value)}
                  placeholder="e.g. B.Tech CSE, BCA, MCA, Self-Taught"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-semester"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Current Academic Year or Semester <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  id="profile-semester"
                  type="text"
                  value={academicYearOrSemester}
                  onChange={e => setAcademicYearOrSemester(e.target.value)}
                  placeholder="e.g. 3rd Year / Semester 5, Working Professional"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="profile-college"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  College, University, or Organization <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  id="profile-college"
                  type="text"
                  value={collegeOrUniversity}
                  onChange={e => setCollegeOrUniversity(e.target.value)}
                  placeholder="e.g. IIT Delhi, NIT Trichy, Stanford University, or Company Name"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Career Aspirations, Learning Interests & Current Skill Levels */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                3. Career Aspirations, Learning Interests &amp; Skill Levels
              </h2>
            </div>

            <div>
              <label
                htmlFor="profile-career-aspiration"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Career Aspiration
              </label>
              <input
                id="profile-career-aspiration"
                type="text"
                value={careerAspiration}
                onChange={e => setCareerAspiration(e.target.value)}
                placeholder="e.g. Crack Product-Based SDE-1 Interviews & Master Full-Stack Systems"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
              />
            </div>

            {/* Learning Interests Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Learning Interests (Click to toggle)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {LEARNING_INTEREST_OPTIONS.map(topic => {
                  const selected = learningInterests.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => handleToggleInterest(topic)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customInterestInput}
                  onChange={e => setCustomInterestInput(e.target.value)}
                  placeholder="Add custom interest or technology (e.g. Rust, Kubernetes)..."
                  aria-label="Add custom learning interest"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomInterest}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Skill</span>
                </button>
              </div>
            </div>

            {/* Current Skill Proficiency Levels */}
            {learningInterests.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Current Skill Levels (Personalizes difficulty &amp; roadmap recommendations)
                </label>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/60">
                  {learningInterests.map(skill => {
                    const currentLevel = skillLevels[skill] || 'Beginner';
                    return (
                      <div
                        key={skill}
                        className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-semibold text-slate-800">{skill}</span>
                        <div className="flex items-center gap-1.5">
                          {(['Beginner', 'Intermediate', 'Advanced'] as SkillProficiencyLevel[]).map(
                            lvl => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => handleSkillLevelChange(skill, lvl)}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                                  currentLevel === lvl
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
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

          {/* Section 4: Learning Preferences, Daily Study Availability & Personal Goals */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Target className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                4. Learning Preferences, Daily Availability &amp; Personal Goals
              </h2>
            </div>

            {/* Preferred Learning Formats */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Preferred Learning Formats
              </label>
              <div className="flex flex-wrap gap-2">
                {LEARNING_FORMAT_OPTIONS.map(fmt => {
                  const active = preferredLearningFormats.includes(fmt);
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleToggleFormat(fmt)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Study Availability */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label
                  htmlFor="profile-daily-minutes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Daily Study Availability (Mins)
                </label>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    id="profile-daily-minutes"
                    type="number"
                    min={15}
                    max={360}
                    step={15}
                    value={dailyMinutesTarget}
                    onChange={e => setDailyMinutesTarget(Number(e.target.value) || 60)}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-weekly-hours"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Weekly Target (Hours)
                </label>
                <input
                  id="profile-weekly-hours"
                  type="number"
                  min={1}
                  max={45}
                  value={weeklyHoursGoal}
                  onChange={e => setWeeklyHoursGoal(Number(e.target.value) || 7)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-preferred-time"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Preferred Reminder Time
                </label>
                <input
                  id="profile-preferred-time"
                  type="time"
                  value={preferredTime}
                  onChange={e => setPreferredTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                />
              </div>
            </div>

            {/* Active Study Days */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Active Study Days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map(day => {
                  const selected = studyDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => handleToggleStudyDay(day.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Personal Learning Goals */}
            <div>
              <label
                htmlFor="profile-personal-goals"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Personal Learning Goals
              </label>
              <textarea
                id="profile-personal-goals"
                rows={3}
                value={personalLearningGoals}
                onChange={e => setPersonalLearningGoals(e.target.value)}
                placeholder="Describe your concrete learning goals (e.g., Complete Striver DSA + DBMS playlists, take structured lecture notes for revision, and build 2 full-stack projects this semester)..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 resize-none"
              />
            </div>

            {saveBanner && (
              <div
                role="status"
                data-testid="profile-bottom-save-banner"
                className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveBanner(null)}
                  className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  aria-label="Dismiss bottom save notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToActiveCourse}
                  onChange={e => setSyncToActiveCourse(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Apply daily availability &amp; schedule to active course</span>
              </label>

              <button
                type="button"
                onClick={persistProfileChanges}
                data-testid="profile-bottom-save-btn"
                className={`relative z-10 pointer-events-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98] ${
                  justSaved
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {justSaved ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Profile</span>
              </button>
            </div>
          </div>
        </form>

        {/* Right Column (5 cols): Personalized Course Recommendations & Course Portfolio History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Personalized Course & Roadmap Recommendations */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Personalized Course Recommendations</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Matched to your career aspiration, skill levels, and daily availability.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {recommendations.map(rec => (
                <div
                  key={rec.id}
                  className="p-4 border border-slate-200 rounded-xl bg-slate-50/70 space-y-2.5 hover:bg-white transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-indigo-600">{rec.category}</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {rec.matchScore}% Match · {rec.difficulty}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{rec.reason}</p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500">
                    {rec.estimatedWeeks}
                  </p>

                  <div className="pt-1 flex items-center gap-2">
                    {rec.matchedTrackerId ? (
                      <button
                        type="button"
                        onClick={() => onResumeOrSelectCourse(rec.matchedTrackerId!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Open Recommended Track</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenCreateCourseModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Import Playlist for This Track</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Profile Completion Checklist */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Onboarding &amp; Profile Readiness ({completionReport.percentage}%)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Completed fields power your AI Concept Mentor context and dashboard recommendations.
            </p>
            {completionReport.missingFields.length === 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Complete! Your learner profile is fully configured.</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Optional fields remaining to reach 100%:</span>
                </div>
                <p className="text-[11px] text-amber-800 pl-5">
                  {completionReport.missingFields.join(' · ')}
                </p>
              </div>
            )}
          </div>

          {/* Card 3: Enrolled Course Status Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Course History &amp; Status ({courseAnalytics.totalCourses})
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {courseAnalytics.totalHoursLogged}h logged
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <button
                type="button"
                onClick={() => setCourseAnalyticsTab('in_progress')}
                className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  courseAnalyticsTab === 'in_progress'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-base font-extrabold font-mono tabular-nums">
                  {courseAnalytics.inProgressCount}
                </div>
                <div>In Progress</div>
              </button>
              <button
                type="button"
                onClick={() => setCourseAnalyticsTab('completed')}
                className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  courseAnalyticsTab === 'completed'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-base font-extrabold font-mono tabular-nums">
                  {courseAnalytics.completedCount}
                </div>
                <div>Completed</div>
              </button>
              <button
                type="button"
                onClick={() => setCourseAnalyticsTab('pending')}
                className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  courseAnalyticsTab === 'pending'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-base font-extrabold font-mono tabular-nums">
                  {courseAnalytics.pendingCount}
                </div>
                <div>Pending</div>
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {displayedAnalyticsList.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  No courses in this status category yet.
                </p>
              ) : (
                displayedAnalyticsList.map(item => (
                  <div
                    key={item.trackerId}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">
                        {item.title}
                        {item.trackerId === activeTrackerId ? ' (Active)' : ''}
                      </p>
                      <p className="text-slate-500 font-mono tabular-nums">
                        {item.completedLessonsCount}/{item.totalLessonsCount} lessons (
                        {item.progressPercent}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onResumeOrSelectCourse(item.trackerId)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
                      >
                        Open
                      </button>
                      {item.status !== 'completed' ? (
                        <button
                          type="button"
                          onClick={() => onMarkCourseCompleted(item.trackerId)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                        >
                          Complete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onResetCourseToPending(item.trackerId)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

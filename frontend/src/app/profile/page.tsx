'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
  User as UserIcon, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  Phone, 
  Calendar,
  Building,
  UserCheck,
  Compass,
  FileText
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { getProfileCompletionStatus, MOVE_IN_TIMELINE_CHOICES } from '@/lib/profile';

function ProfileContent() {
  const { user, loading: authLoading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active tab: 'profile' or 'security'
  const initialTab = searchParams.get('tab') === 'security' ? 'security' : 'profile';
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>(initialTab);

  // Profile form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [preferredCity, setPreferredCity] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [moveInTimeline, setMoveInTimeline] = useState('');

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [bioError, setBioError] = useState('');
  const [preferredCityError, setPreferredCityError] = useState('');
  const [monthlyBudgetError, setMonthlyBudgetError] = useState('');
  const [moveInTimelineError, setMoveInTimelineError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Email change state
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Sync initial tab from URL if changed
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'security' || tabParam === 'profile') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Auth protection & form initialization
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/profile');
      return;
    }
    setName(user.name || '');
    setPhone(user.phone || '');
    setBio(user.bio || '');
    setPreferredCity(user.preferredCity || '');
    setMonthlyBudget(
      user.monthlyBudget !== undefined && user.monthlyBudget !== null
        ? String(user.monthlyBudget)
        : ''
    );
    setMoveInTimeline(user.moveInTimeline || '');
  }, [user, authLoading, router]);

  const profileStatus = getProfileCompletionStatus(user);

  if (authLoading || !user) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle Profile Update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setNameError('');
    setPhoneError('');
    setBioError('');
    setPreferredCityError('');
    setMonthlyBudgetError('');
    setMoveInTimelineError('');

    let hasValidationError = false;

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters long');
      hasValidationError = true;
    } else if (trimmedName.length > 60) {
      setNameError('Name cannot exceed 60 characters');
      hasValidationError = true;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      const phoneRegex = /^[+]?[0-9\s().-]{7,20}$/;
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (
        !phoneRegex.test(trimmedPhone) ||
        trimmedPhone.length < 7 ||
        trimmedPhone.length > 20 ||
        digitsOnly.length < 7 ||
        digitsOnly.length > 15
      ) {
        setPhoneError('Please enter a valid phone number (e.g. +91 9876543210)');
        hasValidationError = true;
      }
    }

    const trimmedBio = bio.trim();
    if (trimmedBio.length > 500) {
      setBioError('Introduction cannot exceed 500 characters');
      hasValidationError = true;
    }

    const trimmedCity = preferredCity.trim();
    if (trimmedCity && (trimmedCity.length < 2 || trimmedCity.length > 100)) {
      setPreferredCityError('Preferred location must be between 2 and 100 characters');
      hasValidationError = true;
    }

    let parsedBudget: number | null = null;
    const trimmedBudget = monthlyBudget.trim();
    if (trimmedBudget) {
      const num = Number(trimmedBudget);
      if (isNaN(num) || !isFinite(num) || num <= 0 || num > 10000000) {
        setMonthlyBudgetError('Monthly budget must be a positive number up to ₹1,00,00,000');
        hasValidationError = true;
      } else {
        parsedBudget = num;
      }
    }

    const trimmedTimeline = moveInTimeline.trim();
    if (trimmedTimeline && !(MOVE_IN_TIMELINE_CHOICES as readonly string[]).includes(trimmedTimeline)) {
      setMoveInTimelineError('Please select a valid move-in timeline');
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    setProfileLoading(true);

    try {
      const res = await api.put<{ success: boolean; message: string; user: any }>('/auth/profile', {
        name: trimmedName,
        phone: trimmedPhone || null,
        bio: trimmedBio || null,
        preferredCity: trimmedCity || null,
        monthlyBudget: parsedBudget,
        moveInTimeline: trimmedTimeline || null,
      });

      setProfileSuccess(res.message || 'Profile updated successfully!');
      await refreshUser();
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Reset Profile Form to current saved values
  const handleProfileReset = () => {
    setName(user.name || '');
    setPhone(user.phone || '');
    setBio(user.bio || '');
    setPreferredCity(user.preferredCity || '');
    setMonthlyBudget(
      user.monthlyBudget !== undefined && user.monthlyBudget !== null
        ? String(user.monthlyBudget)
        : ''
    );
    setMoveInTimeline(user.moveInTimeline || '');
    setNameError('');
    setPhoneError('');
    setBioError('');
    setPreferredCityError('');
    setMonthlyBudgetError('');
    setMoveInTimelineError('');
    setProfileError('');
    setProfileSuccess('');
  };

  // Handle Self-Service Email Change
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const trimmedEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address format.');
      return;
    }

    if (trimmedEmail === user.email.toLowerCase()) {
      setEmailError('New email must be different from your current email address.');
      return;
    }

    if (!emailPassword) {
      setEmailError('Current password is required to verify identity for email change.');
      return;
    }

    setEmailLoading(true);

    try {
      const res = await api.put<{ success: boolean; message: string; user: any }>('/auth/change-email', {
        newEmail: trimmedEmail,
        password: emailPassword,
      });

      setEmailSuccess(res.message || 'Email address successfully updated.');
      setNewEmail('');
      setEmailPassword('');
      await refreshUser();
    } catch (err: any) {
      setEmailError(err.message || 'Failed to update email address. Please verify your password.');
    } finally {
      setEmailLoading(false);
    }
  };

  // Handle Password Change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await api.put<{ success: boolean; message: string }>('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordSuccess(res.message || 'Password changed successfully. Redirecting to login...');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Invalidate frontend auth state and redirect user to login
      setTimeout(async () => {
        await logout();
        router.push('/login?message=' + encodeURIComponent('Password updated successfully. Please log in again with your new password.'));
      }, 1200);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // User initials for avatar
  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.slice(0, 2).toUpperCase();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full flex-grow flex flex-col">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Account Settings</h1>
        <p className="text-muted mt-1 text-sm sm:text-base">Manage your personal information, role details, and security credentials.</p>
      </div>

      {/* User Overview Banner */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 mb-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0 shadow-xs">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">{user.name}</h2>
              {user.isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted truncate mt-0.5">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-muted/20 text-foreground uppercase tracking-wider border border-border">
                {user.role}
              </span>
              {user.createdAt && (
                <span className="text-xs text-muted flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex space-x-8">
          <button
            onClick={() => {
              setActiveTab('profile');
              setProfileError('');
              setProfileSuccess('');
            }}
            className={`pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-foreground hover:border-border'
            }`}
          >
            <UserIcon className="h-4 w-4" />
            Profile Details
          </button>

          <button
            onClick={() => {
              setActiveTab('security');
              setPasswordError('');
              setPasswordSuccess('');
            }}
            className={`pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'security'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-foreground hover:border-border'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Security & Password
          </button>
        </div>
      </div>

      {/* Tab 1: Profile Details */}
      {activeTab === 'profile' && (
        <>
          <div className="bg-card border border-border rounded-xl p-5 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground">Personal Information</h3>
            <p className="text-sm text-muted mt-0.5">Update your contact information visible to verified parties.</p>
          </div>

          {profileSuccess && (
            <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg flex items-center gap-3 text-success text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger text-sm font-medium">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Renter Profile Completion Progress (Tenants only) */}
            {user.role === 'TENANT' && (
              <div className="p-4 bg-muted/10 border border-border/80 rounded-xl mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">Renter Profile Checklist</span>
                  <span className="text-xs font-bold text-foreground bg-primary/10 px-2.5 py-0.5 rounded-full">
                    {profileStatus.completedCount} of {profileStatus.totalItems} ({profileStatus.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-muted/20 rounded-full h-2 mb-3 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${profileStatus.percentage}%` }}
                  />
                </div>
                {profileStatus.isComplete ? (
                  <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    All 5 renter checklist items are complete! Your profile is ready for property owners.
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    Complete the remaining {profileStatus.missingItems.length} {profileStatus.missingItems.length === 1 ? 'item' : 'items'} below to complete your profile.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {/* Full Name */}
              <div>
                <Input
                  label="Full Name"
                  id="profile-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  error={nameError}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              {/* Phone Number */}
              <div>
                <Input
                  label="Contact Phone Number"
                  id="profile-phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError('');
                  }}
                  error={phoneError}
                  placeholder="+91 9876543210"
                />
                <p className="mt-1 text-xs text-muted">Direct contact line for rental coordination.</p>
              </div>

              {/* Role (Read-only) */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-1.5">
                  Account Type
                  <span className="text-[11px] text-muted font-normal">(Read-only)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user.role === 'TENANT' ? 'Tenant (Rental Seeker)' : user.role === 'OWNER' ? 'Property Owner' : 'Platform Administrator'}
                    disabled
                    readOnly
                    className="w-full px-3 py-2 bg-muted/10 border border-border rounded-lg text-sm text-muted cursor-not-allowed pr-9 focus:outline-none capitalize"
                  />
                  <Building className="h-4 w-4 text-muted absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-1 text-xs text-muted">Role permissions are verified and assigned at registration.</p>
              </div>
            </div>

            {/* Tenant Renter Preferences Section */}
            {user.role === 'TENANT' && (
              <div className="mt-8 pt-8 border-t border-border space-y-6">
                <div>
                  <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Compass className="h-4.5 w-4.5 text-primary" />
                    Renter Preferences & Details
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Help property owners evaluate your inquiry quickly by sharing your preferences and move-in timeline.
                  </p>
                </div>

                {/* About me / Bio */}
                <div>
                  <label htmlFor="profile-bio" className="block text-sm font-medium text-foreground mb-1 flex items-center justify-between">
                    <span>About Me / Renter Introduction</span>
                    <span className="text-xs text-muted font-normal">{bio.length}/500</span>
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={3}
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      if (bioError) setBioError('');
                    }}
                    placeholder="e.g. Software engineer looking for a peaceful 2BHK near HSR Layout. Non-smoker, reliable tenant with stable income."
                    className={`block w-full px-3.5 py-2.5 text-sm border ${
                      bioError ? 'border-danger focus:ring-danger focus:border-danger' : 'border-border focus:ring-primary focus:border-primary'
                    } rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-foreground transition-all`}
                  />
                  {bioError ? (
                    <p className="mt-1 text-sm text-danger">{bioError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">A short introduction makes your requests stand out to landlords.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  {/* Preferred City / Locality */}
                  <div>
                    <Input
                      label="Preferred Rental City or Locality"
                      id="profile-preferred-city"
                      value={preferredCity}
                      onChange={(e) => {
                        setPreferredCity(e.target.value);
                        if (preferredCityError) setPreferredCityError('');
                      }}
                      error={preferredCityError}
                      placeholder="e.g. Indiranagar, Bengaluru"
                    />
                    <p className="mt-1 text-xs text-muted">Primary neighbourhood or city you are looking to rent in.</p>
                  </div>

                  {/* Monthly Rental Budget */}
                  <div>
                    <Input
                      label="Monthly Rental Budget (₹/mo)"
                      id="profile-monthly-budget"
                      type="number"
                      min="1"
                      max="10000000"
                      value={monthlyBudget}
                      onChange={(e) => {
                        setMonthlyBudget(e.target.value);
                        if (monthlyBudgetError) setMonthlyBudgetError('');
                      }}
                      error={monthlyBudgetError}
                      placeholder="e.g. 35000"
                    />
                    <p className="mt-1 text-xs text-muted">Maximum monthly rent you are comfortable paying.</p>
                  </div>

                  {/* Expected Move-in Timeline */}
                  <div className="sm:col-span-2">
                    <Select
                      label="Expected Move-in Timeline"
                      id="profile-movein-timeline"
                      value={moveInTimeline}
                      onChange={(e) => {
                        setMoveInTimeline(e.target.value);
                        if (moveInTimelineError) setMoveInTimelineError('');
                      }}
                      error={moveInTimelineError}
                      options={[
                        { label: 'Select move-in timeline...', value: '' },
                        ...MOVE_IN_TIMELINE_CHOICES.map((choice) => ({
                          label: choice,
                          value: choice,
                        })),
                      ]}
                    />
                    <p className="mt-1 text-xs text-muted">Helps owners understand your urgency and move-in readiness.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-6 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleProfileReset}
                disabled={profileLoading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={profileLoading}
                className="w-full sm:w-auto"
              >
                {profileLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving Changes...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Card 2: Account Email & Credentials */}
        <div className="mt-8 bg-card border border-border rounded-xl p-5 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Account Email Address
              </h3>
              <p className="text-sm text-muted mt-0.5">Your email address is your primary identity for login and notifications.</p>
            </div>
            {!isChangingEmail && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsChangingEmail(true);
                  setEmailError('');
                  setEmailSuccess('');
                }}
                className="self-start sm:self-auto font-medium"
              >
                Change Email
              </Button>
            )}
          </div>

          {/* Current Email display */}
          <div className="p-4 bg-muted/10 rounded-lg border border-border flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Current Email</p>
              <p className="text-base font-semibold text-foreground mt-0.5">{user.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </span>
          </div>

          {/* Change Email Form */}
          {isChangingEmail && (
            <form onSubmit={handleEmailSubmit} className="mt-6 pt-6 border-t border-border space-y-5 animate-in fade-in duration-150">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs sm:text-sm">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Security Verification Required
                </p>
                <p className="mt-1 text-blue-800">
                  Enter your new email address and confirm with your current password. For security, other active sessions will be revoked.
                </p>
              </div>

              {emailSuccess && (
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg flex items-center gap-3 text-success text-sm font-medium">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <span>{emailSuccess}</span>
                </div>
              )}

              {emailError && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger text-sm font-medium">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{emailError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Input
                    label="New Email Address"
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. yourname@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showEmailPassword ? 'text' : 'password'}
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-1 focus:outline-none"
                    >
                      {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsChangingEmail(false);
                    setNewEmail('');
                    setEmailPassword('');
                    setEmailError('');
                  }}
                  disabled={emailLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={emailLoading}
                >
                  {emailLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating Email...
                    </>
                  ) : (
                    'Confirm & Update Email'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </>
    )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="bg-card border border-border rounded-xl p-5 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground">Change Password</h3>
            <p className="text-sm text-muted mt-0.5">Ensure your account is using a long, random password to stay secure.</p>
          </div>

          {passwordSuccess && (
            <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg flex items-center gap-3 text-success text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger text-sm font-medium">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-md">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">Must be at least 8 characters long.</p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={`w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:ring-1 focus:outline-none pr-10 ${
                    confirmPassword && newPassword !== confirmPassword
                      ? 'border-danger focus:ring-danger focus:border-danger'
                      : 'border-border focus:ring-primary focus:border-primary'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-danger">Passwords do not match.</p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button
                type="submit"
                disabled={passwordLoading}
                className="w-full sm:w-auto"
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}

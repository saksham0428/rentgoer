/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  User as UserIcon, 
  KeyRound, 
  LogOut, 
  ChevronDown, 
  ClipboardList, 
  Heart, 
  Plus, 
  ShieldCheck, 
  ShieldAlert, 
  LayoutDashboard 
} from 'lucide-react';

interface ProfileDropdownProps {
  align?: 'right' | 'left';
}

export const ProfileDropdown = ({ align = 'right' }: ProfileDropdownProps) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown handler
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Toggle dropdown handler
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  // Handle keyboard navigation (Escape to close)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeDropdown();
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

  if (!user) return null;

  // Check for image or fallback initials
  const avatarUrl = (user as any)?.avatar || (user as any)?.profileImage || (user as any)?.image;

  // Fallback initials for avatar
  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.slice(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    closeDropdown();
    await logout();
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Profile Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleDropdown}
        className={`group flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/25 border ${
          isOpen 
            ? 'bg-primary/5 border-primary/20 shadow-xs ring-1 ring-primary/20' 
            : 'border-transparent hover:bg-muted/10 hover:border-border'
        }`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="User account menu"
      >
        {/* Avatar circle */}
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={user.name} 
            className="h-8 w-8 rounded-full object-cover border border-primary/20 flex-shrink-0 shadow-xs" 
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            {getInitials(user.name)}
          </div>
        )}

        {/* User first name display (desktop) */}
        <span className="hidden md:inline-block max-w-[120px] truncate font-medium text-foreground text-left leading-tight">
          {user.name.split(' ')[0]}
        </span>

        {/* Chevron */}
        <ChevronDown 
          className={`hidden sm:block h-3.5 w-3.5 text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : 'group-hover:text-foreground'
          }`} 
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-64 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-xl bg-card border border-border shadow-xl z-50 py-1.5 focus:outline-none animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* 1. User Info Header */}
          <div className="px-4 py-3 border-b border-border/70 bg-muted/5">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={user.name} 
                  className="h-10 w-10 rounded-full object-cover border border-primary/20 flex-shrink-0 shadow-xs" 
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
                  {getInitials(user.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/15">
                {user.role}
              </span>
              {user.isVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
            </div>
          </div>

          {/* 2. Primary Account Actions */}
          <div className="py-1">
            <Link
              href="/profile"
              onClick={closeDropdown}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
            >
              <UserIcon className="h-4 w-4 text-muted flex-shrink-0" />
              <span>Edit Profile</span>
            </Link>

            <Link
              href="/profile?tab=security"
              onClick={closeDropdown}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
            >
              <KeyRound className="h-4 w-4 text-muted flex-shrink-0" />
              <span>Change Password</span>
            </Link>
          </div>

          {/* 3. Role-Appropriate Shortcuts */}
          <div className="border-t border-border/70 py-1">
            {user.role === 'TENANT' && (
              <>
                <Link
                  href="/tenant"
                  onClick={closeDropdown}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>Tenant Dashboard</span>
                </Link>
                <Link
                  href="/rental-requests"
                  onClick={closeDropdown}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
                >
                  <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>My Requests</span>
                </Link>
                <Link
                  href="/favorites"
                  onClick={closeDropdown}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
                >
                  <Heart className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span>Saved Properties</span>
                </Link>
              </>
            )}

            {user.role === 'OWNER' && (
              <>
                <Link
                  href="/owner"
                  onClick={closeDropdown}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>Owner Dashboard</span>
                </Link>
                <Link
                  href="/owner/requests"
                  onClick={closeDropdown}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
                >
                  <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>Rental Requests</span>
                </Link>
                <Link
                  href="/owner/properties/new"
                  onClick={closeDropdown}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
                >
                  <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>List New Property</span>
                </Link>
              </>
            )}

            {user.role === 'ADMIN' && (
              <>
                <Link
                  href="/admin"
                  onClick={closeDropdown}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
                >
                  <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>Admin Center</span>
                </Link>
                <Link
                  href="/admin/reports"
                  onClick={closeDropdown}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
                >
                  <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span>Moderation Reports</span>
                </Link>
              </>
            )}

            <Link
              href="/reports"
              onClick={closeDropdown}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/15 transition-colors"
            >
              <ShieldAlert className="h-4 w-4 text-muted flex-shrink-0" />
              <span>My Reports</span>
            </Link>
          </div>

          {/* 4. Logout Action */}
          <div className="border-t border-border/70 pt-1 pb-0.5">
            <button
              type="button"
              onClick={handleLogout}
              role="menuitem"
              className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 transition-colors text-left"
            >
              <LogOut className="h-4 w-4 text-danger flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

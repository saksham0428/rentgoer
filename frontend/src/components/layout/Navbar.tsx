/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { 
  Menu, 
  X, 
  Heart, 
  ClipboardList, 
  Bell, 
  MessageSquare, 
  Search,
  User as UserIcon,
  KeyRound,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  LayoutDashboard,
  Plus
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useUnreadChatCount } from '@/hooks/useUnreadChatCount';
import { ProfileDropdown } from './ProfileDropdown';

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { unreadChatCount } = useUnreadChatCount();
  const pathname = usePathname();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  // Avatar initials helper for mobile drawer
  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.slice(0, 2).toUpperCase();
  };

  const avatarUrl = (user as any)?.avatar || (user as any)?.profileImage || (user as any)?.image;

  return (
    <nav className="bg-card/95 backdrop-blur-md border-b border-border sticky top-0 z-50 transition-shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 1. Left: Brand Logo & Primary Nav Links */}
          <div className="flex items-center gap-6 xl:gap-8">
            <Link 
              href="/" 
              className="flex-shrink-0 flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 rounded-lg p-0.5" 
              onClick={closeMenu}
              aria-label="RentGoer Home"
            >
              <span className="text-2xl font-black text-primary tracking-tight transition-transform duration-150 group-hover:scale-[1.02]">
                RentGoer
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1 xl:gap-2">
              <Link
                href="/properties"
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[0.98] ${
                  isActive('/properties')
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-foreground/80 hover:text-foreground hover:bg-muted/10'
                }`}
              >
                Properties
              </Link>

              {!loading && user && (
                <>
                  {user.role === 'TENANT' && (
                    <>
                      <Link
                        href="/tenant"
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[0.98] ${
                          isActive('/tenant')
                            ? 'text-primary bg-primary/10 font-semibold'
                            : 'text-foreground/80 hover:text-foreground hover:bg-muted/10'
                        }`}
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/rental-requests"
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[0.98] ${
                          isActive('/rental-requests')
                            ? 'text-primary bg-primary/10 font-semibold'
                            : 'text-foreground/80 hover:text-foreground hover:bg-muted/10'
                        }`}
                      >
                        <ClipboardList className="h-4 w-4" />
                        Requests
                      </Link>
                    </>
                  )}

                  {user.role === 'OWNER' && (
                    <>
                      <Link
                        href="/owner"
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[0.98] ${
                          isActive('/owner') && !pathname.startsWith('/owner/requests')
                            ? 'text-primary bg-primary/10 font-semibold'
                            : 'text-foreground/80 hover:text-foreground hover:bg-muted/10'
                        }`}
                      >
                        My Properties
                      </Link>
                      <Link
                        href="/owner/requests"
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[0.98] ${
                          isActive('/owner/requests')
                            ? 'text-primary bg-primary/10 font-semibold'
                            : 'text-foreground/80 hover:text-foreground hover:bg-muted/10'
                        }`}
                      >
                        <ClipboardList className="h-4 w-4" />
                        Requests
                      </Link>
                    </>
                  )}

                  {user.role === 'ADMIN' && (
                    <>
                      <Link
                        href="/admin"
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[0.98] ${
                          isActive('/admin') && !pathname.startsWith('/admin/reports')
                            ? 'text-primary bg-primary/10 font-semibold'
                            : 'text-foreground/80 hover:text-foreground hover:bg-muted/10'
                        }`}
                      >
                        Admin Center
                      </Link>
                      <Link
                        href="/admin/reports"
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[0.98] ${
                          isActive('/admin/reports')
                            ? 'text-amber-600 bg-amber-50 font-semibold'
                            : 'text-foreground/80 hover:text-amber-600 hover:bg-amber-50/50'
                        }`}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Moderation
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 2. Desktop Utility & Profile Controls - Far Right */}
          <div className="hidden lg:flex lg:items-center lg:space-x-2 xl:space-x-2.5">
            {/* Search Action */}
            <Link href="/properties">
              <Button
                variant="outline"
                size="sm"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border-border font-medium text-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
              >
                <Search className="h-4 w-4 text-muted" />
                <span>Search</span>
              </Button>
            </Link>

            {!loading && (
              <>
                {user ? (
                  <>
                    {/* Sole designated speech-bubble Messages icon beside Search */}
                    <Link
                      href="/chat"
                      className={`relative p-2 text-muted hover:text-primary transition-all duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 hover:bg-muted/10 active:scale-95 group ${
                        isActive('/chat') ? 'text-primary bg-primary/10' : ''
                      }`}
                      title="Messages"
                      aria-label="Messages"
                    >
                      <MessageSquare className="h-5 w-5 transition-transform duration-150 group-hover:scale-105" />
                      {unreadChatCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-primary text-white text-[10px] font-bold rounded-full shadow-xs animate-in zoom-in-75">
                          {unreadChatCount > 99 ? '99+' : unreadChatCount}
                        </span>
                      )}
                    </Link>

                    {/* Notification Bell beside Messages */}
                    <Link
                      href="/notifications"
                      className={`relative p-2 text-muted hover:text-primary transition-all duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 hover:bg-muted/10 active:scale-95 group ${
                        isActive('/notifications') ? 'text-primary bg-primary/10' : ''
                      }`}
                      title="Notifications"
                      aria-label="Notifications"
                    >
                      <Bell className="h-5 w-5 transition-transform duration-150 group-hover:scale-105" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-xs animate-in zoom-in-75">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>

                    {/* Moved Saved to utility icon area: Icon-only control for authenticated tenants */}
                    {user.role === 'TENANT' && (
                      <Link
                        href="/favorites"
                        className={`relative p-2 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 hover:bg-muted/10 active:scale-95 group ${
                          isActive('/favorites')
                            ? 'text-red-500 bg-red-50/90 ring-1 ring-red-200/60'
                            : 'text-muted hover:text-red-500'
                        }`}
                        title="Saved Properties"
                        aria-label="Saved Properties"
                      >
                        <Heart 
                          className={`h-5 w-5 transition-transform duration-150 group-hover:scale-105 ${
                            isActive('/favorites') ? 'fill-red-500 text-red-500' : ''
                          }`} 
                        />
                      </Link>
                    )}

                    {/* Profile Dropdown at the far right */}
                    <div className="pl-1">
                      <ProfileDropdown align="right" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center space-x-2 pl-2">
                    <Link href="/login">
                      <Button variant="ghost" size="sm" className="font-medium text-foreground hover:text-primary">
                        Log in
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm" className="font-semibold shadow-xs">
                        Sign up
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 3. Mobile & Tablet Controls - below lg */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 lg:hidden">
            {/* Search shortcut on mobile */}
            <Link
              href="/properties"
              onClick={closeMenu}
              className="p-1.5 sm:p-2 text-muted hover:text-primary transition-all duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-95"
              title="Search"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Link>

            {!loading && user && (
              <>
                {/* Sole designated speech-bubble Messages icon on mobile */}
                <Link
                  href="/chat"
                  onClick={closeMenu}
                  className="relative p-1.5 sm:p-2 text-muted hover:text-primary transition-all duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-95"
                  title="Messages"
                  aria-label="Messages"
                >
                  <MessageSquare className="h-5 w-5" />
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.125rem] h-4 px-1 bg-primary text-white text-[10px] font-bold rounded-full shadow-xs">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </Link>

                {/* Notifications icon */}
                <Link
                  href="/notifications"
                  onClick={closeMenu}
                  className="relative p-1.5 sm:p-2 text-muted hover:text-primary transition-all duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-95"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.125rem] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Saved Properties shortcut on mobile for tenants (screens >= 375px) */}
                {user.role === 'TENANT' && (
                  <Link
                    href="/favorites"
                    onClick={closeMenu}
                    className={`hidden xs:inline-flex p-1.5 sm:p-2 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-95 ${
                      isActive('/favorites') ? 'text-red-500 bg-red-50' : 'text-muted hover:text-red-500'
                    }`}
                    title="Saved Properties"
                    aria-label="Saved Properties"
                  >
                    <Heart className={`h-5 w-5 ${isActive('/favorites') ? 'fill-red-500 text-red-500' : ''}`} />
                  </Link>
                )}

                {/* Profile dropdown trigger for mobile & touch */}
                <div className="relative">
                  <ProfileDropdown align="right" />
                </div>
              </>
            )}

            {/* Mobile Hamburger menu toggle */}
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-lg text-muted hover:text-foreground hover:bg-muted/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 transition-all duration-150 active:scale-95"
              aria-label="Toggle navigation menu"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Toggle navigation menu</span>
              {isOpen ? <X className="block h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="block h-5 w-5 sm:h-6 sm:w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Mobile & Tablet Slide-down Navigation Drawer */}
      {isOpen && (
        <div className="lg:hidden border-t border-border bg-card shadow-xl animate-in fade-in slide-in-from-top-1 duration-150 max-h-[calc(100vh-4.5rem)] overflow-y-auto">
          {!loading && user ? (
            <div className="p-4 space-y-4">
              {/* User Account Card */}
              <div className="p-3.5 rounded-xl bg-muted/10 border border-border flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={user.name} 
                      className="h-10 w-10 rounded-full object-cover border border-primary/20 flex-shrink-0" 
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {getInitials(user.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    {user.role}
                  </span>
                  {user.isVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Profile Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/profile"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted/15 transition-all duration-150 active:scale-[0.98] text-foreground"
                >
                  <UserIcon className="h-4 w-4 text-muted" />
                  <span>Edit Profile</span>
                </Link>
                <Link
                  href="/profile?tab=security"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted/15 transition-all duration-150 active:scale-[0.98] text-foreground"
                >
                  <KeyRound className="h-4 w-4 text-muted" />
                  <span>Password</span>
                </Link>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1 pt-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  Navigation
                </p>

                <Link
                  href="/properties"
                  onClick={closeMenu}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                    isActive('/properties')
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground hover:bg-muted/10'
                  }`}
                >
                  Properties
                </Link>

                {user.role === 'TENANT' && (
                  <>
                    <Link
                      href="/tenant"
                      onClick={closeMenu}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                        isActive('/tenant')
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-foreground hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                        <span>Tenant Dashboard</span>
                      </div>
                    </Link>
                    <Link
                      href="/rental-requests"
                      onClick={closeMenu}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                        isActive('/rental-requests')
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-foreground hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <span>My Rental Requests</span>
                      </div>
                    </Link>
                    <Link
                      href="/favorites"
                      onClick={closeMenu}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                        isActive('/favorites')
                          ? 'bg-red-50 text-red-600 font-semibold'
                          : 'text-foreground hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span>Saved Properties</span>
                      </div>
                    </Link>
                  </>
                )}

                {user.role === 'OWNER' && (
                  <>
                    <Link
                      href="/owner"
                      onClick={closeMenu}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                        isActive('/owner') && !pathname.startsWith('/owner/requests')
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-foreground hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                        <span>My Properties</span>
                      </div>
                    </Link>
                    <Link
                      href="/owner/requests"
                      onClick={closeMenu}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                        isActive('/owner/requests')
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-foreground hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <span>Rental Requests</span>
                      </div>
                    </Link>
                    <Link
                      href="/owner/properties/new"
                      onClick={closeMenu}
                      className="block px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/10 transition-all duration-150"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-primary" />
                        <span>List New Property</span>
                      </div>
                    </Link>
                  </>
                )}

                {user.role === 'ADMIN' && (
                  <>
                    <Link
                      href="/admin"
                      onClick={closeMenu}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                        isActive('/admin')
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-foreground hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Admin Center</span>
                      </div>
                    </Link>
                    <Link
                      href="/admin/reports"
                      onClick={closeMenu}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                        isActive('/admin/reports')
                          ? 'bg-amber-50 text-amber-600 font-semibold'
                          : 'text-foreground hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                        <span>Moderation Reports</span>
                      </div>
                    </Link>
                  </>
                )}

                <Link
                  href="/reports"
                  onClick={closeMenu}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/10 transition-all duration-150"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-muted" />
                    <span>My Reports</span>
                  </div>
                </Link>
              </div>

              {/* Sign Out Action */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-all duration-150 active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4 text-danger" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <Link
                href="/properties"
                onClick={closeMenu}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/10 transition-all duration-150"
              >
                Properties
              </Link>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <Link href="/login" onClick={closeMenu}>
                  <Button variant="outline" className="w-full">
                    Log in
                  </Button>
                </Link>
                <Link href="/register" onClick={closeMenu}>
                  <Button className="w-full">
                    Sign up
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

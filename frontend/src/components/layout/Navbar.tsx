'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Menu, X, User as UserIcon, Heart, ClipboardList, Bell, MessageSquare, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useUnreadChatCount } from '@/hooks/useUnreadChatCount';

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { unreadChatCount } = useUnreadChatCount();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center" onClick={closeMenu}>
              <span className="text-2xl font-bold text-primary tracking-tight">RentGoer</span>
            </Link>
          </div>
          
          {/* Desktop Nav - lg and above */}
          <div className="hidden lg:flex lg:items-center lg:space-x-4">
            <Link 
              href="/properties" 
              className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Browse Properties
            </Link>
            
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-2 xl:space-x-3 ml-2 pl-3 border-l border-border">
                    {user.role === 'OWNER' && (
                      <div className="flex items-center space-x-1.5">
                        <Link href="/owner">
                          <Button variant="ghost" size="sm" className="text-muted hover:text-primary hover:bg-primary/5">
                            Properties
                          </Button>
                        </Link>
                        <Link href="/owner/requests">
                          <Button variant="ghost" size="sm" className="text-muted hover:text-primary hover:bg-primary/5">
                            <ClipboardList className="h-4 w-4 mr-1.5" />
                            Requests
                          </Button>
                        </Link>
                      </div>
                    )}
                    {user.role === 'TENANT' && (
                      <div className="flex items-center space-x-1.5">
                        <Link href="/tenant">
                          <Button variant="ghost" size="sm" className="text-muted hover:text-primary hover:bg-primary/5">
                            Dashboard
                          </Button>
                        </Link>
                        <Link href="/rental-requests">
                          <Button variant="ghost" size="sm" className="text-muted hover:text-primary hover:bg-primary/5">
                            <ClipboardList className="h-4 w-4 mr-1.5" />
                            Requests
                          </Button>
                        </Link>
                        <Link href="/favorites">
                          <Button variant="ghost" size="sm" className="text-muted hover:text-red-500 hover:bg-red-50">
                            <Heart className="h-4 w-4 mr-1.5" />
                            Saved
                          </Button>
                        </Link>
                        <Link href="/properties">
                          <Button variant="outline" size="sm">Search</Button>
                        </Link>
                      </div>
                    )}

                    {/* Sole retained general-purpose Messages entry point: beside Search and before Bell */}
                    <Link
                      href="/chat"
                      className="relative group p-2 text-muted hover:text-primary transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Messages"
                      aria-label="Messages"
                    >
                      <MessageSquare className="h-5 w-5" />
                      {unreadChatCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-primary text-white text-[10px] font-bold rounded-full">
                          {unreadChatCount > 99 ? '99+' : unreadChatCount}
                        </span>
                      )}
                    </Link>

                    {/* Notification Bell */}
                    <Link
                      href="/notifications"
                      className="relative group p-2 text-muted hover:text-primary transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Notifications"
                      aria-label="Notifications"
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>

                    <div className="flex items-center text-sm font-medium text-muted ml-1 max-w-[140px] truncate" title={user.name}>
                      <UserIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                      <span className="truncate">{user.name}</span>
                    </div>

                    <Link href="/reports">
                      <Button variant="ghost" size="sm" className="text-muted hover:text-foreground">Reports</Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={logout}>
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-border">
                    <Link href="/login">
                      <Button variant="ghost" size="sm">Log in</Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm">Sign up</Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile & Tablet controls - below lg */}
          <div className="flex items-center space-x-1 lg:hidden">
            {!loading && user && (
              <>
                {/* Sole retained Messages icon accessible on mobile & tablet */}
                <Link
                  href="/chat"
                  onClick={closeMenu}
                  className="relative p-2 text-muted hover:text-primary transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  title="Messages"
                  aria-label="Messages"
                >
                  <MessageSquare className="h-5 w-5" />
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.125rem] h-4 px-1 bg-primary text-white text-[10px] font-bold rounded-full">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </Link>

                {/* Notifications icon */}
                <Link
                  href="/notifications"
                  onClick={closeMenu}
                  className="relative p-2 text-muted hover:text-primary transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.125rem] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </>
            )}

            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-muted hover:text-foreground hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-colors"
              aria-label="Toggle navigation menu"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X className="block h-6 w-6" aria-hidden="true" /> : <Menu className="block h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Dropdown Navigation */}
      {isOpen && (
        <div className="lg:hidden border-t border-border bg-card shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="pt-2 pb-3 space-y-1">
            <Link 
              href="/properties" 
              onClick={closeMenu}
              className="block px-4 py-2 text-base font-medium text-foreground hover:bg-muted/10 hover:text-primary"
            >
              Browse Properties
            </Link>
          </div>
          
          {!loading && (
            <div className="pt-3 pb-3 border-t border-border">
              {user ? (
                <>
                  <div className="px-4 flex items-center justify-between mb-4">
                    <div className="flex items-center min-w-0 mr-2">
                      <UserIcon className="h-5 w-5 mr-3 text-muted flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-foreground truncate">{user.name}</div>
                        <div className="text-xs text-muted truncate">{user.email}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {user.role === 'OWNER' && (
                      <>
                        <Link 
                          href="/owner" 
                          onClick={closeMenu}
                          className="block px-4 py-2.5 text-base font-medium text-foreground hover:bg-muted/10"
                        >
                          My Properties
                        </Link>
                        <Link 
                          href="/owner/requests" 
                          onClick={closeMenu}
                          className="block px-4 py-2.5 text-base font-medium text-foreground hover:bg-muted/10"
                        >
                          <div className="flex items-center">
                            <ClipboardList className="h-4 w-4 mr-2.5 text-primary" />
                            Rental Requests
                          </div>
                        </Link>
                      </>
                    )}
                    {user.role === 'TENANT' && (
                      <>
                        <Link 
                          href="/tenant" 
                          onClick={closeMenu}
                          className="block px-4 py-2.5 text-base font-medium text-foreground hover:bg-muted/10"
                        >
                          Tenant Dashboard
                        </Link>
                        <Link 
                          href="/rental-requests" 
                          onClick={closeMenu}
                          className="block px-4 py-2.5 text-base font-medium text-foreground hover:bg-muted/10"
                        >
                          <div className="flex items-center">
                            <ClipboardList className="h-4 w-4 mr-2.5 text-primary" />
                            My Requests
                          </div>
                        </Link>
                        <Link 
                          href="/favorites" 
                          onClick={closeMenu}
                          className="block px-4 py-2.5 text-base font-medium text-foreground hover:bg-muted/10"
                        >
                          <div className="flex items-center">
                            <Heart className="h-4 w-4 mr-2.5 text-red-500" />
                            Saved Properties
                          </div>
                        </Link>
                      </>
                    )}

                    <Link 
                      href="/reports" 
                      onClick={closeMenu}
                      className="block px-4 py-2.5 text-base font-medium text-foreground hover:bg-muted/10"
                    >
                      <div className="flex items-center">
                        <ShieldAlert className="h-4 w-4 mr-2.5 text-muted" />
                        Reports
                      </div>
                    </Link>

                    <button 
                      onClick={() => {
                        closeMenu();
                        logout();
                      }}
                      className="block w-full text-left px-4 py-2.5 text-base font-medium text-danger hover:bg-muted/10"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2 px-4 py-2 flex flex-col">
                  <Link href="/login" onClick={closeMenu}>
                    <Button variant="outline" className="w-full">Log in</Button>
                  </Link>
                  <Link href="/register" onClick={closeMenu}>
                    <Button className="w-full">Sign up</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

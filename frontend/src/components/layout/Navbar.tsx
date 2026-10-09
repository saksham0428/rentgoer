'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Menu, X, User as UserIcon, Heart, ClipboardList, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-primary tracking-tight">RentGoer</span>
            </Link>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            <Link href="/properties" className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
              Browse Properties
            </Link>
            
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-border">
                    {user.role === 'OWNER' && (
                      <div className="flex space-x-2">
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
                      <div className="flex space-x-2">
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
                    <Link href="/notifications" className="relative group p-2 text-muted hover:text-primary transition-colors">
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>
                    <div className="flex items-center text-sm font-medium text-muted ml-2">
                      <UserIcon className="h-4 w-4 mr-2" />
                      {user.name}
                    </div>
                    <Link href="/reports"><Button variant="ghost" size="sm" className="text-muted hover:text-foreground">Reports</Button></Link>
                      <Button variant="ghost" size="sm" onClick={logout}>
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-border">
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

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-muted hover:text-foreground hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-colors"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X className="block h-6 w-6" aria-hidden="true" /> : <Menu className="block h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="sm:hidden border-t border-border bg-card">
          <div className="pt-2 pb-3 space-y-1">
            <Link href="/properties" className="block px-4 py-2 text-base font-medium text-foreground hover:bg-muted/10 hover:text-primary">
              Browse Properties
            </Link>
          </div>
          
          {!loading && (
            <div className="pt-4 pb-3 border-t border-border">
              {user ? (
                <>
                  <div className="px-4 flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <UserIcon className="h-5 w-5 mr-3 text-muted" />
                      <div>
                        <div className="text-base font-medium text-foreground">{user.name}</div>
                        <div className="text-sm font-medium text-muted">{user.email}</div>
                      </div>
                    </div>
                    <Link href="/notifications" className="relative p-2 text-muted hover:text-primary">
                      <Bell className="h-6 w-6" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border border-card">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  </div>
                  <div className="space-y-1">
                    {user.role === 'OWNER' && (
                      <>
                        <Link href="/owner" className="block px-4 py-2 text-base font-medium text-foreground hover:bg-muted/10">
                          My Properties
                        </Link>
                        <Link href="/owner/requests" className="block px-4 py-2 text-base font-medium text-foreground hover:bg-muted/10">
                          <div className="flex items-center">
                            <ClipboardList className="h-4 w-4 mr-2 text-primary" />
                            Rental Requests
                          </div>
                        </Link>
                      </>
                    )}
                    {user.role === 'TENANT' && (
                      <>
                        <Link href="/tenant" className="block px-4 py-2 text-base font-medium text-foreground hover:bg-muted/10">
                          Tenant Dashboard
                        </Link>
                        <Link href="/rental-requests" className="block px-4 py-2 text-base font-medium text-foreground hover:bg-muted/10">
                          <div className="flex items-center">
                            <ClipboardList className="h-4 w-4 mr-2 text-primary" />
                            My Requests
                          </div>
                        </Link>
                        <Link href="/favorites" className="block px-4 py-2 text-base font-medium text-foreground hover:bg-muted/10">
                          <div className="flex items-center">
                            <Heart className="h-4 w-4 mr-2 text-red-500" />
                            Saved Properties
                          </div>
                        </Link>
                      </>
                    )}
                    <button 
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-base font-medium text-danger hover:bg-muted/10"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-1 px-4 flex flex-col gap-2">
                  <Link href="/login">
                    <Button variant="outline" fullWidth>Log in</Button>
                  </Link>
                  <Link href="/register">
                    <Button fullWidth>Sign up</Button>
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

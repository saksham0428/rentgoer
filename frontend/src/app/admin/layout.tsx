'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Home,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Loader2,
  ArrowRight,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=' + encodeURIComponent(pathname || '/admin'));
    }
  }, [user, authLoading, router, pathname]);

  // Loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Unauthenticated user is redirecting to login
  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Authenticated Non-Admin User: Display clear 403 Forbidden Access Denied state
  if (user.role !== 'ADMIN') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm text-center">
          <div className="h-14 w-14 rounded-full bg-danger/10 text-danger border border-danger/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-danger/10 text-danger border border-danger/20 mb-3">
            403 Forbidden
          </span>

          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Administrator Access Required
          </h2>

          <p className="text-sm text-muted mt-2">
            You are signed in as <span className="font-semibold text-foreground">{user.email}</span> with the <span className="font-semibold text-foreground">{user.role}</span> role. Access to the RentGoer Admin Portal is strictly restricted to platform administrators.
          </p>

          <div className="mt-6 pt-6 border-t border-border flex flex-col gap-2.5">
            {user.role === 'TENANT' && (
              <Link href="/tenant" className="w-full">
                <Button className="w-full font-medium">
                  Go to Tenant Dashboard
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            )}

            {user.role === 'OWNER' && (
              <Link href="/owner" className="w-full">
                <Button className="w-full font-medium">
                  Go to Owner Dashboard
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            )}

            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full font-medium">
                Return to Home
              </Button>
            </Link>

            <button
              onClick={() => logout()}
              className="text-xs text-danger hover:underline mt-2 inline-flex items-center justify-center gap-1 font-medium"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out of this account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Properties', href: '/admin/properties', icon: Home },
    { name: 'Reports', href: '/admin/reports', icon: AlertTriangle },
    { name: 'Verification', href: '/admin/verification', icon: ShieldCheck },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-background w-full relative">
      {/* Mobile sidebar toggle */}
      <div className="md:hidden absolute top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-card rounded-lg shadow-xs border border-border text-foreground hover:bg-muted/10 transition-colors"
          aria-label="Toggle admin menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        fixed md:sticky top-16 md:top-0 h-[calc(100vh-4rem)] md:h-auto
        w-64 bg-card border-r border-border shadow-xs flex flex-col transition-transform duration-200 z-40
      `}>
        <div className="p-6 pb-4 border-b border-border/70">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Admin Center
          </h2>
          <p className="text-xs text-muted mt-1 truncate">Logged in as {user.name}</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98]
                  ${isActive
                    ? 'bg-primary text-white shadow-xs font-semibold'
                    : 'text-foreground/80 hover:bg-muted/10 hover:text-foreground'
                  }
                `}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-muted'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        {children}
      </main>
    </div>
  );
}

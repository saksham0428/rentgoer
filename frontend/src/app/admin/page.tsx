'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Loader2, Users, Home, ShieldCheck, AlertTriangle, ArrowRight, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get<{ success: boolean; data: any }>('/admin/stats');
        setStats(res.data);
      } catch (err: any) {
        console.error('Failed to load admin stats:', err);
        setError('Failed to load platform statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-danger">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-80" />
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className="bg-white border border-border rounded-xl p-6 shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-semibold text-muted uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold text-foreground mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {subtitle && <p className="text-sm text-muted mt-auto">{subtitle}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Platform Overview</h1>
        <p className="text-muted mt-2">At-a-glance metrics for the RentGoer marketplace.</p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Users" 
          value={stats.users.total} 
          icon={Users} 
          color="bg-blue-100 text-blue-700" 
          subtitle={`${stats.users.tenants} Tenants • ${stats.users.owners} Owners`}
        />
        <StatCard 
          title="Total Properties" 
          value={stats.properties.total} 
          icon={Home} 
          color="bg-green-100 text-green-700" 
          subtitle={`${stats.properties.verified} properties verified`}
        />
        <StatCard 
          title="Open Reports" 
          value={stats.reports.open} 
          icon={AlertTriangle} 
          color={stats.reports.open > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'} 
          subtitle="Requires moderation"
        />
        <StatCard 
          title="Pending Verification" 
          value={stats.verification.pending} 
          icon={ShieldCheck} 
          color={stats.verification.pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'} 
          subtitle="Waiting for review"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Verification Requests */}
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-gray-50/50">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Recent Verification Requests
            </h2>
            <Link href="/admin/verification" className="text-sm font-medium text-primary hover:underline flex items-center">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="divide-y divide-border flex-1">
            {stats.verification.recent.length === 0 ? (
              <div className="p-8 text-center text-muted">No recent verification requests.</div>
            ) : (
              stats.verification.recent.map((req: any) => (
                <div key={req.id} className="p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                        req.type === 'OWNER' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
                      }`}>
                        {req.type}
                      </span>
                      <span className="font-semibold text-foreground text-sm">
                        {req.type === 'OWNER' ? req.owner.name : req.property?.title || 'Unknown Property'}
                      </span>
                    </div>
                    <span className="text-xs text-muted">
                      {formatDistanceToNow(new Date(req.submittedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-2">
                    Submitted by: {req.owner.email}
                  </p>
                  <div className="mt-3">
                    <Link href={`/admin/verification/${req.id}`}>
                      <button className="text-xs font-medium text-primary hover:underline">
                        Review Request
                      </button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-gray-50/50">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger" />
              Recent Reports
            </h2>
            <Link href="/admin/reports" className="text-sm font-medium text-primary hover:underline flex items-center">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="divide-y divide-border flex-1">
            {stats.reports.recent.length === 0 ? (
              <div className="p-8 text-center text-muted">No recent reports.</div>
            ) : (
              stats.reports.recent.map((report: any) => (
                <div key={report.id} className="p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                        report.status === 'OPEN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {report.status}
                      </span>
                      <span className="font-semibold text-foreground text-sm capitalize">
                        {report.targetType.toLowerCase()} Report
                      </span>
                    </div>
                    <span className="text-xs text-muted">
                      {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-2">
                    {report.reason.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-muted line-clamp-1 mt-1">
                    Reported by: {report.reporter?.name || 'Unknown User'}
                  </p>
                  <div className="mt-3">
                    <Link href={`/admin/reports/${report.id}`}>
                      <button className="text-xs font-medium text-primary hover:underline">
                        View Details
                      </button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

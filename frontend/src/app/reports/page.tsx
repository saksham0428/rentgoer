/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/reports');
    }
  }, [authLoading, user, router]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get<{ data: Report[] }>('/reports/me');
      setReports(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">OPEN</span>;
      case 'REVIEWING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">REVIEWING</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/10 text-success">RESOLVED</span>;
      case 'DISMISSED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground">DISMISSED</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground">{status}</span>;
    }
  };

  const formatTarget = (targetType: string) => {
    return targetType.charAt(0) + targetType.slice(1).toLowerCase();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-grow flex flex-col">
      <div className="mb-8 border-b border-border pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-danger" />
            My Reports
          </h1>
          <p className="text-muted mt-2">Track the status of the issues you have reported.</p>
        </div>
        <button 
          onClick={fetchReports}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors bg-muted/10 rounded-md border border-border/50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="text-center py-16 bg-danger/5 rounded-xl border border-danger/20 border-dashed my-auto">
          <h3 className="text-lg font-medium text-danger">Unable to load reports</h3>
          <p className="mt-1 text-danger/80">{error}</p>
          <button 
            onClick={fetchReports}
            className="mt-4 px-4 py-2 bg-danger text-white rounded-md hover:bg-danger/90 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      ) : loading && reports.length === 0 ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed my-auto flex flex-col items-center justify-center">
          <ShieldAlert className="h-16 w-16 text-muted/30 mb-4" />
          <h3 className="text-xl font-bold text-foreground">No reports found</h3>
          <p className="mt-2 text-muted mb-8 max-w-md mx-auto">
            You haven&apos;t submitted any reports yet. Thank you for helping keep RentGoer safe!
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <ul className="divide-y divide-border">
            {reports.map((report) => (
              <li key={report.id} className="p-5 hover:bg-muted/5 transition-colors">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                  
                  {/* Left Side: Type & Reason */}
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-muted border border-border uppercase">
                        {formatTarget(report.targetType)}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {report.reason.replace(/_/g, ' ')}
                      </span>
                      {getStatusBadge(report.status)}
                    </div>
                    
                    <p className="text-muted text-sm line-clamp-2 mt-2 break-words">
                      {report.description}
                    </p>
                    
                    {report.targetType === 'PROPERTY' && (
                      <Link 
                        href={`/properties/${report.targetId}`}
                        className="inline-flex items-center text-xs text-primary hover:underline mt-3"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Property
                      </Link>
                    )}
                  </div>

                  {/* Right Side: Meta */}
                  <div className="flex-shrink-0 md:text-right flex flex-row md:flex-col justify-between items-center md:items-end">
                    <div className="text-xs text-muted">
                      Reported on<br className="hidden md:block" />
                      <span className="font-medium text-foreground ml-1 md:ml-0">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

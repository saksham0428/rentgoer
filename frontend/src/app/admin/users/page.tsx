'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Loader2, Search, Filter, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [isVerified, setIsVerified] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      if (search) query.append('search', search);
      if (role !== 'ALL') query.append('role', role);
      if (isVerified !== 'ALL') query.append('isVerified', isVerified === 'VERIFIED' ? 'true' : 'false');

      const res = await api.get<{ success: boolean; data: any[]; pagination: any }>(`/admin/users?${query.toString()}`);
      setUsers(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]); // Search and filters are applied via explicit button click or form submit, except page

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Users Management</h1>
        <p className="text-muted mt-2">View and manage all registered users on the platform.</p>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
        {/* Filters */}
        <div className="p-5 border-b border-border bg-gray-50/50">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:max-w-xs">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder="Name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>
            
            <div className="w-full sm:w-40">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Roles</option>
                <option value="TENANT">Tenant</option>
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="w-full sm:w-48">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Verification</label>
              <select
                value={isVerified}
                onChange={(e) => setIsVerified(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="ALL">All Status</option>
                <option value="VERIFIED">Verified</option>
                <option value="UNVERIFIED">Unverified</option>
              </select>
            </div>

            <Button type="submit" className="w-full sm:w-auto h-9">
              Apply Filters
            </Button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading && users.length === 0 ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-danger font-medium">{error}</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-muted">No users found matching the criteria.</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Verification</th>
                  <th className="px-6 py-4">Registered</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold mr-3 flex-shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{user.name}</p>
                          <p className="text-xs text-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'OWNER' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.isVerified ? (
                        <span className="inline-flex items-center text-xs font-medium text-success">
                          <ShieldCheck className="w-4 h-4 mr-1" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-muted">
                          <ShieldX className="w-4 h-4 mr-1 opacity-50" /> Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-gray-50/50 mt-auto">
            <span className="text-sm text-muted">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || loading}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.totalPages || loading}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { ReportModal } from './ReportModal';
import { useAuth } from '../../context/AuthContext';

export const ReportUserButton = ({ userId }: { userId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user || user.id === userId) {
    return null;
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger transition-colors"
        title="Report user"
      >
        <Flag className="h-3 w-3" />
        <span className="sr-only sm:not-sr-only">Report</span>
      </button>

      {isOpen && (
        <ReportModal 
          targetType="USER" 
          targetId={userId} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  );
};

"use client";

import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { ReportModal } from './ReportModal';
import { useAuth } from '../../context/AuthContext';

export const ReportMessageButton = ({ messageId, senderId }: { messageId: string, senderId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user || user.id === senderId) {
    return null; // Don't show report button on own messages
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-danger rounded-full hover:bg-muted/30"
        title="Report message"
      >
        <Flag className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <ReportModal 
          targetType="MESSAGE" 
          targetId={messageId} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  );
};

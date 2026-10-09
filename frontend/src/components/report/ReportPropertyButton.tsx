"use client";

import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { ReportModal } from './ReportModal';
import { useAuth } from '../../context/AuthContext';

export const ReportPropertyButton = ({ propertyId, ownerId }: { propertyId: string, ownerId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user || user.id === ownerId) {
    return null; // Don't show report button to guests or the owner of the property
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger transition-colors mt-4"
      >
        <Flag className="h-3.5 w-3.5" />
        Report this property
      </button>

      {isOpen && (
        <ReportModal 
          targetType="PROPERTY" 
          targetId={propertyId} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  );
};

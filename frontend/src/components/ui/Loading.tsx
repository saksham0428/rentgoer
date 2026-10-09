import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  fullScreen?: boolean;
  message?: string;
}

export const Loading = ({ fullScreen = false, message = 'Loading...' }: LoadingProps) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 text-muted">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return <div className="w-full flex justify-center py-12">{content}</div>;
};

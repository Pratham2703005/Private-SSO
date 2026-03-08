'use client';

import { ReactNode } from 'react';

interface AuthCardProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

export function AuthCard({ children, maxWidth = 'lg' }: AuthCardProps) {
  const widthClass = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-5xl',
  }[maxWidth];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8
      bg-(--bg) transition-colors duration-300">
      <div className={`w-full ${widthClass} animate-fade-in`}>
        <div className="rounded-3xl border border-(--border)
          bg-(--card) p-8 sm:p-12 shadow-sm
          transition-colors duration-300">
          {children}
        </div>
      </div>
    </div>
  );
}

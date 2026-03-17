'use client';

import { createContext } from 'react';
import type { SSOContextValue } from '../../shared/types';

/**
 * SSOContext - Single source of truth for authentication state
 * Contains session, loading, error, and all auth methods
 */
export const SSOContext = createContext<SSOContextValue | undefined>(undefined);

SSOContext.displayName = 'SSOContext';

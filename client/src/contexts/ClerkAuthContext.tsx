import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role?: string;
}

interface ClerkAuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: () => void;
  signUp: () => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const ClerkAuthContext = createContext<ClerkAuthContextType | undefined>(undefined);

export function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { openSignIn, openSignUp, signOut: clerkSignOut } = useClerk();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      // Get the session token from Clerk
      const token = await clerkUser?.getToken?.();
      console.log('Clerk token exists:', !!token);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
        headers,
      });
      
      console.log('Auth response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('User data received:', !!data.user);
        setUser(data.user);
      } else {
        console.log('Auth response not ok');
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      if (clerkUser) {
        fetchUser();
      } else {
        setUser(null);
        setIsLoading(false);
      }
    }
  }, [clerkUser, isLoaded]);

  const signIn = () => {
    openSignIn();
  };

  const signUp = () => {
    openSignUp();
  };

  const signOut = async () => {
    await clerkSignOut();
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const value: ClerkAuthContextType = {
    user,
    isLoading: isLoading || !isLoaded,
    isAuthenticated: !!clerkUser && !!user,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return (
    <ClerkAuthContext.Provider value={value}>
      {children}
    </ClerkAuthContext.Provider>
  );
}

export function useClerkAuth() {
  const context = useContext(ClerkAuthContext);
  if (context === undefined) {
    throw new Error('useClerkAuth must be used within a ClerkAuthProvider');
  }
  return context;
}

// Hook for checking admin status
export function useIsAdmin() {
  const { user } = useClerkAuth();
  return user?.role === 'admin';
}
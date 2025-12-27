import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isInitialized: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Ref para prevenir procesamiento de eventos duplicados
  const lastEventRef = useRef<{ event: string; userId: string | null; timestamp: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        // Marcar la sesión inicial como procesada ANTES de registrar el listener
        if (initialSession?.user) {
          lastEventRef.current = { 
            event: 'INITIAL_SESSION', 
            userId: initialSession.user.id, 
            timestamp: Date.now() 
          };
          console.log('[AuthContext] Sesión inicial cargada:', initialSession.user.email);
        }
        
        setLoading(false);
        setIsInitialized(true);

        // AHORA registrar el listener (después de procesar la sesión inicial)
        const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (!mounted) return;

          const userId = newSession?.user?.id || null;
          const now = Date.now();

          // Ignorar INITIAL_SESSION completamente (ya lo procesamos arriba)
          if (event === 'INITIAL_SESSION') {
            return;
          }

          // Prevenir eventos duplicados (mismo evento, mismo usuario, dentro de 3 segundos)
          if (
            lastEventRef.current &&
            lastEventRef.current.event === event &&
            lastEventRef.current.userId === userId &&
            now - lastEventRef.current.timestamp < 3000
          ) {
            return;
          }

          lastEventRef.current = { event, userId, timestamp: now };
          console.log('[AuthContext] Auth state changed:', event, newSession?.user?.email);

          setSession(newSession);
          setUser(newSession?.user ?? null);
        });
        
        subscription = data.subscription;
        
      } catch (error) {
        console.error('[AuthContext] Error obteniendo sesión inicial:', error);
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setLoading(false);
  };

  const value = {
    session,
    user,
    loading,
    isInitialized,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

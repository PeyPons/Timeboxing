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

    // 1. Obtener sesión inicial
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setLoading(false);
          setIsInitialized(true);
          
          // Marcar como procesado para evitar duplicados del listener
          if (initialSession?.user) {
            lastEventRef.current = { 
              event: 'INITIAL_SESSION', 
              userId: initialSession.user.id, 
              timestamp: Date.now() 
            };
          }
        }
      } catch (error) {
        console.error('[AuthContext] Error obteniendo sesión inicial:', error);
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    // 2. Listener ÚNICO para cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      const userId = newSession?.user?.id || null;
      const now = Date.now();

      // Ignorar INITIAL_SESSION si ya procesamos la sesión inicial
      if (event === 'INITIAL_SESSION' && lastEventRef.current?.event === 'INITIAL_SESSION') {
        console.log('[AuthContext] Ignorando INITIAL_SESSION duplicado');
        return;
      }

      // Prevenir procesamiento de eventos duplicados (mismo evento, mismo usuario, dentro de 3 segundos)
      if (
        lastEventRef.current &&
        lastEventRef.current.event === event &&
        lastEventRef.current.userId === userId &&
        now - lastEventRef.current.timestamp < 3000
      ) {
        console.log('[AuthContext] Ignorando evento duplicado:', event);
        return;
      }

      lastEventRef.current = { event, userId, timestamp: now };
      console.log('[AuthContext] Auth state changed:', event, newSession?.user?.email);

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      setIsInitialized(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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

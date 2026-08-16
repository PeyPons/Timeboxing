import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAgency } from '@/contexts/AgencyContext';

export interface Notification {
  id: string;
  type: 'assignment' | 'deadline' | 'budget' | 'weekly' | 'info' | 'ads';
  title: string;
  message: string;
  date: Date;
  read: boolean;
  link?: string;
  /** Proyecto a resaltar (p. ej. presupuesto); permite reparar enlaces antiguos sin query en `link`. */
  projectId?: string;
}

const MAX_INBOX = 50;

function inboxStorageKey(agencyId: string, userId: string): string {
  return `tb_inbox_${agencyId}_${userId}`;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  /** Avisos del motor de reglas; se muestran en la campanita y persisten en localStorage. */
  pushSystemNotification: (n: Omit<Notification, 'id' | 'date' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Centro de notificaciones (campanita). Historial local de avisos automáticos + futuras fuentes.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useApp();
  const { currentAgency } = useAgency();
  const storageKey =
    currentUser?.id && currentAgency?.id ? inboxStorageKey(currentAgency.id, currentUser.id) : null;

  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!storageKey) {
      setNotifications([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setNotifications(
            parsed.map((n: Record<string, unknown>) => ({
              ...n,
              date: new Date(String(n.date)),
            })) as Notification[]
          );
          return;
        }
      }
      const legacy = localStorage.getItem('notifications');
      if (legacy) {
        const parsed = JSON.parse(legacy) as unknown;
        if (Array.isArray(parsed)) {
          const migrated = parsed.map((n: Record<string, unknown>) => ({
            ...n,
            date: new Date(String(n.date)),
          })) as Notification[];
          setNotifications(migrated.slice(0, MAX_INBOX));
          localStorage.removeItem('notifications');
        }
      }
    } catch (e) {
      console.error('Error cargando bandeja de notificaciones', e);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch (e) {
      console.error('Error guardando bandeja de notificaciones', e);
    }
  }, [notifications, storageKey]);

  const pushSystemNotification = useCallback((n: Omit<Notification, 'id' | 'date' | 'read'>) => {
    setNotifications((prev) => {
      const newItem: Notification = {
        ...n,
        id: crypto.randomUUID(),
        date: new Date(),
        read: false,
      };
      return [newItem, ...prev].slice(0, MAX_INBOX);
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        pushSystemNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

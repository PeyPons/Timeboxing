import { memo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OptimizedCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

/**
 * Componente Card optimizado con React.memo
 * Útil para evitar re-renders innecesarios
 */
export const OptimizedCard = memo(function OptimizedCard({
  title,
  children,
  className,
  headerClassName,
  contentClassName,
}: OptimizedCardProps) {
  return (
    <Card className={cn(className)}>
      {title && (
        <CardHeader className={cn(headerClassName)}>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
});


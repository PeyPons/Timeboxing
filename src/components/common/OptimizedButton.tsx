import { memo, ReactNode } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OptimizedButtonProps extends ButtonProps {
  children: ReactNode;
  loading?: boolean;
}

/**
 * Componente Button optimizado con React.memo
 * Evita re-renders cuando las props no cambian
 */
export const OptimizedButton = memo(function OptimizedButton({
  children,
  loading,
  disabled,
  className,
  ...props
}: OptimizedButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      className={cn(className)}
    >
      {loading ? (
        <>
          <span className="animate-spin mr-2">⏳</span>
          {children}
        </>
      ) : (
        children
      )}
    </Button>
  );
});


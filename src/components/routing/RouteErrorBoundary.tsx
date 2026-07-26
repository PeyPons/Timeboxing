import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { isChunkLoadError, reloadOnceForNewDeploy } from "@/lib/chunkReload";

interface RouteErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface RouteErrorBoundaryState {
  error: Error | null;
  /** true mientras window.location.reload está en curso por chunk obsoleto. */
  autoReloading: boolean;
}

function RouteErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useAppTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8 max-w-md">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('routeError.title')}</h2>
        <p className="text-slate-600 mb-4 text-sm">{error.message}</p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Button onClick={onRetry} className="bg-primary hover:bg-primary/90">
            {t('routeError.retry')}
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t('routeError.reload')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Captura fallos de lazy import / render en rutas protegidas. */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null, autoReloading: false };

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return { error };
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, autoReloading: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RouteErrorBoundary]", error, info.componentStack);
    if (isChunkLoadError(error)) {
      const autoReloading = reloadOnceForNewDeploy();
      if (autoReloading) {
        this.setState({ autoReloading: true });
      }
    }
  }

  handleRetry = () => {
    this.setState({ error: null, autoReloading: false });
  };

  render() {
    if (this.state.error) {
      if (this.state.autoReloading) return null;
      return <RouteErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

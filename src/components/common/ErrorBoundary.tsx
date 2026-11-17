// Catches a crash inside a page so the visitor sees a friendly message with "Try again"
// instead of a blank screen. Guest pages get a calm version; staff pages a plain one.
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; guest?: boolean; resetKey?: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // moving to another page clears the error
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const guest = this.props.guest;
    return (
      <div className={guest ? "guest-site min-h-screen" : "min-h-screen bg-background"} role="alert">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className={guest ? "gs-display text-3xl" : "text-xl font-semibold"}>Something went wrong</h1>
          <p className="text-muted-foreground">
            {guest ? "This page didn't load properly. Please try again; if it keeps happening, contact the hotel directly."
              : "This screen hit a problem. Your data is safe. Try again, or go back to the dashboard."}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.location.reload()}
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Try again</button>
            {!guest && <a href="/" className="rounded-full border px-6 py-2 text-sm font-medium hover:bg-muted">Dashboard</a>}
          </div>
        </div>
      </div>
    );
  }
}

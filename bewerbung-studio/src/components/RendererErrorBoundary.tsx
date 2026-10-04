import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class RendererErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    void window.bewerbungsManager.system.reportRendererFailure().catch(() => undefined);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Ein Fehler ist aufgetreten</h1>
        <p>Die Ansicht konnte nicht angezeigt werden. Laden Sie die Anwendung neu.</p>
        <button type="button" onClick={() => window.location.reload()}>Neu laden</button>
      </main>
    );
  }
}

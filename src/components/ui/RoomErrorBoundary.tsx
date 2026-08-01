"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { RoomErrorFallback } from "@/components/ui/RoomErrorFallback";

type Props = {
  children: ReactNode;
  /** ログ用の場所名（lobby / game など） */
  label?: string;
};

type State = {
  error: Error | null;
};

/**
 * ロビー・対局画面用の React Error Boundary。
 * レンダー中の例外を捕捉し、分かりやすい復帰画面を出す。
 */
export class RoomErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? "room";
    console.error(`[RoomErrorBoundary:${label}]`, error.message, error.stack);
    console.error(`[RoomErrorBoundary:${label}] componentStack`, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <RoomErrorFallback
          message={
            this.state.error.message
              ? `エラーが発生しました（${this.state.error.message}）。トップに戻るか、再試行してください。`
              : undefined
          }
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

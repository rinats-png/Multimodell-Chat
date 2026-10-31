import { AppHeader } from "./AppHeader";

interface AppShellProps {
  email: string | null;
  isDemoStore: boolean;
  active: "chat" | "billing";
  children: React.ReactNode;
}

/** Seiten außerhalb des Chats: Kopf-Kachel und eine große Glas-Kachel für den Inhalt. */
export function AppShell({ email, isDemoStore, active, children }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1400px] flex-col gap-3.5 p-3 sm:p-4">
      <AppHeader active={active} email={email} isDemoStore={isDemoStore} />
      <main className="glass tile relative flex-1 p-1 sm:p-2">{children}</main>
    </div>
  );
}

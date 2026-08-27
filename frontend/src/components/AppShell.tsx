import Sidebar from "./Sidebar";

interface Props {
  children: React.ReactNode;
  scheduledCount?: number;
  sentCount?: number;
}

export default function AppShell({ children, scheduledCount, sentCount }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar scheduledCount={scheduledCount} sentCount={sentCount} />
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        {children}
      </div>
    </div>
  );
}

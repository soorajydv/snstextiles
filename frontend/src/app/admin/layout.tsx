import { AdminLayoutClient } from './AdminLayoutClient';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}

import { redirect } from 'next/navigation';
import { appPath } from '@/lib/paths';

export default function AdminHomePage() {
  redirect(appPath('/dashboard'));
}

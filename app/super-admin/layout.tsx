import { getSession } from '@/lib/auth/server-auth';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: Auth check is handled by individual pages
  // This layout just provides the container structure

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {children}
    </div>
  );
}


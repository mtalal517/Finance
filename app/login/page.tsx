import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Mark } from '@/components/ui/Mark';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"
          >
            <Mark className="h-[19px] w-auto" />
          </span>
          <h1 className="text-lg font-semibold text-ink">My Finance</h1>
          <p className="mt-1 text-base text-muted">Enter your password to continue.</p>
        </div>

        <div className="surface p-5">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-sm leading-relaxed text-muted">
          Nobody without this password can read or change your records.
        </p>
      </div>
    </main>
  );
}

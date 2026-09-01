'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { FormError, TextField } from '@/components/ui/Field';
import { apiRequest } from '@/lib/client/api';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const response = await apiRequest('/api/auth/login', { method: 'POST', body: { password } });

    if (!response.ok) {
      setSubmitting(false);
      setPassword('');
      setError(response.error);
      return;
    }

    // Only ever return to a path inside this app — never to a URL an attacker
    // could have put in the query string.
    const requested = searchParams.get('next') ?? '';
    const destination = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard';

    router.replace(destination);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <FormError message={error} />}

      <TextField
        label="Password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <Button type="submit" variant="primary" loading={submitting} className="w-full">
        Sign in
      </Button>
    </form>
  );
}

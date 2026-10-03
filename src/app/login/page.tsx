import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Development Ops</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to manage projects and procurement.</p>
        <LoginForm />
      </div>
    </main>
  );
}

import { AuthStatus } from "./status";
export default function SystemPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">System</h1>
      <AuthStatus />
    </main>
  );
}

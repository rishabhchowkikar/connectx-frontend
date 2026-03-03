// Middleware handles redirects server-side (faster)
// This component should rarely render as middleware redirects before page loads
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <div className="text-xl font-medium text-zinc-700 animate-pulse">Redirecting...</div>
    </div>
  );
}

export function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-white to-[#F8FAFC]">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <img src="/logo.jpg" alt="Calendfree" className="h-20 w-20 rounded-2xl shadow-lg" />
        </div>
        <h1 className="bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] bg-clip-text text-5xl font-extrabold text-transparent">
          Calendfree
        </h1>
        <p className="mt-3 text-lg text-[#64748B]">Terminplanung, die einfach funktioniert.</p>
        <div className="mt-6 h-1 w-24 mx-auto rounded-full bg-gradient-to-r from-[#0B8ECA] via-[#14B8A6] to-[#F59E0B]" />
      </div>
    </div>
  );
}

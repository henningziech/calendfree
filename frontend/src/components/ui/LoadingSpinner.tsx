export function LoadingSpinner({ text = 'Laden...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E2E8F0] border-t-[#0B8ECA]" />
      <p className="mt-3 text-sm text-[#64748B]">{text}</p>
    </div>
  );
}

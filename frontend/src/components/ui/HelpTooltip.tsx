interface HelpTooltipProps {
  text: string;
}

export function HelpTooltip({ text }: HelpTooltipProps) {
  return (
    <span className="group relative inline-flex ml-1.5 cursor-help">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E2E8F0] text-[10px] font-bold text-[#64748B] transition-colors group-hover:bg-[#0B8ECA] group-hover:text-white">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl bg-[#1E293B] px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1E293B]" />
      </span>
    </span>
  );
}

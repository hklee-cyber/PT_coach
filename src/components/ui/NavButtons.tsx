import Link from "next/link";
import { ChevronLeft, LayoutDashboard } from "lucide-react";

interface Props {
  backHref: string;
  backLabel?: string;
  mainHref: string;
  mainLabel?: string;
}

const BTN =
  "inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md font-semibold text-xs hover:bg-blue-700 transition active:scale-95 shadow-sm";

export default function NavButtons({
  backHref,
  backLabel = "이전으로",
  mainHref,
  mainLabel = "메인으로",
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <Link href={backHref} className={BTN}>
        <ChevronLeft className="w-3.5 h-3.5" />
        {backLabel}
      </Link>
      <Link href={mainHref} className={BTN}>
        <LayoutDashboard className="w-3.5 h-3.5" />
        {mainLabel}
      </Link>
    </div>
  );
}

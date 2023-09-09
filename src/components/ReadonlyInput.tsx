import { IconCopy } from "@tabler/icons-react";
import clsx from "clsx";
import copy from "copy-to-clipboard";
import { useRef, type HTMLAttributes, type InputHTMLAttributes } from "react";
import toast from "react-hot-toast";

export default function ReadonlyInput({
  className,
  ...props
}: HTMLAttributes<HTMLInputElement> & InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative flex-1">
      <input
        ref={ref}
        {...props}
        readOnly
        className={clsx(
          "block w-full min-w-0 rounded-md font-mono px-2.5 py-1.5 pr-10",
          "text-sm text-white placeholder:text-white/60",
          "border border-white/50 focus-visible:border-transparent",
          "bg-white/20",
          "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75",
          className
        )}
      />

      <button
        type="button"
        className="rounded-full transition-colors hover:bg-white/20 flex justify-center items-center absolute top-[3px] right-1 h-7 w-7"
        onClick={() => {
          copy(ref.current?.value ?? "");
          toast.success("Copied!");
        }}
      >
        <IconCopy size={20} />
      </button>
    </div>
  );
}

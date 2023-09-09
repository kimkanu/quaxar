import { clsx } from "clsx";
import { useAtomValue } from "jotai";
import type { HTMLAttributes, InputHTMLAttributes } from "react";
import { autocompleteAtom } from "../state";

export default function HexInput({
  className,
  autocompleteKey,
  ...props
}: HTMLAttributes<HTMLInputElement> &
  InputHTMLAttributes<HTMLInputElement> & { autocompleteKey?: string }) {
  const autocomplete = useAtomValue(autocompleteAtom);
  const list = autocompleteKey ? autocomplete[autocompleteKey] ?? [] : [];

  return (
    <div className="min-w-0 flex-1 relative">
      <input
        {...props}
        pattern="(0x)?[0-9a-fA-F]*"
        className={clsx(
          "w-full block rounded-md font-mono px-2.5 py-1.5 pr-10",
          "text-sm text-white placeholder:text-white/60",
          "border border-white/50 focus-visible:border-transparent",
          "bg-white/20 invalid:bg-red-500/50",
          "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75",
          className
        )}
        onBlur={(e) => {
          e.target.value = e.target.value.trim().toLowerCase();
        }}
        list={autocompleteKey ? `list-${autocompleteKey}` : undefined}
      />
      {autocompleteKey && (
        <datalist id={`list-${autocompleteKey}`}>
          {list.map((item) => (
            // eslint-disable-next-line jsx-a11y/control-has-associated-label
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
      <span className="absolute top-1/2 -translate-y-1/2 text-xs text-white/80 right-2 pointer-events-none select-none">
        HEX
      </span>
    </div>
  );
}

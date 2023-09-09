import { clsx } from "clsx";
import { useAtomValue } from "jotai";
import { type HTMLAttributes, type InputHTMLAttributes } from "react";
import { autocompleteAtom } from "../state";

export default function StringInput({
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
        className={clsx(
          "w-full block rounded-md font-mono px-2.5 py-1.5",
          "text-sm text-white placeholder:text-white/60",
          "border border-white/50 focus-visible:border-transparent",
          "bg-white/20 invalid:bg-red-500/50",
          "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75",
          className
        )}
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
    </div>
  );
}

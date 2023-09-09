import { clsx } from "clsx";
import { useAtomValue } from "jotai";
import { useState, type HTMLAttributes, type InputHTMLAttributes } from "react";
import { autocompleteAtom } from "../state";

export default function DataInput({
  className,
  autocompleteKey,
  ...props
}: HTMLAttributes<HTMLInputElement> &
  InputHTMLAttributes<HTMLInputElement> & { autocompleteKey?: string }) {
  const [detectedFormat, setDetectedFormat] = useState<"hex" | "string" | "">(
    ""
  );
  const autocomplete = useAtomValue(autocompleteAtom);
  const list = autocompleteKey ? autocomplete[autocompleteKey] ?? [] : [];

  return (
    <div className="min-w-0 flex-1 relative">
      <input
        {...props}
        className={clsx(
          "w-full block rounded-md font-mono px-2.5 py-1.5 pr-16",
          "text-sm text-white placeholder:text-white/60",
          "border border-white/50 focus-visible:border-transparent",
          "bg-white/20 invalid:bg-red-500/50",
          "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75",
          className
        )}
        onChange={(e) => {
          const { value } = e.target;
          if (value.trim() === "") {
            setDetectedFormat("");
          } else if (
            value.startsWith("0x") &&
            value.slice(2).match(/^[0-9a-f]*$/)
          ) {
            setDetectedFormat("hex");
          } else {
            setDetectedFormat("string");
          }
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
        {detectedFormat.toUpperCase()}
      </span>
    </div>
  );
}

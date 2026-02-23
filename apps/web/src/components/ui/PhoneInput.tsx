import { type ChangeEvent, type KeyboardEvent, useRef, useCallback } from "react";

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
}

// Format: +998 (XX) XXX XX-XX
// Raw digits stored without +998 prefix (max 9 digits)
const COUNTRY_CODE = "+998";

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 9);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 5) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 5)} ${d.slice(5)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 5)} ${d.slice(5, 7)}-${d.slice(7)}`;
}

function extractDigits(formatted: string): string {
  return formatted.replace(/\D/g, "").slice(0, 9);
}

// Build raw value for storage: +998XXXXXXXXX or empty
function toRawValue(digits: string): string {
  if (digits.length === 0) return "";
  return COUNTRY_CODE + digits;
}

// Parse stored value (+998XXXXXXXXX) to just the 9 digits
function fromRawValue(raw: string): string {
  const cleaned = raw.replace(/\D/g, "");
  if (cleaned.startsWith("998") && cleaned.length > 3) {
    return cleaned.slice(3, 12);
  }
  return cleaned.slice(0, 9);
}

// Map cursor position in formatted string to digit index
function cursorToDigitIndex(formatted: string, cursor: number): number {
  let digitCount = 0;
  for (let i = 0; i < cursor && i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) digitCount++;
  }
  return digitCount;
}

// Map digit index back to cursor position in formatted string
function digitIndexToCursor(formatted: string, digitIdx: number): number {
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      count++;
      if (count === digitIdx) return i + 1;
    }
  }
  return formatted.length;
}

export function PhoneInput({ label, value, onChange, error, placeholder, className = "" }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = fromRawValue(value);
  const displayValue = digits.length > 0 ? `${COUNTRY_CODE} ${formatPhone(digits)}` : COUNTRY_CODE + " ";

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawInput = input.value;
    const cursorPos = input.selectionStart ?? rawInput.length;

    // Don't allow editing the +998 prefix
    const afterPrefix = rawInput.slice(5); // skip "+998 "
    const newDigits = extractDigits(afterPrefix);
    const newFormatted = `${COUNTRY_CODE} ${formatPhone(newDigits)}`;

    onChange(toRawValue(newDigits));

    // Restore cursor position
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const prefixLen = 5; // "+998 "
      const typedPart = rawInput.slice(prefixLen);
      const digitIdxAtCursor = cursorToDigitIndex(typedPart, cursorPos - prefixLen);
      const formattedPart = formatPhone(newDigits);
      const newCursor = prefixLen + digitIndexToCursor(formattedPart, digitIdxAtCursor);
      inputRef.current.setSelectionRange(newCursor, newCursor);
    });
  }, [onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const pos = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;

    // Prevent editing the +998 prefix
    if (pos < 5 && e.key !== "Tab" && e.key !== "ArrowRight" && e.key !== "ArrowLeft"
      && e.key !== "Home" && e.key !== "End") {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        return;
      }
      // Move cursor after prefix for any other input
      if (pos < 5) {
        requestAnimationFrame(() => {
          input.setSelectionRange(5, 5);
        });
      }
    }

    // Handle Backspace over formatting characters
    if (e.key === "Backspace" && pos === selEnd && pos > 5) {
      const ch = displayValue[pos - 1];
      if (ch && /[\s()\-]/.test(ch)) {
        e.preventDefault();
        // Skip back to previous digit
        let newPos = pos - 1;
        while (newPos > 5 && displayValue[newPos - 1] && !/\d/.test(displayValue[newPos - 1]!)) {
          newPos--;
        }
        if (newPos > 5) {
          // Delete the digit before
          const beforeDigits = digits;
          const digitIdx = cursorToDigitIndex(displayValue.slice(5), newPos - 5);
          const newDigits = beforeDigits.slice(0, digitIdx - 1) + beforeDigits.slice(digitIdx);
          onChange(toRawValue(newDigits));
          requestAnimationFrame(() => {
            const formatted = `${COUNTRY_CODE} ${formatPhone(newDigits)}`;
            const cursor = 5 + digitIndexToCursor(formatPhone(newDigits), digitIdx - 1);
            const safeCursor = Math.min(cursor, formatted.length);
            input.setSelectionRange(safeCursor, safeCursor);
          });
        }
        return;
      }
    }

    // Handle Delete over formatting characters
    if (e.key === "Delete" && pos === selEnd && pos >= 5) {
      const ch = displayValue[pos];
      if (ch && /[\s()\-]/.test(ch)) {
        e.preventDefault();
        // Skip forward to next digit
        let newPos = pos + 1;
        while (newPos < displayValue.length && displayValue[newPos] && !/\d/.test(displayValue[newPos]!)) {
          newPos++;
        }
        if (newPos < displayValue.length) {
          const digitIdx = cursorToDigitIndex(displayValue.slice(5), newPos - 5);
          const newDigits = digits.slice(0, digitIdx) + digits.slice(digitIdx + 1);
          onChange(toRawValue(newDigits));
          requestAnimationFrame(() => {
            const cursor = 5 + digitIndexToCursor(formatPhone(newDigits), digitIdx);
            const formatted = `${COUNTRY_CODE} ${formatPhone(newDigits)}`;
            const safeCursor = Math.min(cursor, formatted.length);
            input.setSelectionRange(safeCursor, safeCursor);
          });
        }
        return;
      }
    }
  }, [displayValue, digits, onChange]);

  const handleFocus = useCallback(() => {
    // Place cursor at end on focus
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const len = displayValue.length;
        inputRef.current.setSelectionRange(len, len);
      }
    });
  }, [displayValue]);

  const handleClick = useCallback(() => {
    if (!inputRef.current) return;
    const pos = inputRef.current.selectionStart ?? 0;
    if (pos < 5) {
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(5, 5);
      });
    }
  }, []);

  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <input
        ref={inputRef}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onClick={handleClick}
        placeholder={placeholder ?? "+998 (XX) XXX XX-XX"}
        className={`input-field ${error ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" : ""} ${className}`}
      />
      {error && <p className="input-error">{error}</p>}
    </div>
  );
}

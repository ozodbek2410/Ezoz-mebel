import { type SelectHTMLAttributes, forwardRef } from "react";

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = "", id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="input-group">
        {label && (
          <label htmlFor={selectId} className="input-label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`select-field ${error ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" : ""} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="input-error">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";

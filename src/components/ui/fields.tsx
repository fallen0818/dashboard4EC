'use client';

import { ReactNode } from 'react';

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  step?: string;
  min?: string;
  placeholder?: string;
}

export function Field({
  label,
  name,
  type = 'text',
  value,
  onChange,
  required = false,
  step,
  min,
  placeholder,
}: FieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        step={step}
        min={min}
        placeholder={placeholder}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: ReactNode;
}

export function SelectField({ label, name, value, onChange, required = false, children }: SelectFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
        {children}
      </select>
    </div>
  );
}

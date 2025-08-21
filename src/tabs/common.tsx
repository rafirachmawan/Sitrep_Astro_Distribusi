"use client";
import React from "react";

export function ThemedSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
) {
  const { className = "", ...rest } = props;
  return (
    <select
      {...rest}
      className={
        "w-full rounded-lg border text-sm bg-white text-slate-800 " +
        "border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 " +
        "disabled:opacity-50 " +
        className
      }
    />
  );
}

/** Warna dot skor; kosong/0 => abu-abu */
export function scoreDot(score?: number | null) {
  if (!score || score === 0) return "bg-slate-300";
  if (score <= 2) return "bg-rose-500";
  if (score === 3) return "bg-amber-500";
  return "bg-emerald-500";
}

/* -----------------------------------------------------------
   1) STRICT: ScoreSelect → hanya number 1..5 (tanpa "–")
   Dipakai di checklist, dsb (tidak pernah undefined).
----------------------------------------------------------- */
export function ScoreSelect({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={"flex items-center gap-2 " + className}>
      <span className={"h-2.5 w-2.5 rounded-full " + scoreDot(value)} />
      <ThemedSelect
        disabled={disabled}
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </ThemedSelect>
    </div>
  );
}

/* -----------------------------------------------------------
   2) LOOSE: ScoreSelectNullable → boleh kosong “–”
   value boleh undefined/null/string | number.
   onChange mengirim number | undefined (undefined = kosong).
   Dipakai khusus di Evaluasi per orang.
----------------------------------------------------------- */
export function ScoreSelectNullable({
  value,
  onChange,
  disabled,
  className = "",
  placeholder = "–",
}: {
  value?: number | string | null;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const num =
    typeof value === "string"
      ? value === ""
        ? undefined
        : Number(value)
      : value ?? undefined;

  const stringValue = num == null || num === 0 ? "" : String(num);

  return (
    <div className={"flex items-center gap-2 " + className}>
      <span className={"h-2.5 w-2.5 rounded-full " + scoreDot(num)} />
      <ThemedSelect
        disabled={disabled}
        value={stringValue}
        onChange={(e) => {
          const v = e.target.value === "" ? undefined : Number(e.target.value);
          onChange(v);
        }}
      >
        <option value="">{placeholder}</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </ThemedSelect>
    </div>
  );
}

export function NumberWithSuffix({
  suffix,
  value,
  onChange,
}: {
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        className="w-full sm:w-28 rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
      />
      {suffix && <span className="text-sm text-slate-600">{suffix}</span>}
    </div>
  );
}

export function OptionsGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          className={
            "px-3 py-1.5 rounded-lg border text-sm transition " +
            (value === opt
              ? "bg-blue-600 text-white border-blue-600 shadow"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50")
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

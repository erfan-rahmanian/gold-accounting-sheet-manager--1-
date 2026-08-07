import React from "react";

/**
 * حالت خالی با تصویر — وقتی جدولی هنوز داده‌ای ندارد.
 *
 * بیشتر جاهای استفاده داخل <tbody> هستند، پس نسخه‌ی `cell` را داریم که
 * خودش <tr>/<td> را می‌سازد؛ گذاشتن <div> لخت داخل جدول، HTML نامعتبر است
 * و مرورگر آن را از جدول بیرون می‌اندازد.
 */
interface EmptyStateProps {
  /** آدرس تصویر داخل public/brand */
  image: string;
  /** پیام اصلی */
  title: string;
  /** توضیح کوتاه اختیاری زیر پیام */
  hint?: string;
}

export function EmptyState({ image, title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
      <img
        src={image}
        alt=""
        loading="lazy"
        className="w-40 h-auto max-w-full opacity-90 select-none pointer-events-none"
      />
      <p className="text-xs font-bold text-slate-500 max-w-xs leading-relaxed">{title}</p>
      {hint && <p className="text-[11px] font-bold text-slate-400 max-w-xs leading-relaxed">{hint}</p>}
    </div>
  );
}

interface EmptyRowProps extends EmptyStateProps {
  /** تعداد ستون‌های جدول تا سلول تمام عرض را بگیرد */
  colSpan: number;
}

/** همان حالت خالی، ولی به‌شکل یک ردیف جدول */
export function EmptyRow({ colSpan, ...rest }: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <EmptyState {...rest} />
      </td>
    </tr>
  );
}

export default EmptyState;

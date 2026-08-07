import React from "react";

/**
 * آیکون‌های تصویریِ برند (همان‌هایی که در منوی کناری هستند).
 *
 * این‌ها برخلاف آیکون‌های lucide تصویرند، نه فونت‌آیکون؛ یعنی با کلاس
 * رنگی نمی‌شوند و در اندازه‌های ریز جزئیاتشان گم می‌شود. پس فقط برای
 * سربرگ بخش‌ها استفاده می‌شوند که درشت‌اند و رنگشان ثابت می‌ماند.
 * برای دکمه‌ها و آیکون‌های کوچکِ کنشی (ذخیره، حذف، بستن...) lucide
 * انتخاب درست‌تری است و سر جایش می‌ماند.
 *
 * فایل‌ها را scripts/build-brand-assets.py می‌سازد؛ همه ۹۶ پیکسل‌اند تا
 * روی نمایشگرهای رتینا هم تیز بمانند.
 */
export type BrandIconName =
  | "dashboard"
  | "transaction"
  | "reports"
  | "spreadsheet"
  | "settings"
  | "backup"
  | "profile";

interface BrandIconProps {
  name: BrandIconName;
  /** اندازه‌ی نمایش به پیکسل */
  size?: number;
  className?: string;
}

export default function BrandIcon({ name, size = 22, className = "" }: BrandIconProps) {
  return (
    <img
      src={`/brand/${name}-icon.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      className={`object-contain shrink-0 select-none pointer-events-none ${className}`}
    />
  );
}

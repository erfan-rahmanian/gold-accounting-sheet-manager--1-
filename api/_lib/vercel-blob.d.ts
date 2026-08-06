/**
 * تعریف نوع محلی برای @vercel/blob
 *
 * این پکیج فقط روی ورسل نصب و استفاده می‌شود (import آن داینامیک است و
 * وقتی BLOB_READ_WRITE_TOKEN وجود نداشته باشد اصلاً بارگذاری نمی‌شود).
 * این فایل باعث می‌شود تایپ‌چک روی سیستم محلی هم بدون نصب پکیج سبز بماند.
 * اگر پکیج نصب شده باشد، تعریف واقعی خودش اولویت دارد.
 */
declare module "@vercel/blob" {
  export function head(
    pathname: string,
    options?: { token?: string }
  ): Promise<{ url: string; pathname: string; size: number }>;

  export function put(
    pathname: string,
    body: string | Buffer | Blob,
    options: {
      access: "public";
      token?: string;
      contentType?: string;
      addRandomSuffix?: boolean;
      allowOverwrite?: boolean;
      cacheControlMaxAge?: number;
    }
  ): Promise<{ url: string; pathname: string }>;
}

/**
 * تعریف نوع محلی برای @vercel/blob
 *
 * این پکیج فقط وقتی استفاده می‌شود که BLOB_READ_WRITE_TOKEN وجود داشته باشد
 * (import آن داینامیک است). این فایل باعث می‌شود تایپ‌چک روی سیستم محلی هم
 * بدون نصب پکیج سبز بماند. اگر پکیج نصب باشد، تعریف واقعی خودش اولویت دارد.
 *
 * فقط همان دو تابعی که استفاده می‌کنیم. Store پروژه Private است، پس در عمل
 * همیشه access: "private" می‌فرستیم. امضاها عمداً سبک‌اند؛ خودِ core.ts
 * تایپ دقیق نتیجه را اعمال می‌کند.
 */
declare module "@vercel/blob" {
  export function get(
    urlOrPathname: string,
    options: {
      access: "private" | "public";
      token?: string;
      useCache?: boolean;
      ifNoneMatch?: string;
    }
  ): Promise<{
    statusCode: number;
    stream: ReadableStream | null;
    blob: { pathname: string; contentType: string; etag: string };
  } | null>;

  export function put(
    pathname: string,
    body: string | Buffer | Blob,
    options: {
      access: "private" | "public";
      token?: string;
      contentType?: string;
      addRandomSuffix?: boolean;
      allowOverwrite?: boolean;
      cacheControlMaxAge?: number;
    }
  ): Promise<{ url: string; pathname: string }>;
}

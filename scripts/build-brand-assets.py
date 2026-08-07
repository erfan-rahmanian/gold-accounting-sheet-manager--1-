#!/usr/bin/env python3
"""
ساخت دارایی‌های تصویری برنامه از روی فایل‌های اصلی داخل brand-src/

فایل‌های اصلی (خروجی هوش مصنوعی) سنگین‌اند و مستقیم قابل استفاده روی وب
نیستند؛ این اسکریپت آن‌ها را به نسخه‌های بهینه و اندازه‌های موردنیاز
تبدیل می‌کند و در public/ می‌گذارد.

اگر لوگو یا تصاویر را عوض کردید، فایل جدید را با همان نام در brand-src/
بگذارید و دوباره اجرا کنید:

    python3 scripts/build-brand-assets.py

نیازمندی: Pillow و numpy
"""

import os
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "brand-src")
PUB = os.path.join(ROOT, "public")
BRAND = os.path.join(PUB, "brand")
ICONS = os.path.join(PUB, "icons")

# پس‌زمینه‌ی آیکون‌های مات (اپل و maskable اندروید شفافیت را درست نشان نمی‌دهند)
ICON_BG = (255, 251, 235)  # amber-50


def load(name):
    return Image.open(os.path.join(SRC, name)).convert("RGBA")


def bleed_alpha(im, iters=16):
    """
    رنگِ زیرِ پیکسل‌های شفاف را با رنگ همسایه‌های مات پر می‌کند.

    مولدهای تصویر معمولاً زیر ناحیه‌ی شفاف رنگ تیره می‌گذارند. موقع کوچک
    کردن تصویر، مرورگر همان رنگ تیره را با لبه‌ها مخلوط می‌کند و دور لوگو
    هاله‌ی کثیف می‌افتد. با پخش کردن رنگ لبه به بیرون، این هاله از بین می‌رود.
    """
    arr = np.array(im).astype(np.float32)
    rgb = arr[..., :3].copy()
    known = arr[..., 3] > 0
    for _ in range(iters):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(known.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * np.roll(np.roll(known, dy, 0), dx, 1)[..., None]
            cnt += np.roll(np.roll(known, dy, 0), dx, 1)
        fill = (~known) & (cnt > 0)
        rgb[fill] = acc[fill] / cnt[fill][:, None]
        known = known | fill
    arr[..., :3] = rgb
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def resize_rgba(im, size):
    """
    کوچک کردن با آلفای پیش‌ضرب‌شده.

    اگر کانال رنگ و آلفا جدا کوچک شوند، لبه‌ها رنگ اشتباه می‌گیرند. با
    پیش‌ضرب کردن، ریاضیِ ترکیب درست می‌ماند و لبه‌ها تمیز درمی‌آیند.
    """
    arr = np.array(im.convert("RGBA")).astype(np.float32) / 255.0
    a = arr[..., 3:4]
    pm = np.concatenate([arr[..., :3] * a, a], axis=2)
    small = Image.fromarray((pm * 255).round().astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)
    out = np.array(small).astype(np.float32) / 255.0
    a2 = out[..., 3:4]
    rgb = np.where(a2 > 1e-4, out[..., :3] / np.maximum(a2, 1e-4), 0.0)
    res = np.concatenate([np.clip(rgb, 0, 1), a2], axis=2)
    return Image.fromarray((res * 255).round().astype(np.uint8), "RGBA")


def trim(im, threshold=8):
    """برش تصویر تا جایی که واقعاً محتوا دارد"""
    box = im.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()
    return im.crop(box) if box else im


def square(im, canvas, fill_ratio, bg=None):
    """محتوا را وسط یک بوم مربع می‌گذارد و به نسبت خواسته‌شده بزرگ می‌کند"""
    target = int(canvas * fill_ratio)
    w, h = im.size
    scale = target / max(w, h)
    im = resize_rgba(im, (max(1, round(w * scale)), max(1, round(h * scale))))
    base = Image.new("RGBA", (canvas, canvas), (*bg, 255) if bg else (0, 0, 0, 0))
    base.paste(im, ((canvas - im.size[0]) // 2, (canvas - im.size[1]) // 2), im)
    return base


def fit_height(im, height):
    w, h = im.size
    return resize_rgba(im, (max(1, round(w * height / h)), height))


def kb(path):
    return f"{os.path.getsize(path) / 1024:.0f}KB"


def main():
    os.makedirs(BRAND, exist_ok=True)
    os.makedirs(ICONS, exist_ok=True)

    # ---------------------------------------------------------------- لوگو
    # نشانه در بوم اصلی وسط نیست؛ برشش می‌زنیم و خودمان دقیق وسط می‌چینیم
    mark = trim(bleed_alpha(load("logo-master.png")))

    outputs = []

    def save_png(im, path, **kw):
        im.save(path, "PNG", optimize=True, **kw)
        outputs.append((os.path.relpath(path, ROOT), kb(path)))

    # آیکون‌های شفاف (purpose: any) + لوگوی داخل خود برنامه
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (256, "logo.png")):
        target = ICONS if name.startswith("icon") else BRAND
        save_png(square(mark, size, 0.92), os.path.join(target, name))

    # آیکون maskable اندروید: ناحیه‌ی امن ۸۰٪ است، پس نشانه باید کوچک‌تر و
    # روی پس‌زمینه‌ی مات باشد تا موقع برش دایره‌ای چیزی از آن قیچی نشود
    for size in (512, 192):
        save_png(square(mark, size, 0.60, bg=ICON_BG), os.path.join(ICONS, f"maskable-{size}.png"))

    # اپل شفافیت را با مشکی پر می‌کند، پس پس‌زمینه‌ی مات می‌دهیم
    save_png(square(mark, 180, 0.82, bg=ICON_BG), os.path.join(ICONS, "apple-touch-icon.png"))

    # فاویکون سه‌اندازه‌ای برای تب مرورگر و بوکمارک
    ico = os.path.join(PUB, "favicon.ico")
    square(mark, 64, 0.94).save(ico, "ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    outputs.append((os.path.relpath(ico, ROOT), kb(ico)))

    # ------------------------------------------------- پس‌زمینه‌ی صفحه‌ی ورود
    bg = Image.open(os.path.join(SRC, "login-bg.png")).convert("RGB")
    p = os.path.join(BRAND, "login-bg.webp")
    bg.save(p, "WEBP", quality=78, method=6)
    outputs.append((os.path.relpath(p, ROOT), kb(p)))

    # ------------------------------------------------------ تصویر اشتراک لینک
    # JPEG چون بعضی پیام‌رسان‌ها هنوز WebP را در پیش‌نمایش لینک نشان نمی‌دهند
    og = Image.open(os.path.join(SRC, "og-cover.png")).convert("RGB").resize((1200, 630), Image.LANCZOS)
    p = os.path.join(BRAND, "og-cover.jpg")
    og.save(p, "JPEG", quality=88, optimize=True, progressive=True)
    outputs.append((os.path.relpath(p, ROOT), kb(p)))

    # ------------------------------------------------------ تصاویر حالت خالی
    # برش تا محتوا، بعد ارتفاع ثابت؛ نسبت هرکدام طبیعی می‌ماند و در رابط
    # کاربری فقط ارتفاع را تعیین می‌کنیم
    for name in ("empty-transactions", "empty-reports", "empty-sheets"):
        art = fit_height(trim(bleed_alpha(load(f"{name}.png"))), 400)
        p = os.path.join(BRAND, f"{name}.webp")
        art.save(p, "WEBP", quality=86, method=6, lossless=False)
        outputs.append((os.path.relpath(p, ROOT), kb(p)))

    total = 0
    for rel, size in outputs:
        print(f"  {rel:38} {size}")
        total += os.path.getsize(os.path.join(ROOT, rel))
    print(f"\n  مجموع: {total / 1024:.0f}KB")


if __name__ == "__main__":
    main()

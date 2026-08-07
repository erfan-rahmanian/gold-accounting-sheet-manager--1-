import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {IconContext} from '@phosphor-icons/react';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA
if ('serviceWorker' in navigator && (import.meta as any).env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA Service Worker registered successfully:', reg.scope))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      آیکون‌های Phosphor به‌طور پیش‌فرض ضخامت «regular» دارند که کنارِ
      فونت درشت و ضخیم رابط کاربری، نازک و کم‌جان دیده می‌شود. با «bold»
      به همان وزنی می‌رسیم که قبلاً با lucide داشتیم.

      رنگ هم currentColor است تا مثل قبل با کلاس‌های text-* رنگ بگیرد و
      حالت‌های hover و فعال/غیرفعال دست‌نخورده کار کند.
    */}
    <IconContext.Provider value={{ weight: 'bold', color: 'currentColor' }}>
      <App />
    </IconContext.Provider>
  </StrictMode>,
);

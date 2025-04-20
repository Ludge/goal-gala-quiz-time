import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import Cookies from 'js-cookie';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cookie helpers for player identity
export function setPlayerCookie(name: string, userId: string, options?: Cookies.CookieAttributes) {
  Cookies.set('name', name, {
    secure: true,
    sameSite: 'Strict',
    expires: 1, // 1 day
    ...options,
  });
  Cookies.set('user_id', userId, {
    secure: true,
    sameSite: 'Strict',
    expires: 1, // 1 day
    ...options,
  });
}

export function getPlayerCookie() {
  const name = Cookies.get('name');
  const userId = Cookies.get('user_id');
  return { name, userId };
}

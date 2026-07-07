import { redirect } from 'next/navigation';

// Musk Quant 已并入 X Monitor（2026-07-08），保留路由兼容旧链接/书签
export default function MuskQuantPage() {
  redirect('/x-monitor');
}

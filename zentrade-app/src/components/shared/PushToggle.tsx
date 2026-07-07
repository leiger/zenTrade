'use client';

import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';

/**
 * PWA Web Push 订阅开关。
 * X Monitor 与 Musk Quant 的后端预警共用同一订阅表——任一处开启全局生效。
 * iOS 需 16.4+ 且先「添加到主屏幕」后才支持 Web Push。
 */
export function PushToggle() {
  const { permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (permission === 'denied') {
    return (
      <Button
        variant="outline"
        size="xs"
        className="h-8 gap-1.5 rounded-md opacity-60"
        disabled
        title="浏览器已拒绝通知权限，请在浏览器网站设置中重新允许后刷新页面"
      >
        <BellOff className="h-3.5 w-3.5" />
        <span>通知被禁用</span>
      </Button>
    );
  }

  return (
    <Button
      variant={subscribed ? 'default' : 'outline'}
      size="xs"
      className="h-8 gap-1.5 rounded-md"
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={loading}
      title={
        subscribed
          ? '点击关闭本设备的预警推送'
          : '开启后，策略预警将推送到本设备（X Monitor 与 Musk Quant 共用）'
      }
    >
      {subscribed ? (
        <BellRing className="h-3.5 w-3.5" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      <span>{loading ? '处理中…' : subscribed ? '推送已开启' : '开启推送'}</span>
    </Button>
  );
}

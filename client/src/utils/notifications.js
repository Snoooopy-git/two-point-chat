// 浏览器桌面通知工具

// 请求通知权限
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// 发送浏览器桌面通知
export function showBrowserNotification(title, body, icon) {
  if ('Notification' in window && Notification.permission === 'granted') {
    // 如果页面可见，不发送通知（用户正在看）
    if (document.visibilityState === 'visible') {
      return;
    }
    try {
      const notification = new Notification(title, {
        body: body || '',
        icon: icon || '',
        tag: 'two-point-chat',  // 相同 tag 的通知会合并
        requireInteraction: false
      });
      // 点击通知跳转到聊天页
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.error('发送通知失败:', e);
    }
  }
}

// 检查通知是否被支持
export function isNotificationSupported() {
  return 'Notification' in window;
}

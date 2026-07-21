import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../utils/api.js';
import { getSocket } from '../utils/socket.js';
import { showBrowserNotification } from '../utils/notifications.js';

export const useChatStore = defineStore('chat', () => {
  const contacts = ref([]);
  const activeContactId = ref(null);
  const messages = ref({});        // { [contactId]: [message, ...] }
  const loading = ref(false);
  const searchResults = ref([]);
  const typingUsers = ref({});     // { [userId]: true }
  const unreadCounts = ref({});    // { [contactId]: count }

  // 全局监听器初始化标志
  let _listenersInitialized = false;

  const activeContact = computed(() =>
    contacts.value.find(c => c.id === activeContactId.value)
  );

  const activeMessages = computed(() =>
    messages.value[activeContactId.value] || []
  );

  // 总未读数
  const totalUnread = computed(() =>
    Object.values(unreadCounts.value).reduce((sum, c) => sum + c, 0)
  );

  const sortedContacts = computed(() =>
    [...contacts.value].sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return timeB - timeA;
    })
  );

  // ============= 全局 Socket 监听器（只初始化一次） =============

  function initSocketListeners() {
    if (_listenersInitialized) return;
    const socket = getSocket();
    if (!socket) {
      // socket 还没连接好，延迟重试
      setTimeout(() => initSocketListeners(), 500);
      return;
    }

    socket.on('new_message', (msg) => {
      receiveMessage(msg);
    });

    socket.on('message_sent', (msg) => {
      confirmMessage(msg);
    });

    socket.on('friend_online', (data) => {
      setUserOnline(data.userId);
    });

    socket.on('friend_offline', (data) => {
      setUserOffline(data.userId);
    });

    socket.on('message_error', (data) => {
      console.error('消息发送失败:', data.error);
    });

    _listenersInitialized = true;
    console.log('✅ 全局 Socket 监听器已初始化');
  }

  // ============= 联系人 =============

  // 获取好友列表
  async function fetchContacts() {
    try {
      const data = await api.get('/api/users/friends');
      contacts.value = data.friends.map(f => ({
        ...f,
        online: false
      }));
      // 拉取未读数
      await fetchUnreadCounts();
    } catch (err) {
      console.error('获取好友列表失败:', err);
    }
  }

  // 获取未读消息数
  async function fetchUnreadCounts() {
    try {
      const data = await api.get('/api/messages/unread/counts');
      const counts = {};
      (data.counts || []).forEach(c => {
        counts[c.sender_id] = c.count;
      });
      unreadCounts.value = counts;
    } catch (err) {
      console.error('获取未读数失败:', err);
    }
  }

  // 搜索用户
  async function searchUsers(query) {
    if (!query.trim()) {
      searchResults.value = [];
      return;
    }
    try {
      const data = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      searchResults.value = data.users;
    } catch (err) {
      console.error('搜索用户失败:', err);
    }
  }

  // 添加好友
  async function addFriend(friendId) {
    try {
      const data = await api.post('/api/users/friends', { friendId });
      await fetchContacts();
      return data;
    } catch (err) {
      throw new Error(err.message || '添加好友失败');
    }
  }

  // ============= 消息 =============

  // 获取历史消息
  async function fetchMessages(contactId) {
    try {
      const data = await api.get(`/api/messages/${contactId}`);
      messages.value[contactId] = data.messages;
    } catch (err) {
      console.error('获取消息失败:', err);
    }
  }

  // 打开聊天
  async function openChat(contactId) {
    activeContactId.value = contactId;
    if (!messages.value[contactId]) {
      await fetchMessages(contactId);
    }
    // 标记该联系人的消息为已读
    markAsRead(contactId);
  }

  // 标记消息已读
  function markAsRead(contactId) {
    // 清除本地未读计数
    unreadCounts.value[contactId] = 0;

    // 通过 HTTP API 标记已读
    api.put(`/api/messages/${contactId}/read`).catch(err => {
      console.error('标记已读失败:', err);
    });

    // 通过 Socket 通知对方（如果在线）
    const socket = getSocket();
    if (socket) {
      socket.emit('mark_read', { from: contactId });
    }
  }

  // 发送文字消息
  function sendTextMessage(content) {
    const socket = getSocket();
    if (!socket || !activeContactId.value) return;

    const messageData = {
      to: activeContactId.value,
      content,
      type: 'text'
    };

    // 乐观更新：立即添加到本地消息列表
    const tempMsg = {
      id: Date.now(),
      sender_id: 'self',
      receiver_id: activeContactId.value,
      content,
      type: 'text',
      file_url: null,
      read: 1,
      created_at: new Date().toISOString(),
      _temp: true
    };

    if (!messages.value[activeContactId.value]) {
      messages.value[activeContactId.value] = [];
    }
    messages.value[activeContactId.value].push(tempMsg);

    socket.emit('private_message', messageData);
  }

  // 发送图片消息
  function sendImageMessage(fileUrl) {
    const socket = getSocket();
    if (!socket || !activeContactId.value) return;

    const messageData = {
      to: activeContactId.value,
      content: fileUrl,
      type: 'image',
      fileUrl
    };

    // 乐观更新
    const tempMsg = {
      id: Date.now(),
      sender_id: 'self',
      receiver_id: activeContactId.value,
      content: fileUrl,
      type: 'image',
      file_url: fileUrl,
      read: 1,
      created_at: new Date().toISOString(),
      _temp: true
    };

    if (!messages.value[activeContactId.value]) {
      messages.value[activeContactId.value] = [];
    }
    messages.value[activeContactId.value].push(tempMsg);

    socket.emit('private_message', messageData);
  }

  // 接收消息（由全局 socket 事件触发）
  function receiveMessage(msg) {
    const contactId = msg.from;
    if (!messages.value[contactId]) {
      messages.value[contactId] = [];
    }
    messages.value[contactId].push({
      id: msg.id,
      sender_id: msg.from,
      receiver_id: 'self',
      content: msg.content,
      type: msg.type || 'text',
      file_url: msg.fileUrl || null,
      read: 0,
      created_at: msg.timestamp || new Date().toISOString()
    });

    // 更新好友列表中的最后一条消息
    const contact = contacts.value.find(c => c.id === contactId);
    const contactName = contact?.username || '新消息';
    if (contact) {
      contact.lastMessage = {
        content: msg.type === 'image' ? '[图片]' : msg.content,
        type: msg.type || 'text',
        created_at: msg.timestamp || new Date().toISOString()
      };
    }

    // 如果不是正在查看该联系人，增加未读计数
    if (activeContactId.value !== contactId) {
      if (!unreadCounts.value[contactId]) {
        unreadCounts.value[contactId] = 0;
      }
      unreadCounts.value[contactId]++;

      // 发送浏览器桌面通知
      showBrowserNotification(
        contactName,
        msg.type === 'image' ? '📷 发送了一张图片' : msg.content
      );
    }
  }

  // 消息发送确认（由 socket 事件触发）
  function confirmMessage(msg) {
    // 将临时消息替换为服务器确认的消息
    const contactMsgs = messages.value[msg.to] || messages.value[msg.receiver_id];
    if (!contactMsgs) return;
    const tempIdx = contactMsgs.findIndex(m => m._temp && m.content === msg.content);
    if (tempIdx !== -1) {
      contactMsgs[tempIdx] = {
        ...contactMsgs[tempIdx],
        id: msg.id,
        _temp: false
      };
    }
  }

  // ============= 在线状态 =============

  function setUserOnline(userId) {
    const contact = contacts.value.find(c => c.id === userId);
    if (contact) {
      contact.online = true;
    }
  }

  function setUserOffline(userId) {
    const contact = contacts.value.find(c => c.id === userId);
    if (contact) {
      contact.online = false;
    }
  }

  // ============= 输入状态 =============

  function setTyping(userId) {
    typingUsers.value[userId] = true;
    setTimeout(() => {
      typingUsers.value[userId] = false;
    }, 3000);
  }

  function clearTyping(userId) {
    typingUsers.value[userId] = false;
  }

  return {
    contacts,
    activeContactId,
    messages,
    loading,
    searchResults,
    typingUsers,
    unreadCounts,
    totalUnread,
    activeContact,
    activeMessages,
    sortedContacts,
    initSocketListeners,
    fetchContacts,
    fetchUnreadCounts,
    searchUsers,
    addFriend,
    fetchMessages,
    openChat,
    markAsRead,
    sendTextMessage,
    sendImageMessage,
    receiveMessage,
    confirmMessage,
    setUserOnline,
    setUserOffline,
    setTyping,
    clearTyping
  };
});

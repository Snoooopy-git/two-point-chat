import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../utils/api.js';
import { getSocket } from '../utils/socket.js';
import { showBrowserNotification } from '../utils/notifications.js';

export const useChatStore = defineStore('chat', () => {
  const contacts = ref([]);
  const activeContactId = ref(null);
  const messages = ref({});
  const historyCursors = ref({});
  const loading = ref(false);
  const searchResults = ref([]);
  const incomingFriendRequests = ref([]);
  const outgoingFriendRequests = ref([]);
  const typingUsers = ref({});
  const unreadCounts = ref({});
  const incomingMessageSignal = ref(0);
  const outgoingMessageSignal = ref(0);

  let boundSocket = null;
  let boundHandlers = {};
  let onlineSnapshot = new Set();

  const activeContact = computed(() =>
    contacts.value.find(contact => contact.id === activeContactId.value)
  );
  const activeMessages = computed(() =>
    messages.value[activeContactId.value] || []
  );
  const activeHistoryCursor = computed(() =>
    historyCursors.value[activeContactId.value] || null
  );
  const totalUnread = computed(() =>
    Object.values(unreadCounts.value).reduce((sum, count) => sum + count, 0)
  );
  const incomingRequestCount = computed(() => incomingFriendRequests.value.length);
  const sortedContacts = computed(() =>
    [...contacts.value].sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return timeB - timeA;
    })
  );

  function detachSocketListeners() {
    if (!boundSocket) return;
    Object.entries(boundHandlers).forEach(([event, handler]) => {
      boundSocket.off(event, handler);
    });
    boundSocket = null;
    boundHandlers = {};
  }

  function initSocketListeners(socket = getSocket()) {
    if (!socket || socket === boundSocket) return;
    detachSocketListeners();
    boundSocket = socket;

    boundHandlers = {
      new_message: receiveMessage,
      message_sent: confirmMessage,
      message_error: failMessage,
      online_users: handleOnlineSnapshot,
      friend_online: handleFriendOnline,
      friend_offline: handleFriendOffline,
      messages_read: handleMessagesRead,
      friend_request_received: handleFriendRequestChanged,
      friend_request_resolved: handleFriendRequestChanged,
      friend_added: handleFriendAdded,
      disconnect: handleSocketDisconnect
    };
    Object.entries(boundHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });
  }

  function handleOnlineSnapshot({ userIds = [] }) {
    onlineSnapshot = new Set(userIds);
    contacts.value.forEach(contact => {
      contact.online = onlineSnapshot.has(contact.id);
    });
  }

  function handleFriendOnline({ userId }) {
    setUserOnline(userId);
  }

  function handleFriendOffline({ userId }) {
    setUserOffline(userId);
  }

  // 对方读取了发给他的消息：把该会话中我方已确认发出的消息标记为已读
  function handleMessagesRead({ from: readerId }) {
    const contactMessages = messages.value[readerId];
    if (!contactMessages) return;
    contactMessages.forEach(message => {
      // 仍在发送中或发送失败的消息尚未被对方读到，不能提前标记
      if (message.sender_id !== readerId && !message._temp && !message._error) {
        message.read = 1;
      }
    });
  }

  function handleFriendRequestChanged() {
    fetchFriendRequests();
  }

  function handleFriendAdded() {
    fetchFriendRequests();
    fetchContacts();
  }

  function handleSocketDisconnect() {
    Object.values(messages.value).forEach(contactMessages => {
      contactMessages.filter(message => message._temp).forEach(message => {
        message._temp = false;
        message._error = true;
        message._errorMessage = '连接已中断，请重试';
      });
    });
  }

  function resetState() {
    detachSocketListeners();
    contacts.value = [];
    activeContactId.value = null;
    messages.value = {};
    historyCursors.value = {};
    searchResults.value = [];
    incomingFriendRequests.value = [];
    outgoingFriendRequests.value = [];
    typingUsers.value = {};
    unreadCounts.value = {};
    incomingMessageSignal.value = 0;
    outgoingMessageSignal.value = 0;
    onlineSnapshot = new Set();
  }

  async function fetchContacts() {
    try {
      const data = await api.get('/api/users/friends');
      contacts.value = data.friends.map(friend => ({
        ...friend,
        online: onlineSnapshot.has(friend.id)
      }));
      await fetchUnreadCounts();
    } catch (error) {
      console.error('获取好友列表失败:', error);
    }
  }

  async function fetchUnreadCounts() {
    try {
      const data = await api.get('/api/messages/unread/counts');
      unreadCounts.value = Object.fromEntries(
        (data.counts || []).map(item => [item.sender_id, item.count])
      );
    } catch (error) {
      console.error('获取未读数失败:', error);
    }
  }

  async function searchUsers(query) {
    if (!query.trim()) {
      searchResults.value = [];
      return;
    }
    try {
      const data = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      searchResults.value = data.users;
    } catch (error) {
      console.error('搜索用户失败:', error);
    }
  }

  async function fetchFriendRequests() {
    try {
      const data = await api.get('/api/users/friend-requests');
      incomingFriendRequests.value = data.incoming || [];
      outgoingFriendRequests.value = data.outgoing || [];
      return data;
    } catch (error) {
      console.error('获取好友申请失败:', error);
      return null;
    }
  }

  async function sendFriendRequest(recipientId) {
    const data = await api.post('/api/users/friend-requests', { recipientId });
    await fetchFriendRequests();
    const result = searchResults.value.find(user => user.id === recipientId);
    if (result) result.relationship = 'outgoing_pending';
    return data;
  }

  async function acceptFriendRequest(requestId) {
    const request = incomingFriendRequests.value.find(item => item.id === requestId);
    const data = await api.put(`/api/users/friend-requests/${requestId}/accept`);
    await Promise.all([fetchFriendRequests(), fetchContacts()]);
    const result = searchResults.value.find(user => user.id === request?.user.id);
    if (result) result.relationship = 'friend';
    return data;
  }

  async function removeFriendRequest(requestId) {
    const request = [...incomingFriendRequests.value, ...outgoingFriendRequests.value]
      .find(item => item.id === requestId);
    const data = await api.delete(`/api/users/friend-requests/${requestId}`);
    await fetchFriendRequests();
    const result = searchResults.value.find(user => user.id === request?.user.id);
    if (result) result.relationship = 'none';
    return data;
  }

  async function fetchMessages(contactId, before = null) {
    try {
      const query = before ? `?before=${encodeURIComponent(before)}` : '';
      const data = await api.get(`/api/messages/${contactId}${query}`);
      messages.value[contactId] = before
        ? [...data.messages, ...(messages.value[contactId] || [])]
        : data.messages;
      historyCursors.value[contactId] = data.nextCursor;
    } catch (error) {
      console.error('获取消息失败:', error);
    }
  }

  async function loadOlderMessages() {
    const cursor = activeHistoryCursor.value;
    if (!activeContactId.value || !cursor) return;
    await fetchMessages(activeContactId.value, cursor);
  }

  async function openChat(contactId) {
    activeContactId.value = contactId;
    if (!messages.value[contactId]) {
      await fetchMessages(contactId);
    }
    await markAsRead(contactId);
  }

  async function markAsRead(contactId) {
    try {
      await api.put(`/api/messages/${contactId}/read`);
      unreadCounts.value[contactId] = 0;
      (messages.value[contactId] || [])
        .filter(message => message.sender_id === contactId)
        .forEach(message => {
          message.read = 1;
        });
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  }

  function createClientMessageId() {
    return globalThis.crypto?.randomUUID?.()
      || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }

  function sendMessage(content, type, fileUrl = null) {
    const socket = getSocket();
    const contactId = activeContactId.value;
    if (!socket?.connected || !contactId) return false;

    const clientMessageId = createClientMessageId();
    const tempMessage = {
      id: clientMessageId,
      client_message_id: clientMessageId,
      sender_id: 'self',
      receiver_id: contactId,
      content,
      type,
      file_url: fileUrl,
      read: 1,
      created_at: new Date().toISOString(),
      _temp: true,
      _error: false
    };
    messages.value[contactId] ||= [];
    messages.value[contactId].push(tempMessage);
    socket.emit('private_message', {
      to: contactId,
      content,
      type,
      fileUrl,
      clientMessageId
    });
    outgoingMessageSignal.value += 1;
    return true;
  }

  function sendTextMessage(content) {
    return sendMessage(content, 'text');
  }

  function sendImageMessage(fileUrl) {
    return sendMessage(fileUrl, 'image', fileUrl);
  }

  function receiveMessage(message) {
    incomingMessageSignal.value += 1;
    const contactId = message.from;
    messages.value[contactId] ||= [];
    if (!messages.value[contactId].some(item => item.id === message.id)) {
      messages.value[contactId].push({
        id: message.id,
        client_message_id: message.clientMessageId,
        sender_id: message.from,
        receiver_id: message.to,
        content: message.content,
        type: message.type || 'text',
        file_url: message.fileUrl || null,
        read: 0,
        created_at: message.timestamp
      });
    }

    updateLastMessage(contactId, message);
    if (activeContactId.value === contactId) {
      markAsRead(contactId);
      return;
    }

    unreadCounts.value[contactId] = (unreadCounts.value[contactId] || 0) + 1;
    const contactName = contacts.value.find(contact => contact.id === contactId)?.username || '新消息';
    showBrowserNotification(
      contactName,
      message.type === 'image' ? '📷 发送了一张图片' : message.content
    );
  }

  function confirmMessage(message) {
    const contactMessages = messages.value[message.to];
    if (!contactMessages) return;
    const index = contactMessages.findIndex(
      item => item.client_message_id === message.clientMessageId
    );
    if (index === -1) return;
    contactMessages[index] = {
      ...contactMessages[index],
      id: message.id,
      sender_id: message.from,
      receiver_id: message.to,
      read: message.read,
      created_at: message.timestamp,
      _temp: false,
      _error: false
    };
    updateLastMessage(message.to, message);
  }

  function failMessage({ clientMessageId, error }) {
    Object.values(messages.value).forEach(contactMessages => {
      const message = contactMessages.find(
        item => item.client_message_id === clientMessageId
      );
      if (message) {
        message._temp = false;
        message._error = true;
        message._errorMessage = error;
      }
    });
  }

  function retryMessage(clientMessageId) {
    const socket = getSocket();
    if (!socket?.connected) return false;

    for (const contactMessages of Object.values(messages.value)) {
      const message = contactMessages.find(
        item => item.client_message_id === clientMessageId
      );
      if (!message) continue;
      message._temp = true;
      message._error = false;
      delete message._errorMessage;
      socket.emit('private_message', {
        to: message.receiver_id,
        content: message.content,
        type: message.type,
        fileUrl: message.file_url,
        clientMessageId
      });
      return true;
    }
    return false;
  }

  function updateLastMessage(contactId, message) {
    const contact = contacts.value.find(item => item.id === contactId);
    if (!contact) return;
    contact.lastMessage = {
      content: message.content,
      type: message.type || 'text',
      created_at: message.timestamp
    };
  }

  function setUserOnline(userId) {
    onlineSnapshot.add(userId);
    const contact = contacts.value.find(item => item.id === userId);
    if (contact) contact.online = true;
  }

  function setUserOffline(userId) {
    onlineSnapshot.delete(userId);
    const contact = contacts.value.find(item => item.id === userId);
    if (contact) contact.online = false;
  }

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
    historyCursors,
    loading,
    searchResults,
    incomingFriendRequests,
    outgoingFriendRequests,
    typingUsers,
    unreadCounts,
    incomingMessageSignal,
    outgoingMessageSignal,
    totalUnread,
    incomingRequestCount,
    activeContact,
    activeMessages,
    activeHistoryCursor,
    sortedContacts,
    initSocketListeners,
    resetState,
    fetchContacts,
    fetchUnreadCounts,
    searchUsers,
    fetchFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriendRequest,
    fetchMessages,
    loadOlderMessages,
    openChat,
    markAsRead,
    sendTextMessage,
    sendImageMessage,
    receiveMessage,
    confirmMessage,
    retryMessage,
    setUserOnline,
    setUserOffline,
    setTyping,
    clearTyping
  };
});

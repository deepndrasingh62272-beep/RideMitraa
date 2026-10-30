"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Send, Paperclip, MoreVertical, 
  Phone, Video, Image, CheckCheck, Check,
  ArrowLeft, AlertCircle, Wifi, WifiOff,
  Loader2, Clock, User
} from "lucide-react";
import chatService, { 
  Conversation as ApiConversation, 
  Message as ApiMessage,
  ApiResponse 
} from "@/src/services/chatService";
import socketService, { 
  SocketMessage, 
  SocketConnectionState 
} from "@/src/services/socketService";
import { toast } from "sonner";

// Types
interface ChatMessage {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  sender?: {
    _id: string;
    name: string;
  };
  createdAt?: string;
  _id?: string;
  tempId?: string;
}

interface ChatConversation {
  id: string;
  rideId: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  bookingId?: string;
  messages?: ChatMessage[];
  completedAt?: string;
  rideStatus?: string;
}

export default function Chat() {
  // State
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [pendingChatRideId, setPendingChatRideId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // Get current user ID from auth context
  const getCurrentUserId = useCallback((): string => {
    // Replace with actual auth context
    return localStorage.getItem('userId') || '';
  }, []);

  // Check if a conversation has expired (10+ minutes after ride completion)
  const isConversationExpired = useCallback((conversation: ChatConversation): boolean => {
    if (!conversation.rideStatus || conversation.rideStatus !== 'completed') return false;
    if (!conversation.completedAt) return false;
    const minutesElapsed = (Date.now() - new Date(conversation.completedAt).getTime()) / 60000;
    return minutesElapsed >= 10;
  }, []);

  // Initialize - Fetch conversations first, then initialize socket
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    
    // Fetch conversations first to get real IDs
    fetchConversations().then((success) => {
      // Only initialize socket after conversations are successfully loaded
      if (success) {
        initializeSocket();
      } else {
        console.warn('Socket initialization skipped due to failed conversation fetch');
        toast.error('Cannot connect to chat service. Backend server may not be running.');
      }
    });
    
    return () => {
      window.removeEventListener('resize', checkDesktop);
      cleanup();
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Leave current chat room
    if (selectedChat?.rideId) {
      socketService.leaveChat(selectedChat.rideId);
    }
    
    // Unsubscribe all listeners
    unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
    unsubscribeRefs.current = [];
    
    // Disconnect socket
    socketService.disconnect();
  }, [selectedChat?.rideId]);

  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    const token = localStorage.getItem('token') || '';
    if (!token) {
      console.warn('No token found for socket connection');
      toast.warning('Please login to use chat features');
      return;
    }

    try {
      socketService.connect(token);
      
      // Listen for connection state changes
      const unsubscribeConnection = socketService.onConnectionStateChange((state) => {
        setConnectionState(state);
      });
      unsubscribeRefs.current.push(unsubscribeConnection);

      // Listen for new messages
      const unsubscribeMessage = socketService.onMessage((socketMessage: SocketMessage) => {
        handleNewSocketMessage(socketMessage);
      });
      unsubscribeRefs.current.push(unsubscribeMessage);

    } catch (error) {
      console.error('Failed to initialize socket:', error);
      toast.error('Failed to connect to real-time chat');
    }
  }, []);

  // Handle new socket message
  const handleNewSocketMessage = useCallback((socketMessage: SocketMessage) => {
    console.log('New socket message:', socketMessage);
    
    // Check if this message belongs to the currently selected chat
    if (selectedChat && selectedChat.rideId === socketMessage.rideId) {
      // Check for duplicate message
      const isDuplicate = selectedChat.messages?.some(msg => 
        msg._id === socketMessage._id || 
        (msg.tempId && socketMessage.text === msg.text && Math.abs(new Date(socketMessage.createdAt).getTime() - new Date(msg.createdAt || Date.now()).getTime()) < 1000)
      );
      
      if (isDuplicate) {
        console.log('Duplicate message detected, skipping');
        return;
      }
      
      const newMessage: ChatMessage = {
        id: socketMessage._id,
        _id: socketMessage._id,
        text: socketMessage.text,
        sent: socketMessage.senderId === getCurrentUserId(),
        time: new Date(socketMessage.createdAt).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        status: "delivered",
        sender: socketMessage.sender,
        createdAt: socketMessage.createdAt
      };
      
      // Replace temporary message if exists
      setSelectedChat(prev => {
        if (!prev) return prev;
        
        const updatedMessages = [...(prev.messages || [])];
        const tempMessageIndex = updatedMessages.findIndex(msg => 
          msg.tempId && msg.text === socketMessage.text && msg.sent === true
        );
        
        if (tempMessageIndex !== -1) {
          // Replace temp message with real message
          updatedMessages[tempMessageIndex] = newMessage;
        } else {
          // Add new message
          updatedMessages.push(newMessage);
        }
        
        return { 
          ...prev, 
          messages: updatedMessages 
        };
      });
      
      // Update conversation list
      updateConversationList(socketMessage.rideId, socketMessage.text, newMessage.time);
      
      scrollToBottom();
    }
  }, [selectedChat, getCurrentUserId]);

  // Update conversation list when new message arrives
  const updateConversationList = useCallback((rideId: string, lastMessage: string, lastMessageTime: string) => {
    setChats(prev => {
      const updatedChats = [...prev];
      const chatIndex = updatedChats.findIndex(chat => chat.rideId === rideId);
      
      if (chatIndex !== -1) {
        const chat = updatedChats[chatIndex];
        const updatedChat = {
          ...chat,
          lastMessage,
          lastMessageTime,
          unreadCount: chat.id === selectedChat?.id ? 0 : chat.unreadCount + 1
        };
        
        // Move to top
        updatedChats.splice(chatIndex, 1);
        updatedChats.unshift(updatedChat);
      }
      
      return updatedChats;
    });
  }, [selectedChat?.id]);

  // Fetch conversations
  const fetchConversations = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const result = await chatService.getConversations();
      
      if (result.success && result.data) {
        const formattedChats: ChatConversation[] = result.data.map((chat: any) => ({
          id: chat._id || chat.id,
          rideId: chat.rideId?._id || chat.rideId || chat.id,
          bookingId: chat.bookingId,
          name: chat.driverId?.name || chat.passengerId?.name || 'Unknown User',
          avatar: chat.driverId?.avatar || chat.passengerId?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.driverId?._id || chat.passengerId?._id || 'user'}`,
          lastMessage: chat.lastMessage?.text || 'No messages yet',
          lastMessageTime: chat.lastMessage?.sentAt 
            ? new Date(chat.lastMessage.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '--:--',
          unreadCount: chat.myUnread || 0,
          isOnline: false,
          messages: [],
          rideStatus: chat.rideId?.status || undefined,
          completedAt: chat.rideId?.completedAt || chat.rideId?.updatedAt || undefined,
        }));
        
        setChats(formattedChats);

        // Auto-open chat if navigated from bookings
        const pendingRideId = sessionStorage.getItem('chatOpenRideId');
        if (pendingRideId) {
          sessionStorage.removeItem('chatOpenRideId');
          setPendingChatRideId(pendingRideId);
        }

        return true;
      } else if (result.error) {
        toast.error(result.error.message);
        return false;
      }
      return false;
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      toast.error('Failed to load conversations');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch messages for a chat
  const fetchMessages = async (chat: ChatConversation) => {
    setIsLoadingMessages(true);
    try {
      const result = await chatService.getRideMessages(chat.rideId, 1, 50);
      
      if (result.success && result.data) {
        const formattedMessages: ChatMessage[] = result.data.map((msg: ApiMessage) => ({
          id: msg.id,
          _id: msg.id,
          text: msg.content,
          sent: false, // Will be updated based on sender
          time: new Date(msg.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          status: "delivered",
          createdAt: msg.createdAt
        }));
        
        return formattedMessages;
      } else if (result.error) {
        toast.error(result.error.message);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
    return [];
  };

  // Handle chat selection
  const handleSelectChat = async (chat: ChatConversation) => {
    // Check if socket is connected
    if (!socketService.isConnected()) {
      toast.error('Chat service is not connected. Please check your connection.');
      return;
    }
    
    // Leave previous chat room
    if (selectedChat?.rideId) {
      socketService.leaveChat(selectedChat.rideId);
    }
    
    // Join new chat room
    const joinResult = await socketService.joinChat(chat.rideId, chat.bookingId);
    if (!joinResult.ok) {
      toast.error(`Failed to join chat: ${joinResult.error}`);
      return;
    }
    
    // Fetch messages
    const messages = await fetchMessages(chat);
    
    // Update selected chat with messages
    setSelectedChat({
      ...chat,
      messages
    });
    
    setIsMobileChatOpen(true);
    
    // Mark conversation as read
    try {
      await chatService.markConversationAsRead(chat.id);
      setChats(prev => prev.map(c => 
        c.id === chat.id ? { ...c, unreadCount: 0 } : c
      ));
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
    
    // Focus message input
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);
  };

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.messages, scrollToBottom]);

  // Auto-open pending chat once chats are loaded (socket connection not required for navigation)
  useEffect(() => {
    if (!pendingChatRideId || chats.length === 0) return;
    const targetChat = chats.find(c => c.rideId === pendingChatRideId);
    if (targetChat) {
      setPendingChatRideId(null);
      handleSelectChat(targetChat);
    }
  }, [pendingChatRideId, chats]);

  // Send message
  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChat || isSendingMessage) return;
    
    // Check if socket is connected
    if (!socketService.isConnected()) {
      toast.error('Chat service is not connected. Please check your connection.');
      return;
    }
    
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      tempId: tempId,
      text: message,
      sent: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "sending"
    };

    // Optimistically add message
    setSelectedChat(prev => prev ? { 
      ...prev, 
      messages: [...(prev.messages || []), tempMessage] 
    } : prev);
    
    setChats(prev => prev.map(chat => 
      chat.id === selectedChat.id 
        ? { 
            ...chat, 
            lastMessage: message,
            lastMessageTime: tempMessage.time
          }
        : chat
    ));
    
    const messageToSend = message;
    setMessage("");
    setIsSendingMessage(true);
    scrollToBottom();

    try {
      const result = await socketService.sendMessage(
        selectedChat.rideId,
        messageToSend,
        selectedChat.bookingId,
        tempId
      );

      if (result.ok) {
        // Update message status
        setSelectedChat(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            messages: (prev.messages || []).map(msg =>
              msg.tempId === tempId
                ? { ...msg, status: "sent", id: result.messageId || msg.id }
                : msg
            )
          };
        });
        
        toast.success('Message sent');
      } else {
        toast.error(`Failed to send message: ${result.error}`);
        
        // Mark as failed
        setSelectedChat(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            messages: (prev.messages || []).map(msg =>
              msg.tempId === tempId
                ? { ...msg, status: "failed" }
                : msg
            )
          };
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error('Failed to send message');
      
      // Mark as failed
      setSelectedChat(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          messages: (prev.messages || []).map(msg =>
            msg.tempId === tempId
              ? { ...msg, status: "failed" }
              : msg
          )
        };
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get status icon
  const getStatusIcon = (status: ChatMessage['status']) => {
    switch (status) {
      case "sending":
        return <Loader2 size={14} className="text-gray-400 animate-spin" />;
      case "sent":
        return <Check size={14} className="text-gray-400" />;
      case "delivered":
        return <CheckCheck size={14} className="text-blue-500" />;
      case "read":
        return <CheckCheck size={14} className="text-emerald-500" />;
      case "failed":
        return <AlertCircle size={14} className="text-red-500" />;
      default:
        return null;
    }
  };

  // Get connection status text
  const getConnectionStatusText = () => {
    if (connectionState.isConnected) return "Live";
    if (connectionState.isConnecting) return "Connecting...";
    if (connectionState.isReconnecting) return "Reconnecting...";
    return "Offline";
  };

  // Get connection status color
  const getConnectionStatusColor = () => {
    if (connectionState.isConnected) return "bg-emerald-50 text-emerald-700";
    if (connectionState.isConnecting || connectionState.isReconnecting) return "bg-amber-50 text-amber-700";
    return "bg-red-50 text-red-700";
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Chat List Sidebar */}
      <AnimatePresence mode="wait">
        {(!isMobileChatOpen || isDesktop) && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full md:w-80 lg:w-96 flex flex-col border-r border-gray-100 bg-white"
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Chats</h1>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConnectionStatusColor()}`}>
                  {connectionState.isConnected ? (
                    <Wifi size={12} />
                  ) : connectionState.isConnecting || connectionState.isReconnecting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <WifiOff size={12} />
                  )}
                  <span>{getConnectionStatusText()}</span>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-4 p-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-start gap-3 p-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4" />
                        <div className="h-3 bg-gray-100 animate-pulse rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : chats.length > 0 ? (
                chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    disabled={isLoadingMessages}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedChat?.id === chat.id ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img 
                        src={chat.avatar} 
                        alt={chat.name}
                        className="w-12 h-12 rounded-2xl object-cover"
                      />
                      {chat.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-gray-900 truncate">{chat.name}</h3>
                        <span className="text-[10px] text-gray-400 font-medium">{chat.lastMessageTime}</span>
                      </div>
                      <p className={`text-sm truncate ${chat.unreadCount > 0 ? "text-gray-700 font-semibold" : "text-gray-500"}`}>
                        {chat.lastMessage}
                      </p>
                    </div>
                    {chat.unreadCount > 0 && (
                      <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">{chat.unreadCount}</span>
                      </div>
                    )}
                    {isLoadingMessages && selectedChat?.id === chat.id && (
                      <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                        <Loader2 size={20} className="text-blue-600 animate-spin" />
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                    <User size={32} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-bold">No conversations found</p>
                  <p className="text-gray-400 text-sm mt-1">Start a ride to begin chatting</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence mode="wait">
        {(isMobileChatOpen || isDesktop) && selectedChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col bg-gray-50/50"
          >
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsMobileChatOpen(false)}
                  className="md:hidden p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div className="relative">
                  <img 
                    src={selectedChat.avatar} 
                    alt={selectedChat.name}
                    className="w-10 h-10 rounded-2xl object-cover"
                  />
                  {selectedChat.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedChat.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-500">
                      {selectedChat.isOnline ? "Online" : "Offline"}
                    </p>
                    <div className={`w-2 h-2 rounded-full ${
                      connectionState.isConnected ? 'bg-emerald-500' : 'bg-gray-300'
                    }`} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors">
                  <Phone size={20} className="text-gray-600" />
                </button>
                <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors">
                  <MoreVertical size={20} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 size={32} className="text-gray-300 animate-spin mb-4" />
                  <p className="text-gray-500 font-bold">Loading messages...</p>
                </div>
              ) : selectedChat.messages && selectedChat.messages.length > 0 ? (
                selectedChat.messages.map((msg, index) => {
                  const showAvatar = index === 0 || selectedChat.messages![index - 1]?.sent !== msg.sent;
                  
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`flex items-end gap-2 max-w-[75%] ${msg.sent ? "flex-row-reverse" : ""}`}>
                        {!msg.sent && showAvatar && (
                          <img 
                            src={selectedChat.avatar} 
                            alt={selectedChat.name}
                            className="w-8 h-8 rounded-2xl object-cover flex-shrink-0"
                          />
                        )}
                        {!msg.sent && !showAvatar && <div className="w-8 flex-shrink-0" />}
                        <div className={`px-5 py-3 rounded-3xl ${
                          msg.sent 
                            ? msg.status === 'failed'
                              ? 'bg-red-100 text-red-900 border border-red-200 rounded-br-md'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-md'
                            : 'bg-white border border-gray-100 text-gray-900 rounded-bl-md shadow-sm'
                        }`}>
                          <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                          <div className={`flex items-center gap-1 mt-1 ${msg.sent ? "justify-end" : ""}`}>
                            <span className={`text-[10px] ${msg.sent && msg.status !== 'failed' ? "text-white/60" : "text-gray-400"}`}>
                              {msg.time}
                            </span>
                            {msg.sent && getStatusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                    <AlertCircle size={32} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-bold">No messages yet</p>
                  <p className="text-gray-400 text-sm mt-1">Start the conversation!</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-100">
              {(() => {
                const isExpired = selectedChat ? isConversationExpired(selectedChat) : false;
                return (
                  <>
                    <div className="flex items-end gap-3">
                      <button className="p-3 hover:bg-gray-100 rounded-2xl transition-colors flex-shrink-0">
                        <Paperclip size={22} className="text-gray-500" />
                      </button>
                      <div className="flex-1 relative">
                        <textarea
                          ref={messageInputRef}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder={isExpired ? "This chat has expired" : "Type a message..."}
                          rows={1}
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-3xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm max-h-32"
                          disabled={!connectionState.isConnected || isSendingMessage || isExpired}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSendMessage}
                        disabled={!message.trim() || !connectionState.isConnected || isSendingMessage || isExpired}
                        className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 flex-shrink-0"
                      >
                        {isSendingMessage ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <Send size={20} />
                        )}
                      </motion.button>
                    </div>
                    {!connectionState.isConnected && (
                      <div className="mt-2 text-center">
                        <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
                          <WifiOff size={12} />
                          {connectionState.error || "Reconnecting to chat service..."}
                        </p>
                      </div>
                    )}
                    {isExpired && (
                      <div className="mt-2 text-center">
                        <p className="text-xs text-red-600 flex items-center justify-center gap-1">
                          <Clock size={12} />
                          This chat has expired (10 minutes after ride completion)
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!selectedChat && (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50/50">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Image size={40} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No chat selected</h3>
            <p className="text-gray-500">Select a conversation to start messaging</p>
            {!connectionState.isConnected && (
              <div className="mt-4 px-4 py-2 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700 flex items-center justify-center gap-1">
                  <WifiOff size={14} />
                  Chat service is offline
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
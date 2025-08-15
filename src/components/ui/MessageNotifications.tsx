import React, { useState, useEffect } from 'react';
import { Bell, MessageCircle, X, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext_django';
import { useToast } from '@/hooks/use-toast';
import { tokenManager } from '@/services/djangoApi';

interface Message {
  id: string;
  sender: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  receiver: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  content: string;
  read: boolean;
  created_at: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
}

const MessageNotifications = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose'>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  // Compose form state
  const [composeForm, setComposeForm] = useState({
    receiverId: '',
    content: ''
  });

  const API_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || '/api';

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/messages/`, {
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const messageList = data.results || data;
        setMessages(messageList);
        setUnreadCount(messageList.filter((msg: Message) => !msg.read && msg.receiver.id === currentUser?.id).length);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Fetch users for compose
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/`, {
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const userList = data.results || data;
        setUsers(userList.filter((user: User) => user.id !== currentUser?.id));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Mark message as read
  const markAsRead = async (messageId: string) => {
    try {
      await fetch(`${API_BASE_URL}/messages/${messageId}/mark_read/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, read: true } : msg
      ));
      setUnreadCount(prev => prev - 1);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!composeForm.receiverId || !composeForm.content) {
      toast({ title: 'Error', description: 'Please select recipient and write message', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/messages/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver_id: composeForm.receiverId,
          content: composeForm.content
        }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Message sent successfully!' });
        setComposeForm({ receiverId: '', content: '' });
        setActiveTab('inbox');
        fetchMessages();
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchMessages();
      fetchUsers();
      
      // Poll for new messages every 30 seconds
      const interval = setInterval(fetchMessages, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const receivedMessages = messages.filter(msg => msg.receiver.id === currentUser?.id);
  const sentMessages = messages.filter(msg => msg.sender.id === currentUser?.id);

  return (
    <div className="relative">
      {/* Bell Icon with Badge */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-white shadow-lg border rounded-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Messages
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              className={`flex-1 p-3 text-sm font-medium ${activeTab === 'inbox' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setActiveTab('inbox')}
            >
              Inbox ({receivedMessages.length})
            </button>
            <button
              className={`flex-1 p-3 text-sm font-medium ${activeTab === 'compose' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setActiveTab('compose')}
            >
              Compose
            </button>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {activeTab === 'inbox' && (
              <div className="p-2">
                {receivedMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                ) : (
                  receivedMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-gray-50 mb-2 ${!message.read ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                      onClick={() => {
                        setSelectedMessage(message);
                        if (!message.read) markAsRead(message.id);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-sm">
                            {message.sender.first_name} {message.sender.last_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {message.sender.role}
                          </Badge>
                        </div>
                        {!message.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 truncate">
                        {message.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(message.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'compose' && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">To:</label>
                  <select
                    className="w-full p-2 border rounded-md text-sm"
                    value={composeForm.receiverId}
                    onChange={(e) => setComposeForm(prev => ({ ...prev, receiverId: e.target.value }))}
                  >
                    <option value="">Select recipient...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
                
                
                <div>
                  <label className="block text-sm font-medium mb-1">Message:</label>
                  <Textarea
                    placeholder="Type your message here..."
                    rows={4}
                    value={composeForm.content}
                    onChange={(e) => setComposeForm(prev => ({ ...prev, content: e.target.value }))}
                  />
                </div>
                
                <Button onClick={sendMessage} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Message Details</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedMessage(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-600">From: </span>
                <span className="text-sm">
                  {selectedMessage.sender.first_name} {selectedMessage.sender.last_name} ({selectedMessage.sender.role})
                </span>
              </div>
              
              
              <div>
                <span className="text-sm font-medium text-gray-600">Date: </span>
                <span className="text-sm">{new Date(selectedMessage.created_at).toLocaleString()}</span>
              </div>
              
              <div className="pt-3 border-t">
                <p className="text-sm whitespace-pre-wrap">{selectedMessage.content}</p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setComposeForm({
                    receiverId: selectedMessage.sender.id,
                    content: `\n\n--- Original Message ---\nFrom: ${selectedMessage.sender.first_name} ${selectedMessage.sender.last_name}\nDate: ${new Date(selectedMessage.created_at).toLocaleString()}\n\n${selectedMessage.content}`
                  });
                  setActiveTab('compose');
                  setSelectedMessage(null);
                }}
              >
                Reply
              </Button>
              <Button variant="ghost" onClick={() => setSelectedMessage(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageNotifications;

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, Bot, User, Clock, CheckCircle, MapPin, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  sender: "guest" | "concierge" | "bot";
  message: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read";
}

interface ChatSession {
  id: number;
  guestName: string;
  roomNumber: string;
  status: "active" | "resolved" | "pending";
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

const DigitalConcierge = () => {
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<{ [key: number]: Message[] }>({
    1: [
      {
        id: 1,
        sender: "guest",
        message: "Hi, I'd like to request extra towels for room 205",
        timestamp: "10:30 AM",
        status: "read"
      },
      {
        id: 2,
        sender: "concierge",
        message: "Of course! I'll have housekeeping bring extra towels to your room within 15 minutes.",
        timestamp: "10:32 AM",
        status: "read"
      },
      {
        id: 3,
        sender: "guest",
        message: "Thank you! Also, could you recommend a good restaurant nearby?",
        timestamp: "10:35 AM",
        status: "read"
      },
      {
        id: 4,
        sender: "bot",
        message: "I recommend 'Safari Grill' - it's 5 minutes away and serves excellent Kenyan cuisine. Would you like me to make a reservation?",
        timestamp: "10:36 AM",
        status: "delivered"
      }
    ],
    2: [
      {
        id: 1,
        sender: "guest",
        message: "The AC in my room isn't working properly",
        timestamp: "2:15 PM",
        status: "read"
      },
      {
        id: 2,
        sender: "concierge",
        message: "I apologize for the inconvenience. I'm sending our maintenance team to room 301 right away.",
        timestamp: "2:16 PM",
        status: "sent"
      }
    ]
  });

  const [chatSessions] = useState<ChatSession[]>([
    {
      id: 1,
      guestName: "Alice Johnson",
      roomNumber: "205",
      status: "active",
      lastMessage: "I recommend 'Safari Grill' - it's 5 minutes away...",
      timestamp: "10:36 AM",
      unreadCount: 0
    },
    {
      id: 2,
      guestName: "Robert Smith",
      roomNumber: "301",
      status: "pending",
      lastMessage: "I'm sending our maintenance team to room 301...",
      timestamp: "2:16 PM",
      unreadCount: 1
    },
    {
      id: 3,
      guestName: "Maria Garcia",
      roomNumber: "102",
      status: "resolved",
      lastMessage: "Thank you for the quick service!",
      timestamp: "Yesterday",
      unreadCount: 0
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChat]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeChat) return;

    const newMsg: Message = {
      id: Date.now(),
      sender: "concierge",
      message: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "sent"
    };

    setMessages(prev => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), newMsg]
    }));

    setNewMessage("");

    toast({
      title: "Message Sent",
      description: "Your message has been delivered to the guest.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "resolved": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const quickResponses = [
    "I'll take care of that right away!",
    "Thank you for letting us know. We're on it!",
    "Is there anything else I can help you with?",
    "I've notified the relevant department.",
    "Your request has been processed."
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Digital Concierge</h2>
        <p className="text-slate-600">Real-time chat system for guest requests and assistance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Chat Sessions List */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Active Chats
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 cursor-pointer hover:bg-slate-50 border-b border-slate-100 ${
                    activeChat === session.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                  }`}
                  onClick={() => setActiveChat(session.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-slate-800">{session.guestName}</div>
                      <div className="text-sm text-slate-600">Room {session.roomNumber}</div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(session.status)}>
                        {session.status}
                      </Badge>
                      {session.unreadCount > 0 && (
                        <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mt-1">
                          {session.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 truncate">{session.lastMessage}</div>
                  <div className="text-xs text-slate-400 mt-1">{session.timestamp}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Messages */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 lg:col-span-2">
          {activeChat ? (
            <>
              <CardHeader className="border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {chatSessions.find(s => s.id === activeChat)?.guestName}
                    </CardTitle>
                    <CardDescription>
                      Room {chatSessions.find(s => s.id === activeChat)?.roomNumber}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(chatSessions.find(s => s.id === activeChat)?.status || "")}>
                    {chatSessions.find(s => s.id === activeChat)?.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-96">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages[activeChat]?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender === "guest" ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div className={`flex items-start space-x-2 max-w-xs ${
                        message.sender === "guest" ? "flex-row" : "flex-row-reverse space-x-reverse"
                      }`}>
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className={
                            message.sender === "guest" ? "bg-blue-100" :
                            message.sender === "bot" ? "bg-purple-100" : "bg-green-100"
                          }>
                            {message.sender === "guest" ? <User className="h-4 w-4" /> :
                             message.sender === "bot" ? <Bot className="h-4 w-4" /> :
                             "C"}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`rounded-lg p-3 ${
                          message.sender === "guest" 
                            ? "bg-slate-100 text-slate-800" 
                            : message.sender === "bot"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-500 text-white"
                        }`}>
                          <div className="text-sm">{message.message}</div>
                          <div className={`text-xs mt-1 flex items-center gap-1 ${
                            message.sender === "guest" ? "text-slate-500" : "text-white/70"
                          }`}>
                            <Clock className="h-3 w-3" />
                            {message.timestamp}
                            {message.sender !== "guest" && message.status === "read" && (
                              <CheckCircle className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Responses */}
                <div className="p-2 border-t border-slate-200">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {quickResponses.map((response, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setNewMessage(response)}
                      >
                        {response}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-slate-200">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage} size="sm">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-slate-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>Select a chat to start messaging</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Chat Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{chatSessions.length}</div>
            <div className="text-sm opacity-90">Total Chats</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {chatSessions.filter(s => s.status === "active").length}
            </div>
            <div className="text-sm opacity-90">Active Chats</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {chatSessions.filter(s => s.status === "pending").length}
            </div>
            <div className="text-sm opacity-90">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {chatSessions.filter(s => s.status === "resolved").length}
            </div>
            <div className="text-sm opacity-90">Resolved</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DigitalConcierge;

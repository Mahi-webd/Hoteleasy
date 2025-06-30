
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Bot, User, Clock, Star, Settings, Send, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DigitalConcierge = () => {
  const [newMessage, setNewMessage] = useState("");
  const [selectedChat, setSelectedChat] = useState("chat001");
  const { toast } = useToast();

  // Mock chat data
  const chatSessions = [
    {
      id: "chat001",
      guestName: "John Smith",
      roomNumber: "201",
      status: "active",
      lastMessage: "Can you recommend a good restaurant nearby?",
      timestamp: "2024-01-15 16:30",
      unread: 1
    },
    {
      id: "chat002",
      guestName: "Sarah Johnson",
      roomNumber: "105", 
      status: "resolved",
      lastMessage: "Thank you for the spa booking!",
      timestamp: "2024-01-15 14:20",
      unread: 0
    }
  ];

  const messages = [
    {
      id: "msg001",
      sender: "guest",
      message: "Hello, I need help with room service",
      timestamp: "16:25"
    },
    {
      id: "msg002",
      sender: "bot",
      message: "I'd be happy to help you with room service! What would you like to order?",
      timestamp: "16:26"
    },
    {
      id: "msg003",
      sender: "guest", 
      message: "Can you recommend a good restaurant nearby?",
      timestamp: "16:30"
    }
  ];

  const quickResponses = [
    "Thank you for contacting us!",
    "I'll connect you with our staff right away.",
    "Is there anything else I can help you with?",
    "Your request has been forwarded to the appropriate department."
  ];

  const services = [
    { name: "Room Service", icon: "🍽️", available: true },
    { name: "Spa Booking", icon: "💆", available: true },
    { name: "Restaurant Reservations", icon: "🍷", available: true },
    { name: "Transportation", icon: "🚗", available: false },
    { name: "Local Attractions", icon: "🗺️", available: true },
    { name: "Housekeeping", icon: "🧹", available: true }
  ];

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the guest",
      });
      setNewMessage("");
    }
  };

  const handleQuickResponse = (response: string) => {
    setNewMessage(response);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Digital Concierge</h1>
          <p className="text-slate-600 dark:text-slate-400">AI-powered guest assistance and live chat support</p>
        </div>
        <Button>
          <Settings className="mr-2 h-4 w-4" />
          Configure AI
        </Button>
      </div>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat">Live Chat</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Sessions List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Chats</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {chatSessions.map((chat) => (
                    <div
                      key={chat.id}
                      className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 border-b ${
                        selectedChat === chat.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => setSelectedChat(chat.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{chat.guestName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium text-sm">{chat.guestName}</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400">Room {chat.roomNumber}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={chat.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                            {chat.status}
                          </Badge>
                          {chat.unread > 0 && (
                            <Badge className="bg-red-500 text-white ml-1">{chat.unread}</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{chat.lastMessage}</p>
                      <p className="text-xs text-slate-500 mt-1">{chat.timestamp}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat Window */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Avatar>
                      <AvatarFallback>JS</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium">John Smith</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Room 201 • Online</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Messages */}
                <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender === 'guest' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender === 'guest' 
                          ? 'bg-blue-500 text-white' 
                          : message.sender === 'bot'
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}>
                        <p className="text-sm">{message.message}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender === 'guest' ? 'text-blue-100' : 'text-slate-500'
                        }`}>
                          {message.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Responses */}
                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Quick Responses:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickResponses.map((response, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickResponse(response)}
                        className="text-xs"
                      >
                        {response}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Message Input */}
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Services</CardTitle>
              <CardDescription>Configure concierge services and availability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((service, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{service.icon}</span>
                        <h4 className="font-medium">{service.name}</h4>
                      </div>
                      <Badge className={service.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {service.available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                    <Button size="sm" variant="outline" className="w-full">
                      Configure
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Chats</p>
                    <p className="text-2xl font-bold">142</p>
                  </div>
                  <MessageCircle className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">AI Resolution</p>
                    <p className="text-2xl font-bold">73%</p>
                  </div>
                  <Bot className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Avg Response</p>
                    <p className="text-2xl font-bold">1.2min</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Satisfaction</p>
                    <p className="text-2xl font-bold">4.6</p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>Configure AI responses and behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">AI Response Style</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select response style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Auto-escalation Threshold</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select threshold" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">After 3 failed attempts</SelectItem>
                      <SelectItem value="5">After 5 failed attempts</SelectItem>
                      <SelectItem value="never">Never auto-escalate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button>Save Configuration</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DigitalConcierge;

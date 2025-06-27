
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Bot, Send, Clock, MapPin, Utensils, Car, Calendar, Phone, Star, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DigitalConcierge = () => {
  const [chatMessage, setChatMessage] = useState("");
  const [activeChat, setActiveChat] = useState("bot");
  const { toast } = useToast();

  // Mock chat conversations
  const chatConversations = [
    {
      id: "guest1",
      guest: "John Smith",
      room: "201",
      status: "active",
      lastMessage: "Thank you for the restaurant recommendations!",
      timestamp: "2 min ago",
      unread: 0
    },
    {
      id: "guest2", 
      guest: "Sarah Johnson",
      room: "305",
      status: "pending",
      lastMessage: "Can you help me book a taxi to the airport?",
      timestamp: "5 min ago",
      unread: 1
    },
    {
      id: "guest3",
      guest: "Mike Wilson", 
      room: "102",
      status: "resolved",
      lastMessage: "Perfect, see you at 7 PM for dinner",
      timestamp: "1 hour ago",
      unread: 0
    }
  ];

  // Mock AI chat messages
  const aiChatMessages = [
    {
      sender: "guest",
      message: "Hi, I'm looking for good restaurants nearby",
      timestamp: "10:30 AM"
    },
    {
      sender: "bot",
      message: "I'd be happy to help you find great restaurants! Based on your location, I recommend these nearby options: 1) The Garden Bistro (5 min walk) - International cuisine, 2) Local Spice Kitchen (3 min walk) - Traditional Kenyan dishes, 3) Sunset Terrace (10 min walk) - Fine dining with city views. Would you like more details about any of these?",
      timestamp: "10:30 AM"
    },
    {
      sender: "guest", 
      message: "Tell me more about The Garden Bistro",
      timestamp: "10:32 AM"
    },
    {
      sender: "bot",
      message: "The Garden Bistro is perfect for you! ✨ Open daily 6 PM - 11 PM, they specialize in fresh international cuisine with a beautiful outdoor seating area. Average price: $25-40 per person. They're known for their grilled salmon and pasta dishes. Would you like me to make a reservation for you?",
      timestamp: "10:32 AM"
    }
  ];

  // Popular guest requests
  const popularRequests = [
    { icon: Utensils, title: "Restaurant Recommendations", count: 156 },
    { icon: Car, title: "Transportation", count: 124 },
    { icon: MapPin, title: "Local Attractions", count: 98 },
    { icon: Calendar, title: "Event Bookings", count: 87 },
    { icon: Phone, title: "Room Service", count: 76 }
  ];

  // Quick responses
  const quickResponses = [
    "I'd be happy to help you with that!",
    "Let me check availability for you.",
    "I'll arrange that right away.",
    "Would you like me to make a reservation?",
    "I can provide directions to that location."
  ];

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    
    toast({
      title: "Message Sent",
      description: "Your response has been sent to the guest",
    });
    setChatMessage("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Digital Concierge</h1>
          <p className="text-slate-600 dark:text-slate-400">AI-powered guest assistance and chat support</p>
        </div>
        <Button>
          <Settings className="mr-2 h-4 w-4" />
          Configure AI
        </Button>
      </div>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat">Live Chat</TabsTrigger>
          <TabsTrigger value="ai-demo">AI Assistant</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* Chat List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Active Chats
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {chatConversations.map((chat) => (
                    <div 
                      key={chat.id}
                      className={`p-4 border-b cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        activeChat === chat.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
                      }`}
                      onClick={() => setActiveChat(chat.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm">{chat.guest}</h4>
                        <div className="flex items-center space-x-2">
                          {chat.unread > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {chat.unread}
                            </Badge>
                          )}
                          <Badge 
                            variant={
                              chat.status === 'active' ? 'default' : 
                              chat.status === 'pending' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {chat.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                        Room {chat.room}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                      <p className="text-xs text-slate-400 mt-1">{chat.timestamp}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat Window */}
            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader>
                <CardTitle>
                  {activeChat === "bot" ? "AI Assistant Demo" : 
                   chatConversations.find(c => c.id === activeChat)?.guest || "Select a chat"}
                </CardTitle>
                {activeChat !== "bot" && (
                  <CardDescription>
                    Room {chatConversations.find(c => c.id === activeChat)?.room}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Messages */}
                <div className="flex-1 space-y-4 mb-4 max-h-96 overflow-y-auto">
                  {activeChat === "bot" ? (
                    aiChatMessages.map((msg, index) => (
                      <div key={index} className={`flex ${msg.sender === 'guest' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          msg.sender === 'guest' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-slate-100 dark:bg-slate-700'
                        }`}>
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">{msg.timestamp}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-500 dark:text-slate-400">
                      <MessageCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
                      <p>Select a conversation to view messages</p>
                    </div>
                  )}
                </div>

                {/* Quick Responses */}
                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Quick Responses:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickResponses.slice(0, 3).map((response, index) => (
                      <Button 
                        key={index}
                        variant="outline" 
                        size="sm"
                        onClick={() => setChatMessage(response)}
                      >
                        {response.substring(0, 20)}...
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Message Input */}
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
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

        <TabsContent value="ai-demo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="mr-2 h-5 w-5" />
                  AI Assistant Demo
                </CardTitle>
                <CardDescription>Experience how our AI helps guests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {aiChatMessages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'guest' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md px-4 py-2 rounded-lg ${
                        msg.sender === 'guest' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-slate-100 dark:bg-slate-700'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">{msg.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Capabilities</CardTitle>
                <CardDescription>What our digital concierge can do</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Utensils className="h-5 w-5 text-blue-500" />
                    <div>
                      <h4 className="font-medium">Restaurant Recommendations</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Personalized dining suggestions</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-green-500" />
                    <div>
                      <h4 className="font-medium">Local Attractions</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Tourist spots and activities</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Car className="h-5 w-5 text-orange-500" />
                    <div>
                      <h4 className="font-medium">Transportation</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Taxi, Uber, and public transport</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    <div>
                      <h4 className="font-medium">Booking Services</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Reservations and appointments</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Requests</p>
                    <p className="text-2xl font-bold">1,247</p>
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
                    <p className="text-2xl font-bold">78%</p>
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
                    <p className="text-2xl font-bold">1.2m</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Popular Requests</CardTitle>
              <CardDescription>Most common guest inquiries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {popularRequests.map((request, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <request.icon className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">{request.title}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 h-2 bg-slate-200 rounded-full">
                        <div 
                          className="h-2 bg-blue-500 rounded-full"
                          style={{ width: `${(request.count / 156) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{request.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Assistant Settings</CardTitle>
                <CardDescription>Configure AI behavior and responses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Response Tone</label>
                  <select className="w-full p-2 border rounded-md">
                    <option>Friendly & Professional</option>
                    <option>Formal & Polite</option>
                    <option>Casual & Warm</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Auto-Resolution</label>
                  <div className="space-y-1">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" defaultChecked />
                      <span className="text-sm">Basic inquiries</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" defaultChecked />
                      <span className="text-sm">Restaurant recommendations</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm">Booking modifications</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Chat Settings</CardTitle>
                <CardDescription>Configure chat availability and routing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Operating Hours</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Start time" defaultValue="06:00" />
                    <Input placeholder="End time" defaultValue="23:00" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Staff Notification</label>
                  <select className="w-full p-2 border rounded-md">
                    <option>Immediate for urgent requests</option>
                    <option>Every 5 minutes</option>
                    <option>Every 15 minutes</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DigitalConcierge;

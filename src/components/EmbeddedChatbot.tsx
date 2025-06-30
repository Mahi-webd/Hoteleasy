
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, X, Minimize2, Maximize2, Bot, User, AlertTriangle, Info, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  sender: "user" | "bot";
  content: string;
  timestamp: string;
  type?: "alert" | "info" | "query";
}

interface Room {
  number: string;
  type: string;
  status: string;
  guest: string | null;
  floor: number;
  rate: string;
}

const EmbeddedChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "bot",
      content: "Hello! I'm your hotel assistant. I can help you with room inquiries, occupancy rates, alerts, and more. Try asking 'What rooms are available on floor 2?' or 'What's our occupancy rate today?'",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: "info"
    }
  ]);
  const [hasNewAlerts, setHasNewAlerts] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Mock hotel data - in real app, this would come from your state management
  const rooms: Room[] = [
    { number: "101", type: "Standard Single", status: "occupied", guest: "John Doe", floor: 1, rate: "KES 8,000" },
    { number: "102", type: "Standard Double", status: "available", guest: null, floor: 1, rate: "KES 12,000" },
    { number: "103", type: "Deluxe Double", status: "cleaning", guest: null, floor: 1, rate: "KES 15,000" },
    { number: "104", type: "Suite", status: "maintenance", guest: null, floor: 1, rate: "KES 25,000" },
    { number: "201", type: "Standard Single", status: "occupied", guest: "Jane Smith", floor: 2, rate: "KES 8,000" },
    { number: "202", type: "Standard Double", status: "available", guest: null, floor: 2, rate: "KES 12,000" },
    { number: "203", type: "Deluxe Double", status: "occupied", guest: "Mike Johnson", floor: 2, rate: "KES 15,000" },
    { number: "204", type: "Presidential Suite", status: "available", guest: null, floor: 2, rate: "KES 45,000" },
    { number: "301", type: "Standard Single", status: "occupied", guest: "Sarah Wilson", floor: 3, rate: "KES 8,000" },
    { number: "302", type: "Standard Double", status: "cleaning", guest: null, floor: 3, rate: "KES 12,000" },
    { number: "303", type: "Deluxe Double", status: "available", guest: null, floor: 3, rate: "KES 15,000" },
    { number: "304", type: "Suite", status: "occupied", guest: "David Brown", floor: 3, rate: "KES 25,000" },
  ];

  const processQuery = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    // Room availability queries
    if (lowerQuery.includes("empty") || lowerQuery.includes("available")) {
      if (lowerQuery.includes("floor")) {
        const floorMatch = lowerQuery.match(/floor (\d+)/);
        if (floorMatch) {
          const floor = parseInt(floorMatch[1]);
          const availableRooms = rooms.filter(r => r.floor === floor && r.status === "available");
          if (availableRooms.length > 0) {
            return `Available rooms on floor ${floor}: ${availableRooms.map(r => r.number).join(", ")}`;
          } else {
            return `No available rooms on floor ${floor} at the moment.`;
          }
        }
      }
      const availableRooms = rooms.filter(r => r.status === "available");
      return `Currently available rooms: ${availableRooms.map(r => r.number).join(", ")} (${availableRooms.length} total)`;
    }

    // Occupancy rate queries
    if (lowerQuery.includes("occupancy") || lowerQuery.includes("occupied")) {
      const occupiedRooms = rooms.filter(r => r.status === "occupied").length;
      const totalRooms = rooms.length;
      const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);
      return `Current occupancy rate: ${occupancyRate}% (${occupiedRooms}/${totalRooms} rooms occupied)`;
    }

    // Room status queries
    if (lowerQuery.includes("status") && lowerQuery.includes("room")) {
      const roomMatch = lowerQuery.match(/room (\d+)/);
      if (roomMatch) {
        const roomNumber = roomMatch[1];
        const room = rooms.find(r => r.number === roomNumber);
        if (room) {
          return `Room ${room.number}: ${room.status}${room.guest ? ` (Guest: ${room.guest})` : ""} - ${room.type} - ${room.rate}`;
        } else {
          return `Room ${roomNumber} not found.`;
        }
      }
    }

    // Floor-specific queries
    if (lowerQuery.includes("floor")) {
      const floorMatch = lowerQuery.match(/floor (\d+)/);
      if (floorMatch) {
        const floor = parseInt(floorMatch[1]);
        const floorRooms = rooms.filter(r => r.floor === floor);
        const statusCounts = {
          occupied: floorRooms.filter(r => r.status === "occupied").length,
          available: floorRooms.filter(r => r.status === "available").length,
          cleaning: floorRooms.filter(r => r.status === "cleaning").length,
          maintenance: floorRooms.filter(r => r.status === "maintenance").length
        };
        return `Floor ${floor} status: ${statusCounts.occupied} occupied, ${statusCounts.available} available, ${statusCounts.cleaning} cleaning, ${statusCounts.maintenance} maintenance`;
      }
    }

    // Maintenance queries
    if (lowerQuery.includes("maintenance")) {
      const maintenanceRooms = rooms.filter(r => r.status === "maintenance");
      if (maintenanceRooms.length > 0) {
        return `Rooms under maintenance: ${maintenanceRooms.map(r => r.number).join(", ")}`;
      }
      return "No rooms currently under maintenance.";
    }

    // Cleaning queries
    if (lowerQuery.includes("cleaning")) {
      const cleaningRooms = rooms.filter(r => r.status === "cleaning");
      if (cleaningRooms.length > 0) {
        return `Rooms being cleaned: ${cleaningRooms.map(r => r.number).join(", ")}`;
      }
      return "No rooms currently being cleaned.";
    }

    // Guest queries
    if (lowerQuery.includes("guest")) {
      const occupiedRooms = rooms.filter(r => r.status === "occupied" && r.guest);
      if (occupiedRooms.length > 0) {
        return `Current guests: ${occupiedRooms.map(r => `${r.guest} (Room ${r.number})`).join(", ")}`;
      }
      return "No guests currently checked in.";
    }

    // Revenue queries
    if (lowerQuery.includes("revenue") || lowerQuery.includes("income")) {
      const occupiedRooms = rooms.filter(r => r.status === "occupied");
      const dailyRevenue = occupiedRooms.reduce((sum, room) => {
        const rate = parseInt(room.rate.replace(/[^0-9]/g, ''));
        return sum + rate;
      }, 0);
      return `Current daily revenue from occupied rooms: KES ${dailyRevenue.toLocaleString()}`;
    }

    // Default response
    return "I can help you with:\n• Room availability (e.g., 'What rooms are available on floor 2?')\n• Occupancy rates (e.g., 'What's our occupancy rate?')\n• Room status (e.g., 'What's the status of room 101?')\n• Maintenance info (e.g., 'Which rooms need maintenance?')\n• Guest information (e.g., 'Who are our current guests?')\n• Revenue details (e.g., 'What's our daily revenue?')";
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: "query"
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setIsTyping(true);

    // Process the query and generate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        content: processQuery(userMessage.content),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "info"
      };
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const addAlert = (alertMessage: string) => {
    const alertMsg: Message = {
      id: Date.now().toString(),
      sender: "bot",
      content: alertMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: "alert"
    };
    setMessages(prev => [...prev, alertMsg]);
    setHasNewAlerts(true);
    if (!isOpen) {
      toast({
        title: "New Alert",
        description: alertMessage,
      });
    }
  };

  // Simulate periodic alerts
  useEffect(() => {
    const alertInterval = setInterval(() => {
      const alerts = [
        "Room 205 checkout overdue - Guest should have checked out 2 hours ago",
        "Low inventory alert: Towels running low (12 remaining)",
        "Maintenance request: Room 301 AC not working",
        "VIP guest arriving in 30 minutes - Room 204 preparation needed",
        "Housekeeping alert: Room 103 cleaning completed"
      ];
      
      const randomAlert = alerts[Math.floor(Math.random() * alerts.length)];
      addAlert(randomAlert);
    }, 30000);

    return () => clearInterval(alertInterval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full h-16 w-16 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl relative animate-pulse border-2 border-white/20 backdrop-blur-sm transition-all duration-300 hover:scale-105"
        >
          <MessageCircle className="h-7 w-7 text-white" />
          {hasNewAlerts && (
            <div className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
              <span className="text-xs text-white font-bold">!</span>
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-20 animate-ping"></div>
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-scale-in">
      <Card className={`w-96 shadow-2xl transition-all duration-500 backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border border-white/20 ${
        isMinimized ? 'h-20' : 'h-[32rem]'
      }`}>
        <CardHeader className="flex flex-row items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse"></div>
          <div className="flex items-center space-x-3 relative z-10">
            <div className="relative">
              <Bot className="h-6 w-6 text-white" />
              <Sparkles className="h-3 w-3 text-yellow-300 absolute -top-1 -right-1 animate-spin" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">AI Hotel Assistant</CardTitle>
              <p className="text-xs text-blue-100 opacity-90">Always here to help</p>
            </div>
            {hasNewAlerts && !isMinimized && (
              <Badge className="bg-red-500 text-white text-xs animate-pulse shadow-lg">
                New Alerts
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2 relative z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsMinimized(!isMinimized);
                if (isMinimized) setHasNewAlerts(false);
              }}
              className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full transition-all duration-200 hover:scale-110"
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full transition-all duration-200 hover:scale-110"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-96 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((msg, index) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`max-w-xs px-4 py-3 rounded-2xl text-sm shadow-lg transition-all duration-200 hover:shadow-xl ${
                    msg.sender === 'user' 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-sm' 
                      : msg.type === 'alert'
                      ? 'bg-gradient-to-r from-red-50 to-red-100 text-red-800 border border-red-200 rounded-bl-sm'
                      : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border border-gray-200 rounded-bl-sm dark:from-slate-700 dark:to-slate-600 dark:text-slate-100'
                  }`}>
                    {msg.type === 'alert' && (
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-xs font-bold text-red-700">ALERT</span>
                      </div>
                    )}
                    <div className="flex items-start space-x-2">
                      {msg.sender === 'bot' && msg.type !== 'alert' && (
                        <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                      )}
                      {msg.sender === 'user' && (
                        <User className="h-4 w-4 mt-0.5 flex-shrink-0 text-white" />
                      )}
                      <div className="flex-1">
                        <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                        <p className={`text-xs mt-2 ${
                          msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-slate-400'
                        }`}>
                          {msg.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start animate-fade-in">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-lg dark:from-slate-700 dark:to-slate-600">
                    <div className="flex items-center space-x-2">
                      <Bot className="h-4 w-4 text-blue-600" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <div className="flex space-x-3">
                <Input
                  placeholder="Ask about rooms, occupancy, alerts..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 rounded-xl border-2 border-gray-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm"
                />
                <Button 
                  onClick={sendMessage} 
                  size="sm" 
                  className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg transition-all duration-200 hover:scale-105 px-4"
                  disabled={!message.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default EmbeddedChatbot;

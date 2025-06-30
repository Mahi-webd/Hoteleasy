
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, X, Minimize2, Maximize2, Bot, User, AlertTriangle, Info } from "lucide-react";
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

    // Process the query and generate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        content: processQuery(message),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "info"
      };
      setMessages(prev => [...prev, botResponse]);
    }, 500);

    setMessage("");
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
    }, 30000); // Every 30 seconds

    return () => clearInterval(alertInterval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full h-14 w-14 bg-blue-600 hover:bg-blue-700 shadow-lg relative"
        >
          <MessageCircle className="h-6 w-6" />
          {hasNewAlerts && (
            <div className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">!</span>
            </div>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className={`w-96 shadow-xl transition-all duration-300 ${isMinimized ? 'h-16' : 'h-96'}`}>
        <CardHeader className="flex flex-row items-center justify-between p-4 bg-blue-600 text-white rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <CardTitle className="text-sm">Hotel Assistant</CardTitle>
            {hasNewAlerts && !isMinimized && (
              <Badge className="bg-red-500 text-white text-xs">Alerts</Badge>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsMinimized(!isMinimized);
                if (isMinimized) setHasNewAlerts(false);
              }}
              className="h-6 w-6 p-0 text-white hover:bg-blue-700"
            >
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0 text-white hover:bg-blue-700"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-80">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    msg.sender === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : msg.type === 'alert'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {msg.type === 'alert' && (
                      <div className="flex items-center space-x-1 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-xs font-semibold">ALERT</span>
                      </div>
                    )}
                    <div className="flex items-start space-x-2">
                      {msg.sender === 'bot' && msg.type !== 'alert' && (
                        <Bot className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      )}
                      {msg.sender === 'user' && (
                        <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <p className="whitespace-pre-line">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {msg.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <Input
                  placeholder="Ask about rooms, occupancy, alerts..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1"
                />
                <Button onClick={sendMessage} size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default EmbeddedChatbot;

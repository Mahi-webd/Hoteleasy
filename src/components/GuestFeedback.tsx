
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageCircle, TrendingUp, Users, Filter, Plus, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GuestFeedback = () => {
  const [filterRating, setFilterRating] = useState("all");
  const [newResponse, setNewResponse] = useState("");
  const { toast } = useToast();

  // Mock feedback data
  const feedbackData = [
    {
      id: "FB001",
      guestName: "John Smith",
      roomNumber: "201",
      rating: 5,
      category: "Service",
      feedback: "Excellent service from the front desk staff. Very helpful and professional.",
      date: "2024-01-15",
      status: "responded",
      response: "Thank you for your wonderful feedback!"
    },
    {
      id: "FB002",
      guestName: "Sarah Johnson", 
      roomNumber: "105",
      rating: 3,
      category: "Room",
      feedback: "Room was clean but the AC was not working properly.",
      date: "2024-01-14",
      status: "pending",
      response: null
    }
  ];

  const handleSendResponse = (feedbackId: string) => {
    toast({
      title: "Response Sent",
      description: "Your response has been sent to the guest",
    });
    setNewResponse("");
  };

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Guest Feedback</h1>
          <p className="text-slate-600 dark:text-slate-400">Monitor and respond to guest reviews and feedback</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Survey
        </Button>
      </div>

      <Tabs defaultValue="feedback" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <Select value={filterRating} onValueChange={setFilterRating}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
                <Filter className="h-4 w-4 text-slate-500" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {feedbackData.map((feedback) => (
              <Card key={feedback.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>{feedback.guestName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{feedback.guestName}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Room {feedback.roomNumber} • {feedback.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-1 mb-1">
                        {renderStars(feedback.rating)}
                      </div>
                      <Badge className={feedback.status === "responded" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                        {feedback.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="mb-4">
                    <Badge variant="outline" className="mb-2">{feedback.category}</Badge>
                    <p className="text-slate-700 dark:text-slate-300">{feedback.feedback}</p>
                  </div>

                  {feedback.response && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg mb-4">
                      <p className="text-sm"><strong>Response:</strong> {feedback.response}</p>
                    </div>
                  )}

                  {feedback.status === "pending" && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Type your response..."
                        value={newResponse}
                        onChange={(e) => setNewResponse(e.target.value)}
                      />
                      <Button 
                        size="sm"
                        onClick={() => handleSendResponse(feedback.id)}
                      >
                        <Send className="mr-1 h-3 w-3" />
                        Send Response
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Average Rating</p>
                    <p className="text-2xl font-bold">4.2</p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Reviews</p>
                    <p className="text-2xl font-bold">248</p>
                  </div>
                  <MessageCircle className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Response Rate</p>
                    <p className="text-2xl font-bold">95%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Satisfaction</p>
                    <p className="text-2xl font-bold">87%</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="surveys">
          <Card>
            <CardHeader>
              <CardTitle>Feedback Surveys</CardTitle>
              <CardDescription>Create and manage guest feedback surveys</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Post-Stay Survey</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Sent automatically after checkout</p>
                  <div className="flex space-x-2">
                    <Button size="sm">Edit</Button>
                    <Button size="sm" variant="outline">Preview</Button>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Service Feedback</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Quick feedback for specific services</p>
                  <div className="flex space-x-2">
                    <Button size="sm">Edit</Button>
                    <Button size="sm" variant="outline">Preview</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GuestFeedback;

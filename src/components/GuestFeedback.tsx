import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, MessageSquare, TrendingUp, Users, AlertCircle, CheckCircle, Clock, Filter, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GuestFeedback = () => {
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const { toast } = useToast();

  // Mock feedback data
  const feedbackData = [
    {
      id: "FB001",
      guest: "John Smith",
      room: "201",
      rating: 5,
      category: "Service",
      comment: "Exceptional service from the front desk staff. Very helpful and friendly!",
      date: "2024-01-15",
      status: "responded",
      department: "Front Desk",
      response: "Thank you for your kind words! We'll share this with our team."
    },
    {
      id: "FB002",
      guest: "Sarah Johnson", 
      room: "305",
      rating: 3,
      category: "Room",
      comment: "Room was clean but the AC wasn't working properly. Otherwise good stay.",
      date: "2024-01-14",
      status: "pending",
      department: "Maintenance"
    },
    {
      id: "FB003",
      guest: "Mike Wilson",
      room: "102", 
      rating: 4,
      category: "Food",
      comment: "Great breakfast variety! Would love to see more local dishes.",
      date: "2024-01-13",
      status: "responded",
      department: "Restaurant",
      response: "We're glad you enjoyed breakfast! We'll consider adding more local options."
    },
    {
      id: "FB004",
      guest: "Emma Davis",
      room: "208",
      rating: 2,
      category: "Service",
      comment: "Long wait times at check-in and room service was slow.",
      date: "2024-01-12",
      status: "pending",
      department: "Operations"
    }
  ];

  const feedbackStats = {
    averageRating: 4.2,
    totalFeedback: 156,
    responseRate: 87,
    categories: [
      { name: "Service", count: 45, rating: 4.3 },
      { name: "Room", count: 38, rating: 4.1 },
      { name: "Food", count: 32, rating: 4.5 },
      { name: "Facilities", count: 25, rating: 3.9 },
      { name: "Location", count: 16, rating: 4.7 }
    ]
  };

  const handleRespondToFeedback = (feedbackId: string) => {
    toast({
      title: "Response Sent",
      description: "Your response has been sent to the guest",
    });
  };

  const StarRating = ({ rating, interactive = false, onRatingChange }: { 
    rating: number; 
    interactive?: boolean; 
    onRatingChange?: (rating: number) => void;
  }) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating 
                ? 'text-yellow-400 fill-current' 
                : 'text-slate-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
            onClick={() => interactive && onRatingChange && onRatingChange(star)}
          />
        ))}
      </div>
    );
  };

  const filteredFeedback = feedbackData.filter(feedback => {
    if (feedbackFilter === "all") return true;
    if (feedbackFilter === "pending") return feedback.status === "pending";
    if (feedbackFilter === "responded") return feedback.status === "responded";
    if (feedbackFilter === "high") return feedback.rating >= 4;
    if (feedbackFilter === "low") return feedback.rating <= 2;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Guest Feedback</h1>
          <p className="text-slate-600 dark:text-slate-400">Monitor and respond to guest reviews</p>
        </div>
        <Button>
          <MessageSquare className="mr-2 h-4 w-4" />
          Send Survey
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="feedback">All Feedback</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Average Rating</p>
                    <p className="text-2xl font-bold">{feedbackStats.averageRating}</p>
                  </div>
                  <div className="flex items-center">
                    <StarRating rating={Math.round(feedbackStats.averageRating)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Reviews</p>
                    <p className="text-2xl font-bold">{feedbackStats.totalFeedback}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Response Rate</p>
                    <p className="text-2xl font-bold">{feedbackStats.responseRate}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
                    <p className="text-2xl font-bold">
                      {feedbackData.filter(f => f.status === "pending").length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Feedback</CardTitle>
              <CardDescription>Latest guest reviews and comments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {feedbackData.slice(0, 3).map((feedback) => (
                  <div key={feedback.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{feedback.guest}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Room {feedback.room} • {feedback.date}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <StarRating rating={feedback.rating} />
                        <Badge variant={feedback.status === "responded" ? "default" : "secondary"}>
                          {feedback.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm mb-2">{feedback.comment}</p>
                    {feedback.response && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded mt-2">
                        <p className="text-sm"><strong>Response:</strong> {feedback.response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <select 
                className="p-2 border rounded-md"
                value={feedbackFilter}
                onChange={(e) => setFeedbackFilter(e.target.value)}
              >
                <option value="all">All Feedback</option>
                <option value="pending">Pending Response</option>
                <option value="responded">Responded</option>
                <option value="high">High Ratings (4-5★)</option>
                <option value="low">Low Ratings (1-2★)</option>
              </select>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Showing {filteredFeedback.length} of {feedbackData.length} reviews
            </p>
          </div>

          <div className="space-y-4">
            {filteredFeedback.map((feedback) => (
              <Card key={feedback.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-lg">{feedback.guest}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Room {feedback.room} • {feedback.category} • {feedback.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <StarRating rating={feedback.rating} />
                      <Badge 
                        variant={feedback.status === "responded" ? "default" : "secondary"}
                        className="mt-1"
                      >
                        {feedback.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-slate-700 dark:text-slate-300 mb-4">{feedback.comment}</p>
                  
                  {feedback.response ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h5 className="font-medium text-sm mb-1">Your Response:</h5>
                      <p className="text-sm">{feedback.response}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea 
                        className="w-full p-3 border rounded-md"
                        placeholder="Write your response to this guest..."
                        rows={3}
                      />
                      <Button 
                        onClick={() => handleRespondToFeedback(feedback.id)}
                        size="sm"
                      >
                        Send Response
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rating by Category</CardTitle>
                <CardDescription>Average ratings across different service areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {feedbackStats.categories.map((category) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{category.name}</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          ({category.count} reviews)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <StarRating rating={Math.round(category.rating)} />
                        <span className="text-sm font-medium">{category.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Performance</CardTitle>
                <CardDescription>Your feedback response metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Response Rate</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 h-2 bg-slate-200 rounded-full">
                      <div 
                        className="h-2 bg-green-500 rounded-full"
                        style={{ width: `${feedbackStats.responseRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{feedbackStats.responseRate}%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Avg Response Time</span>
                  <span className="text-sm font-medium">2.3 hours</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Guest Satisfaction</span>
                  <span className="text-sm font-medium">94%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="surveys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Feedback Surveys</CardTitle>
              <CardDescription>Create and manage guest satisfaction surveys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Post-Stay Survey</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    Automatically sent 24 hours after checkout
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge>Active</Badge>
                    <Button size="sm" variant="outline">Edit</Button>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Mid-Stay Check-in</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    Sent on day 2 for stays longer than 3 nights
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">Draft</Badge>
                    <Button size="sm" variant="outline">Edit</Button>
                  </div>
                </div>
              </div>
              
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Create New Survey
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GuestFeedback;

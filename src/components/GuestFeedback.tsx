
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Star, Plus, MessageSquare, TrendingUp, Users, Calendar, Mail, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GuestFeedback = () => {
  const { toast } = useToast();
  const [showCreateSurvey, setShowCreateSurvey] = useState(false);
  const [surveys, setSurveys] = useState([
    {
      id: 1,
      title: "Post-Stay Experience Survey",
      type: "post-stay",
      status: "active",
      responses: 245,
      avgRating: 4.2,
      created: "2024-01-15"
    },
    {
      id: 2,
      title: "Mid-Stay Satisfaction Check",
      type: "mid-stay",
      status: "active",
      responses: 156,
      avgRating: 4.5,
      created: "2024-01-10"
    },
    {
      id: 3,
      title: "Dining Experience Survey",
      type: "service-specific",
      status: "draft",
      responses: 0,
      avgRating: 0,
      created: "2024-01-20"
    }
  ]);

  const recentFeedback = [
    {
      id: 1,
      guest: "John Doe",
      room: "101",
      rating: 5,
      comment: "Excellent service and beautiful room. The staff was very helpful throughout our stay.",
      date: "2024-01-20",
      category: "Overall Experience"
    },
    {
      id: 2,
      guest: "Jane Smith",
      room: "203",
      rating: 4,
      comment: "Good experience overall, but the WiFi was a bit slow in the evening.",
      date: "2024-01-19",
      category: "Technology"
    },
    {
      id: 3,
      guest: "Mike Johnson",
      room: "305",
      rating: 3,
      comment: "Room was clean but the AC was too noisy. Food was great though!",
      date: "2024-01-18",
      category: "Room Quality"
    }
  ];

  const handleCreateSurvey = (surveyData: any) => {
    const newSurvey = {
      id: surveys.length + 1,
      title: surveyData.title,
      type: surveyData.type,
      status: "draft",
      responses: 0,
      avgRating: 0,
      created: new Date().toISOString().split('T')[0]
    };

    setSurveys([...surveys, newSurvey]);
    setShowCreateSurvey(false);
    toast({
      title: "Survey Created",
      description: `Survey "${surveyData.title}" has been created successfully`,
    });
  };

  const handleSurveyAction = (surveyId: number, action: string) => {
    setSurveys(surveys.map(survey => 
      survey.id === surveyId 
        ? { ...survey, status: action === 'activate' ? 'active' : action === 'pause' ? 'paused' : survey.status }
        : survey
    ));
    
    toast({
      title: "Survey Updated",
      description: `Survey has been ${action}d successfully`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "paused": return "bg-yellow-100 text-yellow-800";
      case "draft": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${
          index < rating 
            ? 'text-yellow-400 fill-current' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Guest Feedback</h2>
          <p className="text-slate-600 dark:text-slate-400">Collect and analyze guest feedback and satisfaction</p>
        </div>
        <Dialog open={showCreateSurvey} onOpenChange={setShowCreateSurvey}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Survey
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Survey</DialogTitle>
              <DialogDescription>Design a new feedback survey for guests</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              handleCreateSurvey({
                title: formData.get('title'),
                type: formData.get('type'),
                description: formData.get('description')
              });
            }}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Survey Title</Label>
                  <Input name="title" id="title" placeholder="e.g., Checkout Experience Survey" required />
                </div>
                <div>
                  <Label htmlFor="type">Survey Type</Label>
                  <Select name="type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select survey type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pre-arrival">Pre-Arrival</SelectItem>
                      <SelectItem value="check-in">Check-In</SelectItem>
                      <SelectItem value="mid-stay">Mid-Stay</SelectItem>
                      <SelectItem value="check-out">Check-Out</SelectItem>
                      <SelectItem value="post-stay">Post-Stay</SelectItem>
                      <SelectItem value="service-specific">Service-Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea name="description" id="description" placeholder="Brief description of the survey purpose..." />
                </div>
                <Button type="submit" className="w-full">Create Survey</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Feedback Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Responses</p>
                <p className="text-2xl font-bold">
                  {surveys.reduce((sum, survey) => sum + survey.responses, 0)}
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Average Rating</p>
                <p className="text-2xl font-bold">
                  {(surveys.reduce((sum, survey) => sum + survey.avgRating * survey.responses, 0) / 
                    surveys.reduce((sum, survey) => sum + survey.responses, 0) || 0).toFixed(1)}
                </p>
              </div>
              <Star className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Active Surveys</p>
                <p className="text-2xl font-bold">
                  {surveys.filter(s => s.status === 'active').length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100">Response Rate</p>
                <p className="text-2xl font-bold">78%</p>
              </div>
              <Users className="h-8 w-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="surveys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="surveys">Feedback Surveys</TabsTrigger>
          <TabsTrigger value="responses">Recent Feedback</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="surveys">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {surveys.map((survey) => (
              <Card key={survey.id} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{survey.title}</CardTitle>
                      <CardDescription>
                        {survey.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Survey
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(survey.status)}>
                      {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Responses</p>
                      <p className="font-semibold text-lg">{survey.responses}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Avg Rating</p>
                      <div className="flex items-center space-x-1">
                        <span className="font-semibold text-lg">{survey.avgRating.toFixed(1)}</span>
                        <div className="flex">
                          {renderStars(Math.round(survey.avgRating))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    {survey.status === 'draft' ? (
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleSurveyAction(survey.id, 'activate')}
                      >
                        Activate
                      </Button>
                    ) : survey.status === 'active' ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleSurveyAction(survey.id, 'pause')}
                      >
                        Pause
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleSurveyAction(survey.id, 'activate')}
                      >
                        Resume
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="responses">
          <div className="space-y-4">
            {recentFeedback.map((feedback) => (
              <Card key={feedback.id} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold">{feedback.guest}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Room {feedback.room} • {feedback.date}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex">
                        {renderStars(feedback.rating)}
                      </div>
                      <Badge variant="outline">{feedback.category}</Badge>
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{feedback.comment}</p>
                  <div className="flex space-x-2 mt-4">
                    <Button size="sm" variant="outline">
                      <Mail className="mr-1 h-3 w-3" />
                      Respond
                    </Button>
                    <Button size="sm" variant="outline">
                      <Phone className="mr-1 h-3 w-3" />
                      Follow Up
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Rating Distribution</CardTitle>
                <CardDescription>Distribution of guest ratings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 w-16">
                      <span className="text-sm font-medium">{rating}</span>
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                    </div>
                    <Progress value={rating === 5 ? 45 : rating === 4 ? 35 : rating === 3 ? 15 : rating === 2 ? 3 : 2} className="flex-1" />
                    <span className="text-sm text-slate-600 w-8">
                      {rating === 5 ? '45%' : rating === 4 ? '35%' : rating === 3 ? '15%' : rating === 2 ? '3%' : '2%'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Feedback Categories</CardTitle>
                <CardDescription>Most commented categories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { category: "Overall Experience", count: 89, rating: 4.2 },
                  { category: "Room Quality", count: 67, rating: 4.1 },
                  { category: "Service", count: 54, rating: 4.5 },
                  { category: "Food & Beverage", count: 43, rating: 4.0 },
                  { category: "Technology", count: 32, rating: 3.8 }
                ].map((item) => (
                  <div key={item.category} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.category}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{item.count} mentions</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm font-medium">{item.rating}</span>
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GuestFeedback;

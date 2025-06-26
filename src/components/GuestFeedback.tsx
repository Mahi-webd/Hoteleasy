
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, MessageCircle, ThumbsUp, ThumbsDown, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GuestFeedback = () => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [guestName, setGuestName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const { toast } = useToast();

  const feedbackData = [
    {
      id: 1,
      guestName: "Alice Johnson",
      roomNumber: "205",
      rating: 5,
      comment: "Excellent service and beautiful views! The staff was incredibly helpful.",
      date: "2025-06-25",
      category: "Service"
    },
    {
      id: 2,
      guestName: "Robert Smith",
      roomNumber: "301",
      rating: 4,
      comment: "Great stay overall. Room was clean and comfortable. Could improve breakfast variety.",
      date: "2025-06-24",
      category: "Food"
    },
    {
      id: 3,
      guestName: "Maria Garcia",
      roomNumber: "102",
      rating: 5,
      comment: "Perfect location and amazing hospitality. Will definitely return!",
      date: "2025-06-23",
      category: "Overall"
    },
    {
      id: 4,
      guestName: "David Wilson",
      roomNumber: "401",
      rating: 3,
      comment: "Room was nice but had some maintenance issues with the AC.",
      date: "2025-06-22",
      category: "Facilities"
    }
  ];

  const handleSubmitFeedback = () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please provide a rating before submitting.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Feedback Submitted!",
      description: "Thank you for your valuable feedback. We appreciate your input!",
    });

    // Reset form
    setRating(0);
    setFeedback("");
    setGuestName("");
    setRoomNumber("");
  };

  const renderStars = (count: number, interactive: boolean = false) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= count 
                ? "text-yellow-400 fill-current" 
                : "text-gray-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
            onClick={interactive ? () => setRating(star) : undefined}
          />
        ))}
      </div>
    );
  };

  const averageRating = feedbackData.reduce((acc, item) => acc + item.rating, 0) / feedbackData.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Guest Feedback</h2>
          <p className="text-slate-600">Collect and manage guest reviews and ratings</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <MessageCircle className="mr-2 h-4 w-4" />
              Leave Feedback
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Share Your Experience</DialogTitle>
              <DialogDescription>We value your feedback and use it to improve our service</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="guestName">Your Name</Label>
                <Input
                  id="guestName"
                  placeholder="John Doe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="roomNumber">Room Number</Label>
                <Input
                  id="roomNumber"
                  placeholder="205"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                />
              </div>
              <div>
                <Label>Overall Rating</Label>
                <div className="mt-2">
                  {renderStars(rating, true)}
                </div>
              </div>
              <div>
                <Label htmlFor="feedback">Comments</Label>
                <Textarea
                  id="feedback"
                  placeholder="Tell us about your experience..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>
              <Button onClick={handleSubmitFeedback} className="w-full">
                Submit Feedback
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Feedback Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
            <div className="text-sm opacity-90">Average Rating</div>
            <div className="mt-1">
              {renderStars(Math.round(averageRating))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {feedbackData.filter(f => f.rating >= 4).length}
            </div>
            <div className="text-sm opacity-90">Positive Reviews</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{feedbackData.length}</div>
            <div className="text-sm opacity-90">Total Reviews</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {Math.round((feedbackData.filter(f => f.rating >= 4).length / feedbackData.length) * 100)}%
            </div>
            <div className="text-sm opacity-90">Satisfaction Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Feedback */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
          <CardDescription>Latest guest reviews and ratings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {feedbackData.map((item) => (
              <div key={item.id} className="border-b border-slate-200 pb-4 last:border-b-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-slate-800">{item.guestName}</div>
                    <div className="text-sm text-slate-600">Room {item.roomNumber} • {item.date}</div>
                  </div>
                  <div className="text-right">
                    {renderStars(item.rating)}
                    <Badge variant="outline" className="mt-1">
                      {item.category}
                    </Badge>
                  </div>
                </div>
                <p className="text-slate-700 text-sm">{item.comment}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GuestFeedback;

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import LimitExceededModal from "@/components/subscription/LimitExceededModal";
import PlanBadge from "@/components/subscription/PlanBadge";
import { Plus, X, AlertCircle } from "lucide-react";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { toast } from "react-toastify";

const AskQuestionIndex = () => {
  const router = useRouter();
  const { user, subscription, fetchSubscription } = useAuth();
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    tags: [] as string[],
  });
  const [newTag, setNewTag] = useState("");
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitErrorMessage, setLimitErrorMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    if (id === "tags") {
      const tagarray = value
        .split(/[\s,]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      setFormData((prev) => ({ ...prev, tags: tagarray }));
    } else {
      setFormData((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to ask question");
      router.push("/auth");
      return;
    }
    try {
      const res = await axiosInstance.post("/question/ask", {
        postquestiondata: {
          questiontitle: formData.title,
          questionbody: formData.body,
          questiontags: formData.tags,
          userposted: user.name,
          userid: user?._id,
        },
      });
      if (res.data.data) {
        toast.success("Question posted successfully!");
        fetchSubscription();
        router.push("/");
      }
    } catch (error: any) {
      console.log(error);
      if (error.response?.status === 403 && error.response?.data?.limitExceeded) {
        setLimitErrorMessage(error.response.data.message);
        setLimitModalOpen(true);
      } else {
        toast.error(error.response?.data?.message || "Something went wrong");
      }
    }
  };

  const handleAddTag = (e: any) => {
    e.preventDefault();
    const trimmedTag = newTag.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData({ ...formData, tags: [...formData.tags, trimmedTag] });
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag: any) => tag !== tagToRemove),
    });
  };

  const currentPlan = subscription?.plan || user?.plan || "free";
  const dailyQuestions = subscription?.dailyQuestions;

  return (
    <Mainlayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
          <h1 className="text-xl lg:text-2xl font-semibold">
            Ask a public question
          </h1>
          {user && (
            <div className="flex items-center gap-2 text-sm bg-orange-50 dark:bg-gray-800 p-2 rounded-lg border border-orange-200">
              <span className="font-medium text-gray-700 dark:text-gray-300">Plan:</span>
              <PlanBadge plan={currentPlan} size="sm" />
              {dailyQuestions && (
                <span className="text-xs text-orange-700 font-semibold ml-2">
                  Remaining today: {dailyQuestions.remaining}
                </span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg lg:text-xl">
                Writing a good question
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="title" className="text-base font-semibold">
                  Title
                </Label>
                <p className="text-sm text-gray-600 mb-2">
                  Be specific and imagine you're asking a question to another
                  person.
                </p>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. How to center a div in CSS?"
                  className="w-full"
                />
              </div>

              <div>
                <Label htmlFor="body" className="text-base font-semibold">
                  What are the details of your problem?
                </Label>
                <p className="text-sm text-gray-600 mb-2">
                  Introduce the problem and expand on what you put in the title.
                  Minimum 20 characters.
                </p>
                <Textarea
                  id="body"
                  value={formData.body}
                  onChange={handleChange}
                  placeholder="Describe your problem in detail..."
                  className="min-h-32 lg:min-h-48 w-full"
                />
              </div>

              <div>
                <Label htmlFor="tags" className="text-base font-semibold">
                  Tags
                </Label>
                <p className="text-sm text-gray-600 mb-2">
                  Add up to 5 tags to describe what your question is about.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="e.g. javascript react nextjs"
                    className="w-full"
                  />
                  <Button
                    onClick={handleAddTag}
                    variant="outline"
                    size="sm"
                    type="button"
                    className="bg-orange-600 text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag: any) => {
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-orange-100 text-orange-800 flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
                  Post your question
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <LimitExceededModal
          isOpen={limitModalOpen}
          onClose={() => setLimitModalOpen(false)}
          message={limitErrorMessage}
          currentPlan={currentPlan}
          limit={dailyQuestions?.limit || 1}
        />
      </div>
    </Mainlayout>
  );
};

export default AskQuestionIndex;

import React, { useEffect, useState } from "react";
import Mainlayout from "@/layout/Mainlayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import Link from "next/link";
import axiosInstance from "@/lib/axiosinstance";

export default function TagsPage() {
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await axiosInstance.get("/question/getallquestion");
        const questions = res.data.data || [];
        const tagMap: Record<string, number> = {};

        questions.forEach((q: any) => {
          if (Array.isArray(q.questiontags)) {
            q.questiontags.forEach((t: string) => {
              if (t) {
                tagMap[t] = (tagMap[t] || 0) + 1;
              }
            });
          }
        });

        const tagList = Object.entries(tagMap).map(([name, count]) => ({
          name,
          count,
        }));
        setTags(tagList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTags();
  }, []);

  return (
    <Mainlayout>
      <div className="max-w-5xl mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <Tag className="w-6 h-6 text-orange-500" /> Tags
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            A tag is a keyword or label that categorizes your question with other, similar questions.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No tags found yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {tags.map((tag) => (
              <Card key={tag.name} className="hover:border-orange-300 transition-colors">
                <CardContent className="p-4 flex justify-between items-center">
                  <Link href={`/tags/${encodeURIComponent(tag.name)}`}>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer">
                      {tag.name}
                    </Badge>
                  </Link>
                  <span className="text-xs text-gray-500 font-medium">
                    {tag.count} question{tag.count !== 1 ? "s" : ""}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Mainlayout>
  );
}

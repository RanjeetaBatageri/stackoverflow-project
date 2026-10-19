import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Mainlayout from "@/layout/Mainlayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import axiosInstance from "@/lib/axiosinstance";

export default function TagDetail() {
  const router = useRouter();
  const { tag } = router.query;
  const tagName = Array.isArray(tag) ? tag[0] : tag;
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tagName) return;
    const fetchQuestions = async () => {
      try {
        const res = await axiosInstance.get("/question/getallquestion");
        const allQuestions = res.data.data || [];
        const filtered = allQuestions.filter((q: any) =>
          q.questiontags?.includes(tagName)
        );
        setQuestions(filtered);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [tagName]);

  return (
    <Mainlayout>
      <div className="max-w-5xl mx-auto py-6">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Questions tagged</h1>
          {tagName && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-lg px-3 py-1">
              [{tagName}]
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No questions found with tag [{tagName}].
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <Card key={q._id}>
                <CardContent className="p-4">
                  <Link href={`/questions/${q._id}`}>
                    <h2 className="text-lg font-semibold text-blue-600 hover:underline">
                      {q.questiontitle}
                    </h2>
                  </Link>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {q.questionbody}
                  </p>
                  <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                    <div className="flex gap-1">
                      {q.questiontags?.map((t: string) => (
                        <Badge key={t} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <span>Asked by {q.userposted}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Mainlayout>
  );
}

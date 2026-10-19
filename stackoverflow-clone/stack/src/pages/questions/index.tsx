import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Mainlayout from "@/layout/Mainlayout";
import axiosInstance from "@/lib/axiosinstance";
import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function QuestionsPage() {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await axiosInstance.get("/question/getallquestion");
        setQuestions(res.data.data || []);
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  if (loading) {
    return (
      <Mainlayout>
        <div className="flex justify-center items-center p-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Mainlayout>
    );
  }

  return (
    <Mainlayout>
      <main className="min-w-0 p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-xl lg:text-2xl font-semibold">{t("allQuestions")}</h1>

          <button
            onClick={() => router.push("/ask")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
          >
            {t("askQuestion")}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center mb-4 text-sm gap-2 sm:gap-4">
          <span className="text-gray-600">
            {questions.length} questions
          </span>

          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs sm:text-sm">
              Newest
            </button>

            <button className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-xs sm:text-sm">
              Active
            </button>

            <button className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-xs sm:text-sm">
              Unanswered
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="text-center text-gray-500 py-10 border-t border-gray-200">
            No questions found.
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
              <div
                key={question._id}
                className="border-b border-gray-200 pb-4"
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex sm:flex-col items-center text-sm text-gray-600 sm:w-20 gap-4 sm:gap-2">
                    <div className="text-center">
                      <div className="font-medium">
                        {question.upvote?.length || 0}
                      </div>
                      <div className="text-xs">votes</div>
                    </div>

                    <div className="text-center">
                      <div
                        className={`font-medium ${
                          question.answer?.length > 0
                            ? "text-green-600 bg-green-100 px-2 py-1 rounded"
                            : ""
                        }`}
                      >
                        {question.noofanswer || 0}
                      </div>

                      <div className="text-xs">
                        {question.noofanswer === 1 ? "answer" : "answers"}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/questions/${question._id}`}
                      className="text-blue-600 hover:text-blue-800 text-base lg:text-lg font-medium mb-2 block"
                    >
                      {question.questiontitle}
                    </Link>

                    <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                      {question.questionbody}
                    </p>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {question.questiontags?.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center text-xs text-gray-600">
                        <Link
                          href={`/users/${question.userid}`}
                          className="flex items-center"
                        >
                          <Avatar className="w-4 h-4 mr-1">
                            <AvatarFallback className="text-xs">
                              {question.userposted?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>

                          <span className="text-blue-600 hover:text-blue-800 mr-1">
                            {question.userposted || "Unknown user"}
                          </span>
                        </Link>

                        <span>
                          asked{" "}
                          {question.askedon
                            ? new Date(
                                question.askedon
                              ).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </Mainlayout>
  );
}
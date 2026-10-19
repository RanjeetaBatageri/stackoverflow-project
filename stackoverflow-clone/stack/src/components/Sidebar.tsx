import { cn } from "@/lib/utils";
import {
  Bookmark,
  Bot,
  Building,
  FileText,
  Home,
  MessageSquare,
  MessageSquareIcon,
  Tag,
  Trophy,
  Users,
  Shield,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import { Badge } from "./ui/badge";
import { useLanguage } from "@/lib/LanguageContext";

const Sidebar = ({ isopen }: any) => {
  const { t } = useLanguage();
  return (
    <div>
      <aside
        className={cn(
          " top-[53px]  w-48 lg:w-64 min-h-screen bg-white shadow-sm border-r transition-transform duration-200 ease-in-out md:translate-x-0",
          isopen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="p-2 lg:p-4">
          <ul className="space-y-1">
            <li>
              <Link
                href="/"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <Home className="w-4 h-4 mr-2 lg:mr-3" />
                {t("home")}
              </Link>
            </li>
            <li>
              <Link
                href="/questions"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <MessageSquareIcon className="w-4 h-4 mr-2 lg:mr-3" />
                {t("questions")}
              </Link>
            </li>
            <li>
              <Link
                href="/community"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <Users className="w-4 h-4 mr-2 lg:mr-3 text-orange-500" />
                {t("community")}
                <Badge variant="secondary" className="ml-auto text-xs bg-orange-100 text-orange-800">
                  Social
                </Badge>
              </Link>
            </li>
            <li>
              <Link
                href="/ask"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <Bot className="w-4 h-4 mr-2 lg:mr-3 text-blue-600" />
                AI Assist
                <Badge variant="secondary" className="ml-auto text-xs bg-blue-100 text-blue-800">
                  Ask
                </Badge>
              </Link>
            </li>
            <li>
              <Link
                href="/tags"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <Tag className="w-4 h-4 mr-2 lg:mr-3" />
                {t("tags")}
              </Link>
            </li>
            <li>
              <Link
                href="/users"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <Users className="w-4 h-4 mr-2 lg:mr-3" />
                {t("users")}
              </Link>
            </li>
            <li>
              <Link
                href="/users/security"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <Shield className="w-4 h-4 mr-2 lg:mr-3 text-blue-600" />
                Security & Devices
              </Link>
            </li>
            <li>
              <Link
                href="/community"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
                title="Saves & Bookmarks are managed in Community Feed and Question details"
              >
                <Bookmark className="w-4 h-4 mr-2 lg:mr-3 text-yellow-600" />
                Saves
              </Link>
            </li>
            <li>
              <Link
                href="/pricing"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <Trophy className="w-4 h-4 mr-2 lg:mr-3 text-orange-500" />
                Challenges
                <Badge
                  variant="secondary"
                  className="ml-auto text-xs bg-orange-100 text-orange-800"
                >
                  Plans
                </Badge>
              </Link>
            </li>
            <li>
              <Link
                href="/community"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <MessageSquare className="w-4 h-4 mr-2 lg:mr-3" />
                Chat
              </Link>
            </li>
            <li>
              <Link
                href="/community"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <FileText className="w-4 h-4 mr-2 lg:mr-3" />
                Articles
              </Link>
            </li>

            <li>
              <Link
                href="/users"
                className="flex items-center px-2 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm"
              >
                <Building className="w-4 h-4 mr-2 lg:mr-3" />
                Companies
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
    </div>
  );
};

export default Sidebar;

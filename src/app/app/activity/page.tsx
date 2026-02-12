"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClipboardList,
  faFilter,
  faSearch,
  faRobot,
  faUser,
  faSatelliteDish,
  faBug,
  faFileAlt,
  faBullseye,
  faPlay,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useActivityLog } from "@/lib/hooks/useActivityLog";
import { ActivityType } from "@/lib/types/pentest";

const activityIcons: Record<ActivityType, any> = {
  manual_test: faUser,
  ai_scan: faRobot,
  nmap_scan: faSatelliteDish,
  openvas_scan: faSatelliteDish,
  zap_scan: faSatelliteDish,
  finding_added: faBug,
  report_generated: faFileAlt,
  target_added: faBullseye,
  engagement_started: faPlay,
  engagement_completed: faCheckCircle,
};

const activityColors: Record<ActivityType, string> = {
  manual_test: "bg-blue-100 text-blue-600",
  ai_scan: "bg-purple-100 text-purple-600",
  nmap_scan: "bg-cyan-100 text-cyan-600",
  openvas_scan: "bg-orange-100 text-orange-600",
  zap_scan: "bg-green-100 text-green-600",
  finding_added: "bg-red-100 text-red-600",
  report_generated: "bg-gray-100 text-gray-600",
  target_added: "bg-yellow-100 text-yellow-600",
  engagement_started: "bg-emerald-100 text-emerald-600",
  engagement_completed: "bg-teal-100 text-teal-600",
};

export default function ActivityPage() {
  const { activities, loading } = useActivityLog(100);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<ActivityType | "all">("all");

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.target?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === "all" || activity.type === filterType;

    return matchesSearch && matchesFilter;
  });

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
            <p className="text-gray-500 mt-1">
              Track all pentest activities - manual and automated
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
              />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <FontAwesomeIcon
                icon={faFilter}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
              />
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as ActivityType | "all")
                }
                className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none bg-white min-w-[180px]"
              >
                <option value="all">All Activities</option>
                <option value="manual_test">Manual Tests</option>
                <option value="ai_scan">AI Scans</option>
                <option value="finding_added">Findings</option>
                <option value="engagement_started">Engagements</option>
                <option value="nmap_scan">Nmap Scans</option>
                <option value="openvas_scan">OpenVAS Scans</option>
                <option value="zap_scan">ZAP Scans</option>
              </select>
            </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading activities...
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="p-8 text-center">
              <FontAwesomeIcon
                icon={faClipboardList}
                className="w-12 h-12 text-gray-300 mb-4"
              />
              <h3 className="text-lg font-medium text-gray-900">
                No activities yet
              </h3>
              <p className="text-gray-500 mt-1">
                Start a manual test or run an AI scan to see activities here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${activityColors[activity.type] || "bg-gray-100 text-gray-600"}`}
                    >
                      <FontAwesomeIcon
                        icon={activityIcons[activity.type] || faClipboardList}
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-gray-900 truncate">
                          {activity.title}
                        </h4>
                        <span className="text-sm text-gray-500 whitespace-nowrap">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {activity.description}
                        </p>
                      )}
                      {activity.target && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-mono">
                            {activity.target}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

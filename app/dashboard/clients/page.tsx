"use client";

import { useState, useEffect } from "react";
import { CallerProfile, Job, Call } from "@/lib/google-sheets";
import { MessageBubble } from "@/components/MessageBubble";
import { AudioPlayer } from "@/components/AudioPlayer";

export default function ClientsPage() {
  const [profiles, setProfiles] = useState<CallerProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedClient, setSelectedClient] = useState<CallerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setProfiles(data.profiles);
      setJobs(data.jobs);
      setCalls(data.calls);
      setLoading(false);
    }
    fetchData();
  }, []);

  const getClientJobs = (phoneNumber: string) => {
    return jobs.filter(j => j.phoneNumber === phoneNumber);
  };

  const getClientCalls = (phoneNumber: string) => {
    return calls.filter(c => c.phoneNumber === phoneNumber);
  };

  const getClientRevenue = (phoneNumber: string) => {
    return jobs
      .filter(j => j.phoneNumber === phoneNumber)
      .reduce((sum, j) => sum + j.price, 0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-12">
        <div className="max-w-[1400px] mx-auto text-center">
          <p className="text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-12 space-y-12">
      <div className="max-w-[1400px] mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-semibold neon-glow tracking-wide">
            Clients
          </h1>
          <p className="text-sm text-zinc-500 tracking-wide">
            Read-only client overview
          </p>
        </div>

        {/* Client Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => {
            const clientJobs = getClientJobs(profile.phoneNumber);
            const clientCalls = getClientCalls(profile.phoneNumber);
            const clientRevenue = getClientRevenue(profile.phoneNumber);
            const hasRecordings = clientCalls.some(c => c.audioUrl);

            return (
              <button
                key={profile.phoneNumber}
                onClick={() => setSelectedClient(profile)}
                className="glass-card rounded-2xl p-6 text-left space-y-4 hover:border-purple-400/30"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-zinc-200">
                      {profile.callerName}
                    </h3>
                    <p className="text-xs text-zinc-600">
                      {profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                    </p>
                  </div>
                  {hasRecordings && (
                    <div className="w-2 h-2 rounded-full bg-purple-400" title="Has call recordings" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/30">
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                      Total Jobs
                    </div>
                    <div className="text-xl font-semibold text-purple-400">
                      {clientJobs.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                      Revenue
                    </div>
                    <div className="text-xl font-semibold text-emerald-400">
                      ${clientRevenue}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <span>Last contact: {new Date(profile.lastCallDate).toLocaleDateString()}</span>
                  <span>{clientCalls.length} calls</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Client Detail Modal */}
        {selectedClient && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-8">
            <div className="glass-card rounded-3xl p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-200">
                    {selectedClient.callerName}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {selectedClient.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-zinc-600 hover:text-zinc-400 text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800/50"
                >
                  x
                </button>
              </div>

              {/* Call Recordings Section */}
              {getClientCalls(selectedClient.phoneNumber).length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                    Call Recordings
                  </h3>
                  <div className="space-y-3">
                    {getClientCalls(selectedClient.phoneNumber).map((call) => (
                      <div
                        key={call.id}
                        className="rounded-xl p-4 bg-zinc-800/30"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              call.outcome === 'booked'
                                ? 'bg-emerald-400'
                                : call.outcome === 'voicemail'
                                ? 'bg-yellow-400'
                                : 'bg-zinc-500'
                            }`} />
                            <span className="text-sm text-zinc-300">
                              {new Date(call.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="text-xs text-zinc-600">
                              {formatDuration(call.durationSeconds)}
                            </span>
                          </div>
                          {call.outcome && (
                            <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider ${
                              call.outcome === 'booked'
                                ? 'bg-emerald-400/10 text-emerald-400'
                                : 'bg-zinc-700 text-zinc-400'
                            }`}>
                              {call.outcome.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        {call.audioUrl ? (
                          <AudioPlayer
                            audioUrl={call.audioUrl}
                            duration={call.durationSeconds}
                          />
                        ) : (
                          <div className="text-xs text-zinc-600 italic">
                            No recording available
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Job History */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                  Job History
                </h3>
                {getClientJobs(selectedClient.phoneNumber).length === 0 ? (
                  <p className="text-sm text-zinc-600">No jobs recorded</p>
                ) : (
                  getClientJobs(selectedClient.phoneNumber).map((job) => (
                    <div key={job.id} className="status-indicator rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-300">{job.title}</span>
                        <span className="text-emerald-400 font-semibold">${job.price}</span>
                      </div>
                      <div className="text-xs text-zinc-600">
                        {new Date(job.date).toLocaleDateString()} - {job.status}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Conversation Transcript - iPhone Style */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                  Conversation Transcript
                </h3>
                <div className="bg-zinc-900/80 rounded-2xl p-4 max-h-96 overflow-y-auto">
                  {selectedClient.messages.length === 0 ? (
                    <p className="text-sm text-zinc-600 text-center py-8">No messages</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedClient.messages.map((msg, idx) => (
                        <MessageBubble
                          key={idx}
                          role={msg.role}
                          content={msg.content}
                          timestamp={msg.timestamp}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

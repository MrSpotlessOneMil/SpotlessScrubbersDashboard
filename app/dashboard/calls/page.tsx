"use client";

import { useState, useEffect } from "react";
import { CallerProfile, Call } from "@/lib/google-sheets";
import { MessageBubble } from "@/components/MessageBubble";
import { AudioPlayer } from "@/components/AudioPlayer";

export default function CallsPage() {
  const [profiles, setProfiles] = useState<CallerProfile[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<CallerProfile | null>(null);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setProfiles(data.profiles);
      setCalls(data.calls);
      setIsLiveData(data.isLiveData);
      if (data.profiles.length > 0) {
        setSelectedProfile(data.profiles[0]);
        // Select the most recent call for this profile
        const profileCalls = data.calls.filter(
          (c: Call) => c.phoneNumber === data.profiles[0].phoneNumber
        );
        if (profileCalls.length > 0) {
          setSelectedCall(profileCalls[0]);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const formatPhone = (phone: string) => {
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProfileCalls = (phoneNumber: string) => {
    return calls.filter(c => c.phoneNumber === phoneNumber);
  };

  const handleProfileSelect = (profile: CallerProfile) => {
    setSelectedProfile(profile);
    const profileCalls = getProfileCalls(profile.phoneNumber);
    setSelectedCall(profileCalls.length > 0 ? profileCalls[0] : null);
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
            Conversations
          </h1>
          <p className="text-sm text-zinc-500 tracking-wide">
            {isLiveData ? "Live call recordings" : "Demo conversations"}
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Caller List */}
          <div className="lg:col-span-3">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800/30">
                <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Callers
                </h2>
              </div>
              <div className="divide-y divide-zinc-800/30 max-h-[700px] overflow-y-auto">
                {profiles.length === 0 ? (
                  <div className="p-6 text-center text-sm text-zinc-600">
                    No calls found
                  </div>
                ) : (
                  profiles.map((profile) => {
                    const profileCalls = getProfileCalls(profile.phoneNumber);
                    const hasRecordings = profileCalls.some(c => c.audioUrl);

                    return (
                      <button
                        key={profile.phoneNumber}
                        onClick={() => handleProfileSelect(profile)}
                        className={`w-full text-left p-4 transition-colors ${
                          selectedProfile?.phoneNumber === profile.phoneNumber
                            ? 'bg-purple-400/10 border-l-2 border-purple-400'
                            : 'hover:bg-zinc-800/30'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-zinc-200">
                              {profile.callerName}
                            </div>
                            <div className="text-xs text-zinc-600 mt-0.5">
                              {formatPhone(profile.phoneNumber)}
                            </div>
                          </div>
                          {hasRecordings && (
                            <div className="w-2 h-2 rounded-full bg-purple-400" title="Has recordings" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                          <span>{profile.totalCalls} {profile.totalCalls === 1 ? 'call' : 'calls'}</span>
                          <span className="text-zinc-700">|</span>
                          <span>{profile.messages.length} messages</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Conversation View */}
          <div className="lg:col-span-9 space-y-6">
            {/* Call Recordings Section */}
            {selectedProfile && (
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Call Recordings
                </h3>
                <div className="space-y-3">
                  {getProfileCalls(selectedProfile.phoneNumber).length === 0 ? (
                    <p className="text-sm text-zinc-600">No calls recorded</p>
                  ) : (
                    getProfileCalls(selectedProfile.phoneNumber).map((call) => (
                      <div
                        key={call.id}
                        className={`rounded-xl p-4 transition-colors cursor-pointer ${
                          selectedCall?.id === call.id
                            ? 'bg-purple-400/10 border border-purple-400/30'
                            : 'bg-zinc-800/30 hover:bg-zinc-800/50'
                        }`}
                        onClick={() => setSelectedCall(call)}
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
                        {call.audioUrl && (
                          <AudioPlayer
                            audioUrl={call.audioUrl}
                            duration={call.durationSeconds}
                          />
                        )}
                        {!call.audioUrl && (
                          <div className="text-xs text-zinc-600 italic">
                            No recording available
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* iPhone-Style Messages */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800/30 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-zinc-300">
                    {selectedProfile ? selectedProfile.callerName : 'Select a caller'}
                  </h2>
                  {selectedProfile && (
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {formatPhone(selectedProfile.phoneNumber)}
                    </p>
                  )}
                </div>
                {selectedProfile && (
                  <div className="text-xs text-zinc-600">
                    {selectedProfile.messages.length} messages
                  </div>
                )}
              </div>

              {/* Message Thread - iPhone Style Dark Background */}
              <div className="bg-zinc-900/80 p-6 h-[500px] overflow-y-auto">
                {!selectedProfile ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-zinc-600 text-sm">Select a caller to view conversation</p>
                  </div>
                ) : selectedProfile.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-zinc-600 text-sm">No messages in this conversation</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {selectedProfile.messages.map((message, idx) => (
                      <MessageBubble
                        key={idx}
                        role={message.role}
                        content={message.content}
                        timestamp={message.timestamp}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-zinc-800/30 bg-zinc-900/50">
                <p className="text-center text-[10px] text-zinc-600 uppercase tracking-wider">
                  Read-only transcript powered by The Clean Machine
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

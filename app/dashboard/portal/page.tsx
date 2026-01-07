"use client";

import { useState, useEffect } from "react";
import { CallerProfile, Job, Call } from "@/lib/google-sheets";
import { MessageBubble } from "@/components/MessageBubble";
import { AudioPlayer } from "@/components/AudioPlayer";

type TabType = 'overview' | 'calls' | 'messages' | 'invoices' | 'payments' | 'reviews';

export default function ClientPortalPage() {
  const [profiles, setProfiles] = useState<CallerProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedClient, setSelectedClient] = useState<CallerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setProfiles(data.profiles);
      setJobs(data.jobs);
      setCalls(data.calls);
      if (data.profiles.length > 0) {
        setSelectedClient(data.profiles[0]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const getClientJobs = (phoneNumber: string) => jobs.filter(j => j.phoneNumber === phoneNumber);
  const getClientCalls = (phoneNumber: string) => calls.filter(c => c.phoneNumber === phoneNumber);
  const getClientRevenue = (phoneNumber: string) => getClientJobs(phoneNumber).reduce((sum, j) => sum + j.price, 0);
  const getClientPaid = (phoneNumber: string) => getClientJobs(phoneNumber).filter(j => j.paid).reduce((sum, j) => sum + j.price, 0);
  const getClientInvoices = (phoneNumber: string) => getClientJobs(phoneNumber).filter(j => j.invoiceSent);
  const getClientPayments = (phoneNumber: string) => getClientJobs(phoneNumber).filter(j => j.paid);
  const getClientReviews = (phoneNumber: string) => getClientJobs(phoneNumber).filter(j => j.reviewReceived);

  const formatPhone = (phone: string) => phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'calls', label: 'Calls' },
    { id: 'messages', label: 'Messages' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'payments', label: 'Payments' },
    { id: 'reviews', label: 'Reviews' },
  ];

  // Filter profiles based on search query
  const filteredProfiles = profiles.filter(profile =>
    profile.callerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.phoneNumber.includes(searchQuery)
  );

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
    <div className="p-12 space-y-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-semibold neon-glow tracking-wide">
            Client Portal
          </h1>
          <p className="text-sm text-zinc-500 tracking-wide">
            Complete client management view
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Client List */}
          <div className="lg:col-span-3">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800/30 space-y-3">
                <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  All Clients ({filteredProfiles.length})
                </h2>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-purple-400/50"
                />
              </div>
              <div className="divide-y divide-zinc-800/30 max-h-[800px] overflow-y-auto">
                {filteredProfiles.map((profile) => {
                  const clientJobs = getClientJobs(profile.phoneNumber);
                  const revenue = getClientRevenue(profile.phoneNumber);

                  return (
                    <button
                      key={profile.phoneNumber}
                      onClick={() => {
                        setSelectedClient(profile);
                        setActiveTab('overview');
                      }}
                      className={`w-full text-left p-4 transition-colors ${
                        selectedClient?.phoneNumber === profile.phoneNumber
                          ? 'bg-purple-400/10 border-l-2 border-purple-400'
                          : 'hover:bg-zinc-800/30'
                      }`}
                    >
                      <div className="font-medium text-zinc-200 truncate">
                        {profile.callerName}
                      </div>
                      <div className="text-xs text-zinc-600 mt-0.5">
                        {formatPhone(profile.phoneNumber)}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-zinc-500">{clientJobs.length} jobs</span>
                        <span className="text-emerald-400">${revenue.toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Client Detail Panel */}
          <div className="lg:col-span-9 space-y-6">
            {selectedClient ? (
              <>
                {/* Client Header */}
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-zinc-200">
                        {selectedClient.callerName}
                      </h2>
                      <p className="text-sm text-zinc-600 mt-1">
                        {formatPhone(selectedClient.phoneNumber)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-emerald-400">
                        ${getClientRevenue(selectedClient.phoneNumber).toLocaleString()}
                      </div>
                      <div className="text-xs text-zinc-600 mt-1">Total Revenue</div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-5 gap-4 mt-6 pt-6 border-t border-zinc-800/30">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {getClientCalls(selectedClient.phoneNumber).length}
                      </div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">Calls</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {selectedClient.messages.length}
                      </div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">Messages</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {getClientInvoices(selectedClient.phoneNumber).length}
                      </div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">Invoices</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        ${getClientPaid(selectedClient.phoneNumber).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">Paid</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {getClientReviews(selectedClient.phoneNumber).length}
                      </div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">Reviews</div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === tab.id
                          ? 'bg-purple-400/20 text-purple-400'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="glass-card rounded-2xl p-6">
                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Recent Activity
                      </h3>
                      <div className="space-y-3">
                        {getClientJobs(selectedClient.phoneNumber).slice(0, 5).map((job) => (
                          <div key={job.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/30">
                            <div>
                              <div className="font-medium text-zinc-300">{job.title}</div>
                              <div className="text-xs text-zinc-600 mt-1">
                                {new Date(job.date).toLocaleDateString()} - {job.status}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-emerald-400 font-semibold">${job.price}</div>
                              {job.paid && (
                                <div className="text-[10px] text-emerald-400/60 mt-1">PAID</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Calls Tab */}
                  {activeTab === 'calls' && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Call History ({getClientCalls(selectedClient.phoneNumber).length} calls)
                      </h3>
                      <div className="space-y-4">
                        {getClientCalls(selectedClient.phoneNumber).length === 0 ? (
                          <p className="text-sm text-zinc-600">No calls recorded</p>
                        ) : (
                          getClientCalls(selectedClient.phoneNumber).map((call) => (
                            <div key={call.id} className="rounded-xl p-4 bg-zinc-800/30 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${
                                    call.outcome === 'booked' ? 'bg-emerald-400' : 'bg-zinc-500'
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
                                    {call.outcome}
                                  </span>
                                )}
                              </div>
                              {call.audioUrl && (
                                <AudioPlayer audioUrl={call.audioUrl} duration={call.durationSeconds} />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Messages Tab */}
                  {activeTab === 'messages' && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Text Conversations ({selectedClient.messages.length} messages)
                      </h3>
                      <div className="bg-zinc-900/80 rounded-2xl p-4 max-h-[500px] overflow-y-auto">
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
                  )}

                  {/* Invoices Tab */}
                  {activeTab === 'invoices' && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Invoices Sent ({getClientInvoices(selectedClient.phoneNumber).length})
                      </h3>
                      <div className="space-y-3">
                        {getClientInvoices(selectedClient.phoneNumber).length === 0 ? (
                          <p className="text-sm text-zinc-600">No invoices sent</p>
                        ) : (
                          getClientInvoices(selectedClient.phoneNumber).map((job) => (
                            <div key={job.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/30">
                              <div>
                                <div className="font-medium text-zinc-300">{job.title}</div>
                                <div className="text-xs text-zinc-600 mt-1">
                                  Invoice sent: {job.invoiceDate ? new Date(job.invoiceDate).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-zinc-200">${job.price}</div>
                                <div className={`text-[10px] mt-1 ${job.paid ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                  {job.paid ? 'PAID' : 'PENDING'}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payments Tab */}
                  {activeTab === 'payments' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Payments Received ({getClientPayments(selectedClient.phoneNumber).length})
                        </h3>
                        <div className="text-emerald-400 font-semibold">
                          Total: ${getClientPaid(selectedClient.phoneNumber).toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {getClientPayments(selectedClient.phoneNumber).length === 0 ? (
                          <p className="text-sm text-zinc-600">No payments received</p>
                        ) : (
                          getClientPayments(selectedClient.phoneNumber).map((job) => (
                            <div key={job.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/30">
                              <div>
                                <div className="font-medium text-zinc-300">{job.title}</div>
                                <div className="text-xs text-zinc-600 mt-1">
                                  Paid: {job.paymentDate ? new Date(job.paymentDate).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-emerald-400">${job.price}</div>
                                <div className="text-[10px] text-emerald-400/60 mt-1">RECEIVED</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reviews Tab */}
                  {activeTab === 'reviews' && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Reviews ({getClientReviews(selectedClient.phoneNumber).length})
                      </h3>
                      <div className="space-y-4">
                        {getClientReviews(selectedClient.phoneNumber).length === 0 ? (
                          <p className="text-sm text-zinc-600">No reviews yet</p>
                        ) : (
                          getClientReviews(selectedClient.phoneNumber).map((job) => (
                            <div key={job.id} className="p-4 rounded-xl bg-zinc-800/30 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-zinc-300">{job.title}</div>
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <span
                                      key={i}
                                      className={`text-lg ${
                                        i < (job.reviewRating || 0) ? 'text-yellow-400' : 'text-zinc-700'
                                      }`}
                                    >
                                      *
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {job.reviewText && (
                                <p className="text-sm text-zinc-400 italic">"{job.reviewText}"</p>
                              )}
                              <div className="text-xs text-zinc-600">
                                {new Date(job.date).toLocaleDateString()}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="glass-card rounded-2xl p-12 text-center">
                <p className="text-zinc-600">Select a client to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

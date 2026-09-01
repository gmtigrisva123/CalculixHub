/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { MessageSquare, Sparkles, Send, ThumbsUp, ThumbsDown, Award, UserCheck, BadgeCheck, Filter } from 'lucide-react';
import { CommunityDiscussion, Problem } from '../../shared/types';
import MathText from './MathText';
import { duration, ease, spring } from '../lib/motion';
import { StaggerItem } from './motion';

interface CommunityProps {
  discussions: CommunityDiscussion[];
  problems: Problem[];
  onAddComment: (comment: Omit<CommunityDiscussion, 'id' | 'timestamp' | 'likes' | 'replies'>) => void;
}

const VOTES_KEY = 'calculix_discussion_votes';
type VoteMap = Record<string, number>;

function loadVotes(): VoteMap {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function Community({ discussions, problems, onAddComment }: CommunityProps) {
  const [selectedProblemId, setSelectedProblemId] = useState<string>('All');
  const [newCommentText, setNewCommentText] = useState('');
  const [votes, setVotes] = useState<VoteMap>(() => loadVotes());

  useEffect(() => {
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  }, [votes]);

  const filteredDiscussions = discussions.filter(
    (disc) => selectedProblemId === 'All' || disc.problemId === selectedProblemId
  );

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const connectedProb = problems.find((p) => p.id === selectedProblemId) || problems[0];
    if (!connectedProb) return;

    onAddComment({
      problemId: connectedProb.id,
      problemTitle: connectedProb.title,
      user: 'You',
      role: 'Student',
      content: newCommentText,
    });

    setNewCommentText('');
  };

  const castVote = (id: string, delta: 1 | -1) => {
    setVotes((prev) => {
      const current = prev[id] || 0;
      const next = current === delta ? 0 : delta;
      return { ...prev, [id]: next };
    });
  };

  const isVerifiedSolution = (disc: CommunityDiscussion) => disc.role === 'Mentor' || disc.role === 'Admin';

  const topContributors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const disc of discussions) {
      counts.set(disc.user, (counts.get(disc.user) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [discussions]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-line pb-4">
        <p className="type-eyebrow text-emerald-500 font-mono text-xs uppercase">Mathematical Forum &amp; Discussions</p>
        <h1 className="type-title text-2xl font-bold text-content mt-1 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-emerald-500" /> Community Solutions
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Discussion Feed */}
        <div className="lg:col-span-8 space-y-6">
          {/* Problem Filter Bar */}
          <div className="cx-glass-panel p-4 space-y-2">
            <span className="text-[10px] font-bold text-content-subtle uppercase tracking-wider block font-mono">
              Filter Threads by Problem
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <m.button
                onClick={() => setSelectedProblemId('All')}
                whileTap={{ scale: 0.95 }}
                className={`text-xs font-mono font-semibold px-3.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
                  selectedProblemId === 'All'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-500'
                    : 'border-line bg-surface-sunken/40 text-content-subtle hover:border-line-strong'
                }`}
              >
                All Threads
              </m.button>

              {problems.map((prob) => (
                <m.button
                  key={prob.id}
                  onClick={() => setSelectedProblemId(prob.id)}
                  whileTap={{ scale: 0.95 }}
                  className={`text-xs font-mono font-semibold px-3.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
                    selectedProblemId === prob.id
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-500'
                      : 'border-line bg-surface-sunken/40 text-content-subtle hover:border-line-strong'
                  }`}
                >
                  {prob.title}
                </m.button>
              ))}
            </div>
          </div>

          {/* Post Creation Form */}
          <form onSubmit={handlePostComment} className="cx-glass-panel p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold text-sm text-content">Post a Solution or Explanation</h3>
            </div>

            <textarea
              id="field-community-comment"
              placeholder={
                selectedProblemId === 'All'
                  ? 'Select a problem above to start a dedicated thread...'
                  : `Share your mathematical approach or solution for "${problems.find((p) => p.id === selectedProblemId)?.title}"...`
              }
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              rows={3}
              className="w-full p-4 rounded-xl border border-line bg-surface-sunken/60 text-content text-xs font-mono focus:outline-hidden focus:border-indigo-500"
            />

            <div className="flex justify-end">
              <m.button
                type="submit"
                disabled={!newCommentText.trim()}
                whileTap={{ scale: 0.96 }}
                className="cx-btn cx-btn-fill px-5 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Post Discussion
              </m.button>
            </div>
          </form>

          {/* Thread Cards */}
          <div className="space-y-4">
            {filteredDiscussions.map((disc, index) => {
              const currentVote = votes[disc.id] || 0;
              const netLikes = disc.likes + currentVote;

              return (
                <StaggerItem key={disc.id} index={index} className="cx-glass-panel p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-content text-sm">{disc.user}</span>
                        <span className="cx-tag cx-tag-accent text-[9px]">{disc.role}</span>
                        {isVerifiedSolution(disc) && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <BadgeCheck className="w-3.5 h-3.5" /> Verified Solution
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-content-subtle">{disc.problemTitle}</span>
                    </div>

                    <span className="text-[11px] font-mono text-content-subtle">{disc.timestamp}</span>
                  </div>

                  <div className="text-xs text-content leading-relaxed font-mono">
                    <MathText text={disc.content} />
                  </div>

                  {/* Voting & Actions Bar */}
                  <div className="flex items-center gap-3 pt-3 border-t border-line text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => castVote(disc.id, 1)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-colors ${
                        currentVote === 1
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-500'
                          : 'border-line bg-surface-sunken/40 text-content-subtle hover:border-line-strong'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{netLikes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => castVote(disc.id, -1)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-colors ${
                        currentVote === -1
                          ? 'border-rose-500 bg-rose-500/15 text-rose-500'
                          : 'border-line bg-surface-sunken/40 text-content-subtle hover:border-line-strong'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </StaggerItem>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Top Contributors */}
        <div className="lg:col-span-4 space-y-6">
          <div className="cx-glass-panel p-6 space-y-4">
            <h3 className="type-title text-base font-bold text-content flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> Top Contributors
            </h3>

            <div className="space-y-3">
              {topContributors.map(([name, count], idx) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl border border-line bg-surface-sunken/30">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                    <span className="font-semibold text-content text-xs">{name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-500">{count} posts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

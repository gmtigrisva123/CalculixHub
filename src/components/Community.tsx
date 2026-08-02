/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { MessageSquare, Sparkles, Send, ThumbsUp, ThumbsDown, Reply, Award, UserCheck, BadgeCheck } from 'lucide-react';
import { CommunityDiscussion, Problem } from '../types';
import MathText from './MathText';
import { duration, ease, spring, travel } from '../lib/motion';
import { StaggerItem } from './motion';

interface CommunityProps {
  discussions: CommunityDiscussion[];
  problems: Problem[];
  onAddComment: (comment: Omit<CommunityDiscussion, 'id' | 'timestamp' | 'likes' | 'replies'>) => void;
}

const VOTES_KEY = 'calculix_discussion_votes';

type VoteMap = Record<string, number>; // discussionId -> net vote delta applied by this user

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

  const filteredDiscussions = discussions.filter((disc) => selectedProblemId === 'All' || disc.problemId === selectedProblemId);

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
      // Clicking the same direction again clears the vote; switching direction flips it.
      const next = current === delta ? 0 : delta;
      return { ...prev, [id]: next };
    });
  };

  const isVerifiedSolution = (disc: CommunityDiscussion) => disc.role === 'Mentor' || disc.role === 'Admin';

  // Data-driven contributor ranking, replacing what used to be hardcoded names.
  const topContributors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const disc of discussions) {
      counts.set(disc.user, (counts.get(disc.user) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [discussions]);

  // Data-driven featured solution: highest-voted verified (Mentor/Admin) post.
  const featuredSolution = useMemo(() => {
    const verified = discussions.filter(isVerifiedSolution);
    if (verified.length === 0) return null;
    return [...verified].sort((a, b) => (b.likes + (votes[b.id] || 0)) - (a.likes + (votes[a.id] || 0)))[0];
  }, [discussions, votes]);

  const medal = (idx: number) => (idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉');

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-100 pb-4">
        <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2 font-serif">
          <MessageSquare className="w-7 h-7 text-proof-600" /> Discussions &amp; Solutions
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Problem-centric discussion &mdash; post a solution, critique reasoning, and learn from mentors and peers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-stone-50 border border-stone-150 p-4 rounded-2xl space-y-2 select-none">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">Filter by problem</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scroll-smooth">
              <m.button
                onClick={() => setSelectedProblemId('All')}
                whileTap={{ scale: 0.95 }}
                transition={spring.press}
                className={`text-xs font-bold px-4 py-2 rounded-xl border whitespace-nowrap transition-[background-color,border-color,color] duration-160 ease-standard cursor-pointer ${
                  selectedProblemId === 'All' ? 'bg-ink-950 border-ink-950 text-white' : 'bg-surface-raised border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                All threads
              </m.button>
              {problems.map((prob) => (
                <m.button
                  key={prob.id}
                  onClick={() => setSelectedProblemId(prob.id)}
                  whileTap={{ scale: 0.95 }}
                  transition={spring.press}
                  className={`text-xs font-bold px-4 py-2 rounded-xl border whitespace-nowrap transition-[background-color,border-color,color] duration-160 ease-standard cursor-pointer ${
                    selectedProblemId === prob.id ? 'bg-ink-950 border-ink-950 text-white' : 'bg-surface-raised border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {prob.title}
                </m.button>
              ))}
            </div>
          </div>

          <form onSubmit={handlePostComment} className="bg-surface-raised border border-stone-100 rounded-3xl p-5 shadow-e1 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-stone-700">Post a solution or question</h3>
            </div>

            <div className="space-y-3">
              <textarea
                id="field-community-comment"
                placeholder={
                  selectedProblemId === 'All'
                    ? 'Pick a specific problem above to start a focused discussion...'
                    : `Got an interesting approach to "${problems.find((p) => p.id === selectedProblemId)?.title}"? Share it here...`
                }
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                rows={3}
                className="w-full border border-stone-200 focus:border-stone-900 rounded-2xl p-4 text-xs font-medium outline-hidden transition-[border-color] duration-160 ease-standard text-stone-800 bg-stone-50 placeholder:text-stone-400"
              />

              <div className="flex justify-between items-center bg-stone-50/50 p-2 rounded-xl">
                <span className="text-[10px] text-stone-400 font-semibold italic">* Keep it constructive &mdash; explain your reasoning, don't just paste an answer.</span>
                <m.button
                  id="btn-submit-comment"
                  type="submit"
                  disabled={!newCommentText.trim()}
                  whileTap={{ scale: 0.95 }}
                  transition={spring.press}
                  className="bg-content hover:bg-content-muted text-surface-raised font-bold text-xs px-4.5 py-2 rounded-xl transition-[background-color,opacity] duration-160 ease-standard shadow-e2 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" /> Post
                </m.button>
              </div>
            </div>
          </form>

          <div className="space-y-4 pt-1">
            {filteredDiscussions.length === 0 && (
              <div className="text-center py-12 bg-surface-raised rounded-2xl border border-dashed border-stone-200 text-stone-400 text-sm">
                No discussion here yet &mdash; be the first to post.
              </div>
            )}
            {/*
              A newly posted thread is prepended to this list. AnimatePresence
              plus `layout` means it expands into place and pushes the existing
              threads down, rather than the whole column jumping by the height
              of a card the moment Post is pressed.
            */}
            <AnimatePresence initial={false}>
            {filteredDiscussions.map((disc, index) => {
              const myVote = votes[disc.id] || 0;
              const netLikes = disc.likes + myVote;
              const verified = isVerifiedSolution(disc);
              return (
                <m.div
                  key={disc.id}
                  layout
                  initial={{ opacity: 0, y: -travel.sm, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: duration.fast, ease: ease.exit } }}
                  transition={{ ...spring.smooth, delay: Math.min(index * 0.03, 0.18) }}
                  className="bg-surface-raised border border-stone-100 rounded-3xl p-5 md:p-6 shadow-e1 space-y-4 transition-[border-color] duration-160 ease-standard hover:border-stone-200"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-150 flex items-center justify-center font-bold text-sm text-stone-600 select-none">
                        {disc.user.substring(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-900">{disc.user}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            disc.role === 'Mentor' ? 'bg-brass-50 text-brass-700 border border-brass-100'
                            : disc.role === 'Admin' ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : 'bg-stone-50 text-stone-600 border border-stone-150'
                          }`}>
                            {disc.role}
                          </span>
                          {verified && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-proof-50 text-proof-700 border border-proof-100">
                              <BadgeCheck className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-stone-400 font-medium block mt-0.5">{disc.timestamp}</span>
                      </div>
                    </div>

                    <span className="text-[9px] font-bold text-stone-450 bg-stone-50 border border-stone-100 px-2.5 py-1 rounded-md block">{disc.problemTitle}</span>
                  </div>

                  <MathText text={disc.content} as="p" className="text-xs text-stone-700 leading-relaxed" />

                  <div className="flex items-center gap-4 border-t border-stone-100 pt-3 text-xs select-none">
                    <div className="flex items-center gap-1.5">
                      {/*
                        Voting is a one-tap action with a tiny visual result —
                        an icon fills in and a number changes by one. The kick
                        on press is what confirms the tap registered at all.
                      */}
                      <m.button
                        onClick={() => castVote(disc.id, 1)}
                        whileTap={{ scale: 0.8 }}
                        animate={{ scale: myVote === 1 ? 1.12 : 1 }}
                        transition={spring.press}
                        className={`hover:text-brass-600 transition-colors duration-160 ease-standard cursor-pointer ${myVote === 1 ? 'text-brass-600' : 'text-stone-400'}`}
                        title="Upvote"
                      >
                        <ThumbsUp className={`w-4 h-4 ${myVote === 1 ? 'fill-brass-500 text-brass-500' : ''}`} />
                      </m.button>
                      <span className="font-mono font-bold text-stone-600 w-6 text-center overflow-hidden">
                        <AnimatePresence mode="wait" initial={false}>
                          <m.span
                            key={netLikes}
                            className="block"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: duration.fast, ease: ease.standard }}
                          >
                            {netLikes}
                          </m.span>
                        </AnimatePresence>
                      </span>
                      <m.button
                        onClick={() => castVote(disc.id, -1)}
                        whileTap={{ scale: 0.8 }}
                        animate={{ scale: myVote === -1 ? 1.12 : 1 }}
                        transition={spring.press}
                        className={`hover:text-rose-600 transition-colors duration-160 ease-standard cursor-pointer ${myVote === -1 ? 'text-rose-600' : 'text-stone-400'}`}
                        title="Downvote"
                      >
                        <ThumbsDown className={`w-4 h-4 ${myVote === -1 ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </m.button>
                    </div>

                    <button className="flex items-center gap-1.5 text-stone-400 hover:text-stone-800 transition-colors font-semibold">
                      <Reply className="w-4 h-4" />
                      <span>{disc.replies} replies</span>
                    </button>
                  </div>
                </m.div>
              );
            })}
            </AnimatePresence>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-ink-950 border border-ink-850 text-white rounded-3xl p-5 shadow-e2 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-brass-500/10 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center gap-2 mb-3.5 text-violet-300">
              <Award className="w-4.5 h-4.5" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider">Featured Solution</h3>
            </div>

            {featuredSolution ? (
              <div className="space-y-3">
                <h4 className="font-extrabold text-xs text-stone-200">{featuredSolution.problemTitle}</h4>
                <MathText text={featuredSolution.content} as="p" className="text-[11px] text-stone-400 leading-relaxed line-clamp-4" />
                <div className="flex items-center justify-between border-t border-ink-800 pt-3 mt-4 text-[10px]">
                  <span className="text-stone-500 font-semibold">By {featuredSolution.user}</span>
                  <span className="text-violet-400 font-bold">{featuredSolution.likes + (votes[featuredSolution.id] || 0)} votes</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-stone-500 leading-relaxed">No mentor-verified solution yet &mdash; once a Mentor or Admin posts one, the highest-voted answer appears here.</p>
            )}
          </div>

          <div className="bg-surface-raised border border-stone-100 rounded-3xl p-5 shadow-e1 space-y-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm text-stone-900 flex items-center gap-1.5 font-serif">
                <UserCheck className="w-4.5 h-4.5 text-proof-600" /> Top Contributors
              </h3>
              <p className="text-[10px] text-stone-400">Ranked by number of posts in this discussion feed.</p>
            </div>

            <div className="space-y-3.5 pt-1 text-xs">
              {topContributors.length === 0 && <p className="text-stone-400 text-[11px]">No contributions yet.</p>}
              {topContributors.map(([user, count], idx) => (
                <StaggerItem key={user} index={idx} inView className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-stone-400 w-4">{medal(idx)}</span>
                    <span className="font-bold text-stone-800">{user}</span>
                  </div>
                  <span className="text-[10px] bg-stone-100 font-semibold px-2 py-0.5 rounded-md text-stone-600 shrink-0">{count} posts</span>
                </StaggerItem>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

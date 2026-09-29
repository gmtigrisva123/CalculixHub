/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { MessageSquare, Sparkles, Send, ThumbsUp, ThumbsDown, Award, UserCheck, BadgeCheck, Filter, Search } from 'lucide-react';
import { CommunityDiscussion, Problem } from '../../shared/types';
import MathText from './MathText';
import { duration, ease, spring } from '../lib/motion';
import { StaggerItem } from './motion';

import { useAuth } from '../context/AuthContext';
import { createPost, togglePostLike, usePostFeed, createComment, useComments } from '../services/data/feed';

function Replies({postId}:{postId:string}) {
 const {user}=useAuth();const feed=useComments(postId);const [body,setBody]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 return <section className="space-y-3 border-t border-line pt-4" aria-label="Replies">
  {feed.error&&<p role="alert">{feed.error}</p>}{error&&<p role="alert">{error}</p>}
  {feed.loading?<p role="status">Loading replies…</p>:feed.data.length===0?<p>No replies yet.</p>:feed.data.map(row=><article key={row.id}><strong>{row.author?.display_name||row.author?.username||'Learner'}</strong><MathText text={row.body}/><time>{new Date(row.created_at).toLocaleString()}</time></article>)}
  {user&&<form onSubmit={async e=>{e.preventDefault();if(busy||!body.trim())return;setBusy(true);const result=await createComment({postId,authorId:user.id,body});if(result.ok){setBody('');await feed.reload();setError('');}else setError(result.error);setBusy(false);}}><label>Reply<textarea className="w-full p-3 border border-line rounded-xl" value={body} maxLength={2000} onChange={e=>setBody(e.target.value)} required/></label><button className="arena-primary" disabled={busy||!body.trim()}>Send reply</button></form>}
 </section>;
}
export default function Community({problems}:{problems:Problem[]}) {
 const {user}=useAuth();
 const [selectedProblemId,setSelectedProblemId]=useState('All');
 const [problemQuery,setProblemQuery]=useState('');
 const matchingProblems=problems.filter(problem=>problem.title.toLocaleLowerCase().includes(problemQuery.trim().toLocaleLowerCase()));
 const [newCommentText,setNewCommentText]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [openReplies,setOpenReplies]=useState<string|null>(null);
 const feed=usePostFeed({viewerId:user?.id});
 const discussions:CommunityDiscussion[]=feed.data.map(row=>({id:row.id,problemId:row.problem_id??'',problemTitle:problems.find(p=>p.id===row.problem_id)?.title??'An open conversation',user:row.author?.display_name||row.author?.username||'Learner',role:'Student',content:row.body,timestamp:new Date(row.created_at).toLocaleString(),likes:row.like_count,replies:row.comment_count}));
 const votes=Object.fromEntries(feed.data.map(p=>[p.id,p.viewer_has_liked?1:0]));
 const filteredDiscussions=discussions.filter(d=>selectedProblemId==='All'||d.problemId===selectedProblemId);
 const handlePostComment=async(e:React.FormEvent)=>{
  e.preventDefault();if(!user||busy||!newCommentText.trim())return;setBusy(true);setError('');
  const result=await createPost({authorId:user.id,body:newCommentText,problemId:selectedProblemId==='All'?null:selectedProblemId});
  if(result.ok){setNewCommentText('');await feed.reload();}else setError(result.error);setBusy(false);
 };
 const castVote=async(id:string,_delta:1|-1)=>{if(!user||busy)return;setBusy(true);const result=await togglePostLike({postId:id,userId:user.id,liked:Boolean(votes[id])});if(!result.ok)setError(result.error);await feed.reload();setBusy(false);};
  const isVerifiedSolution = (disc: CommunityDiscussion) => disc.role === 'Mentor' || disc.role === 'Admin';

  const topContributors = useMemo(() => {
    const counts = new Map<string, {id:string;name:string;count:number}>();
    for (const post of feed.data) {
      const previous = counts.get(post.author_id);
      counts.set(post.author_id, {id:post.author_id,name:post.author?.display_name||post.author?.username||'Learner',count:(previous?.count||0)+1});
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [feed.data]);

  return (
    <div className="space-y-8">
      {feed.error&&<p role="alert">{feed.error}</p>}{error&&<p role="alert">{error}</p>}{feed.loading&&<p role="status">Loading conversations…</p>}{!user&&<p className="arena-note">Sign in to post, like or reply.</p>}
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
            <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken/40 px-3 text-content-subtle focus-within:border-indigo-500">
              <Search className="w-4 h-4 shrink-0" />
              <span className="sr-only">Find a problem to filter discussions</span>
              <input value={problemQuery} onChange={event=>setProblemQuery(event.target.value)} placeholder="Find a problem by title" className="min-w-0 w-full py-2 bg-transparent text-sm text-content outline-none" />
            </label>
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

              {matchingProblems.map((prob) => (
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
            {problemQuery && matchingProblems.length === 0 && <p className="text-xs text-content-muted">No matching problem. Try another title.</p>}
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
              maxLength={5000}
              disabled={!user||busy}
              className="w-full p-4 rounded-xl border border-line bg-surface-sunken/60 text-content text-xs font-mono focus:outline-hidden focus:border-indigo-500"
            />

            <div className="flex justify-end">
              <m.button
                type="submit"
                disabled={!user||busy||!newCommentText.trim()}
                whileTap={{ scale: 0.96 }}
                className="cx-btn cx-btn-fill px-5 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Post Discussion
              </m.button>
            </div>
          </form>

          {/* Thread Cards */}
          <div className="space-y-4">
            {!feed.loading&&!filteredDiscussions.length&&<p>No conversations here yet. Share the first idea.</p>}
            {filteredDiscussions.map((disc, index) => {
              const currentVote = votes[disc.id] || 0;
              const netLikes = disc.likes;

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
                      disabled={!user||busy}
                      aria-label="Like post"
                      aria-pressed={currentVote===1}
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

                    <button type="button" onClick={()=>setOpenReplies(openReplies===disc.id?null:disc.id)}><MessageSquare size={15}/> {disc.replies} replies</button>
                  </div>
                  {openReplies===disc.id&&<Replies postId={disc.id}/>}
                </StaggerItem>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Contributors in this feed */}
        <div className="lg:col-span-4 space-y-6">
          <div className="cx-glass-panel p-6 space-y-4">
            <h3 className="type-title text-base font-bold text-content flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> Contributors in this feed
            </h3>

            <div className="space-y-3">
              {topContributors.map(({id,name,count}, idx) => (
                <div key={id} className="flex items-center justify-between p-3 rounded-xl border border-line bg-surface-sunken/30">
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MessageSquare, Users, Sparkles, Send, Heart, Reply, Award, ShieldAlert, BookOpen, UserCheck } from 'lucide-react';
import { CommunityDiscussion, Problem } from '../types';

interface CommunityProps {
  discussions: CommunityDiscussion[];
  problems: Problem[];
  onAddComment: (comment: Omit<CommunityDiscussion, 'id' | 'timestamp' | 'likes' | 'replies'>) => void;
}

export default function Community({ discussions, problems, onAddComment }: CommunityProps) {
  const [selectedProblemId, setSelectedProblemId] = useState<string>('All');
  const [newCommentText, setNewCommentText] = useState('');
  const [likedIds, setLikedIds] = useState<string[]>([]);

  // Filter discussions by problem selection if chosen
  const filteredDiscussions = discussions.filter((disc) => {
    if (selectedProblemId === 'All') return true;
    return disc.problemId === selectedProblemId;
  });

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    // Determine connected problem details
    const connectedProb = problems.find((p) => p.id === selectedProblemId) || problems[0];

    onAddComment({
      problemId: connectedProb.id,
      problemTitle: connectedProb.title,
      user: 'You (Member)',
      role: 'Student',
      content: newCommentText,
    });

    setNewCommentText('');
  };

  const handleToggleLike = (id: string, currentLikes: number) => {
    if (likedIds.includes(id)) {
      setLikedIds(likedIds.filter((item) => item !== id));
    } else {
      setLikedIds([...likedIds, id]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Title */}
      <div className="border-b border-slate-100 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-emerald-600" /> Discussions & Solutions
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          A focused academic discussion ecosystem. Post polished solutions, critique mathematical reasoning with top solvers and expert coaches.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        
        {/* Left Side: Forums Feed & Posting Form (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Forum Thread Filter */}
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-2 select-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Discussion topics by problem</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scroll-smooth">
                <button
                onClick={() => setSelectedProblemId('All')}
                className={`text-xs font-bold px-4 py-2 rounded-xl border whitespace-nowrap transition-all cursor-pointer ${
                  selectedProblemId === 'All'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-3xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🪐 All posts
              </button>
              {problems.map((prob) => (
                <button
                  key={prob.id}
                  onClick={() => setSelectedProblemId(prob.id)}
                  className={`text-xs font-bold px-4 py-2 rounded-xl border whitespace-nowrap transition-all cursor-pointer ${
                    selectedProblemId === prob.id
                      ? 'bg-slate-900 border-slate-900 text-white shadow-3xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  📝 {prob.title}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Posting Form */}
          <form onSubmit={handlePostComment} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Post a new solution idea</h3>
            </div>

            <div className="space-y-3">
              <textarea
                id="field-community-comment"
                placeholder={
                  selectedProblemId === 'All'
                    ? 'Please select a specific problem above to discuss in-depth...'
                    : `Do you have a unique solution for "${problems.find(p => p.id === selectedProblemId)?.title}"? Share it here...`
                }
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 focus:border-slate-900 rounded-2xl p-4 text-xs font-medium outline-hidden transition-all text-slate-800 bg-slate-50 placeholder:text-slate-400"
              />

              <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold italic">
                  * Follow community guidelines, no spam or posting bare answers without explanation.
                </span>
                <button
                  id="btn-submit-comment"
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-4.5 py-2 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" /> Post comment
                </button>
              </div>
            </div>
          </form>

          {/* Comment Threads list */}
          <div className="space-y-4 pt-1">
            {filteredDiscussions.map((disc) => {
              const hasLiked = likedIds.includes(disc.id);
              return (
                <div key={disc.id} className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-xs space-y-4 transition-all hover:border-slate-200">
                  
                  {/* User profile rail */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-150 flex items-center justify-center font-bold text-sm text-slate-600 select-none">
                        {disc.user.substring(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{disc.user}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.2 rounded-md uppercase tracking-wider ${
                            disc.role === 'Mentor'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : disc.role === 'Admin'
                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                              : 'bg-slate-50 text-slate-600 border border-slate-150/70'
                          }`}>
                            {disc.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{disc.timestamp}</span>
                      </div>
                    </div>

                    {/* Linked problem topic tag */}
                    <span className="text-[9px] font-bold text-slate-450 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md block">
                      Problem: {disc.problemTitle}
                    </span>
                  </div>

                  {/* Comment main content block with math LaTeX formulas translation */}
                  <p className="text-xs text-slate-705 leading-relaxed font-serif whitespace-pre-wrap">
                    {disc.content.split('\n').map((line, idx) => {
                      let cleanLine = line.replace(/\$(.*?)\$/g, '$1');
                      return (
                        <span key={idx} className="block mt-1 first:mt-0">
                          {cleanLine}
                        </span>
                      );
                    })}
                  </p>

                  {/* Actions footer */}
                  <div className="flex items-center gap-4 border-t border-slate-50 pt-3 text-xs select-none">
                    <button
                      onClick={() => handleToggleLike(disc.id, disc.likes)}
                      className={`flex items-center gap-1.5 hover:text-rose-600 transition-colors cursor-pointer ${
                        hasLiked ? 'text-rose-600 font-extrabold' : 'text-slate-400 font-semibold'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${hasLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{disc.likes + (hasLiked ? 1 : 0)} Likes</span>
                    </button>

                    <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-800 transition-colors font-semibold">
                      <Reply className="w-4 h-4" />
                      <span>{disc.replies} Replies</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Right Side: Featured Solutions and top contributors (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Featured solution card */}
          <div className="bg-slate-950 border border-slate-850 text-white rounded-3xl p-5 shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-3.5 text-indigo-300">
              <Award className="w-4.5 h-4.5" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider">Featured Solution</h3>
            </div>

            <div className="space-y-3">
              <h4 className="font-extrabold text-xs text-slate-200">
                Tiling the mutilated chessboard (Proof sketch)
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-serif line-clamp-4">
                "An 8x8 chessboard with two opposite squares removed will always have a difference of two between the number of black and white squares (opposite squares share the same color). Each 1x2 domino necessarily covers exactly one white and one black square..."
              </p>
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-4 text-[10px]">
                <span className="text-slate-500 font-semibold">Author: Mr. Hoang</span>
                <span className="text-indigo-400 font-bold hover:underline cursor-pointer">Details →</span>
              </div>
            </div>
          </div>

          {/* Academic Contributor Rankings */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <UserCheck className="w-4.5 h-4.5 text-emerald-500" /> Top Contributors
              </h3>
              <p className="text-[10px] text-slate-400">Members who most actively contributed solutions.</p>
            </div>

            <div className="space-y-3.5 pt-1 text-xs">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-400 w-4">🥇</span>
                  <span className="font-bold text-slate-800">Trần Thị Thu Trang</span>
                </div>
                  <span className="text-[10px] bg-slate-100 font-semibold px-2 py-0.5 rounded-md text-slate-600 shrink-0">
                    42 featured solutions
                  </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-400 w-4">🥈</span>
                  <span className="font-bold text-slate-800">Lê Hoài Nam</span>
                </div>
                <span className="text-[10px] bg-slate-100 font-semibold px-2 py-0.5 rounded-md text-slate-600 shrink-0">
                  29 active discussions
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-400 w-4">🥉</span>
                  <span className="font-bold text-slate-800">Nguyễn Hoàng Nam</span>
                </div>
                <span className="text-[10px] bg-slate-100 font-semibold px-2 py-0.5 rounded-md text-slate-600 shrink-0">
                  18 exemplar explanations
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

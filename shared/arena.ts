import type { Problem } from './types';
export interface Arena {
 id:string; title:string; description:string; starts_at:string; ends_at:string; duration_minutes:number;
 status:'draft'|'published'|'closed'; question_count?:number; questions?:Problem[];
}
export interface ArenaAnswer {count:number;finished:boolean;correct:boolean;forfeited:boolean;first_correct:boolean}
export interface ArenaView {
 arena:Arena; entry:{registered_at:string;started_at:string|null;finished_at:string|null;answers:Record<string,ArenaAnswer>;score:number;theta:number;sem:number};
 questions:(Omit<Problem,'correctAnswer'|'solution'|'hint'> & {correctAnswer?:string;solution?:string;hint?:string})[];
 leaderboard:{name:string;score:number;theta:number;sem:number}[];
 server_time:string;deadline:string|null;
}

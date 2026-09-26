/** Signed-in learning writes use a constrained database RPC, never the service-role key. */
import { createClient } from '@supabase/supabase-js';
import type { Problem } from '../shared/types';
import { config } from './config';
export interface RecordAttemptInput {
 userId: string; problem: Problem; submittedAnswer: string; isCorrect: boolean; durationMs?: number; authorization?: string;
}
export type RecordAttemptOutcome = { status: 'recorded' | 'already-solved' | 'not-configured' | 'failed' | 'exhausted'; pointsAwarded: number; correct?:boolean; attemptsUsed?:number; finished?:boolean; forfeited?:boolean };
export async function recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptOutcome> {
 const settings=config();
 if(!settings.supabaseUrl || !settings.supabaseAnonKey || !input.authorization) return {status:'not-configured',pointsAwarded:0};
 const client=createClient(settings.supabaseUrl,settings.supabaseAnonKey,{auth:{persistSession:false},global:{headers:{Authorization:input.authorization}}});
 const {data,error}=await client.rpc('learning_grade',{p_problem:input.problem.id,p_answer:input.submittedAnswer,p_duration:input.durationMs??null});
 if(error) return {status:'failed',pointsAwarded:0};
 return data as RecordAttemptOutcome;
}

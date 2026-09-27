create or replace function public.learning_grade(p_problem text,p_answer text,p_duration integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); q jsonb; prior integer; solved boolean; exhausted boolean; correct boolean; points integer; used integer;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if exists(select 1 from auth.users where id=uid and banned_until>now()) then raise exception 'Account suspended'; end if;
 if length(coalesce(p_answer,''))>4000 or p_duration<0 or p_duration>14400000 then raise exception 'Invalid attempt'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||':'||p_problem,0));
 select document into q from public.problem_catalog where id=p_problem and not archived;
 if q is null or coalesce((q->>'proOnly')::boolean,false) then raise exception 'Question unavailable'; end if;
 select count(*),coalesce(bool_or(points_awarded>0),false),coalesce(bool_or(submitted_answer='__forfeit__'),false),count(*) filter(where submitted_answer<>'__forfeit__')
 into prior,solved,exhausted,used from public.problem_attempts where user_id=uid and problem_id=p_problem;
 if prior>=3 or exhausted then return jsonb_build_object('status','exhausted','pointsAwarded',0,'correct',solved,'attemptsUsed',least(3,used),'finished',true,'forfeited',not solved); end if;
 if solved then return jsonb_build_object('status','already-solved','pointsAwarded',0,'correct',true,'attemptsUsed',least(3,used),'finished',true,'forfeited',false); end if;
 correct:=case when trim(coalesce(p_answer,'')) ~ '^\d+$' and q->>'correctAnswer' ~ '^\d+$' then coalesce(nullif(ltrim(trim(p_answer),'0'),''),'0')=coalesce(nullif(ltrim(q->>'correctAnswer','0'),''),'0') else lower(trim(coalesce(p_answer,'')))=lower(trim(q->>'correctAnswer')) end;
 points:=case when correct and not solved then (q->>'points')::integer else 0 end;
 insert into public.problem_attempts(user_id,problem_id,topic,level,submitted_answer,is_correct,points_awarded,duration_ms)
 values(uid,p_problem,q->>'topic',q->>'level',p_answer,correct,points,p_duration);
 return jsonb_build_object('status',case when solved and correct then 'already-solved' else 'recorded' end,'pointsAwarded',points,'correct',correct,'attemptsUsed',least(3,used+case when p_answer='__forfeit__' then 0 else 1 end),'finished',correct or prior+1>=3 or p_answer='__forfeit__','forfeited',not correct and (prior+1>=3 or p_answer='__forfeit__'));
end; $$;
revoke all on function public.learning_grade(text,text,integer) from public;
grant execute on function public.learning_grade(text,text,integer) to authenticated;

import { createClient } from '@supabase/supabase-js';
import type { Problem } from '../shared/types';
import { config, type AppConfig } from './config';
import { problems } from './data';
export async function loadProblemBank(settings: AppConfig = config()): Promise<Problem[]> {
  if(!settings.supabaseUrl || !settings.supabaseAnonKey) return problems;
  const client=createClient(settings.supabaseUrl,settings.supabaseAnonKey,{auth:{persistSession:false}});
  const {data,error}=await client.from('problem_catalog').select('id,document,archived');
  if(error) throw Error('Could not load the database question catalog.');
  return (data??[]).filter(row=>!row.archived).map(row=>row.document as Problem);
}

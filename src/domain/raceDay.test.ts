import { describe, expect, it } from 'vitest';
import { attentionOrder, daysUntil, parseRaceDay, problemsFor, trainingPlan } from './raceDay';

const skills = { Algebra: 70, Geometry: 20, Combinatorics: 45, 'Number Theory': 45 };

describe('race day', () => {
  it('counts whole calendar days, across a daylight-saving change too', () => {
    expect(daysUntil('2026-11-12', '2026-11-10')).toBe(2);
    expect(daysUntil('2026-11-10', '2026-11-10')).toBe(0);
    expect(daysUntil('2026-11-08', '2026-11-10')).toBe(-2);
    expect(daysUntil('2027-03-15', '2027-03-13')).toBe(2);
  });

  it.each([
    ['nothing', null],
    ['an impossible date', '{"contest":"AIME","date":"2026-13-45"}'],
    ['a contest it does not list', '{"contest":"Putnam","date":"2026-12-01"}'],
    ['broken JSON', '{"contest":'],
  ])('reads %s as no date set', (_label, raw) => {
    expect(parseRaceDay(raw)).toBeNull();
  });

  it('reads back what it stored', () => {
    expect(parseRaceDay('{"contest":"AMC 10","date":"2026-11-18"}')).toEqual({ contest: 'AMC 10', date: '2026-11-18' });
  });

  it('puts the weakest topic first, and breaks ties the same way every time', () => {
    expect(attentionOrder(skills)).toEqual(['Geometry', 'Combinatorics', 'Number Theory', 'Algebra']);
    expect(attentionOrder({})).toEqual(['Algebra', 'Geometry', 'Combinatorics', 'Number Theory']);
  });

  it('turns minutes into a number of problems, never fewer than one', () => {
    expect([5, 15, 30, 60].map(problemsFor)).toEqual([1, 2, 4, 8]);
  });

  describe('the plan', () => {
    const plan = trainingPlan({ date: '2027-01-19', today: '2026-11-10', minutesPerDay: 30, skills, contest: 'AMC 10' });

    it('covers every day up to the contest, and no more', () => {
      expect(plan).toHaveLength(10);
      expect(plan.reduce((days, week) => days + week.days, 0)).toBe(70);
      expect(plan[0].start).toBe('2026-11-10');
    });

    it('builds first, sharpens next, and always ends on a taper', () => {
      expect(plan.map(week => week.phase)).toEqual(['build', 'build', 'build', 'build', 'build', 'build', 'sharpen', 'sharpen', 'sharpen', 'taper']);
    });

    it('opens on the weakest topic and returns to it more often while building', () => {
      const built = plan.filter(week => week.phase === 'build').map(week => week.focus);
      expect(built[0]).toBe('Geometry');
      expect(built.filter(topic => topic === 'Geometry')).toHaveLength(2);
      expect(built.filter(topic => topic === 'Algebra')).toHaveLength(1);
    });

    it('never pairs a topic with itself', () => {
      for (const week of plan) expect(week.support, `week ${week.index}`).not.toBe(week.focus);
    });

    it('asks for more against the clock and less in the last week', () => {
      expect(plan[0].problemsPerDay).toBe(4);
      expect(plan[7].problemsPerDay).toBe(5);
      expect(plan[9].problemsPerDay).toBe(2);
    });

    it('is a single taper week when the contest is days away, and empty once it has passed', () => {
      const short = trainingPlan({ date: '2026-11-14', today: '2026-11-10', minutesPerDay: 15, skills });
      expect(short.map(week => [week.phase, week.days])).toEqual([['taper', 4]]);
      expect(trainingPlan({ date: '2026-11-10', today: '2026-11-10', minutesPerDay: 15, skills })).toEqual([]);
    });
  });
});

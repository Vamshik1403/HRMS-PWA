import {
  collapsePunchBursts,
  dedupeSortedPunchList,
  MIN_PUNCH_GAP_MIN,
} from './attendance-status.engine';

describe('attendance-status.engine', () => {
  describe('collapsePunchBursts', () => {
    it('merges rapid duplicate taps within the gap window', () => {
      const punches = ['09:00', '09:02', '09:03', '18:00'];
      expect(collapsePunchBursts(punches, MIN_PUNCH_GAP_MIN)).toEqual(['09:00', '18:00']);
    });

    it('keeps distinct in/out punches separated by working hours', () => {
      const punches = ['09:05', '13:00', '18:10'];
      expect(collapsePunchBursts(punches, MIN_PUNCH_GAP_MIN)).toEqual(punches);
    });
  });

  describe('dedupeSortedPunchList', () => {
    it('sorts, dedupes exact duplicates, then collapses bursts', () => {
      const punches = ['18:00', '09:00', '09:00', '09:02'];
      expect(dedupeSortedPunchList(punches)).toEqual(['09:00', '18:00']);
    });
  });
});

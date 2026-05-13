import {
  findNextTemplateStep,
  pickNextStep,
  StepCandidate,
} from '../../../src/modules/processing-route/domain/next-step';

const step = (overrides: Partial<StepCandidate> = {}): StepCandidate => ({
  id: 's1',
  stepType: 'WASH',
  displayName: 'Wash',
  sortOrder: 10,
  ...overrides,
});

describe('pickNextStep', () => {
  it('returns null when both candidates are null (plan completion)', () => {
    expect(pickNextStep(null, null)).toBeNull();
  });

  it('returns the override candidate alone when route is null', () => {
    const ov = step({ id: 'o1', sortOrder: 15 });
    expect(pickNextStep(ov, null)).toEqual({ step: ov, source: 'OVERRIDE' });
  });

  it('returns the route candidate alone when override is null', () => {
    const rt = step({ id: 'r1', sortOrder: 20 });
    expect(pickNextStep(null, rt)).toEqual({ step: rt, source: 'ROUTE' });
  });

  it('override wins when its sortOrder is strictly less than route', () => {
    const ov = step({ id: 'o1', sortOrder: 15 });
    const rt = step({ id: 'r1', sortOrder: 20 });
    expect(pickNextStep(ov, rt)).toEqual({ step: ov, source: 'OVERRIDE' });
  });

  it('route wins when its sortOrder is strictly less than override', () => {
    const ov = step({ id: 'o1', sortOrder: 25 });
    const rt = step({ id: 'r1', sortOrder: 20 });
    expect(pickNextStep(ov, rt)).toEqual({ step: rt, source: 'ROUTE' });
  });

  it('on equal sortOrder, route wins (override at SAME sortOrder is "we are on it" — already accounted for)', () => {
    const ov = step({ id: 'o1', sortOrder: 20 });
    const rt = step({ id: 'r1', sortOrder: 20 });
    expect(pickNextStep(ov, rt)).toEqual({ step: rt, source: 'ROUTE' });
  });
});

describe('findNextTemplateStep', () => {
  const templateSteps = [
    { offset: 0, stepType: 'CHECK', displayName: 'Check' },
    { offset: 1, stepType: 'WAIT_CUSTOMER_DECISION', displayName: 'Wait' },
    { offset: 2, stepType: 'REPAIR', displayName: 'Repair' },
  ];

  it('returns the first step whose offset is strictly greater than currentOffset', () => {
    const result = findNextTemplateStep(templateSteps, 0, 100, 'ov1');
    expect(result).toEqual({
      id: 'ov1',
      stepType: 'WAIT_CUSTOMER_DECISION',
      displayName: 'Wait',
      sortOrder: 101,
    });
  });

  it('projects sortOrder as baseStepSortOrder + offset', () => {
    const result = findNextTemplateStep(templateSteps, 1, 50, 'ov1');
    expect(result?.sortOrder).toBe(52); // 50 + 2
  });

  it('returns null when every step has offset ≤ currentOffset (template exhausted)', () => {
    expect(findNextTemplateStep(templateSteps, 2, 100, 'ov1')).toBeNull();
    expect(findNextTemplateStep(templateSteps, 99, 100, 'ov1')).toBeNull();
  });

  it('returns null when template has no steps', () => {
    expect(findNextTemplateStep([], 0, 100, 'ov1')).toBeNull();
  });

  it('carries the override id (not a template step id) onto the returned StepCandidate', () => {
    // findNextStep callers downstream use this id to identify the override
    // row, not the template step.
    const result = findNextTemplateStep(templateSteps, 0, 0, 'override-uuid');
    expect(result?.id).toBe('override-uuid');
  });
});

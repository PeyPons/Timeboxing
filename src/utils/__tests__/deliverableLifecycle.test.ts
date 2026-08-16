import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    computeDeliverableLifecycle,
    deliverablePhaseOverlapsMonth,
    getDeliverablePhase,
    prorateHoursForPhaseOverlap,
} from '@/utils/deliverableLifecycle';
import * as hoursTracking from '@/utils/hoursTracking';
import type { Allocation, Employee, Project } from '@/types';
import { PROJECT_TYPE_ENTREGABLE } from '@/config/projectTypePresets';

const baseProject = (over: Partial<Project> = {}): Project => ({
    id: 'p1',
    agencyId: 'a1',
    clientId: 'c1',
    name: 'P',
    status: 'active',
    budgetHours: 100,
    monthlyFee: 12000,
    projectType: PROJECT_TYPE_ENTREGABLE,
    deliverableContractFee: 12000,
    deliverableStartDate: '2026-01-01',
    deliverableDueDate: '2026-01-31',
    ...over,
});

const employee = (over: Partial<Employee> = {}): Employee => ({
    id: 'e1',
    agencyId: 'a1',
    name: 'Emp',
    email: 'e@test.com',
    role: 'member',
    department: 'd',
    defaultWeeklyCapacity: 40,
    workSchedule: {
        monday: 8,
        tuesday: 8,
        wednesday: 8,
        thursday: 8,
        friday: 8,
        saturday: 0,
        sunday: 0,
    },
    isActive: true,
    monthlyCost: 4400,
    ...over,
});

const alloc = (over: Partial<Allocation> = {}): Allocation => ({
    id: 'a1',
    employeeId: 'e1',
    projectId: 'p1',
    weekStartDate: '2026-01-05',
    hoursAssigned: 10,
    hoursActual: 10,
    hoursComputed: 10,
    status: 'completed',
    ...over,
});

describe('getDeliverablePhase', () => {
    it('1. proyecto no Entregable → null', () => {
        expect(getDeliverablePhase(baseProject({ projectType: 'Mensual' }))).toBeNull();
    });

    it('2. Entregable sin start → null', () => {
        expect(
            getDeliverablePhase(
                baseProject({ deliverableStartDate: null, deliverableDueDate: '2026-01-31' })
            )
        ).toBeNull();
    });
});

describe('deliverablePhaseOverlapsMonth', () => {
    it('solapa enero cuando la fase cruza enero', () => {
        const p = baseProject({
            deliverableStartDate: '2025-11-01',
            deliverableDueDate: '2026-05-31',
        });
        expect(deliverablePhaseOverlapsMonth(p, new Date('2026-01-10'))).toBe(true);
    });
    it('no solapa mes fuera de fase', () => {
        const p = baseProject({
            deliverableStartDate: '2025-11-01',
            deliverableDueDate: '2026-05-31',
        });
        expect(deliverablePhaseOverlapsMonth(p, new Date('2026-07-01'))).toBe(false);
    });
});

describe('computeDeliverableLifecycle', () => {
    it('1b. no Entregable → no-phase y ceros', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({ projectType: 'Mensual' }),
            allocations: [alloc()],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-15'),
        });
        expect(r.status).toBe('no-phase');
        expect(r.hours.computed).toBe(0);
    });

    it('3. fase sin allocations, mitad de fase → on-track, computed 0, expected > 0', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject(),
            allocations: [],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-16'),
        });
        expect(r.status).toBe('on-track');
        expect(r.hours.computed).toBe(0);
        expect(r.pacing.expectedHoursToDate).toBeGreaterThan(0);
        expect(r.pacing.deltaHours).toBeCloseTo(-r.pacing.expectedHoursToDate, 1);
    });

    it('4. allocations en ritmo → marginPct coherente', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({ budgetHours: 77 }),
            allocations: [
                alloc({
                    hoursAssigned: 20,
                    hoursActual: 20,
                    hoursComputed: 20,
                    weekStartDate: '2026-01-06',
                }),
            ],
            employees: [employee({ monthlyCost: 4000, defaultWeeklyCapacity: 40 })],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-16'),
        });
        expect(r.status).toBe('on-track');
        if (r.finance.revenueAccrued > 0 && r.finance.marginPct != null) {
            const expectedPct = (1 - r.finance.costToDate / r.finance.revenueAccrued) * 100;
            expect(Math.abs(r.finance.marginPct - expectedPct)).toBeLessThan(1);
        }
    });

    it('5. overshoot absoluto → over-budget', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({ budgetHours: 100 }),
            allocations: [
                alloc({
                    hoursComputed: 120,
                    hoursActual: 120,
                    hoursAssigned: 120,
                }),
            ],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-15'),
        });
        expect(r.hours.computed).toBeGreaterThan(100);
        expect(r.status).toBe('over-budget');
    });

    it('6. proyección elevada sin superar techo → on-track (ritmo no es veredicto)', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({
                budgetHours: 100,
                deliverableStartDate: '2026-01-01',
                deliverableDueDate: '2026-01-30',
            }),
            allocations: [
                alloc({
                    hoursComputed: 80,
                    hoursActual: 80,
                    hoursAssigned: 80,
                    weekStartDate: '2026-01-06',
                }),
            ],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-15'),
        });
        expect(r.pacing.daysElapsed).toBeGreaterThan(0);
        expect(r.pacing.projectedAtDueDate).toBeGreaterThan(100 * 1.1 - 0.01);
        expect(r.hours.computed).toBeLessThanOrEqual(100);
        expect(r.status).toBe('on-track');
    });

    it('6b. Oasis-like: mitad de fase, 62% techo → on-track', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({
                budgetHours: 30,
                deliverableStartDate: '2026-05-20',
                deliverableDueDate: '2026-08-11',
            }),
            allocations: [
                alloc({
                    hoursComputed: 18.53,
                    hoursActual: 18.53,
                    hoursAssigned: 18.53,
                    weekStartDate: '2026-06-23',
                }),
            ],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-06-30'),
        });
        expect(r.pacing.daysRemaining).toBeGreaterThan(30);
        expect(r.status).toBe('on-track');
    });

    it('6c. >90% techo con >15% plazo restante → at-risk', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({
                budgetHours: 100,
                deliverableStartDate: '2026-01-01',
                deliverableDueDate: '2026-06-30',
            }),
            allocations: [
                alloc({
                    hoursComputed: 92,
                    hoursActual: 92,
                    hoursAssigned: 92,
                    weekStartDate: '2026-01-06',
                }),
            ],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-02-15'),
        });
        expect(r.hours.computed).toBeLessThanOrEqual(100);
        expect(r.status).toBe('at-risk');
    });

    it('6d. <14 días y >95% techo → at-risk', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({
                budgetHours: 100,
                deliverableStartDate: '2026-01-01',
                deliverableDueDate: '2026-01-31',
            }),
            allocations: [
                alloc({
                    hoursComputed: 96,
                    hoursActual: 96,
                    hoursAssigned: 96,
                    weekStartDate: '2026-01-06',
                }),
            ],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-25'),
        });
        expect(r.pacing.daysRemaining).toBeLessThanOrEqual(14);
        expect(r.status).toBe('at-risk');
    });

    it('7. pre-start → revenueAccrued 0', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject(),
            allocations: [],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2025-12-01'),
        });
        expect(r.status).toBe('pre-start');
        expect(r.finance.revenueAccrued).toBe(0);
    });

    it('8. completed → daysElapsed = totalDays', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject(),
            allocations: [],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-02-15'),
        });
        expect(r.status).toBe('completed');
        expect(r.phase?.totalDays).toBeDefined();
        expect(r.pacing.daysElapsed).toBe(r.phase!.totalDays);
    });

    it('9. empleado borrado → hasUnknownCostEmployees', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject(),
            allocations: [alloc({ employeeId: 'missing' })],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-15'),
        });
        expect(r.finance.hasUnknownCostEmployees).toBe(true);
    });

    it('10. contractFee 0 → margin null', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({ monthlyFee: 0, deliverableContractFee: null }),
            allocations: [],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-15'),
        });
        expect(r.finance.contractFee).toBe(0);
        expect(r.finance.marginAbsolute).toBeNull();
        expect(r.finance.marginPct).toBeNull();
    });

    it('11. semana antes de fase, solape parcial → solo días dentro', () => {
        const r = computeDeliverableLifecycle({
            project: baseProject({
                deliverableStartDate: '2026-01-08',
                deliverableDueDate: '2026-01-31',
            }),
            allocations: [
                alloc({
                    weekStartDate: '2026-01-05',
                    hoursComputed: 40,
                    hoursActual: 40,
                    hoursAssigned: 40,
                }),
            ],
            employees: [employee()],
            hoursPreference: 'computed',
            costMode: 'standard',
            today: new Date('2026-01-20'),
        });
        expect(r.hours.computed).toBeGreaterThan(0);
        expect(r.hours.computed).toBeLessThan(40);
    });

    it('12. usa getEffectiveAllocationHours con preferencia', () => {
        const spy = vi.spyOn(hoursTracking, 'getEffectiveAllocationHours').mockReturnValue(99);
        const a = alloc({ hoursComputed: 5, hoursActual: 5 });
        prorateHoursForPhaseOverlap(a, new Date('2026-01-01'), new Date('2026-01-31'), 'computed');
        expect(spy).toHaveBeenCalledWith(a, 'computed');
        spy.mockRestore();
    });
});

describe('dynamic cost lifecycle', () => {
    it('dynamic un empleado dos allocations monopoliza coste mensual', () => {
        const em = employee({ monthlyCost: 3000 });
        const r = computeDeliverableLifecycle({
            project: baseProject({ budgetHours: 200 }),
            allocations: [
                alloc({
                    id: 'x1',
                    weekStartDate: '2026-01-06',
                    hoursComputed: 10,
                    hoursActual: 10,
                    hoursAssigned: 10,
                }),
                alloc({
                    id: 'x2',
                    weekStartDate: '2026-01-13',
                    hoursComputed: 20,
                    hoursActual: 20,
                    hoursAssigned: 20,
                }),
            ],
            employees: [em],
            hoursPreference: 'computed',
            costMode: 'dynamic',
            today: new Date('2026-01-20'),
        });
        expect(r.finance.costToDate).toBeCloseTo(3000, 0);
    });
});

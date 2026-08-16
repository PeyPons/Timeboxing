import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    ArrowRight, ArrowLeft, Clock, DollarSign, Target, Users,
    BarChart3, LayoutDashboard, CalendarRange, FolderKanban, Plug,
    TrendingUp, AlertTriangle, CheckCircle2, Zap, Shield, PieChart,
    Timer, ChevronLeft, ChevronRight, Sparkles, Building2, Eye, Layers,
    Table2, Mail, Gauge, FileText,
} from 'lucide-react';

import { TaimboxMark } from '@/components/brand/TaimboxLogo';

import { useTranslation } from 'react-i18next';
import { pathEsToEn } from '@/i18n/publicPaths';
import { SeoTags } from '@/seo/SeoTags';
import {
    MockPlanningGrid, MockAllocationSheet, MockDashboard,
    MockTeamCapacity, MockReportsDashboard, MockDeadlines,
    MockIntegrations, MockWeeklyForecast, MockBeforeAfter,
} from '@/components/landing/PresentationMockups';

/* ─── SLIDE INFRASTRUCTURE ─── */

interface SlideProps {
    isActive: boolean;
    direction: 'left' | 'right' | 'none';
}

function SlideWrapper({ isActive, direction, children }: SlideProps & { children: React.ReactNode }) {
    return (
        <div
            className={`absolute inset-0 w-full h-full transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] overflow-y-auto overflow-x-hidden ${isActive
                ? 'opacity-100 translate-x-0 scale-100 z-10'
                : direction === 'left'
                    ? 'opacity-0 -translate-x-[100vw] scale-[0.98] pointer-events-none z-0'
                    : direction === 'right'
                        ? 'opacity-0 translate-x-[100vw] scale-[0.98] pointer-events-none z-0'
                        : 'opacity-0 scale-[0.98] pointer-events-none z-0'
                }`}
        >
            <div className="min-h-full w-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-12 lg:px-20 pt-10 sm:pt-14 pb-40 sm:pb-48">
                <div className="w-full max-w-full break-words">
                    {children}
                </div>
            </div>
        </div>
    );
}

/* ─── REUSABLE PIECES ─── */

function StatCard({ value, label, color, icon: Icon }: { value: string; label: string; color: string; icon: React.ElementType }) {
    const map: Record<string, string> = {
        red: 'bg-red-500/15 border-red-400/30 text-red-300',
        amber: 'bg-amber-500/15 border-amber-400/30 text-amber-300',
        orange: 'bg-orange-500/15 border-orange-400/30 text-orange-300',
    };
    return (
        <div className={`h-full flex flex-col items-center justify-center p-3 sm:p-6 rounded-xl sm:rounded-2xl border ${map[color]} text-center`}>
            <Icon className="h-5 w-5 sm:h-7 sm:w-7 mx-auto mb-1.5 sm:mb-2 opacity-80" />
            <p className="text-2xl sm:text-3xl md:text-4xl font-black">{value}</p>
            <p className="text-xs sm:text-base mt-1 sm:mt-1.5 opacity-80 leading-tight">{label}</p>
        </div>
    );
}

function CostRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-amber-300/60 shrink-0" />
                <span className="text-white/90 text-sm sm:text-base truncate">{label}</span>
            </div>
            <span className="font-bold text-amber-300 text-base sm:text-xl shrink-0">{value}</span>
        </div>
    );
}

function PillarCard({ icon: Icon, title, description, gradient, step }: { icon: React.ElementType; title: string; description: string; gradient: string; step: string }) {
    return (
        <div className="h-full flex flex-col relative p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm text-left group hover:bg-white/10 hover:border-white/25 transition-all duration-300">
            <span className="absolute top-2 right-2 sm:top-3 sm:right-3 text-[10px] sm:text-xs font-mono font-bold text-white/30">{step}</span>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-2 sm:mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 sm:mb-2">{title}</h3>
            <p className="text-sm sm:text-base text-indigo-200/80 leading-relaxed">{description}</p>
        </div>
    );
}

function ROICard({ value, label, icon: Icon, color }: { value: string; label: string; icon: React.ElementType; color: string }) {
    const map: Record<string, string> = {
        emerald: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300',
        blue: 'bg-blue-500/15 border-blue-400/30 text-blue-300',
        purple: 'bg-purple-500/15 border-purple-400/30 text-purple-300',
        indigo: 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300',
    };
    return (
        <div className={`h-full flex flex-col items-center justify-center p-3 sm:p-6 rounded-xl sm:rounded-2xl border ${map[color]} text-center`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 mx-auto mb-1.5 sm:mb-2 opacity-80" />
            <p className="text-xl sm:text-2xl md:text-3xl font-black">{value}</p>
            <p className="text-[11px] sm:text-base mt-1 sm:mt-1.5 opacity-90 leading-snug">{label}</p>
        </div>
    );
}

/* ─── SLIDES ─── */

function S00_Portada({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center min-h-full text-center px-2">
                <div className="relative mb-5 sm:mb-8">
                    <div className="absolute -inset-6 sm:-inset-10 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 rounded-full blur-3xl animate-pulse" />
                    <TaimboxMark className="relative h-20 w-20 sm:h-28 sm:w-28" variant="dark" />
                </div>
                <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white mb-3 sm:mb-4 tracking-tight">Taimbox</h1>
                <p className="text-base sm:text-xl md:text-2xl lg:text-3xl text-indigo-200/90 max-w-xl font-light">
                    Sistema operativo financiero<br />
                    <span className="text-white font-semibold">basado en tiempo</span>
                </p>
                <div className="mt-8 sm:mt-14 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 text-indigo-300/60 text-xs sm:text-base animate-bounce">
                    <span>Pulsa</span>
                    <kbd className="px-2 py-1 rounded bg-white/10 border border-white/20 text-xs sm:text-sm font-mono">→</kbd>
                    <span>o toca para avanzar</span>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S01_Contexto({ isActive, direction }: SlideProps) {
    const items: { icon: React.ElementType; text: string }[] = [
        { icon: Table2, text: 'Excels compartidos que nadie actualiza' },
        { icon: Mail, text: 'Emails y chats para saber "quién hace qué"' },
        { icon: Gauge, text: 'Estimaciones de presupuesto "a ojo"' },
        { icon: FileText, text: 'Reporting manual al final de mes' },
    ];
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center h-full w-full max-w-5xl mx-auto px-4 sm:px-6">
                {/* Título e icono en bloque compacto */}
                <div className="flex flex-col items-center text-center mb-4 sm:mb-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center mb-3 sm:mb-4">
                        <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-300" />
                    </div>
                    <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight px-1">
                        ¿Cómo gestiona hoy
                        <span className="block text-indigo-300 mt-1">una agencia su tiempo?</span>
                    </h2>
                </div>

                {/* Grid problemas: en móvil solo 2 ítems; en desktop 4 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 w-full max-w-3xl mb-3 sm:mb-8">
                    {items.map((item, i) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={i}
                                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-red-500/10 border-2 border-red-500/25 text-left shadow-lg shadow-red-950/20 ${i >= 2 ? 'hidden sm:flex' : ''}`}
                            >
                                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-lg sm:rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                                    <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-red-200" />
                                </div>
                                <p className="text-sm sm:text-xl font-semibold text-white/95 leading-snug">
                                    {item.text}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Conclusión: texto más corto en móvil */}
                <div className="w-full max-w-2xl rounded-xl sm:rounded-2xl bg-white/5 border border-white/15 px-4 sm:px-6 py-3 sm:py-5 text-center">
                    <p className="text-sm sm:text-xl md:text-2xl text-white/95 font-medium leading-snug">
                        <span className="sm:hidden">Horas que se pierden, decisiones sin datos.</span>
                        <span className="hidden sm:inline">Resultado: las horas se pierden, la rentabilidad es incierta y las decisiones se toman sin datos.</span>
                    </p>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S02_Problema({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center h-full text-center max-w-4xl mx-auto px-2 sm:px-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-red-500/25 border border-red-400/40 flex items-center justify-center mb-4 sm:mb-6">
                    <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-300" />
                </div>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-8">
                    ¿Cuánto dinero<br /><span className="text-red-400">se pierde cada mes?</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 w-full max-w-3xl">
                    <StatCard value="30%" label="de horas no se registran" color="red" icon={Clock} />
                    <StatCard value="15h" label="por empleado/mes sin planificar" color="amber" icon={Timer} />
                    <div className="col-span-1">
                        <StatCard value="€€€" label="de rentabilidad invisible" color="orange" icon={DollarSign} />
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S03_Coste({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center h-full text-center max-w-4xl mx-auto px-2 sm:px-4">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-8">
                    El coste de <span className="text-amber-400">no medir</span>
                </h2>
                <div className="w-full max-w-xl">
                    <div className="relative p-4 sm:p-8 rounded-xl sm:rounded-2xl border-2 border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                        <div className="space-y-3 sm:space-y-5">
                            <CostRow icon={Users} label="20 empleados × 15h/mes" value="300h" />
                            <CostRow icon={DollarSign} label="× Tarifa media 50€/h" value="×50€" />
                            <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm sm:text-lg text-white font-bold">Pérdida mensual</span>
                                <span className="text-2xl sm:text-3xl md:text-4xl font-black text-amber-400">15.000€</span>
                            </div>
                            <p className="text-amber-200/70 text-xs sm:text-base text-center">= 180.000€/año en rentabilidad invisible</p>
                        </div>
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S04_BeforeAfter({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto px-2 sm:px-4 text-center">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-8">
                    Antes vs <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Después</span>
                </h2>
                <MockBeforeAfter />
            </div>
        </SlideWrapper>
    );
}

function S05_Solucion({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center h-full text-center max-w-4xl mx-auto px-2 sm:px-4">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-3 sm:mb-6">
                    La solución: <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Taimbox</span>
                </h2>
                <p className="text-sm sm:text-xl text-indigo-200/90 mb-4 sm:mb-8 max-w-lg">Convierte el tiempo en el activo más rentable de la agencia.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 w-full max-w-3xl">
                    <PillarCard icon={CalendarRange} title="Planificar" description="Asigna horas por proyecto, persona y semana con vista de carga en tiempo real." gradient="from-indigo-500 to-blue-500" step="01" />
                    <PillarCard icon={BarChart3} title="Medir" description="Compara planificado vs real. Detecta desvíos antes de que cuesten dinero." gradient="from-purple-500 to-pink-500" step="02" />
                    <div className="hidden sm:block">
                        <PillarCard icon={TrendingUp} title="Optimizar" description="Informes de rentabilidad, previsiones y redistribución inteligente." gradient="from-emerald-500 to-teal-500" step="03" />
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S06_Planificador({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center w-full max-w-6xl mx-auto px-2 sm:px-4 h-full py-3 sm:py-4">
                <div className="text-center lg:text-left order-2 lg:order-1">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 justify-center lg:justify-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-xl shrink-0">
                            <CalendarRange className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-indigo-400">Para directores</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Planificador</h2>
                        </div>
                    </div>
                    <div className="space-y-2 max-w-md mx-auto lg:mx-0">
                        {['Vista semanal del equipo completo', 'Barras de carga en tiempo real', 'Asignación con vista de impacto', 'Indicadores visuales de sobrecarga'].map((f, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/10 ${i >= 2 ? 'hidden sm:flex' : ''}`}>
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" />
                                <span className="text-sm sm:text-base text-white/90">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-center items-center order-1 lg:order-2">
                    <div className="w-full max-w-md flex flex-col gap-2 sm:gap-3 scale-[0.85] sm:scale-95 md:scale-105 origin-center">
                        <MockPlanningGrid />
                        <MockAllocationSheet />
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S07_Dashboard({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center w-full max-w-6xl mx-auto px-2 sm:px-4 h-full py-3 sm:py-4">
                <div className="flex justify-center items-center order-1">
                    <div className="w-full max-w-sm scale-[0.85] sm:scale-95 md:scale-105 origin-center">
                        <MockDashboard />
                    </div>
                </div>
                <div className="text-center lg:text-left order-2">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 justify-center lg:justify-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-xl shrink-0">
                            <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-purple-400">Para empleados</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Dashboard Personal</h2>
                        </div>
                    </div>
                    <div className="space-y-2 max-w-md mx-auto lg:mx-0">
                        {['Vista diaria con dependencias', 'Control planificación vs deadline', 'Índice de fiabilidad personal', 'Gestión interna y no facturables'].map((f, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/10 ${i >= 2 ? 'hidden sm:flex' : ''}`}>
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" />
                                <span className="text-sm sm:text-base text-white/90">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S08_Equipos({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center w-full max-w-6xl mx-auto px-2 sm:px-4 h-full py-3 sm:py-4">
                <div className="text-center lg:text-left order-2 lg:order-1">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 justify-center lg:justify-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shrink-0">
                            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-blue-400">Para RRHH</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Gestión de Equipos</h2>
                        </div>
                    </div>
                    <div className="space-y-2 max-w-md mx-auto lg:mx-0">
                        {['Horarios personalizados L–D', 'Calendario de ausencias integrado', 'Capacidad semanal automática', 'Team Pulse: estado del equipo'].map((f, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/10 ${i >= 2 ? 'hidden sm:flex' : ''}`}>
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" />
                                <span className="text-sm sm:text-base text-white/90">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-center items-center order-1 lg:order-2">
                    <div className="w-full max-w-sm scale-[0.85] sm:scale-95 md:scale-105 origin-center">
                        <MockTeamCapacity />
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S09_Tiempos({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center w-full max-w-6xl mx-auto px-2 sm:px-4 h-full py-3 sm:py-4">
                <div className="text-center lg:text-left order-2 lg:order-1">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 justify-center lg:justify-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-xl shrink-0">
                            <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-teal-400">Para todo el equipo</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Tiempos y cronómetro</h2>
                        </div>
                    </div>
                    <div className="space-y-2 max-w-md mx-auto lg:mx-0">
                        {['Cronómetro por tarea en planificador y Mi Día', 'Registro de horas real con precisión de segundos', 'Vista "Tiempos": quién está en qué ahora mismo', 'Parar desde sidebar o desde la página del equipo'].map((f, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/10">
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" />
                                <span className="text-sm sm:text-base text-white/90">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-center items-center order-1 lg:order-2">
                    <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm p-4 sm:p-6">
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-teal-400/80 mb-3">Vista Tiempos — En curso</p>
                        <div className="space-y-2.5">
                            {[
                                { name: 'María A.', task: 'Diseño landing', client: 'Acme', time: '1h 23m' },
                                { name: 'Carlos R.', task: 'Dev API', client: 'StartupXYZ', time: '0h 45m' },
                            ].map((row, i) => (
                                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">{row.name.slice(0, 2)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{row.task}</p>
                                        <p className="text-[10px] text-teal-300/80 truncate">{row.client} · {row.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-white/50 mt-3 text-center">Total del día y parar en un clic</p>
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S10_Reportes({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center w-full max-w-6xl mx-auto px-2 sm:px-4 h-full py-3 sm:py-4">
                <div className="flex justify-center items-center order-1">
                    <div className="w-full max-w-md scale-[0.85] sm:scale-95 md:scale-105 origin-center">
                        <MockReportsDashboard />
                    </div>
                </div>
                <div className="text-center lg:text-left order-2">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 justify-center lg:justify-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl shrink-0">
                            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-emerald-400">Para financieros</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Reportes</h2>
                        </div>
                    </div>
                    <div className="space-y-2 max-w-md mx-auto lg:mx-0">
                        {['Rentabilidad por proyecto con ingreso devengado y ritmo (pacing)', 'Exportar Excel/CSV/JSON en 1 clic', 'Coherencia global: alertas de desvío', 'Presupuesto por deadline y coste operativo/dinámico'].map((f, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/10 ${i >= 2 ? 'hidden sm:flex' : ''}`}>
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" />
                                <span className="text-sm sm:text-base text-white/90">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S11_Deadlines({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center w-full max-w-6xl mx-auto px-2 sm:px-4 h-full py-3 sm:py-4">
                <div className="text-center lg:text-left order-2 lg:order-1">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 justify-center lg:justify-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-xl shrink-0">
                            <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400">Para PMs</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Deadlines y OKRs</h2>
                        </div>
                    </div>
                    <div className="space-y-2 max-w-md mx-auto lg:mx-0">
                        {['Objetivos de horas por proyecto/mes', 'Override de presupuesto al cambiar scope', 'Indicadores de coherencia y desviación', 'Weekly Forecast con asistente de redistribución rápida'].map((f, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/10 ${i >= 2 ? 'hidden sm:flex' : ''}`}>
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" />
                                <span className="text-sm sm:text-base text-white/90">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-center items-center order-1 lg:order-2">
                    <div className="w-full max-w-sm flex flex-col gap-2 sm:gap-3 scale-[0.85] sm:scale-95 md:scale-105 origin-center">
                        <MockDeadlines />
                        <MockWeeklyForecast />
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S12_Integraciones({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center w-full max-w-6xl mx-auto px-2 sm:px-4 h-full py-3 sm:py-4">
                <div className="flex justify-center items-center order-1">
                    <div className="w-full max-w-sm scale-[0.85] sm:scale-95 md:scale-105 origin-center">
                        <MockIntegrations />
                    </div>
                </div>
                <div className="text-center lg:text-left order-2">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 justify-center lg:justify-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-xl shrink-0">
                            <Plug className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-cyan-400">Para técnicos</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Integraciones</h2>
                        </div>
                    </div>
                    <div className="space-y-2 max-w-md mx-auto lg:mx-0">
                        {['Google Ads y Meta Ads sincronizados', 'API REST con documentación completa', 'SDK JavaScript para custom', 'Sincronización de tiempos con CRM/ERP (sujeto a integración)'].map((f, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/10 ${i >= 2 ? 'hidden sm:flex' : ''}`}>
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" />
                                <span className="text-sm sm:text-base text-white/90">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S13_Seguridad({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center h-full text-center max-w-4xl mx-auto px-2 sm:px-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center mb-4 sm:mb-6">
                    <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-300" />
                </div>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-8">
                    Seguridad y <span className="text-indigo-300">Arquitectura</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 w-full max-w-2xl">
                    {[
                        { icon: Shield, title: 'Row Level Security', desc: 'Cada agencia solo ve sus datos. Aislamiento total.' },
                        { icon: Layers, title: 'Multi-agencia', desc: 'Un usuario puede pertenecer a varias agencias.' },
                        { icon: Eye, title: 'Permisos granulares', desc: 'Roles y accesos por ruta y funcionalidad.' },
                        { icon: Sparkles, title: 'Tiempo real', desc: 'Cambios se reflejan al instante vía Supabase Realtime.' },
                    ].map((item, i) => {
                        const Icon = item.icon;
                        return (
                            <div key={i} className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-white/15 bg-white/5 text-left ${i >= 2 ? 'hidden sm:block' : ''}`}>
                                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-400 mb-1.5 sm:mb-2" />
                                <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 sm:mb-2">{item.title}</h3>
                                <p className="text-sm sm:text-base text-indigo-200/85">{item.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </SlideWrapper>
    );
}

function S14_ROI({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center h-full text-center max-w-4xl mx-auto px-2 sm:px-4">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-8">
                    Retorno de la <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">inversión</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 w-full max-w-4xl mb-4 sm:mb-6">
                    <ROICard value="+25%" label="horas facturables recuperadas" icon={TrendingUp} color="emerald" />
                    <ROICard value="90%" label="precisión en estimaciones" icon={Target} color="blue" />
                    <div className="col-span-1">
                        <ROICard value="-40%" label="tiempo en reporting" icon={PieChart} color="purple" />
                    </div>
                    <div className="col-span-1">
                        <ROICard value="100%" label="visibilidad financiera" icon={Shield} color="indigo" />
                    </div>
                </div>
                <p className="text-white/50 text-xs sm:text-sm max-w-xl mb-4">
                    Ilustración estimada (ejemplo interno, no garantía contractual). Tus resultados dependen del uso y del contexto de tu agencia.
                </p>
                <div className="p-4 sm:p-7 rounded-xl sm:rounded-2xl border border-emerald-400/30 bg-emerald-500/10 max-w-md w-full">
                    <p className="text-emerald-100 font-medium text-sm sm:text-lg">Ejemplo orientativo (equipo ~20 personas)</p>
                    <p className="text-2xl sm:text-4xl md:text-5xl font-black text-emerald-400 mt-2">hasta 180.000€/año</p>
                    <p className="text-emerald-200/80 text-sm sm:text-lg mt-1.5">mejora potencial de visibilidad operativa</p>
                </div>
            </div>
        </SlideWrapper>
    );
}

function S15_CTA({ isActive, direction }: SlideProps) {
    return (
        <SlideWrapper isActive={isActive} direction={direction}>
            <div className="flex flex-col items-center justify-center h-full text-center max-w-3xl mx-auto px-3 sm:px-4">
                <div className="relative mb-4 sm:mb-6">
                    <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-emerald-500/30 rounded-full blur-3xl animate-pulse" />
                    <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl">
                        <Zap className="h-7 w-7 sm:h-10 sm:w-10 text-white" />
                    </div>
                </div>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-6">¿Empezamos?</h2>
                <p className="text-sm sm:text-lg md:text-xl text-indigo-200/90 mb-6 sm:mb-8 max-w-lg">
                    Taimbox se configura en minutos. Vuestro equipo puede empezar a planificar <span className="text-white font-semibold">esta misma semana</span>.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto max-w-xs sm:max-w-none">
                    <Link to="/login" className="w-full sm:w-auto">
                        <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:scale-105 transition-all duration-300 min-h-[48px]">
                            Acceder a Taimbox <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
                        </Button>
                    </Link>
                    <Link to="/" className="w-full sm:w-auto">
                        <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 min-h-[48px]">
                            Ver la web completa
                        </Button>
                    </Link>
                </div>
                <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-x-6 sm:gap-x-8 gap-y-2 items-center text-sm sm:text-base">
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" /><span className="text-indigo-200/90">Setup en 10 min</span></div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" /><span className="text-indigo-200/90">Sin coste inicial</span></div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 shrink-0" /><span className="text-indigo-200/90">Soporte dedicado</span></div>
                </div>
            </div>
        </SlideWrapper>
    );
}

/* ─── ALL SLIDES ─── */
const SLIDES = [
    S00_Portada,
    S01_Contexto,
    S02_Problema,
    S03_Coste,
    S04_BeforeAfter,
    S05_Solucion,
    S06_Planificador,
    S07_Dashboard,
    S08_Equipos,
    S09_Tiempos,
    S10_Reportes,
    S11_Deadlines,
    S12_Integraciones,
    S13_Seguridad,
    S14_ROI,
    S15_CTA,
];

/* ─── MAIN PAGE ─── */
export default function PresentationPage() {
    const { t, i18n } = useTranslation('landing');
    const lang = i18n.language.startsWith('en') ? 'en' : 'es';
    const [current, setCurrent] = useState(0);
    const total = SLIDES.length;

    const goTo = useCallback((n: number) => {
        if (n < 0 || n >= total || n === current) return;
        setCurrent(n);
    }, [current, total]);

    const next = useCallback(() => goTo(current + 1), [current, goTo]);
    const prev = useCallback(() => goTo(current - 1), [current, goTo]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
            else if (e.key === 'Escape') { e.preventDefault(); goTo(0); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [next, prev, goTo]);

    useEffect(() => {
        let startX = 0;
        const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
        const onEnd = (e: TouchEvent) => {
            const diff = startX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 60) {
                if (diff > 0) next();
                else prev();
            }
        };
        window.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchend', onEnd, { passive: true });
        return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
    }, [next, prev]);

    return (
        <>
            <SeoTags
                pathEs="/pitch"
                pathEn={pathEsToEn('/pitch')}
                title={t('static.pitch.seoTitle')}
                description={t('static.pitch.seoDescription')}
                lang={lang}
                robots="noindex, nofollow"
            />
            <div className="fixed inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 overflow-hidden overflow-x-hidden select-none min-w-0">
                {/* BG effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
                    <div className="absolute top-1/2 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
                </div>
                <div className="absolute inset-0 opacity-[0.04]" style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px',
                }} />

                {/* Progress bar */}
                <div className="absolute top-0 left-0 right-0 z-50 h-1 bg-white/5">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out" style={{ width: `${((current + 1) / total) * 100}%` }} />
                </div>

                {/* Slide counter: más pequeño en móvil */}
                <div className="absolute top-3 right-3 sm:top-4 sm:right-5 z-50 text-xs sm:text-sm font-mono text-white/40">
                    {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </div>

                {/* Slides */}
                <div className="relative w-full h-full">
                    {SLIDES.map((SlideComp, i) => (
                        <SlideComp key={i} isActive={i === current} direction={i < current ? 'left' : i > current ? 'right' : 'none'} />
                    ))}
                </div>

                {/* Click zones: en móvil flechas siempre visibles y zona táctil mínima 44px */}
                {current > 0 && (
                    <button onClick={prev} className="group absolute left-0 top-0 bottom-0 w-[18%] min-w-[44px] max-w-[80px] z-40 cursor-pointer flex items-center justify-start pl-1 sm:pl-0 sm:justify-center" aria-label="Anterior">
                        <div className="p-2 rounded-full bg-white/10 sm:bg-transparent sm:opacity-0 sm:group-hover:opacity-100 opacity-80 hover:opacity-100 transition-opacity flex items-center justify-center min-h-[44px] min-w-[44px]">
                            <ChevronLeft className="h-8 w-8 sm:h-10 sm:w-10 text-white/70 sm:text-white/50" />
                        </div>
                    </button>
                )}
                {current < total - 1 && (
                    <button onClick={next} className="group absolute right-0 top-0 bottom-0 w-[18%] min-w-[44px] max-w-[80px] z-40 cursor-pointer flex items-center justify-end pr-1 sm:pr-0 sm:justify-center" aria-label="Siguiente">
                        <div className="p-2 rounded-full bg-white/10 sm:bg-transparent sm:opacity-0 sm:group-hover:opacity-100 opacity-80 hover:opacity-100 transition-opacity flex items-center justify-center min-h-[44px] min-w-[44px]">
                            <ChevronRight className="h-8 w-8 sm:h-10 sm:w-10 text-white/70 sm:text-white/50" />
                        </div>
                    </button>
                )}

                {/* Bottom nav: franja opaca para que el contenido no se vea por detrás de los controles */}
                <div className="absolute bottom-0 left-0 right-0 z-50 h-28 sm:h-32 bg-gradient-to-t from-indigo-950 from-40% via-indigo-950/95 to-transparent pointer-events-none" aria-hidden />
                <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-4 px-3 py-2 rounded-2xl bg-indigo-950/90 backdrop-blur-md border border-white/10 shadow-lg">
                    <button onClick={prev} disabled={current === 0} className="p-3 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-white min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Slide anterior">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="flex gap-1.5 sm:gap-2 overflow-x-auto max-w-[50vw] sm:max-w-none pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                        {SLIDES.map((_, i) => (
                            <button key={i} onClick={() => goTo(i)} className={`flex-shrink-0 transition-all duration-300 rounded-full min-h-[10px] sm:min-h-0 ${i === current ? 'w-6 sm:w-8 h-2.5 bg-gradient-to-r from-indigo-400 to-purple-400' : 'w-2.5 h-2.5 bg-white/25 hover:bg-white/50'}`} aria-label={`Slide ${i + 1}`} />
                        ))}
                    </div>
                    <button onClick={next} disabled={current === total - 1} className="p-3 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-white min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Slide siguiente">
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </>
    );
}

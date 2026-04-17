'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { FaUserTie, FaCar, FaVideo, FaArrowRight } from 'react-icons/fa';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface ChartDataPoint {
    label: string;
    uploads?: number;
    deletions?: number;
    other?: number;
    total?: number;
}

interface TooltipProps {
    active?: boolean;
    payload?: Array<{ color: string; name: string; value: number }>;
    label?: string;
}

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        staffCount: 0,
        stockCount: 0,
        videoCount: 0
    });
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const router = useRouter();

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setChartLoading(true);
        try {
            const headers = { Authorization: `Bearer ${user?.token}` };

            const staffRes = await fetch('/api/auth/staff', { headers });
            const staffData = await staffRes.json();

            let stockCount = 0;
            try {
                const stockRes = await fetch('/api/autotrader/stock', { headers });
                const stockData = await stockRes.json();
                stockCount = stockData.results?.length || 0;
            } catch (e) {
                stockCount = 0;
            }

            const videoRes = await fetch('/api/videos', { headers });
            const videoData = await videoRes.json();

            setStats({
                staffCount: staffData.length,
                stockCount: stockCount,
                videoCount: videoData.length
            });

            const chartRes = await fetch('/api/audit-logs/weekly-stats', { headers });
            const chartResData = await chartRes.json();
            setChartData(chartResData);
        } catch (error) {
            console.error('Failed to fetch dashboard stats', error);
        } finally {
            setLoading(false);
            setChartLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const statCards = [
        {
            title: 'Staff',
            desc: 'Create & manage staff accounts',
            count: stats.staffCount,
            icon: FaUserTie,
            bgClass: 'bg-purple-100',
            textClass: 'text-purple-600',
            path: '/admin/staff'
        },
        {
            title: 'Stock',
            desc: 'Manage vehicle inventory',
            count: stats.stockCount,
            icon: FaCar,
            bgClass: 'bg-green-100',
            textClass: 'text-green-600',
            path: '/admin/stock'
        },
        {
            title: 'Videos',
            desc: 'View uploaded video presentations',
            count: stats.videoCount,
            icon: FaVideo,
            bgClass: 'bg-blue-100',
            textClass: 'text-blue-600',
            path: '/staff/videos'
        }
    ];

    const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border border-gray-100 rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-semibold text-gray-700 mb-1">{label}</p>
                    {payload.map((entry, i) => (
                        <p key={i} style={{ color: entry.color }}>
                            {entry.name}: <span className="font-bold">{entry.value}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const totalActivity = chartData.reduce((sum, d) => sum + (d.total || 0), 0);
    const hasActivity = totalActivity > 0;

    return (
        <DashboardLayout>
            <div className="w-full px-6 space-y-8 animate-fadeIn">

                {/* Weekly Activity Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Weekly Activity</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Last 7 days of system actions</p>
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                            {totalActivity} total actions
                        </span>
                    </div>

                    <div className="h-64 w-full">
                        {chartLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : !hasActivity ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <svg className="w-12 h-12 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <p className="text-sm">No activity in the last 7 days</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={chartData}
                                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorDeletions" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        allowDecimals={false}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="uploads"
                                        name="Uploads"
                                        stroke="#3b82f6"
                                        strokeWidth={2.5}
                                        fill="url(#colorUploads)"
                                        dot={false}
                                        activeDot={{ r: 5, strokeWidth: 0 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="deletions"
                                        name="Deletions"
                                        stroke="#ef4444"
                                        strokeWidth={2.5}
                                        fill="url(#colorDeletions)"
                                        dot={false}
                                        activeDot={{ r: 5, strokeWidth: 0 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="other"
                                        name="Other"
                                        stroke="#8b5cf6"
                                        strokeWidth={2.5}
                                        fill="url(#colorOther)"
                                        dot={false}
                                        activeDot={{ r: 5, strokeWidth: 0 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Go To Section */}
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Go To</h3>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {statCards.map((card, idx) => {
                                const Icon = card.icon;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => router.push(card.path)}
                                        className="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between h-48"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className={`${card.bgClass} p-3 rounded-lg`}>
                                                <Icon className={`${card.textClass}`} size={24} />
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <FaArrowRight className="text-gray-300 group-hover:text-blue-500" />
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-gray-800 text-lg">{card.title}</h4>
                                            <p className="text-sm text-gray-400 mt-1 mb-3">{card.desc}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 text-sm font-medium">Total:</span>
                                                <span className="text-2xl font-bold text-gray-900">{card.count}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AdminDashboard;

import React, { useState, useEffect, useMemo } from 'react';

// --- Type Definitions ---
interface Activity {
    id: number;
    task: string;
    startTime: string;
    endTime: string | null;
}

interface Day {
    date: string; // This will be the primary key
    activities: Activity[];
}

// --- Initial Data Configuration ---
const initialTaskOptions: string[] = [
  'Wake up', 'Washroom', 'Exercise', 'Breakfast', 'Video call', 
  'Office work', 'Rest', 'Lunch', 'Sleep', 'Read book', 'Call', 'Dinner'
];

const taskIcons: { [key: string]: string } = {
  'Wake up': '☀️', 'Washroom': '🚽', 'Exercise': '🏋️', 'Breakfast': '�', 
  'Video call': '💻', 'Office work': '💼', 'Rest': '🧘', 'Lunch': '🥪',
  'Sleep': '😴', 'Read book': '📚', 'Call': '📞', 'Dinner': '🍽️',
};

// --- Helper Functions ---

const calculateStreaks = (days: Day[], task: string | null): { currentStreak: number; longestStreak: number } => {
    if (!days || days.length === 0) {
        return { currentStreak: 0, longestStreak: 0 };
    }

    const relevantDays = task
        ? days.filter(day => day.activities.some(activity => activity.task === task))
        : days;

    if (relevantDays.length === 0) {
        return { currentStreak: 0, longestStreak: 0 };
    }

    const dates = relevantDays.map(day => {
        const [year, month, dayOfMonth] = day.date.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, dayOfMonth));
    }).sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) {
        return { currentStreak: 0, longestStreak: 0 };
    }

    let longestStreak = 0;
    let currentConsecutive = 0;

    if (dates.length > 0) {
        longestStreak = 1;
        currentConsecutive = 1;
    }

    for (let i = 1; i < dates.length; i++) {
        const diff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
            currentConsecutive++;
        } else {
            longestStreak = Math.max(longestStreak, currentConsecutive);
            currentConsecutive = 1;
        }
    }
    longestStreak = Math.max(longestStreak, currentConsecutive);

    let activeCurrentStreak = 0;
    if (dates.length > 0) {
        const lastDate = dates[dates.length - 1];
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        const yesterdayUTC = new Date(todayUTC);
        yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1);

        if (lastDate.getTime() === todayUTC.getTime() || lastDate.getTime() === yesterdayUTC.getTime()) {
            activeCurrentStreak = 1;
            for (let i = dates.length - 2; i >= 0; i--) {
                const diff = (dates[i + 1].getTime() - dates[i].getTime()) / (1000 * 60 * 60 * 24);
                if (diff === 1) {
                    activeCurrentStreak++;
                } else {
                    break;
                }
            }
        }
    }

    return { currentStreak: activeCurrentStreak, longestStreak };
};


const parseTime = (timeString: string | null): Date | null => {
    if (!timeString) return null;
    const now = new Date();
    const [time, modifier] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    now.setHours(hours, minutes, 0, 0);
    return now;
};

const calculateDuration = (start: string | null, end: string | null): string => {
    if (!start || !end) return '';
    const startDate = parseTime(start);
    const endDate = parseTime(end);
    if (!startDate || !endDate) return '';
    let diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (diff < 0) diff += 24 * 60;
    if (diff === 0) return '0m';
    const hours = Math.floor(diff / 60);
    const minutes = Math.round(diff % 60);
    let duration = '';
    if (hours > 0) duration += `${hours}h `;
    if (minutes > 0) duration += `${minutes}m`;
    return duration.trim();
};

const formatTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHours = h % 12 || 12;
    return `${formattedHours}:${minutes} ${ampm}`;
};

const convertTo24Hour = (time12: string | null): string => {
    if (!time12) return '';
    const [time, modifier] = time12.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDateForDisplay = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', options);
};

const formatDateForInput = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Notification Hook ---
const useNotificationReminder = (days: Day[] | undefined) => {
    useEffect(() => {
        if (!("Notification" in window)) {
            console.log("This browser does not support desktop notification");
            return;
        }

        Notification.requestPermission();

        const checkLastActivity = () => {
            if (!days || days.length === 0 || Notification.permission !== 'granted') {
                return;
            }
            
            const todayStr = formatDateForInput(new Date());
            const today = days.find(d => d.date === todayStr);

            if (today && today.activities.length > 0) {
                const lastActivity = today.activities[today.activities.length - 1];
                const lastActivityTime = parseTime(lastActivity.startTime);
                
                if (lastActivityTime) {
                    const hoursSinceLastActivity = (new Date().getTime() - lastActivityTime.getTime()) / (1000 * 60 * 60);
                    
                    if (hoursSinceLastActivity > 1) {
                         new Notification("Day Tracker Reminder", {
                            body: "Gentle reminder: What have you been up to for the last hour? Don't forget to log it!",
                            icon: '/pwa-192x192.png'
                        });
                    }
                }
            } else if (today && today.activities.length === 0) {
                new Notification("Day Tracker Reminder", {
                    body: "Ready to start your day? Log your first activity!",
                    icon: '/pwa-192x192.png'
                });
            }
        };

        const intervalId = setInterval(checkLastActivity, 20 * 60 * 1000);

        return () => clearInterval(intervalId);

    }, [days]);
};


// --- React Components ---

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    message: string;
}

function ConfirmationModal({ isOpen, onClose, onConfirm, message }: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
                <p className="mb-6">{message}</p>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Yes, Delete</button>
                </div>
            </div>
        </div>
    );
}

interface DayModalProps {
    day: Day;
    onClose: () => void;
    onSave: (day: Day) => void;
    taskOptions: string[];
    onAddNewTask: (task: string) => void;
}

function DayModal({ day, onClose, onSave, taskOptions, onAddNewTask }: DayModalProps) {
    const [currentActivities, setCurrentActivities] = useState<Activity[]>(day.activities);
    const [task, setTask] = useState<string>(taskOptions[0] || '');
    
    const [startTime, setStartTime] = useState<string>(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    const [endTime, setEndTime] = useState<string>(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });

    const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
    const [editedStartTime, setEditedStartTime] = useState('');
    const [editedEndTime, setEditedEndTime] = useState('');

    const showEndTime = task !== 'Wake up' && task !== 'Sleep';

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const handleAddActivity = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedTask = task.trim();
        if (trimmedTask === '') return;

        onAddNewTask(trimmedTask);

        const newActivity: Activity = {
            id: Date.now(),
            task: trimmedTask,
            startTime: formatTo12Hour(startTime),
            endTime: showEndTime ? formatTo12Hour(endTime) : null
        };
        const updatedActivities = [...currentActivities, newActivity].sort((a, b) => {
            const timeA = parseTime(a.startTime);
            const timeB = parseTime(b.startTime);
            if (!timeA || !timeB) return 0;
            return timeA.getTime() - timeB.getTime();
        });
        setCurrentActivities(updatedActivities);
        setTask(taskOptions[0] || ''); // Reset input
    };

    const handleDeleteActivity = (id: number) => {
        setCurrentActivities(prev => prev.filter(act => act.id !== id));
    };

    const handleStartEditing = (activity: Activity) => {
        setEditingActivityId(activity.id);
        setEditedStartTime(convertTo24Hour(activity.startTime));
        setEditedEndTime(convertTo24Hour(activity.endTime));
    };

    const handleCancelEditing = () => {
        setEditingActivityId(null);
        setEditedStartTime('');
        setEditedEndTime('');
    };

    const handleUpdateActivity = () => {
        if (editingActivityId === null) return;
        
        const updatedActivities = currentActivities.map(act => {
            if (act.id === editingActivityId) {
                const showEnd = act.task !== 'Wake up' && act.task !== 'Sleep';
                return {
                    ...act,
                    startTime: formatTo12Hour(editedStartTime),
                    endTime: showEnd ? formatTo12Hour(editedEndTime) : null,
                };
            }
            return act;
        }).sort((a, b) => {
            const timeA = parseTime(a.startTime);
            const timeB = parseTime(b.startTime);
            if (!timeA || !timeB) return 0;
            return timeA.getTime() - timeB.getTime();
        });

        setCurrentActivities(updatedActivities);
        handleCancelEditing();
    };
    
    const handleSave = () => {
        onSave({ ...day, activities: currentActivities });
        onClose();
    };

    return (
        <div className="fixed inset-0  bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full max-w-2xl h-full sm:h-[90vh] flex flex-col">
                <header className="p-4 border-b">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{formatDateForDisplay(day.date)}</h2>
                    <p className="text-gray-500">Log your activities for the day.</p>
                </header>

                <div className="flex-grow overflow-y-auto p-4">
                    {currentActivities.length > 0 ? (
                        <ul className="divide-y divide-gray-200">
                            {currentActivities.map(activity => (
                                <li key={activity.id} className="py-3">
                                    {editingActivityId === activity.id ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-4">
                                                <span className="text-2xl w-8 text-center">{taskIcons[activity.task] || '📌'}</span>
                                                <p className="font-semibold flex-grow">{activity.task}</p>
                                            </div>
                                            <div className="flex items-center gap-2 pl-12">
                                                <input type="time" value={editedStartTime} onChange={e => setEditedStartTime(e.target.value)} className="w-full p-1 border border-gray-300 rounded-md"/>
                                                { (activity.task !== 'Wake up' && activity.task !== 'Sleep') &&
                                                    <>
                                                        <span>-</span>
                                                        <input type="time" value={editedEndTime} onChange={e => setEditedEndTime(e.target.value)} className="w-full p-1 border border-gray-300 rounded-md"/>
                                                    </>
                                                }
                                            </div>
                                            <div className="flex justify-end gap-2 mt-2">
                                                <button onClick={handleCancelEditing} className="px-3 py-1 bg-gray-200 text-sm rounded-md">Cancel</button>
                                                <button onClick={handleUpdateActivity} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <span className="text-2xl w-8 text-center">{taskIcons[activity.task] || '📌'}</span>
                                                <div>
                                                    <p className="font-semibold">{activity.task}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {activity.startTime} {activity.endTime && ` - ${activity.endTime}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded-full">{calculateDuration(activity.startTime, activity.endTime)}</span>
                                                <button onClick={() => handleStartEditing(activity)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteActivity(activity.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-full">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="mt-4 text-gray-500 font-semibold">No activities logged for this day yet.</p>
                            <p className="text-gray-400 text-sm mt-1">Use the form below to add your first activity.</p>
                        </div>
                    )}
                </div>

                <form onSubmit={handleAddActivity} className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row sm:items-end gap-4">
                    <div className="flex-grow">
                        <label htmlFor="task-input" className="block text-sm font-medium text-gray-700 mb-1">Task</label>
                        <input
                          id="task-input"
                          list="task-options"
                          value={task}
                          onChange={e => setTask(e.target.value)}
                          placeholder="Type or select a task"
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                        <datalist id="task-options">
                          {taskOptions.map(opt => <option key={opt} value={opt} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{showEndTime ? 'Start Time' : 'Time'}</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/>
                    </div>
                    {showEndTime && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/>
                        </div>
                    )}
                    <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 self-end">Add</button>
                </form>

                <footer className="p-4 flex flex-col sm:flex-row justify-end gap-4 border-t">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Add to Dashboard</button>
                </footer>
            </div>
        </div>
    );
}

interface DayCardProps {
    day: Day;
    onClick: () => void;
    onDelete: (date: string) => void;
}

function DayCard({ day, onClick, onDelete }: DayCardProps) {
    const summary = useMemo(() => {
        const totalActivities = day.activities.length;
        const uniqueTasks = [...new Set(day.activities.map(a => a.task))].slice(0, 3).join(', ');
        return { totalActivities, uniqueTasks };
    }, [day.activities]);
    
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(day.date);
    };

    return (
        <div 
            onClick={onClick} 
            className="bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer p-6 flex flex-col justify-between relative group"
        >
            <div className="absolute top-2 right-2 flex gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                    onClick={handleDeleteClick}
                    className="p-2 rounded-full bg-red-100 text-red-600  lg:hover:bg-red-200"
                    aria-label="Delete day"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
            <div>
                <h3 className="font-bold text-lg text-gray-800">{formatDateForDisplay(day.date)}</h3>
                <p className="text-sm text-gray-500 mt-2">{summary.totalActivities} activities logged.</p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600 truncate">Tasks include: {summary.uniqueTasks}</p>
            </div>
        </div>
    );
}

interface AddNewDayProps {
    onAddDay: (date: string) => void;
}

function AddNewDay({ onAddDay }: AddNewDayProps) {
    const [date, setDate] = useState<string>(formatDateForInput());

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddDay(date);
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 bg-indigo-700 text-white rounded-xl shadow-lg flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-grow">
                <h3 className="text-xl font-bold">Add New Day</h3>
                <p className="opacity-80">Select a date to start tracking.</p>
            </div>
            <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                max={formatDateForInput()} // This prevents selecting a future date
                className="p-2 rounded-md border-2 border-transparent bg-white focus:border-indigo-300 focus:ring-indigo-300 text-gray-800 w-full sm:w-auto"
            />
            <button type="submit" className="w-full sm:w-auto px-6 py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                Create
            </button>
        </form>
    );
}

interface StreakCounterProps {
    days: Day[];
    taskOptions: string[];
}

function StreakCounter({ days, taskOptions }: StreakCounterProps) {
    const [selectedTask, setSelectedTask] = useState<string>('Overall');

    const { currentStreak, longestStreak } = useMemo(() => {
        const taskToCalculate = selectedTask === 'Overall' ? null : selectedTask;
        return calculateStreaks(days, taskToCalculate);
    }, [days, selectedTask]);

    const topStreak = useMemo(() => {
        let top = { task: '', streak: 0 };
        if (days.length === 0) return null;

        for (const task of taskOptions) {
            const { longestStreak } = calculateStreaks(days, task);
            if (longestStreak > top.streak) {
                top = { task, streak: longestStreak };
            }
        }
        return top.streak > 0 ? top : null;
    }, [days, taskOptions]);

    const streakTitle = selectedTask === 'Overall' ? 'Overall Consistency' : `${selectedTask} Streak`;
    const streakIcon = selectedTask === 'Overall' ? '🔥' : (taskIcons[selectedTask] || '🎯');

    return (
        <div className="p-6 bg-gradient-to-br from-orange-400 to-red-500 text-white rounded-xl shadow-lg flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <span className="text-5xl">{streakIcon}</span>
                    <div className="text-center sm:text-left">
                        <h3 className="text-xl font-bold">{streakTitle}</h3>
                        <p className="opacity-90">Keep the momentum going!</p>
                    </div>
                </div>
                <div className="flex gap-6 sm:gap-10 text-center">
                    <div>
                        <p className="text-4xl font-extrabold">{currentStreak}</p>
                        <p className="font-semibold opacity-90 text-sm">Current</p>
                    </div>
                    <div>
                        <p className="text-4xl font-extrabold">{longestStreak}</p>
                        <p className="font-semibold opacity-90 text-sm">Longest</p>
                    </div>
                </div>
            </div>
            <div className="pt-4 border-t border-white/20">
                <label htmlFor="streak-select" className="block text-sm font-medium text-white mb-2">
                    View streak for:
                </label>
                <select
                    id="streak-select"
                    value={selectedTask}
                    onChange={e => setSelectedTask(e.target.value)}
                    className="w-full p-2 rounded-md bg-white/20 text-white border-transparent focus:ring-2 focus:ring-white"
                >
                    <option value="Overall">Overall</option>
                    {taskOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
            {topStreak && (
                <div className="mt-2 text-center">
                    <p className="text-sm font-semibold text-white/90">
                        🏆 Top Streak: <span className="font-bold">{topStreak.task}</span> ({topStreak.streak} days)
                    </p>
                </div>
            )}
        </div>
    );
}


export default function App() {
    const [days, setDays] = useState<Day[]>(() => {
        try {
            const savedDays = localStorage.getItem('dayTrackerData');
            return savedDays ? JSON.parse(savedDays) : [];
        } catch (error) {
            console.error("Could not parse data from localStorage", error);
            return [];
        }
    });

    const [taskOptions, setTaskOptions] = useState<string[]>(() => {
        try {
            const savedTasks = localStorage.getItem('dayTrackerTasks');
            return savedTasks ? JSON.parse(savedTasks) : initialTaskOptions;
        } catch (error) {
            console.error("Could not parse tasks from localStorage", error);
            return initialTaskOptions;
        }
    });

    const [selectedDay, setSelectedDay] = useState<Day | null>(null);
    const [dayToDelete, setDayToDelete] = useState<string | null>(null);

    useNotificationReminder(days);

    useEffect(() => {
        localStorage.setItem('dayTrackerData', JSON.stringify(days));
    }, [days]);

    useEffect(() => {
        localStorage.setItem('dayTrackerTasks', JSON.stringify(taskOptions));
    }, [taskOptions]);

    const handleOpenModal = (day: Day) => {
        setSelectedDay(day);
    };

    const handleCloseModal = () => {
        setSelectedDay(null);
    };

    const handleSaveDay = (updatedDay: Day) => {
        setDays(prevDays => {
            const dayExists = prevDays.some(d => d.date === updatedDay.date);
            if (dayExists) {
                return prevDays.map(d => d.date === updatedDay.date ? updatedDay : d).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            } else {
                return [...prevDays, updatedDay].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            }
        });
    };
    
    const handleAddDay = (date: string) => {
        const dayExists = days.some(d => d.date === date);
        if (dayExists) {
            alert("This day already exists on your dashboard.");
            return;
        }
        const newDay: Day = {
            date: date,
            activities: []
        };
        handleOpenModal(newDay);
    };

    const handleDeleteRequest = (date: string) => {
        setDayToDelete(date);
    };

    const handleConfirmDelete = () => {
        if (dayToDelete) {
            setDays(prevDays => prevDays.filter(day => day.date !== dayToDelete));
            setDayToDelete(null);
        }
    };

    const handleAddNewTask = (newTask: string) => {
        if (!taskOptions.includes(newTask)) {
            setTaskOptions(prev => [...prev, newTask]);
        }
    };

    const sortedDays = useMemo(() => {
        return [...days].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [days]);

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            {selectedDay && <DayModal day={selectedDay} onClose={handleCloseModal} onSave={handleSaveDay} taskOptions={taskOptions} onAddNewTask={handleAddNewTask} />}
            <ConfirmationModal 
                isOpen={!!dayToDelete}
                onClose={() => setDayToDelete(null)}
                onConfirm={handleConfirmDelete}
                message="Are you sure you want to delete this day's log? This action cannot be undone."
            />

            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="text-center my-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-800">Home Screen - Dashboard</h1>
                    <p className="text-lg text-gray-500 mt-2">An overview of your tracked days.</p>
                </header>

                <div className="space-y-8">
                    <AddNewDay onAddDay={handleAddDay} />
                    
                    {days.length > 0 && <StreakCounter days={days} taskOptions={taskOptions} />}
                </div>

                {sortedDays.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        {sortedDays.map(day => (
                            <DayCard 
                                key={day.date} 
                                day={day} 
                                onClick={() => handleOpenModal(day)}
                                onDelete={handleDeleteRequest}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 px-6 bg-white rounded-xl shadow-lg mt-8">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className="mt-2 text-lg font-medium text-gray-900">No days tracked yet</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Click "Create" above to add your first day and start tracking your activities.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

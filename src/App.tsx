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
const initialDaysData: Day[] = [
    {
        date: '2025-07-04',
        activities: [
            { id: 1, task: 'Wake up', startTime: '6:50 AM', endTime: '6:57 AM' },
            { id: 2, task: 'Washroom', startTime: '6:57 AM', endTime: '7:26 AM' },
            { id: 3, task: 'Exercise', startTime: '7:26 AM', endTime: '7:53 AM' },
            { id: 4, task: 'Breakfast', startTime: '7:53 AM', endTime: '8:05 AM' },
        ],
    },
    {
        date: '2025-07-05',
        activities: [
            { id: 1, task: 'Wake up', startTime: '7:00 AM', endTime: '7:10 AM' },
            { id: 2, task: 'Office work', startTime: '7:10 AM', endTime: '10:00 AM' },
        ],
    }
];

const initialTaskOptions: string[] = [
  'Wake up', 'Washroom', 'Exercise', 'Breakfast', 'Video call', 
  'Office work', 'Rest', 'Lunch', 'Sleep', 'Read book', 'Call', 'Dinner'
];

const taskIcons: { [key: string]: string } = {
  'Wake up': '☀️', 'Washroom': '🚽', 'Exercise': '🏋️', 'Breakfast': '🥞', 
  'Video call': '💻', 'Office work': '💼', 'Rest': '🧘', 'Lunch': '🥪',
  'Sleep': '😴', 'Read book': '📚', 'Call': '📞', 'Dinner': '🍽️',
};

// --- Helper Functions ---

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

const formatDateForDisplay = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
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
                            body: `It's been a while! Don't forget to track your last hour.`,
                            icon: '/pwa-192x192.png'
                        });
                    }
                }
            }
        };

        const intervalId = setInterval(checkLastActivity, 30 * 60 * 1000);

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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
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
}

function DayModal({ day, onClose, onSave }: DayModalProps) {
    const [currentActivities, setCurrentActivities] = useState<Activity[]>(day.activities);
    const [task, setTask] = useState<string>(initialTaskOptions[0]);
    const [startTime, setStartTime] = useState<string>(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const handleAddActivity = (e: React.FormEvent) => {
        e.preventDefault();
        const newActivityTime = formatTo12Hour(startTime);

        const updatedActivities = [...currentActivities];
        if (updatedActivities.length > 0) {
            const lastActivity = updatedActivities[updatedActivities.length - 1];
            if (!lastActivity.endTime) {
                lastActivity.endTime = newActivityTime;
            }
        }

        const newActivity: Activity = {
            id: Date.now(),
            task: task,
            startTime: newActivityTime,
            endTime: null
        };
        setCurrentActivities([...updatedActivities, newActivity]);
    };
    
    const handleSave = () => {
        onSave({ ...day, activities: currentActivities });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full max-w-2xl h-full sm:h-[90vh] flex flex-col">
                <header className="p-4 border-b">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{formatDateForDisplay(day.date)}</h2>
                    <p className="text-gray-500">Log your activities for the day.</p>
                </header>

                <div className="flex-grow overflow-y-auto p-4">
                    <ul className="divide-y divide-gray-200">
                        {currentActivities.map(activity => (
                            <li key={activity.id} className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl w-8 text-center">{taskIcons[activity.task] || '�'}</span>
                                    <div>
                                        <p className="font-semibold">{activity.task}</p>
                                        <p className="text-sm text-gray-500">
                                            <span className="font-medium text-gray-700">Start:</span> {activity.startTime} 
                                            {activity.endTime && <> | <span className="font-medium text-gray-700">End:</span> {activity.endTime}</>}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded-full">{calculateDuration(activity.startTime, activity.endTime)}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <form onSubmit={handleAddActivity} className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row sm:items-end gap-4">
                    <div className="flex-grow">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Task</label>
                        <select value={task} onChange={e => setTask(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                            {initialTaskOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/>
                    </div>
                    <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">Add</button>
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
             <button 
                onClick={handleDeleteClick}
                className="absolute top-2 right-2 p-2 rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-200 transition-opacity"
                aria-label="Delete day"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
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
                className="p-2 rounded-md border-2 border-transparent focus:border-indigo-300 focus:ring-indigo-300 text-gray-800 w-full sm:w-auto"
            />
            <button type="submit" className="w-full sm:w-auto px-6 py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                Create
            </button>
        </form>
    );
}

export default function App() {
    const [days, setDays] = useState<Day[]>(() => {
        try {
            const savedDays = localStorage.getItem('dayTrackerData');
            return savedDays ? JSON.parse(savedDays) : initialDaysData;
        } catch (error) {
            console.error("Could not parse data from localStorage", error);
            return initialDaysData;
        }
    });
    const [selectedDay, setSelectedDay] = useState<Day | null>(null);
    const [dayToDelete, setDayToDelete] = useState<string | null>(null);

    useNotificationReminder(days);

    useEffect(() => {
        localStorage.setItem('dayTrackerData', JSON.stringify(days));
    }, [days]);

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
                return prevDays.map(d => d.date === updatedDay.date ? updatedDay : d);
            } else {
                return [...prevDays, updatedDay].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            {selectedDay && <DayModal day={selectedDay} onClose={handleCloseModal} onSave={handleSaveDay} />}
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

                <div className="mb-8">
                    <AddNewDay onAddDay={handleAddDay} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {days.map(day => (
                        <DayCard 
                            key={day.date} 
                            day={day} 
                            onClick={() => handleOpenModal(day)}
                            onDelete={handleDeleteRequest}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
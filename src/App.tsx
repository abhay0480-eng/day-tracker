import React, { useState, useEffect, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

interface Goal {
    id: number;
    task: string;
    frequency: number;
    period: 'week';
}

// --- Initial Data Configuration ---
const initialTaskOptions: string[] = [
  'Wake up', 'Washroom', 'Exercise', 'Breakfast', 'Video call', 
  'Office work', 'Rest', 'Lunch', 'Sleep', 'Small Nap', 'Read book', 'Call', 'Dinner',
  'Watch TV', 'Editing youTube Video', 'Drink Water', 'Office Meeting Scrum', 'Take Bath', 'Self Learning'
];

const taskIcons: { [key: string]: string } = {
  'Wake up': '☀️', 'Washroom': '🚽', 'Exercise': '🏋️', 'Breakfast': '🥞', 
  'Video call': '💻', 'Office work': '💼', 'Rest': '🧘', 'Lunch': '🥪',
  'Sleep': '😴', 'Read book': '📚', 'Call': '📞', 'Dinner': '🍽️',
  'Watch TV': '📺', 'Editing youTube Video': '🎬', 'Drink Water': '💧', 
  'Office Meeting Scrum': '🧑‍💻', 'Take Bath': '🛀', 'Self Learning': '🧠',
  'Small Nap': '🛌'
};

// --- AI Helper Functions ---
const getAISuggestion = async (days: Day[], taskOptions: string[]): Promise<string | null> => {
    const recentDays = days.slice(-5);
    if (recentDays.length === 0) return null;

    const simplifiedLog = recentDays.map(d => ({
        date: d.date,
        activities: d.activities.map(a => ({ task: a.task, startTime: a.startTime }))
    }));

    const prompt = `You are an AI assistant for a daily activity tracking app. Your goal is to predict the user's current activity based on their past behavior and the current time. The current date and time is ${new Date().toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: true })}. The user can choose from these tasks: ${taskOptions.join(', ')}. Here is a log of their activities from the past few days: ${JSON.stringify(simplifiedLog)}. Based on this data, what is the single most likely task they are doing right now? Please respond with only the name of the task from the list, and nothing else.`;

    try {
        const apiKey = "AIzaSyCHh9juUudLVNQRgTKo5EPQ9iuOMC7Gd0s"; // API key is handled by the environment
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, topP: 0.9 } };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) {
            console.error("AI API request failed:", response.status, response.statusText);
            return null;
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            const suggestion = text.trim();
            if (taskOptions.includes(suggestion)) return suggestion;
        }
        return null;
    } catch (error) { console.error("Error fetching AI suggestion:", error); return null; }
};

const getAIWeeklySummary = async (days: Day[], taskOptions: string[]): Promise<string | null> => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const recentDays = days.filter(d => new Date(d.date) >= sevenDaysAgo && new Date(d.date) <= today);
    if (recentDays.length < 2) {
        toast.error("Track at least 2 days to get a summary.");
        return null;
    }
    const simplifiedLog = recentDays.map(d => ({
        date: d.date,
        activities: d.activities.map(a => ({
            task: a.task,
            startTime: a.startTime,
            duration: calculateDuration(a.startTime, a.endTime)
        }))
    }));
    const prompt = `You are a friendly and encouraging productivity coach. Analyze the user's activity log from the past week and provide a short, insightful summary (about 3-4 sentences). Highlight one positive achievement or consistent habit, and gently suggest one area for potential improvement or a pattern to be mindful of. The user's available tasks are: ${taskOptions.join(', ')}. Here is their log: ${JSON.stringify(simplifiedLog)}. Respond in a conversational and motivational tone. Use markdown for formatting, like bolding key tasks with **Task Name**.`;

    try {
        const apiKey = "AIzaSyCHh9juUudLVNQRgTKo5EPQ9iuOMC7Gd0s"; // API key is handled by the environment
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, topP: 1.0 } };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) {
            console.error("AI API request failed:", response.status, response.statusText);
            throw new Error("Could not generate summary.");
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0) return result.candidates[0].content.parts[0].text.trim();
        throw new Error("Could not generate summary.");
    } catch (error) { 
        console.error("Error fetching AI summary:", error); 
        throw error;
    }
};

const getAICoachingTip = async (goal: Goal, progress: number, daysLeft: number): Promise<string | null> => {
    const prompt = `You are a motivational AI coach. The user has a goal to perform the task "${goal.task}" ${goal.frequency} times a week. So far, they have completed it ${progress} times. There are ${daysLeft} days left in the week. Provide a short (2-3 sentences), encouraging, and actionable coaching tip. If they are on track, praise their effort. If they are behind, provide a gentle, motivational nudge without being critical.`;

    try {
        const apiKey = "AIzaSyCHh9juUudLVNQRgTKo5EPQ9iuOMC7Gd0s"; // API key is handled by the environment
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, topP: 1.0 } };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) {
            console.error("AI API request failed:", response.status, response.statusText);
            throw new Error("Could not get coaching tip.");
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0) return result.candidates[0].content.parts[0].text.trim();
        throw new Error("Could not get coaching tip.");
    } catch (error) { 
        console.error("Error fetching AI coaching tip:", error); 
        throw error;
    }
};

const getAIDailyPlan = async (days: Day[], goals: Goal[]): Promise<string[]> => {
    const recentDays = days.slice(-5);
    const prompt = `You are a friendly and motivating productivity coach. Based on the user's past activity logs and their current goals, create a simple, suggested schedule for today, which is a ${new Date().toLocaleString('en-US', { weekday: 'long' })}. The user's goals are: ${JSON.stringify(goals)}. Here is their activity log from the last few days: ${JSON.stringify(recentDays)}. Suggest 3-5 key activities for them to focus on today. Keep each suggestion concise and actionable.`;
    
    try {
        const apiKey = "AIzaSyCHh9juUudLVNQRgTKo5EPQ9iuOMC7Gd0s"; // API key is handled by the environment
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        plan: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        }
                    }
                }
            }
        };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) {
            console.error("AI API request failed:", response.status, response.statusText);
            throw new Error("Could not generate a plan.");
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0) {
            const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
            return parsed.plan || [];
        }
        throw new Error("Could not generate a plan.");
    } catch (error) { 
        console.error("Error fetching AI daily plan:", error); 
        throw error;
    }
};


// --- Helper Functions ---
const calculateGoalProgress = (goal: Goal, days: Day[]): number => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Assuming Sunday is the start of the week

    const daysInWeek = days.filter(d => {
        const dayDate = new Date(d.date + 'T00:00:00');
        return dayDate >= startOfWeek && dayDate <= today;
    });

    const completedDays = new Set(daysInWeek.filter(d => d.activities.some(a => a.task === goal.task)).map(d => d.date));
    return completedDays.size;
};

const calculateStreaks = (days: Day[], task: string | null): { currentStreak: number; longestStreak: number } => {
    if (!days || days.length === 0) return { currentStreak: 0, longestStreak: 0 };
    const relevantDays = task ? days.filter(day => day.activities.some(activity => activity.task === task)) : days;
    if (relevantDays.length === 0) return { currentStreak: 0, longestStreak: 0 };
    const dates = relevantDays.map(day => { const [year, month, dayOfMonth] = day.date.split('-').map(Number); return new Date(Date.UTC(year, month - 1, dayOfMonth)); }).sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };
    let longestStreak = 0; let currentConsecutive = 0;
    if (dates.length > 0) { longestStreak = 1; currentConsecutive = 1; }
    for (let i = 1; i < dates.length; i++) { const diff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24); if (diff === 1) { currentConsecutive++; } else { longestStreak = Math.max(longestStreak, currentConsecutive); currentConsecutive = 1; } }
    longestStreak = Math.max(longestStreak, currentConsecutive);
    let activeCurrentStreak = 0;
    if (dates.length > 0) {
        const lastDate = dates[dates.length - 1]; const today = new Date(); const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); const yesterdayUTC = new Date(todayUTC); yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1);
        if (lastDate.getTime() === todayUTC.getTime() || lastDate.getTime() === yesterdayUTC.getTime()) {
            activeCurrentStreak = 1;
            for (let i = dates.length - 2; i >= 0; i--) { const diff = (dates[i + 1].getTime() - dates[i].getTime()) / (1000 * 60 * 60 * 24); if (diff === 1) { activeCurrentStreak++; } else { break; } }
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

const calculateDurationInMinutes = (start: string | null, end: string | null): number => {
    if (!start || !end) return 0;
    const startDate = parseTime(start); const endDate = parseTime(end);
    if (!startDate || !endDate) return 0;
    let diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (diff < 0) diff += 24 * 60;
    return diff;
};

const formatDuration = (minutes: number): string => {
    if (minutes < 1) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    let duration = '';
    if (hours > 0) duration += `${hours}h `;
    if (mins > 0) duration += `${mins}m`;
    return duration.trim();
}

const calculateDuration = (start: string | null, end: string | null): string => {
   return formatDuration(calculateDurationInMinutes(start, end));
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
    if (modifier === 'PM' && hours < 12) { hours += 12; }
    if (modifier === 'AM' && hours === 12) { hours = 0; }
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
const useNotificationReminder = (days: Day[] | undefined, permission: string) => {
    useEffect(() => {
        if (permission !== 'granted' || !days) return;

        const checkLastActivity = () => {
            if (days.length === 0) return;
            const todayStr = formatDateForInput(new Date());
            const today = days.find(d => d.date === todayStr);
            if (today && today.activities.length > 0) {
                const lastActivity = today.activities[today.activities.length - 1];
                const lastActivityTime = parseTime(lastActivity.startTime);
                if (lastActivityTime) {
                    const hoursSinceLastActivity = (new Date().getTime() - lastActivityTime.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceLastActivity > 1) { new Notification("Day Tracker Reminder", { body: "Gentle reminder: What have you been up to for the last hour? Don't forget to log it!" }); }
                }
            } else if (today && today.activities.length === 0) {
                new Notification("Day Tracker Reminder", { body: "Ready to start your day? Log your first activity!" });
            }
        };
        const intervalId = setInterval(checkLastActivity, 20 * 60 * 1000);
        return () => clearInterval(intervalId);
    }, [days, permission]);
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
        <div className="fixed inset-0  bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
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
    allDays: Day[];
    onClose: () => void;
    onSave: (day: Day) => void;
    taskOptions: string[];
    onAddNewTask: (task: string) => void;
}

function DayModal({ day, allDays, onClose, onSave, taskOptions, onAddNewTask }: DayModalProps) {
    const [currentActivities, setCurrentActivities] = useState<Activity[]>(day.activities);
    const [task, setTask] = useState<string>(taskOptions[0] || '');
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [startTime, setStartTime] = useState<string>(() => { const now = new Date(); return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; });
    const [endTime, setEndTime] = useState<string>(() => { const now = new Date(); now.setMinutes(now.getMinutes() + 30); return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; });
    const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
    const [editedStartTime, setEditedStartTime] = useState('');
    const [editedEndTime, setEditedEndTime] = useState('');
    const [isCustomTask, setIsCustomTask] = useState(false);

    const pointInTimeTasks = ['Wake up', 'Sleep', 'Drink Water'];
    const showEndTime = !pointInTimeTasks.includes(task);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const fetchSuggestion = async () => { if (day.date === formatDateForInput() && day.activities.length === 0) { setIsSuggesting(true); const suggestion = await getAISuggestion(allDays, taskOptions); if (suggestion) { setTask(suggestion); } setIsSuggesting(false); } };
        fetchSuggestion();
        return () => { document.body.style.overflow = 'auto'; };
    }, [day, allDays, taskOptions]);

    const handleAddActivity = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedTask = task.trim();
        if (trimmedTask === '') return;
        // Prevent duplicate Wake up
        if (trimmedTask === "Wake up" && currentActivities.some(a => a.task === "Wake up")) {
            toast.error("You already logged Wake up for this day.");
            return;
        }
        onAddNewTask(trimmedTask);
        const newActivity: Activity = { id: Date.now(), task: trimmedTask, startTime: formatTo12Hour(startTime), endTime: showEndTime ? formatTo12Hour(endTime) : null };
        const updatedActivities = [...currentActivities, newActivity].sort((a: Activity, b: Activity) => {
            const timeA = parseTime(a.startTime);
            const timeB = parseTime(b.startTime);
            if (!timeA || !timeB) return 0;
            return timeA.getTime() - timeB.getTime();
        });
        setCurrentActivities(updatedActivities);

        // After adding, reset to first available task in filteredTaskOptions
        const wakeUpAlreadyAdded = updatedActivities.some(a => a.task === "Wake up");
        const filteredTaskOptions = wakeUpAlreadyAdded
            ? taskOptions.filter(opt => opt !== "Wake up")
            : taskOptions;
        setTask(filteredTaskOptions[0] || '');

        toast.success(`Added: ${trimmedTask}`);
    };
    const handleDeleteActivity = (id: number) => { const taskToDelete = currentActivities.find(act => act.id === id); setCurrentActivities(prev => prev.filter(act => act.id !== id)); if(taskToDelete) toast.error(`Removed: ${taskToDelete.task}`); };
    const handleStartEditing = (activity: Activity) => { setEditingActivityId(activity.id); setEditedStartTime(convertTo24Hour(activity.startTime)); setEditedEndTime(convertTo24Hour(activity.endTime)); };
    const handleCancelEditing = () => { setEditingActivityId(null); setEditedStartTime(''); setEditedEndTime(''); };
    
    const handleUpdateActivity = () => { 
        if (editingActivityId === null) return; 
        const updatedActivities = currentActivities.map(act => { 
            if (act.id === editingActivityId) { 
                const showEnd = !pointInTimeTasks.includes(act.task); 
                return { ...act, startTime: formatTo12Hour(editedStartTime), endTime: showEnd ? formatTo12Hour(editedEndTime) : null, }; 
            } 
            return act; 
        }).sort((a: Activity, b: Activity) => { 
            const timeA = parseTime(a.startTime); 
            const timeB = parseTime(b.startTime); 
            if (!timeA || !timeB) return 0; 
            return timeA.getTime() - timeB.getTime(); 
        }); 
        setCurrentActivities(updatedActivities); 
        handleCancelEditing(); 
    };

    const handleSave = () => { onSave({ ...day, activities: currentActivities }); onClose(); toast.success('Day saved successfully!'); };
    
    useEffect(() => {
        if (task === "Washroom") {
            const [h, m] = startTime.split(':').map(Number);
            let endH = h, endM = m + 4;
            if (endM >= 60) { endH += 1; endM -= 60; }
            if (endH >= 24) endH = 0;
            const formattedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
            setEndTime(formattedEnd);
        }
    }, [task, startTime]);

    useEffect(() => {
        // Only suggest if Wake up is selected, before 9am and after 3am
        if (task === "Wake up") {
            const [h, m] = startTime.split(':').map(Number);
            if (h >= 3 && h < 9) {
                // Find last activity
                if (currentActivities.length > 0) {
                    const lastTask = currentActivities[currentActivities.length - 1].task;
                    // If last task is Wake up, suggest Washroom
                    if (lastTask === "Wake up") {
                        setTask("Washroom");
                    }
                }
            }
        }
        // After Washroom, suggest Exercise
        if (task === "Washroom") {
            const [h, m] = startTime.split(':').map(Number);
            if (h >= 3 && h < 9) {
                if (currentActivities.length > 0) {
                    const lastTask = currentActivities[currentActivities.length - 1].task;
                    if (lastTask === "Washroom") {
                        setTask("Exercise");
                    }
                }
            }
        }
        // After Exercise, suggest Take Bath
        if (task === "Exercise") {
            const [h, m] = startTime.split(':').map(Number);
            if (h >= 3 && h < 9) {
                if (currentActivities.length > 0) {
                    const lastTask = currentActivities[currentActivities.length - 1].task;
                    if (lastTask === "Exercise") {
                        setTask("Take Bath");
                    }
                }
            }
        }
    }, [task, startTime, currentActivities]);

    // Check if Wake up is already added
    const wakeUpAlreadyAdded = currentActivities.some(a => a.task === "Wake up");
    const filteredTaskOptions = wakeUpAlreadyAdded
        ? taskOptions.filter(opt => opt !== "Wake up")
        : taskOptions;

    return (
        <div className="fixed inset-0  bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full max-w-2xl h-full sm:h-[90vh] flex flex-col">
                <header className="p-4 border-b"><h2 className="text-xl sm:text-2xl font-bold text-gray-800">{formatDateForDisplay(day.date)}</h2><p className="text-gray-500">Log your activities for the day.</p></header>
                <div className="flex-grow overflow-y-auto p-4">{currentActivities.length > 0 ? (<ul className="divide-y divide-gray-200">{currentActivities.map(activity => (<li key={activity.id} className="py-3">{editingActivityId === activity.id ? ( <div className="flex flex-col gap-2"> <div className="flex items-center gap-4"> <span className="text-2xl w-8 text-center">{taskIcons[activity.task] || '📌'}</span> <p className="font-semibold flex-grow">{activity.task}</p> </div> <div className="flex items-center gap-2 pl-12"> <input type="time" value={editedStartTime} onChange={e => setEditedStartTime(e.target.value)} className="w-full p-1 border border-gray-300 rounded-md"/> { !pointInTimeTasks.includes(activity.task) && <> <span>-</span> <input type="time" value={editedEndTime} onChange={e => setEditedEndTime(e.target.value)} className="w-full p-1 border border-gray-300 rounded-md"/> </> } </div> <div className="flex justify-end gap-2 mt-2"> <button onClick={handleCancelEditing} className="px-3 py-1 bg-gray-200 text-sm rounded-md">Cancel</button> <button onClick={handleUpdateActivity} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md">Save</button> </div> </div> ) : ( <div className="flex items-center justify-between"> <div className="flex items-center gap-4"> <span className="text-2xl w-8 text-center">{taskIcons[activity.task] || '📌'}</span> <div> <p className="font-semibold">{activity.task}</p> <p className="text-sm text-gray-500"> {activity.startTime} {activity.endTime && ` - ${activity.endTime}`} </p> </div> </div> <div className="flex items-center gap-2"> <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded-full">{calculateDuration(activity.startTime, activity.endTime)}</span> <button onClick={() => handleStartEditing(activity)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full"> <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg> </button> <button onClick={() => handleDeleteActivity(activity.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-full"> <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> </button> </div> </div> )}</li>))}</ul>) : (<div className="text-center py-10 flex flex-col items-center justify-center h-full"><svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><p className="mt-4 text-gray-500 font-semibold">No activities logged for this day yet.</p><p className="text-gray-400 text-sm mt-1">Use the form below to add your first activity.</p></div>)}</div>
                <form onSubmit={handleAddActivity} className="p-4 bg-gray-50 border-t flex flex-wrap flex-col sm:flex-row sm:items-end gap-4">
                    <div className="flex-grow">
                        <label htmlFor="task-input" className="block text-sm font-medium text-gray-700 mb-1">Task</label>
                        <div className="flex flex-row gap-2 items-center">
                            {isCustomTask ? (
                                <>
                                    <input
                                        id="task-input"
                                        type="text"
                                        value={task}
                                        onChange={e => setTask(e.target.value)}
                                        placeholder="Enter custom task"
                                        className="flex-1 p-2 border border-gray-300 rounded-md"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setIsCustomTask(false); setTask(taskOptions[0] || ''); }}
                                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 whitespace-nowrap"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <select
                                        id="task-input"
                                        value={task}
                                        onChange={e => setTask(e.target.value)}
                                        className="flex-1 p-2 border border-gray-300 rounded-md"
                                    >
                                        {filteredTaskOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => { setIsCustomTask(true); setTask(''); }}
                                        className="px-3 py-2 bg-green-100 text-green-700 rounded-md text-sm hover:bg-green-200 whitespace-nowrap"
                                    >
                                        + Add Custom Task
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{showEndTime ? 'Start Time' : 'Time'}</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={e => {
                                const newStart = e.target.value;
                                setStartTime(newStart);
                                if (task === "Washroom") {
                                    // Calculate 4 minutes ahead
                                    const [h, m] = newStart.split(':').map(Number);
                                    let endH = h, endM = m + 4;
                                    if (endM >= 60) { endH += 1; endM -= 60; }
                                    const formattedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                                    setEndTime(formattedEnd);
                                }
                                if (task === "Small Nap") {
                                    // Default to 20 min nap
                                    const [h, m] = newStart.split(':').map(Number);
                                    let endH = h, endM = m + 20;
                                    if (endM >= 60) { endH += 1; endM -= 60; }
                                    if (endH >= 24) endH = 0;
                                    const formattedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                                    setEndTime(formattedEnd);
                                }
                            }}
                            className="w-full p-2 border border-gray-300 rounded-md"
                        /></div>
                    {showEndTime && (<div><label className="block text-sm font-medium text-gray-700 mb-1">End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/></div>)}
                    <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 self-end">Add</button>
                </form>
                <footer className="p-4 flex flex-col sm:flex-row justify-end gap-4 border-t"><button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Add to Dashboard</button></footer>
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
    const [isRingHovered, setIsRingHovered] = useState(false);

    const { totalWorkAndGrowthMinutes, totalOddTaskMinutes, totalUnaccountedMinutes, totalDayDuration } = useMemo(() => {
        const workAndGrowthTasks = ['Office work', 'Video call', 'Office Meeting Scrum', 'Read book', 'Self Learning', 'Exercise'];
        const pointInTimeTasks = ['Wake up', 'Sleep', 'Drink Water'];
        let totalWorkAndGrowthMinutes = 0;
        let totalOddTaskMinutes = 0;
        let totalLoggedMinutes = 0;

        const sortedActivities = [...day.activities].sort((a: Activity, b: Activity) => (parseTime(a.startTime)?.getTime() || 0) - (parseTime(b.startTime)?.getTime() || 0));

        sortedActivities.forEach(activity => {
            const duration = calculateDurationInMinutes(activity.startTime, activity.endTime);
            if (duration > 0) {
                if (workAndGrowthTasks.includes(activity.task)) {
                    totalWorkAndGrowthMinutes += duration;
                } else if (!pointInTimeTasks.includes(activity.task)) {
                    totalOddTaskMinutes += duration;
                }
                totalLoggedMinutes += duration;
            }
        });
        
        const firstActivity = sortedActivities[0];
        const lastActivity = sortedActivities[sortedActivities.length - 1];

        let totalDayDuration = 0;
        let totalUnaccountedMinutes = 0;

        if (firstActivity && lastActivity) {
            const dayStartTime = parseTime(firstActivity.startTime);
            const dayEndTime = parseTime(lastActivity.endTime || lastActivity.startTime);
            if(dayStartTime && dayEndTime) {
                totalDayDuration = calculateDurationInMinutes(firstActivity.startTime, lastActivity.endTime || lastActivity.startTime);
                totalUnaccountedMinutes = totalDayDuration - totalLoggedMinutes;
            }
        }

        return { totalWorkAndGrowthMinutes, totalOddTaskMinutes, totalUnaccountedMinutes: Math.max(0, totalUnaccountedMinutes), totalDayDuration };
    }, [day.activities]);


    const wakeUpStatus = useMemo(() => {
        const wakeUpActivity = day.activities.find(a => a.task === 'Wake up');
        if (!wakeUpActivity || !wakeUpActivity.startTime) return null;
        const wakeUpTime = parseTime(wakeUpActivity.startTime);
        if (!wakeUpTime) return null;
        return {
            early: wakeUpTime.getHours() < 6,
            time: wakeUpActivity.startTime
        };
    }, [day.activities]);

    const sleepStatus = useMemo(() => {
        const sleepActivity = day.activities.find(a => a.task === 'Sleep');
        if (!sleepActivity || !sleepActivity.startTime) return null;
        const sleepTime = parseTime(sleepActivity.startTime);
        if (!sleepTime) return null;
        return {
            early: sleepTime.getHours() < 22, // 10 PM
            time: sleepActivity.startTime
        };
    }, [day.activities]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(day.date);
    };

    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const workPercentage = totalDayDuration > 0 ? totalWorkAndGrowthMinutes / totalDayDuration : 0;
    const oddTaskPercentage = totalDayDuration > 0 ? totalOddTaskMinutes / totalDayDuration : 0;

    const workOffset = circumference * (1 - workPercentage);
    const oddTaskOffset = circumference * (1 - (workPercentage + oddTaskPercentage));

    const oddTaskRotation = -90 + workPercentage * 360;

    // Add a ref for the printable area
    const printRef = React.useRef<HTMLDivElement>(null);

    const handleDownloadPDF = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!printRef.current) return;
        // Show the printable area
        printRef.current.style.display = "block";
        await new Promise(res => setTimeout(res, 100)); // Wait for render

        const canvas = await html2canvas(printRef.current);
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "pt",
            format: "a4"
        });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight > pageHeight - 40 ? pageHeight - 40 : imgHeight);
        pdf.save(`DayTracker-${day.date}.pdf`);
        // Hide the printable area again
        printRef.current.style.display = "none";
    };

    return (
        <div 
            onClick={onClick} 
            className="bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer p-6 flex flex-col justify-between relative group"
        >
            {/* Download PDF Button */}
            <button
                onClick={handleDownloadPDF}
                className="absolute top-2 right-10 p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 z-10"
                aria-label="Download PDF"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </button>
            {/* Delete Button */}
            <button
                onClick={handleDeleteClick}
                className="absolute top-2 right-2 p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 z-10"
                aria-label="Delete Day"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            {/* Hidden printable area */}
            <div ref={printRef} style={{ display: "none", background: "#fff", padding: 24, width: 400, minHeight: 200 }}>
                <h2 style={{ fontWeight: "bold", fontSize: 20, marginBottom: 8 }}>{formatDateForDisplay(day.date)}</h2>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 4 }}>Task</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 4 }}>Start</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 4 }}>End</th>
                        </tr>
                    </thead>
                    <tbody>
                        {day.activities.map((a) => (
                            <tr key={a.id}>
                                <td style={{ padding: 4 }}>{a.task}</td>
                                <td style={{ padding: 4 }}>{a.startTime}</td>
                                <td style={{ padding: 4 }}>{a.endTime || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div>
                <h3 className="font-bold text-lg text-gray-800">{formatDateForDisplay(day.date)}</h3>
                 <div 
                    className="relative flex items-center justify-center mt-4"
                    onMouseEnter={() => setIsRingHovered(true)}
                    onMouseLeave={() => setIsRingHovered(false)}
                >
                    <div className="relative w-28 h-28">
                        <svg className="w-full h-full" viewBox="0 0 70 70">
                            <circle cx="35" cy="35" r={radius} className="stroke-gray-200" strokeWidth="8" fill="transparent" />
                            <circle
                                cx="35"
                                cy="35"
                                r={radius}
                                className="stroke-indigo-500"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={workOffset}
                                strokeLinecap="round"
                                transform="rotate(-90 35 35)"
                            />
                             <circle
                                cx="35"
                                cy="35"
                                r={radius}
                                className="stroke-teal-500"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={oddTaskOffset}
                                strokeLinecap="round"
                                transform={`rotate(${oddTaskRotation} 35 35)`}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            {isRingHovered ? (
                                <div className="text-center">
                                    <p className="text-xs font-semibold text-indigo-600">Work/Growth</p>
                                    <p className="text-sm font-bold text-gray-800">{formatDuration(totalWorkAndGrowthMinutes)}</p>
                                    <p className="text-xs font-semibold text-teal-600 mt-1">Odd Tasks</p>
                                    <p className="text-sm font-bold text-gray-800">{formatDuration(totalOddTaskMinutes)}</p>
                                    <p className="text-xs font-semibold text-gray-500 mt-1">Idle</p>
                                    <p className="text-sm font-bold text-gray-800">{formatDuration(totalUnaccountedMinutes)}</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                     <p className="text-xl font-bold text-gray-800">{formatDuration(totalWorkAndGrowthMinutes)}</p>
                                     <p className="text-xs font-semibold text-indigo-600">PRODUCTIVE</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {(wakeUpStatus || sleepStatus) && (
                 <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    {wakeUpStatus && (
                        <p className={`text-sm font-semibold flex items-center ${wakeUpStatus.early ? 'text-green-600' : 'text-amber-600'}`}>
                            <span className="text-lg mr-2">{wakeUpStatus.early ? '🎉' : '🌅'}</span>
                            {wakeUpStatus.early ? `Early bird! Woke up at ${wakeUpStatus.time}.` : `Woke up at ${wakeUpStatus.time}. Aim for an earlier start!`}
                        </p>
                    )}
                     {sleepStatus && (
                         <p className={`text-sm font-semibold flex items-center ${sleepStatus.early ? 'text-green-600' : 'text-amber-600'}`}>
                            <span className="text-lg mr-2">{sleepStatus.early ? '✅' : '�'}</span>
                            {sleepStatus.early ? `Good job! Slept at ${sleepStatus.time}.` : `Slept at ${sleepStatus.time}. Try for an earlier night!`}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}


interface AddNewDayProps {
    onAddDay: (date: string) => void;
}

function AddNewDay({ onAddDay }: AddNewDayProps) {
    const [date, setDate] = useState<string>(formatDateForInput());
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onAddDay(date); };
    return (
        <form onSubmit={handleSubmit} className="p-6 bg-indigo-700 text-white rounded-xl shadow-lg flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-grow"><h3 className="text-xl font-bold">Add New Day</h3><p className="opacity-80">Select a date to start tracking.</p></div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} max={formatDateForInput()} className="p-2 rounded-md border-2 border-transparent bg-white focus:border-indigo-300 focus:ring-indigo-300 text-gray-800 w-full sm:w-auto"/>
            <button type="submit" className="w-full sm:w-auto px-6 py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors">Create</button>
        </form>
    );
}

interface StreakCounterProps {
    days: Day[];
}

function StreakCounter({ days }: StreakCounterProps) {
    const streakTasks = ['Exercise', 'Read book', 'Self Learning'];
    const [selectedTask, setSelectedTask] = useState<string>('Overall');
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => { setIsVisible(true); }, []);
    const { currentStreak, longestStreak } = useMemo(() => { const taskToCalculate = selectedTask === 'Overall' ? null : selectedTask; return calculateStreaks(days, taskToCalculate); }, [days, selectedTask]);
    const topStreak = useMemo(() => { let top = { task: '', streak: 0 }; if (days.length === 0) return null; for (const task of streakTasks) { const { longestStreak } = calculateStreaks(days, task); if (longestStreak > top.streak) { top = { task, streak: longestStreak }; } } return top.streak > 0 ? top : null; }, [days]);
    const streakTitle = selectedTask === 'Overall' ? 'Overall Consistency' : `${selectedTask} Streak`;
    const streakIcon = selectedTask === 'Overall' ? '🔥' : (taskIcons[selectedTask] || '🎯');
    return (
        <div className={`p-6 bg-gradient-to-br from-orange-400 to-red-500 text-white rounded-xl shadow-lg flex flex-col gap-4 transition-all duration-500 ease-in-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4"><div className="flex items-center gap-4"><span className="text-5xl">{streakIcon}</span><div className="text-center sm:text-left"><h3 className="text-xl font-bold">{streakTitle}</h3><p className="opacity-90">Keep the momentum going!</p></div></div><div className="flex gap-6 sm:gap-10 text-center"><div><p className="text-4xl font-extrabold">{currentStreak}</p><p className="font-semibold opacity-90 text-sm">Current</p></div><div><p className="text-4xl font-extrabold">{longestStreak}</p><p className="font-semibold opacity-90 text-sm">Longest</p></div></div></div>
            <div className="pt-4 border-t border-white/20"><label htmlFor="streak-select" className="block text-sm font-medium text-white mb-2">View streak for:</label>
                <select id="streak-select" value={selectedTask} onChange={e => setSelectedTask(e.target.value)} className="w-full p-2 rounded-md bg-white/20 text-white border-transparent focus:ring-2 focus:ring-white">
                    <option value="Overall">Overall</option>
                    {streakTasks.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
            {topStreak && (<div className="mt-2 text-center transition-opacity duration-300"><p className="text-sm font-semibold text-white/90">🏆 Top Streak: <span className="font-bold">{topStreak.task}</span> ({topStreak.streak} days)</p></div>)}
        </div>
    );
}

interface WeeklySummaryProps {
    days: Day[];
    taskOptions: string[];
}

function WeeklySummary({ days, taskOptions }: WeeklySummaryProps) {
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const handleAnalyzeClick = async () => { 
        setIsLoading(true);
        const toastId = toast.loading('Analyzing your week...');
        try {
            const result = await getAIWeeklySummary(days, taskOptions); 
            setSummary(result);
            toast.success('Summary generated!', { id: toastId });
        } catch (error) {
            toast.error('Could not generate summary.', { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };
    const renderMarkdown = (text: string) => { const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />'); return { __html: html }; };
    return (
        <div className="p-6 bg-white rounded-xl shadow-lg">
            <div className="flex items-center gap-4 mb-4"><span className="text-3xl">📊</span><div><h3 className="text-xl font-bold text-gray-800">Weekly Insights</h3><p className="text-gray-500">Let AI analyze your week's performance.</p></div></div>
            {summary && !isLoading && (<div className="p-4 bg-indigo-50 rounded-lg text-gray-700 prose prose-sm" dangerouslySetInnerHTML={renderMarkdown(summary)} />)}
            {isLoading ? (<div className="flex items-center justify-center gap-2 text-gray-500"><svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Analyzing your week...</span></div>) : (<button onClick={handleAnalyzeClick} className="w-full mt-4 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-300" disabled={days.length < 2}>{summary ? 'Re-analyze My Week' : 'Analyze My Week'}</button>)}
            {days.length < 2 && !summary && (<p className="text-center text-sm text-gray-400 mt-2">Track at least 2 days for an analysis.</p>)}
        </div>
    );
}

interface GoalCoachingProps {
    goals: Goal[];
    onAddGoal: (goal: Omit<Goal, 'id'>) => void;
    onDeleteGoal: (id: number) => void;
    days: Day[];
    taskOptions: string[];
}

function GoalCoaching({ goals, onAddGoal, onDeleteGoal, days, taskOptions }: GoalCoachingProps) {
    const [newTask, setNewTask] = useState(taskOptions[0] || '');
    const [newFrequency, setNewFrequency] = useState(3);
    const [coachingTips, setCoachingTips] = useState<{ [key: number]: string }>({});
    const [isLoadingTip, setIsLoadingTip] = useState<number | null>(null);

    const handleAddGoal = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTask && newFrequency > 0) {
            onAddGoal({ task: newTask, frequency: newFrequency, period: 'week' });
        }
    };
    
    const handleGetCoachingTip = async (goal: Goal) => {
        setIsLoadingTip(goal.id);
        const toastId = toast.loading('Getting your tip...');
        try {
            const progress = calculateGoalProgress(goal, days);
            const daysLeft = 7 - new Date().getDay();
            const tip = await getAICoachingTip(goal, progress, daysLeft);
            if (tip) {
                setCoachingTips(prev => ({ ...prev, [goal.id]: tip }));
                toast.success("Here's a tip!", { id: toastId });
            }
        } catch(e) {
            toast.error("Could not get coaching tip.", { id: toastId });
        } finally {
            setIsLoadingTip(null);
        }
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg space-y-6">
            <div className="flex items-center gap-4">
                <span className="text-3xl">🎯</span>
                <div>
                    <h3 className="text-xl font-bold text-gray-800">My Goals</h3>
                    <p className="text-gray-500">Set weekly goals and get AI coaching.</p>
                </div>
            </div>

            {/* Goal List */}
            <div className="space-y-4">
                {goals.length > 0 ? goals.map(goal => {
                    const progress = calculateGoalProgress(goal, days);
                    const progressPercentage = Math.min((progress / goal.frequency) * 100, 100);
                    return (
                        <div key={goal.id} className="p-4 border rounded-lg space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-gray-800">{goal.task}</p>
                                    <p className="text-sm text-gray-500">{goal.frequency} times per week</p>
                                </div>
                                <button onClick={() => onDeleteGoal(goal.id)} className="p-1 text-gray-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">Progress</span>
                                    <span className="text-sm font-medium text-gray-700">{progress} / {goal.frequency}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                                </div>
                            </div>
                            {coachingTips[goal.id] && (
                                <p className="p-3 bg-blue-50 text-sm text-blue-800 rounded-md">{coachingTips[goal.id]}</p>
                            )}
                            <button onClick={() => handleGetCoachingTip(goal)} disabled={isLoadingTip === goal.id} className="w-full text-sm px-4 py-1.5 bg-blue-100 text-blue-700 font-semibold rounded-md hover:bg-blue-200 disabled:bg-gray-200">
                                {isLoadingTip === goal.id ? 'Thinking...' : 'Get Coaching Tip'}
                            </button>
                        </div>
                    )
                }) : <p className="text-center text-gray-500">You haven't set any goals yet. Add one below!</p>}
            </div>

            {/* Add Goal Form */}
            <form onSubmit={handleAddGoal} className="p-4 bg-gray-50 rounded-lg flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-grow w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task</label>
                    <select value={newTask} onChange={e => setNewTask(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                        {taskOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Times/Week</label>
                    <input type="number" min="1" value={newFrequency} onChange={e => setNewFrequency(parseInt(e.target.value, 10))} className="w-full p-2 border border-gray-300 rounded-md"/>
                </div>
                <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700">Add Goal</button>
            </form>
        </div>
    );
}

// New Dashboard Component
function Dashboard({ days, taskOptions, goals, onAddGoal, onDeleteGoal }: { days: Day[], taskOptions: string[], goals: Goal[], onAddGoal: (goal: Omit<Goal, 'id'>) => void, onDeleteGoal: (id: number) => void }) {
  const [activeTab, setActiveTab] = useState('streaks');

  const renderContent = () => {
    switch (activeTab) {
      case 'insights':
        return <WeeklySummary days={days} taskOptions={taskOptions} />;
      case 'goals':
        return <GoalCoaching goals={goals} onAddGoal={onAddGoal} onDeleteGoal={onDeleteGoal} days={days} taskOptions={taskOptions} />;
      case 'streaks':
      default:
        return days.length > 0 ? <StreakCounter days={days} /> : <div className="text-center py-10"><p className="text-gray-500">Track your first day to see your streaks!</p></div>;
    }
  };

  const TabButton = ({ tabId, label, icon }: { tabId: string, label: string, icon: string }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`flex-1 sm:flex-none px-4 py-3 text-sm sm:text-base font-bold text-center transition-colors duration-200 ${
        activeTab === tabId
          ? 'text-indigo-600 border-b-4 border-indigo-600 bg-indigo-50'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-b-4 border-transparent'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="flex border-b border-gray-200">
        <TabButton tabId="streaks" label="Streaks" icon="🔥" />
        <TabButton tabId="insights" label="Insights" icon="📊" />
        <TabButton tabId="goals" label="Goals" icon="🎯" />
      </div>
      <div className="p-0">
        {renderContent()}
      </div>
    </div>
  );
}

function NotificationControl({ permission, onRequestPermission }: { permission: string, onRequestPermission: () => void }) {
    const isEnabled = permission === 'granted';
    const isDisabled = permission === 'denied';

    return (
        <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                Reminders
            </span>
            <label htmlFor="notification-toggle" className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    id="notification-toggle" 
                    className="sr-only peer" 
                    checked={isEnabled}
                    disabled={isDisabled}
                    onChange={onRequestPermission}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
        </div>
    );
}

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
        return { title: "Good Morning!", subtitle: "Seize the day and make it yours." };
    }
    if (hour < 17) {
        return { title: "Good Afternoon!", subtitle: "Keep up the great momentum." };
    }
    return { title: "Good Evening!", subtitle: "Time to reflect and unwind." };
};


export default function App() {
    const [days, setDays] = useState<Day[]>(() => {
        try { const savedDays = localStorage.getItem('dayTrackerData'); return savedDays ? JSON.parse(savedDays) : []; } catch (error) { console.error("Could not parse data from localStorage", error); return []; }
    });

    const [taskOptions, setTaskOptions] = useState<string[]>(() => {
        try { const savedTasks = localStorage.getItem('dayTrackerTasks'); return savedTasks ? JSON.parse(savedTasks) : initialTaskOptions; } catch (error) { console.error("Could not parse tasks from localStorage", error); return initialTaskOptions; }
    });

    const [goals, setGoals] = useState<Goal[]>(() => {
        try { const savedGoals = localStorage.getItem('dayTrackerGoals'); return savedGoals ? JSON.parse(savedGoals) : []; } catch (error) { console.error("Could not parse goals from localStorage", error); return []; }
    });

    const [selectedDay, setSelectedDay] = useState<Day | null>(null);
    const [dayToDelete, setDayToDelete] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState('default');
    const [dailyPlan, setDailyPlan] = useState<string[] | null>(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

    useEffect(() => {
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    useNotificationReminder(days, notificationPermission);

    useEffect(() => { localStorage.setItem('dayTrackerData', JSON.stringify(days)); }, [days]);
    useEffect(() => { localStorage.setItem('dayTrackerTasks', JSON.stringify(taskOptions)); }, [taskOptions]);
    useEffect(() => { localStorage.setItem('dayTrackerGoals', JSON.stringify(goals)); }, [goals]);

    const handleOpenModal = (day: Day) => { setSelectedDay(day); };
    const handleCloseModal = () => { setSelectedDay(null); };

    const handleSaveDay = (updatedDay: Day) => {
        setDays(prevDays => {
            const dayExists = prevDays.some(d => d.date === updatedDay.date);
            if (dayExists) { return prevDays.map(d => d.date === updatedDay.date ? updatedDay : d).sort((a: Day, b: Day) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
            else { return [...prevDays, updatedDay].sort((a: Day, b: Day) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
        });
    };
    
    const handleAddDay = (date: string) => {
        const dayExists = days.some(d => d.date === date);
        if (dayExists) { 
            toast.error("This day already exists on your dashboard.");
            return; 
        }
        // Determine weekday
        const jsDate = new Date(date + 'T00:00:00');
        const weekday = jsDate.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

        let scrumActivity: Activity | null = null;
        if (weekday >= 1 && weekday <= 4) { // Mon-Thurs
            scrumActivity = {
                id: Date.now(),
                task: "Office Meeting Scrum",
                startTime: "12:30 PM",
                endTime: "1:00 PM"
            };
        } else if (weekday === 5) { // Friday
            scrumActivity = {
                id: Date.now(),
                task: "Office Meeting Scrum",
                startTime: "12:00 PM",
                endTime: "12:30 PM"
            };
        }

        const newDay: Day = { 
            date: date, 
            activities: scrumActivity ? [scrumActivity] : [] 
        };
        handleOpenModal(newDay);
    };

    const handleDeleteRequest = (date: string) => { setDayToDelete(date); };
    const handleConfirmDelete = () => { if (dayToDelete) { setDays(prevDays => prevDays.filter(day => day.date !== dayToDelete)); setDayToDelete(null); toast.success('Day deleted!'); } };
    const handleAddNewTask = (newTask: string) => { if (!taskOptions.includes(newTask)) { setTaskOptions(prev => [...prev, newTask]); toast.success(`New task added: ${newTask}`); } };
    
    const handleAddGoal = (newGoal: Omit<Goal, 'id'>) => {
        const goalToAdd: Goal = { ...newGoal, id: Date.now() };
        setGoals(prev => [...prev, goalToAdd]);
    };

    const handleDeleteGoal = (id: number) => {
        const goalToRemove = goals.find(g => g.id === id);
        setGoals(prev => prev.filter(g => g.id !== id));
        if(goalToRemove) toast.error(`Goal removed: ${goalToRemove.task}`);
    };
    
    const handleRequestNotificationPermission = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if(permission === 'granted') {
                toast.success("Reminder notifications enabled!");
            } else {
                toast.error("Reminder notifications are disabled.");
            }
        }
    };

    const handleGeneratePlan = async () => {
        const toastId = toast.loading('Generating your daily plan...');
        try {
            const plan = await getAIDailyPlan(days, goals);
            setDailyPlan(plan);
            setIsPlanModalOpen(true);
            toast.success('Your plan is ready!', { id: toastId });
        } catch (error) {
            toast.error('Could not generate a plan right now.', { id: toastId });
        }
    };

    const sortedDays = useMemo(() => {
        return [...days].sort((a: Day, b: Day) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [days]);

    const greeting = getGreeting();

    // --- Calculate overall time metrics ---
    const allActivities = days.flatMap(d => d.activities);

const totalSleepMinutes = allActivities
    .filter(a => a.task === "Sleep" || a.task === "Small Nap")
    .reduce((sum, a) => sum + calculateDurationInMinutes(a.startTime, a.endTime), 0);

const productiveTasks = ['Office work', 'Video call', 'Office Meeting Scrum', 'Read book', 'Self Learning', 'Exercise'];
const nonProductiveTasks = ['Watch TV', 'Rest', 'Small Nap', 'Call', 'Dinner', 'Lunch', 'Breakfast'];

const totalProductiveMinutes = allActivities
    .filter(a => productiveTasks.includes(a.task))
    .reduce((sum, a) => sum + calculateDurationInMinutes(a.startTime, a.endTime), 0);

const totalNonProductiveMinutes = allActivities
    .filter(a => nonProductiveTasks.includes(a.task))
    .reduce((sum, a) => sum + calculateDurationInMinutes(a.startTime, a.endTime), 0);

const totalLoggedMinutes = allActivities
    .reduce((sum, a) => sum + calculateDurationInMinutes(a.startTime, a.endTime), 0);

// Assume a day is 24 hours * number of days tracked
const totalDayMinutes = days.length * 24 * 60;
const totalIdleMinutes = Math.max(0, totalDayMinutes - totalLoggedMinutes);

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <Toaster position="top-center" reverseOrder={false} />
            {selectedDay && <DayModal day={selectedDay} allDays={days} onClose={handleCloseModal} onSave={handleSaveDay} taskOptions={taskOptions} onAddNewTask={handleAddNewTask} />}
            <ConfirmationModal isOpen={!!dayToDelete} onClose={() => setDayToDelete(null)} onConfirm={handleConfirmDelete} message="Are you sure you want to delete this day's log? This action cannot be undone." />
            {isPlanModalOpen && dailyPlan && (
                <div className="fixed inset-0  bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Your AI-Generated Daily Plan 🚀</h3>
                        <ul className="space-y-2">
                            {dailyPlan.map((item, index) => (
                                <li key={index} className="flex items-start gap-3">
                                    <span className="text-indigo-500 font-bold">✓</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <button onClick={() => setIsPlanModalOpen(false)} className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700">
                            Got it!
                        </button>
                    </div>
                </div>
            )}


            <div className="container mx-auto p-4 sm:p-6 lg:p-8 relative">
                <header className="text-center my-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-800">{greeting.title}</h1>
                    <p className="text-lg text-gray-500 mt-2">{greeting.subtitle}</p>
                </header>
                
                <div className="absolute top-0 right-4 sm:right-6 lg:right-8">
                    <NotificationControl permission={notificationPermission} onRequestPermission={handleRequestNotificationPermission} />
                </div>

                <div className="space-y-8">
                    <AddNewDay onAddDay={handleAddDay} />
                    
                    <button onClick={handleGeneratePlan} className="w-full p-4 bg-teal-500 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-teal-600 transition-colors">
                        🤖 Plan My Day with AI
                    </button>

                    <Dashboard 
                        days={days}
                        taskOptions={taskOptions}
                        goals={goals}
                        onAddGoal={handleAddGoal}
                        onDeleteGoal={handleDeleteGoal}
                    />
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

            {/* Metrics Section */}
            {days.length > 0 && (
                <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Your Weekly Metrics</h2>
                        <div className="flex flex-col sm:flex-row gap-6">
                            <MetricsRing
                                value={totalSleepMinutes}
                                max={totalDayMinutes}
                                label="Total Sleep"
                                color="#6366f1"
                                subLabel="(Sleep + Nap)"
                            />
                            <MetricsRing
                                value={totalProductiveMinutes}
                                max={totalLoggedMinutes}
                                label="Productive"
                                color="#10b981"
                                subLabel="Work & Growth"
                            />
                            <MetricsRing
                                value={totalIdleMinutes}
                                max={totalDayMinutes}
                                label="Idle Time"
                                color="#f59e42"
                                subLabel="Unaccounted"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricsRing({ value, max, label, color, subLabel }: { value: number, max: number, label: string, color: string, subLabel?: string }) {
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const percent = max > 0 ? value / max : 0;
    const offset = circumference * (1 - percent);

    return (
        <div className="flex flex-col items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={radius} stroke="#e5e7eb" strokeWidth="8" fill="none" />
                <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    stroke={color}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                />
            </svg>
            <div className="mt-2 text-center">
                <div className="text-lg font-bold">{label}</div>
                <div className="text-sm text-gray-500">{subLabel}</div>
                <div className="text-xl font-extrabold mt-1">{formatDuration(value)}</div>
            </div>
        </div>
    );
}

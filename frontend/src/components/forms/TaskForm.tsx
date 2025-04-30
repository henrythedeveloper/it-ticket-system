// src/pages/dashboard/TasksPage.tsx // <- File path likely incorrect in error message, should be TaskForm.tsx
// ==========================================================================
// Component rendering the form for creating or editing tasks.
// Refactored to use the useFormSubmit hook.
// **REVISED**: Added conditional UI for BYDAY (weekly) and BYMONTHDAY (monthly).
// ==========================================================================

import React, { useState, useEffect } from 'react';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Custom hook
import { Task, User, TaskStatus } from '../../types'; // Import types
import { createTask, updateTask } from '../../services/taskService'; // API service calls

// --- Component Props ---
interface TaskFormProps {
    task?: Task | null;
    ticketId?: string | null;
    onSaveSuccess: (savedTask: Task) => void;
    onCancel: () => void;
    assignableUsers: Pick<User, 'id' | 'name'>[];
}

// --- Constants for Recurrence ---
type RecurrenceFrequency = '' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
const frequencyOptions: { value: RecurrenceFrequency; label: string }[] = [
    { value: '', label: 'Does not repeat' },
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'YEARLY', label: 'Yearly' },
];
const daysOfWeek = [
    { value: 'SU', label: 'Sun' }, { value: 'MO', label: 'Mon' }, { value: 'TU', label: 'Tue' },
    { value: 'WE', label: 'Wed' }, { value: 'TH', label: 'Thu' }, { value: 'FR', label: 'Fri' },
    { value: 'SA', label: 'Sat' }
];

// --- Form Input Data Structure ---
interface TaskFormInputs {
    title: string;
    description: string;
    status: TaskStatus;
    dueDate: string;
    assignedToId: string;
    // Recurrence State
    isRecurring: boolean;
    recurrenceFrequency: RecurrenceFrequency;
    recurrenceInterval: number;
    recurrenceDaysOfWeek: string[]; // e.g., ['MO', 'WE', 'FR']
    recurrenceDayOfMonth: number; // e.g., 15
    // TODO: Add state for more complex rules (BYSETPOS, Nth weekday)
}

// --- API Payload Structure ---
interface TaskApiPayload {
    title: string;
    description?: string;
    status: TaskStatus;
    dueDate?: string | null;
    assignedToId?: string | null;
    ticketId?: string | null;
    isRecurring?: boolean;
    recurrenceRule?: string | null;
}

// --- Component ---
const TaskForm: React.FC<TaskFormProps> = ({
    task,
    ticketId,
    onSaveSuccess,
    onCancel,
    assignableUsers
}) => {
    // --- Mode ---
    const isEditMode = !!task;

    // --- State ---
    const [formData, setFormData] = useState<TaskFormInputs>({
        title: '', description: '', status: 'Open', dueDate: '', assignedToId: '',
        isRecurring: false,
        recurrenceFrequency: '',
        recurrenceInterval: 1,
        recurrenceDaysOfWeek: [], // Initialize as empty array
        recurrenceDayOfMonth: 1, // Default to 1st
    });

    // --- Custom Hook for Submission ---
    const submitApiCall = (data: TaskApiPayload): Promise<Task> => {
        if (isEditMode && task) { return updateTask(task.id, data); }
        else { return createTask(data); }
    };
    const { submit: saveTask, isLoading, error, clearError } = useFormSubmit<TaskApiPayload, Task>(
        submitApiCall,
        { onSuccess: onSaveSuccess, onError: (err) => console.error("Task save failed:", err) }
    );

    // --- Effects ---
    useEffect(() => {
        let initialState: TaskFormInputs = {
            title: '', description: '', status: 'Open', dueDate: '', assignedToId: '',
            isRecurring: false, recurrenceFrequency: '', recurrenceInterval: 1,
            recurrenceDaysOfWeek: [], recurrenceDayOfMonth: 1,
        };

        if (isEditMode && task) {
            initialState = {
                ...initialState,
                title: task.title || '',
                description: task.description || '',
                status: task.status || 'Open',
                dueDate: task.due_date ? task.due_date.split('T')[0] : '',
                assignedToId: task.assignedTo?.id || '',
                isRecurring: task.is_recurring || false,
            };

            // Basic RRULE parsing (can be improved)
            if (task.recurrence_rule) {
                const parts = task.recurrence_rule.split(';');
                parts.forEach(part => {
                    const [key, value] = part.split('=');
                    if (key === 'FREQ') initialState.recurrenceFrequency = value as RecurrenceFrequency;
                    if (key === 'INTERVAL') initialState.recurrenceInterval = parseInt(value, 10) || 1;
                    if (key === 'BYDAY') initialState.recurrenceDaysOfWeek = value.split(',');
                    if (key === 'BYMONTHDAY') initialState.recurrenceDayOfMonth = parseInt(value, 10) || 1;
                });
                // Ensure isRecurring matches parsed frequency
                if (initialState.recurrenceFrequency) initialState.isRecurring = true;
            }
        }
        setFormData(initialState);
        clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, task]);

    // --- Handlers ---
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const isNumber = type === 'number';
        const targetValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;

        setFormData((prev) => {
            const newState = {
                ...prev,
                [name]: isNumber ? (parseInt(value, 10) || 1) : targetValue, // Parse number for interval/dayOfMonth
            };

            // --- Logic based on field changed ---
            if (name === 'recurrenceFrequency') {
                newState.isRecurring = !!targetValue; // Set isRecurring based on frequency
                // Reset other recurrence fields when frequency changes
                newState.recurrenceDaysOfWeek = [];
                newState.recurrenceDayOfMonth = 1;
                if (!targetValue) newState.recurrenceInterval = 1; // Reset interval if frequency is cleared
            }

            return newState;
        });

        if (error) clearError();
    };

    // Handler specifically for day of week toggles
    const handleDayOfWeekToggle = (dayValue: string) => {
        setFormData(prev => {
            const currentDays = prev.recurrenceDaysOfWeek;
            const newDays = currentDays.includes(dayValue)
                ? currentDays.filter(d => d !== dayValue)
                : [...currentDays, dayValue];
            return { ...prev, recurrenceDaysOfWeek: newDays };
        });
        if (error) clearError();
    };

    // --- RRULE String Construction ---
    const constructRecurrenceRule = (): string | null => {
        if (!formData.recurrenceFrequency) { // Use frequency to determine recurrence
            return null;
        }
        let ruleParts: string[] = [`FREQ=${formData.recurrenceFrequency}`];
        if (formData.recurrenceInterval > 1) {
            ruleParts.push(`INTERVAL=${formData.recurrenceInterval}`);
        }
        // Add BYDAY for weekly recurrence
        if (formData.recurrenceFrequency === 'WEEKLY' && formData.recurrenceDaysOfWeek.length > 0) {
            ruleParts.push(`BYDAY=${formData.recurrenceDaysOfWeek.join(',')}`);
        }
        // Add BYMONTHDAY for monthly recurrence
        if (formData.recurrenceFrequency === 'MONTHLY') {
            // Basic implementation: uses BYMONTHDAY
            // TODO: Add UI and logic for "Nth weekday of month" (BYDAY=1MO, BYDAY=-1FR etc.)
            if (formData.recurrenceDayOfMonth >= 1 && formData.recurrenceDayOfMonth <= 31) {
                 ruleParts.push(`BYMONTHDAY=${formData.recurrenceDayOfMonth}`);
            }
        }
        // TODO: Add logic for other RRULE parts (BYMONTH, BYSETPOS, UNTIL/COUNT etc.)

        return ruleParts.join(';');
    };

    // --- Form Submission Handler ---
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const recurrenceRuleString = constructRecurrenceRule();
        const taskDataPayload: TaskApiPayload = {
            title: formData.title,
            description: formData.description || undefined,
            status: formData.status,
            dueDate: formData.dueDate || null,
            assignedToId: formData.assignedToId || null,
            isRecurring: !!formData.recurrenceFrequency, // Determine from frequency
            recurrenceRule: recurrenceRuleString,
            ticketId: isEditMode ? task?.task_id : ticketId || null,
        };
        console.log('[TaskForm] Submitting payload:', taskDataPayload);
        saveTask(taskDataPayload);
    };

    // --- Options ---
    const statusOptions: { value: TaskStatus; label: string }[] = [
        { value: 'Open', label: 'Open' }, { value: 'In Progress', label: 'In Progress' }, { value: 'Completed', label: 'Completed' },
    ];
    const assigneeOptions = [
        { value: '', label: 'Unassigned' },
        ...assignableUsers.map(user => ({ value: user.id, label: user.name })),
    ];

    // --- Render ---
    return (
        <form onSubmit={handleSubmit} className="task-form">
            {error && <Alert type="error" message={error} className="mb-4" />}

            <Input label="Task Title" id="title" name="title" value={formData.title} onChange={handleChange} required disabled={isLoading} containerClassName="mb-4" />
            <Textarea label="Description (Optional)" id="description" name="description" value={formData.description} onChange={handleChange} rows={4} disabled={isLoading} containerClassName="mb-4" />
            <div className="form-row">
                <Select label="Status" id="status" name="status" options={statusOptions} value={formData.status} onChange={handleChange} required disabled={isLoading} />
                <Select label="Assign To (Optional)" id="assignedToId" name="assignedToId" options={assigneeOptions} value={formData.assignedToId} onChange={handleChange} disabled={isLoading} placeholder="Select Assignee..." />
            </div>
            <Input label="Due Date (Optional)" id="dueDate" name="dueDate" type="date" value={formData.dueDate} onChange={handleChange} disabled={isLoading} containerClassName="mb-4"/>

            {/* --- Recurrence Section --- */}
            <fieldset className="recurrence-fieldset">
                <legend>Recurrence</legend>
                <div className="form-row recurrence-controls"> {/* Added class */}
                    <Select
                        label="Repeats" // Changed label
                        id="recurrenceFrequency"
                        name="recurrenceFrequency"
                        options={frequencyOptions}
                        value={formData.recurrenceFrequency}
                        onChange={handleChange}
                        disabled={isLoading}
                        containerClassName="recurrence-frequency"
                    />
                    {/* Interval Input - Show only if frequency is selected */}
                    {formData.recurrenceFrequency && (
                         <Input
                            label={`Every ( ${formData.recurrenceFrequency.toLowerCase()} )`} // Dynamic label
                            id="recurrenceInterval"
                            name="recurrenceInterval"
                            type="number"
                            value={formData.recurrenceInterval.toString()}
                            onChange={handleChange}
                            min="1"
                            disabled={isLoading}
                            containerClassName="recurrence-interval"
                        />
                    )}
                 </div>

                 {/* --- Conditional UI for Weekly --- */}
                {formData.recurrenceFrequency === 'WEEKLY' && (
                    <div className="form-group recurrence-weekly-options">
                         <label>On Days</label>
                        <div className="day-selector">
                            {daysOfWeek.map(day => (
                                <button
                                    key={day.value}
                                    type="button" // Important: prevent form submission
                                    className={`day-button ${formData.recurrenceDaysOfWeek.includes(day.value) ? 'selected' : ''}`}
                                    onClick={() => handleDayOfWeekToggle(day.value)}
                                    disabled={isLoading}
                                    aria-pressed={formData.recurrenceDaysOfWeek.includes(day.value)}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- Conditional UI for Monthly --- */}
                {formData.recurrenceFrequency === 'MONTHLY' && (
                    <div className="form-group recurrence-monthly-options">
                        {/* Basic implementation: Day of the month */}
                         <Input
                            label="On Day of Month"
                            id="recurrenceDayOfMonth"
                            name="recurrenceDayOfMonth"
                            type="number"
                            value={formData.recurrenceDayOfMonth.toString()}
                            onChange={handleChange}
                            min="1"
                            max="31"
                            disabled={isLoading}
                            containerClassName="recurrence-day-month"
                        />
                        {/* TODO: Add radio buttons/selects for "Nth Weekday" option */}
                    </div>
                )}

            </fieldset>
            {/* --- End Recurrence Section --- */}


            {/* Form Actions */}
            <div className="form-actions mt-6">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}>
                    {isLoading ? (isEditMode ? 'Saving Task...' : 'Creating Task...') : (isEditMode ? 'Save Changes' : 'Create Task')}
                </Button>
            </div>
        </form>
    );
};

export default TaskForm;
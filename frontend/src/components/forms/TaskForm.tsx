// src/components/forms/TaskForm.tsx
// ==========================================================================
// Component rendering the form for creating or editing tasks.
// Refactored to use the useFormSubmit hook.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Select from '../common/Select';
import Button from '../common/Button';
import Alert from '../common/Alert';
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

// --- Form Input Data Structure ---
interface TaskFormInputs {
    title: string;
    description: string;
    status: TaskStatus;
    dueDate: string; // Store as yyyy-MM-dd string
    assignedToId: string; // Store ID, empty string if unassigned
}

// --- API Payload Structure --- (May differ slightly from form state)
interface TaskApiPayload {
    title: string;
    description?: string;
    status: TaskStatus;
    dueDate?: string | null; // API might expect null for empty
    assignedToId?: string | null; // API might expect null for empty
    ticketId?: string | null;
}

// --- Component ---

/**
 * Renders a form for creating or editing tasks using the useFormSubmit hook.
 *
 * @param {TaskFormProps} props - The component props.
 * @returns {React.ReactElement} The rendered TaskForm component.
 */
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
    });

    // --- Custom Hook for Submission ---
    // Define the submission function that calls the correct API
    const submitApiCall = (data: TaskApiPayload): Promise<Task> => {
        if (isEditMode && task) {
            return updateTask(task.id, data);
        } else {
            return createTask(data);
        }
    };

    const {
    submit: saveTask,
    isLoading,
    error,
    clearError,
    // successMessage is not needed as we call onSaveSuccess which likely closes the form
    } = useFormSubmit<TaskApiPayload, Task>(
        submitApiCall,
        {
            onSuccess: (savedTask) => {
                onSaveSuccess(savedTask); // Notify parent component
            },
            onError: (err) => {
                console.error("Failed to save task (hook callback):", err);
                // Error message handled by hook state
            },
        }
    );

    // --- Effects ---
    // Pre-fill form if in edit mode
    useEffect(() => {
    if (isEditMode && task) {
        setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'Open',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        assignedToId: task.assignedTo?.id || '',
        });
    } else {
        // Reset form for create mode if task becomes null
        setFormData({ title: '', description: '', status: 'Open', dueDate: '', assignedToId: '' });
    }
    clearError(); // Clear error when task changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, task]); // Depend on isEditMode and task

    // --- Handlers ---
    /**
     * Handles changes in form input/select/textarea fields. Clears hook error.
     */
    const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) clearError();
    };

    /**
     * Handles form submission by preparing payload and calling the hook's submit function.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prepare payload matching the API structure
    const taskDataPayload: TaskApiPayload = {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        dueDate: formData.dueDate || null,
        assignedToId: formData.assignedToId || null,
        ticketId: ticketId || null, // Include ticketId if provided
    };

    saveTask(taskDataPayload); // Call the hook's submit function
    };

    // --- Options ---
    const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'Open', label: 'Open' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Completed', label: 'Completed' },
    ];

    const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...assignableUsers.map(user => ({ value: user.id, label: user.name })),
    ];

    // --- Render ---
    return (
    <form onSubmit={handleSubmit} className="task-form">
        {error && <Alert type="error" message={error} className="mb-4" />}

        {/* Title Input */}
        <Input
        label="Task Title" id="title" name="title" value={formData.title}
        onChange={handleChange} required disabled={isLoading} containerClassName="mb-4"
        />

        {/* Description Textarea */}
        <Textarea
        label="Description (Optional)" id="description" name="description" value={formData.description}
        onChange={handleChange} rows={4} disabled={isLoading} containerClassName="mb-4"
        />

        {/* Status Select */}
        <Select
        label="Status" id="status" name="status" options={statusOptions} value={formData.status}
        onChange={handleChange} required disabled={isLoading} containerClassName="mb-4"
        />

        {/* Assignee Select */}
        <Select
        label="Assign To (Optional)" id="assignedToId" name="assignedToId" options={assigneeOptions}
        value={formData.assignedToId} onChange={handleChange} disabled={isLoading}
        containerClassName="mb-4" placeholder="Select Assignee..."
        />

        {/* Due Date Input */}
        <Input
        label="Due Date (Optional)" id="dueDate" name="dueDate" type="date" value={formData.dueDate}
        onChange={handleChange} disabled={isLoading} containerClassName="mb-6"
        />

        {/* Form Actions */}
        <div className="form-actions">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}>
            {isLoading ? (isEditMode ? 'Saving Task...' : 'Creating Task...') : (isEditMode ? 'Save Changes' : 'Create Task')}
        </Button>
        </div>
    </form>
    );
};

export default TaskForm;

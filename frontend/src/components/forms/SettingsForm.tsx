// src/components/forms/SettingsForm.tsx
// ==========================================================================
// Component rendering the form for application settings (Admin only).
// Handles potentially complex settings structures.
// Refactored to use the useFormSubmit hook and fix array updates.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import { AppSettings, NotificationSettings, TicketSettings } from '../../types'; // Adjust path if needed
import Input from '../common/Input'; // Reusable Input component
import Button from '../common/Button'; // Reusable Button component
import Alert from '../common/Alert'; // Reusable Alert component
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Import the custom hook
// import Checkbox from '../common/Checkbox'; // Assuming a Checkbox component exists
// import { fetchSettings, updateSettings } from '../../services/settingsService'; // Example API service


// --- Component Props ---
interface SettingsFormProps {
    initialSettings: AppSettings; // Pre-load settings
    onSaveSuccess: (savedSettings: AppSettings) => void; // Callback on success
}

// --- Mock API Function (Replace with actual service call) ---
const mockUpdateSettings = async (settings: AppSettings): Promise<AppSettings> => {
    console.log("Mock API: Saving settings...", settings);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Simulate potential error
    // if (Math.random() > 0.8) {
    //     throw new Error("Simulated server error saving settings!");
    // }
    // Return the saved settings (or response from backend)
    return settings;
};

// --- Component ---

/**
 * Renders a form for administrators to configure application settings.
 * Handles fetching initial settings and saving updates using the useFormSubmit hook.
 *
 * @param {SettingsFormProps} props - The component props.
 * @returns {React.ReactElement} The rendered SettingsForm component.
 */
const SettingsForm: React.FC<SettingsFormProps> = ({ initialSettings, onSaveSuccess }) => {
    // --- State ---
    const [settings, setSettings] = useState<AppSettings>(initialSettings);
    const [newIssueType, setNewIssueType] = useState<string>(''); // For adding new issue types

    // --- Custom Hook for Submission ---
    const {
    submit: saveSettings, // Renamed 'submit' to 'saveSettings' for clarity
    isLoading,
    error,
    successMessage,
    clearError,
    clearSuccessMessage,
    } = useFormSubmit<AppSettings, AppSettings>(
    mockUpdateSettings,
    {
        onSuccess: (savedSettings) => {
        console.log("Hook Success Callback: Settings saved", savedSettings);
        onSaveSuccess(savedSettings); // Notify parent component
        },
        onError: (err) => {
        console.error("Hook Error Callback: Failed to save settings", err);
        },
        successMessage: 'Settings saved successfully!', // Message to display on success
    }
    );

    // --- Effects ---
    // Update local state if initialSettings prop changes
    useEffect(() => {
    setSettings(initialSettings);
    }, [initialSettings]);

    // --- Handlers ---
    /**
     * Handles changes in simple input/select fields within nested settings.
     * Clears hook messages/errors on change.
     */
    const handleSettingChange = (
    section: keyof AppSettings,
    field: keyof NotificationSettings | keyof Omit<TicketSettings, 'issueTypes'>, // Exclude issueTypes here
    value: string | boolean // Only string or boolean expected now
    ) => {
    setSettings(prev => ({
        ...prev,
        [section]: {
        ...(prev[section] as object),
        [field]: value,
        },
    }));
    // Clear feedback messages from the hook when user makes changes
    if (error) clearError();
    if (successMessage) clearSuccessMessage();
    };

    /**
     * Handles changes specifically for checkbox inputs.
     */
    const handleCheckboxChange = (
    section: keyof AppSettings,
    field: keyof NotificationSettings | keyof Omit<TicketSettings, 'issueTypes'>,
    checked: boolean
    ) => {
    handleSettingChange(section, field, checked);
    };

    /**
     * Adds a new issue type to the list directly using setSettings.
     */
    const handleAddIssueType = () => {
    const trimmedType = newIssueType.trim();
    if (trimmedType && !settings.tickets.issueTypes.includes(trimmedType)) {
        // FIX: Update state directly for arrays
        setSettings(prev => ({
            ...prev,
            tickets: {
                ...prev.tickets,
                issueTypes: [...prev.tickets.issueTypes, trimmedType]
            }
        }));
        setNewIssueType(''); // Clear input field
        if (error) clearError(); // Clear messages on change
        if (successMessage) clearSuccessMessage();
    }
    };

    /**
     * Removes an issue type from the list directly using setSettings.
     * @param typeToRemove - The issue type string to remove.
     */
    const handleRemoveIssueType = (typeToRemove: string) => {
        // FIX: Update state directly for arrays
        setSettings(prev => ({
            ...prev,
            tickets: {
                ...prev.tickets,
                issueTypes: prev.tickets.issueTypes.filter(type => type !== typeToRemove)
            }
        }));
        if (error) clearError(); // Clear messages on change
        if (successMessage) clearSuccessMessage();
    };

    /**
     * Handles form submission by calling the submit function from the hook.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveSettings(settings);
    };

    // --- Render ---
    return (
    <form onSubmit={handleSubmit} className="settings-form">
        {/* Display messages from the hook state */}
        {error && <Alert type="error" message={error} className="mb-4" />}
        {successMessage && <Alert type="success" message={successMessage} className="mb-4" />}

        {/* --- Notifications Section --- */}
        <div className="settings-section">
        <h2>Notification Settings</h2>
            {/* Placeholder using standard checkbox */}
            <div className="form-group checkbox mb-3">
            <label htmlFor="emailOnNewTicket">
                <input
                    type="checkbox"
                    id="emailOnNewTicket"
                    checked={settings.notifications.emailOnNewTicket}
                    // Use handleCheckboxChange for boolean updates
                    onChange={(e) => handleCheckboxChange('notifications', 'emailOnNewTicket', e.target.checked)}
                    disabled={isLoading}
                />
                Email on New Ticket Creation
            </label>
            </div>
            <div className="form-group checkbox mb-3">
            <label htmlFor="emailOnAssignment">
                <input
                    type="checkbox"
                    id="emailOnAssignment"
                    checked={settings.notifications.emailOnAssignment}
                    onChange={(e) => handleCheckboxChange('notifications', 'emailOnAssignment', e.target.checked)}
                    disabled={isLoading}
                />
                Email on Ticket Assignment
            </label>
            </div>
            <div className="form-group checkbox mb-3">
            <label htmlFor="emailOnUpdate">
                <input
                    type="checkbox"
                    id="emailOnUpdate"
                    checked={settings.notifications.emailOnUpdate}
                    onChange={(e) => handleCheckboxChange('notifications', 'emailOnUpdate', e.target.checked)}
                    disabled={isLoading}
                />
                Email on Ticket Update/Comment
            </label>
            </div>
        </div>

        {/* --- Ticket Management Section --- */}
        <div className="settings-section">
        <h2>Ticket Management</h2>
            {/* Placeholder using standard select */}
            <div className="form-group mb-4">
            <label htmlFor="defaultUrgency">Default Ticket Urgency</label>
            <select
                id="defaultUrgency"
                value={settings.tickets.defaultUrgency}
                // Use handleSettingChange for string updates
                onChange={(e) => handleSettingChange('tickets', 'defaultUrgency', e.target.value)}
                disabled={isLoading}
            >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
            </select>
            </div>

            {/* Example Checkbox */}
            <div className="form-group checkbox mb-5">
            <label htmlFor="allowPublicSubmission">
                <input
                    type="checkbox"
                    id="allowPublicSubmission"
                    checked={settings.tickets.allowPublicSubmission}
                    // Use handleCheckboxChange for boolean updates
                    onChange={(e) => handleCheckboxChange('tickets', 'allowPublicSubmission', e.target.checked)}
                    disabled={isLoading}
                />
                Allow Public Ticket Submission
            </label>
            </div>

            {/* Issue Types Management */}
            <div className="form-group">
                <label htmlFor="issueTypes">Manage Issue Types/Categories</label>
                <div className="issue-types-list">
                    {settings.tickets.issueTypes.map(type => (
                        <div key={type} className="issue-type-item">
                            <span>{type}</span>
                            <button
                            type="button"
                            onClick={() => handleRemoveIssueType(type)} // Uses direct state update
                            className="remove-btn"
                            aria-label={`Remove ${type}`}
                            disabled={isLoading}
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
                <div className="input-with-button mt-3">
                    <Input
                    label="" // Label handled by group label above
                    id="newIssueType"
                    name="newIssueType"
                    type="text"
                    placeholder="Add new issue type"
                    value={newIssueType}
                    onChange={(e) => setNewIssueType(e.target.value)}
                    disabled={isLoading}
                    />
                    <Button
                    type="button"
                    onClick={handleAddIssueType} // Uses direct state update
                    disabled={isLoading || !newIssueType.trim()}
                    className="add-btn"
                    >
                        Add
                    </Button>
                </div>
            </div>
        </div>

        {/* --- Form Actions --- */}
        <div className="form-actions mt-8">
        <Button
            type="submit"
            variant="primary"
            isLoading={isLoading} // Use isLoading from the hook
            disabled={isLoading}
            className="submit-btn"
        >
            {isLoading ? 'Saving Settings...' : 'Save Settings'}
        </Button>
        </div>
    </form>
    );
};

export default SettingsForm;
